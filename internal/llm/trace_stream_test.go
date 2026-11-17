package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"testing"

	"test-driven-study/internal/testsupport"
	"time"

	"test-driven-study/internal/storage/storedb"
	"test-driven-study/internal/tasktrace"
)

func tracedContext(t *testing.T) (context.Context, *storedb.Queries) {
	t.Helper()
	options := testOptions(t, "http://127.0.0.1:1/v1")
	queries := storedb.New(options.DB)
	err := queries.CreatePalaceJob(context.Background(), storedb.CreatePalaceJobParams{
		ID: "trace", QuestionID: 4, SubjectID: 1, SnapshotJson: "{}"})
	if err != nil {
		t.Fatal(err)
	}
	return tasktrace.With(context.Background(), queries, "trace"), queries
}
func recordedRows(t *testing.T, q *storedb.Queries) []storedb.TaskTraceEvent {
	t.Helper()
	rows, err := q.ListTraceEvents(context.Background(), storedb.ListTraceEventsParams{JobID: "trace"})
	if err != nil {
		t.Fatal(err)
	}
	return rows
}

func TestTraceOnlyRecordsPublicSummariesAndDistinguishesArgumentReadiness(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	ctx, queries := tracedContext(t)
	observer := newStreamTrace(ctx)
	for _, event := range []string{
		`{"type":"response.output_item.added","item":{"id":"r","type":"reasoning","encrypted_content":"PRIVATE-OPAQUE"}}`,
		`{"type":"response.reasoning_text.delta","item_id":"r","delta":"PRIVATE-REASONING"}`,
		`{"type":"response.reasoning_summary_text.delta","item_id":"r","delta":"Public "}`,
		`{"type":"response.reasoning_summary_text.done","item_id":"r","text":"Public "}`,
		`{"type":"response.output_item.added","item":{"id":"f","type":"function_call","arguments":"PRIVATE-ARGS"}}`,
		`{"type":"response.function_call_arguments.done","item_id":"f","arguments":"PRIVATE-ARGS"}`,
		`{"type":"response.web_search_call.in_progress","item_id":"w"}`,
		`{"type":"response.web_search_call.completed","item_id":"w"}`,
		`{"type":"response.output_text.delta","item_id":"m","delta":"Visible answer"}`,
	} {
		observer.observe([]byte(event))
	}
	observer.close("failed")
	rows := recordedRows(t, queries)
	payload, _ := json.Marshal(rows)
	if strings.Contains(string(payload), "PRIVATE-") || !strings.Contains(string(payload), "Public ") ||
		!strings.Contains(string(payload), "Visible answer") {
		t.Fatal("private state leaked or public text lost")
	}
	toolStarts, argumentEnds := 0, 0
	for _, row := range rows {
		if row.Kind == "tool" && row.EventType == "start" {
			toolStarts++
		}
		if row.Kind == "arguments" && row.EventType == "end" && strings.Contains(row.Content, "不代表工具已执行") {
			argumentEnds++
		}
	}
	if toolStarts != 1 || argumentEnds != 1 {
		t.Fatal("arguments were reported as executed tools")
	}
}

func TestProviderPersistsDeltasBeforeTerminalResponseWithoutForcingSummary(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	ctx, queries := tracedContext(t)
	release := make(chan struct{})
	var once sync.Once
	defer once.Do(func() { close(release) })
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		if body["stream"] != true || r.Header.Get("Accept") != "text/event-stream" {
			t.Error("no streaming request")
		}
		if reasoning, ok := body["reasoning"].(map[string]any); ok && reasoning["summary"] != nil {
			t.Error("forced optional summary")
		}
		w.Header().Set("Content-Type", "text/event-stream")
		delta, _ := json.Marshal(map[string]any{"type": "response.output_text.delta", "item_id": "m", "delta": strings.Repeat("live", 200)})
		fmt.Fprintf(w, "data: %s\n\n", delta)
		w.(http.Flusher).Flush()
		select {
		case <-release:
		case <-r.Context().Done():
			return
		}
		result, _ := json.Marshal(map[string]any{"type": "response.completed", "response": map[string]any{
			"status": "completed", "output": []any{map[string]any{"id": "m", "type": "message", "content": []any{
				map[string]string{"type": "output_text", "text": strings.Repeat("live", 200)}}}}}})
		fmt.Fprintf(w, "data: %s\n\n", result)
	}))
	defer func() { once.Do(func() { close(release) }); server.Close() }()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	done := make(chan error, 1)
	go func() {
		_, err := provider.postJSON(ctx, "/responses", map[string]any{"model": "fixture-reasoner", "stream": false})
		done <- err
	}()
	deadline := time.Now().Add(3 * time.Second)
	found := false
	for time.Now().Before(deadline) {
		for _, row := range recordedRows(t, queries) {
			if row.EventType == "delta" {
				found = true
			}
		}
		if found {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if !found {
		t.Fatal("deltas were buffered until the full response")
	}
	select {
	case <-done:
		t.Fatal("request ended before terminal response")
	default:
	}
	once.Do(func() { close(release) })
	if err := <-done; err != nil {
		t.Fatal(err)
	}
}

func TestCompletedItemsReconcileMissingSuffixAndDoNotDuplicateSources(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	ctx, queries := tracedContext(t)
	observer := newStreamTrace(ctx)
	observer.observe([]byte(`{"type":"response.output_text.delta","item_id":"m","delta":"First "}`))
	data := []byte(`{"status":"completed","output":[
		{"id":"m","type":"message","content":[{"type":"output_text","text":"First final suffix"}]},
		{"id":"w","type":"web_search_call","status":"completed","action":{"type":"search","sources":[{"url":"https://www.gov.cn/","title":"Official"}]}}]}`)
	observer.final(data, "stream")
	observer.final(data, "stream")
	observer.close("completed")
	var text string
	sources, unknownTiming := 0, false
	for _, row := range recordedRows(t, queries) {
		if row.Kind == "answer" && row.EventType == "delta" {
			text += row.Content
		}
		if row.Kind == "source" {
			sources++
		}
		if row.Kind == "tool" && row.EventType == "end" {
			unknownTiming = strings.Contains(row.Content, "未测得独立执行区间")
		}
	}
	if text != "First final suffix" || sources != 1 || !unknownTiming {
		t.Fatal("final reconciliation changed evidence", text, sources, unknownTiming)
	}
}

func TestCodexCompactionIsLabeledWithoutPersistingItsInput(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	ctx, queries := tracedContext(t)
	_, span, _ := traceRequest(ctx, "/responses", map[string]any{"model": "fixture-reasoner",
		"input": []json.RawMessage{json.RawMessage(`{"role":"user","content":"PRIVATE-INPUT"}`),
			json.RawMessage(`{"type":"compaction_trigger"}`)}})
	span.End("completed", "")
	rows := recordedRows(t, queries)
	data, _ := json.Marshal(rows)
	if len(rows) != 2 || rows[0].Kind != "compaction" || !strings.Contains(rows[0].Label, "Codex V2") ||
		strings.Contains(string(data), "PRIVATE-INPUT") {
		t.Fatal("compaction trace leaked input or mislabeled work")
	}
}

func TestAnswerCitationsAreOfficialDeduplicatedAndPageFindInputsAreReadable(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	ctx, queries := tracedContext(t)
	observer := newStreamTrace(ctx)
	for _, url := range []string{"https://www.gov.cn/law", "https://www.gov.cn/law", "https://gov.cn.evil.example/", "https://user:secret@www.gov.cn/"} {
		data, _ := json.Marshal(map[string]any{"type": "response.output_text.annotation.added",
			"annotation": map[string]string{"type": "url_citation", "url": url, "title": "Authority"}})
		observer.observe(data)
	}
	rows := recordedRows(t, queries)
	if len(rows) != 1 || rows[0].Label != "回答引用" || !strings.Contains(rows[0].Content, "https://www.gov.cn/law") {
		t.Fatal("untrusted or duplicate source citation", rows)
	}
	if detail := toolDescription([]byte(`{"type":"find_in_page","url":"https://www.gov.cn/law","pattern":"适用日期"}`), false); !strings.Contains(detail, "查找：适用日期") {
		t.Fatal("page-find arguments were lost")
	}
}
