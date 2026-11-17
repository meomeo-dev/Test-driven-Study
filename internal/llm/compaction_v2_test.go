package llm

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
)

func TestV2CompactionFallbackRetainsOriginalAndOpaqueState(t *testing.T) {
	standalone, v2 := 0, 0
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/responses/compact" {
			standalone++
			w.WriteHeader(404)
			return
		}
		v2++
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		input := body["input"].([]any)
		if input[len(input)-1].(map[string]any)["type"] != "compaction_trigger" ||
			body["model"] != "fixture-reasoner" || body["tool_choice"] != "auto" ||
			body["stream"] != true || body["store"] != false ||
			r.Header.Get("Accept") != "text/event-stream" {
			t.Error("request differs from the selected V2 protocol")
		}
		if _, exists := body["text"]; exists {
			t.Error("compaction was constrained to a scene JSON schema")
		}
		w.Header().Set("Content-Type", "text/event-stream")
		result := map[string]any{"status": "completed", "output": []any{
			map[string]string{"type": "message", "text": "must-not-be-installed"},
			map[string]string{"type": "compaction", "encrypted_content": "opaque-v2"}},
			"usage": Usage{40, 12, 52}}
		data, _ := json.Marshal(map[string]any{"type": "response.completed", "response": result})
		fmt.Fprintf(w, "event: response.created\ndata: {\"type\":\"response.created\"}\n\n")
		fmt.Fprintf(w, "event: response.completed\ndata: %s\n\n", data)
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	params, _ := normalizePolicy(Parameters{Model: "fixture-reasoner"})
	initial := initialWindow("original question", []InputImage{
		imageInput([]byte("diagram"), "image/png", 1, 1)})
	window, usage, method, err := provider.compact(context.Background(), params, initial, initial[0])
	if err != nil || standalone != 1 || v2 != 1 || method != "codex_v2" ||
		usage.TotalTokens != 52 || len(window) != 2 || !bytes.Equal(window[0], initial[0]) ||
		!strings.Contains(string(window[1]), "opaque-v2") || len(initial) != 1 {
		t.Fatal("V2 replay history is invalid", err)
	}
}

func TestV2RequiresExactlyOneNonemptyOpaqueItem(t *testing.T) {
	for _, output := range [][]json.RawMessage{
		{rawValue(map[string]string{"type": "message"})},
		{rawValue(map[string]string{"type": "compaction"})},
		{rawValue(map[string]string{"type": "compaction", "encrypted_content": "a"}),
			rawValue(map[string]string{"type": "compaction", "encrypted_content": "b"})},
	} {
		if _, err := v2Window(output, rawValue(map[string]string{"role": "user"})); err == nil {
			t.Fatal("ambiguous or missing opaque state was accepted")
		}
	}
}

func TestTruncatedV2StreamDoesNotFallBackOrReplay(t *testing.T) {
	calls := 0
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.URL.Path == "/responses/compact" {
			w.WriteHeader(404)
			return
		}
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: {\"type\":\"response.output_item.done\",\"item\":{\"type\":\"compaction\",\"encrypted_content\":\"partial\"}}\n\n")
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	params, _ := normalizePolicy(Parameters{Model: "fixture-reasoner"})
	input := initialWindow("original", nil)
	_, _, _, err := provider.compact(context.Background(), params, input, input[0])
	if err == nil || calls != 2 {
		t.Fatal("uncertain V2 request was accepted or replayed", err)
	}
}
