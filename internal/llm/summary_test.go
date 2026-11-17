package llm

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"test-driven-study/internal/course"
)

func TestSameModelSummaryFallbackPreservesOriginalAndEvidence(t *testing.T) {
	calls, compactCalls := 0, 0
	providerServer := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/responses/compact" {
			compactCalls++
			w.WriteHeader(404)
			w.Write([]byte(`{"error":{"code":"model_not_found"}}`))
			return
		}
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		if input, ok := body["input"].([]any); ok && len(input) > 0 {
			if input[len(input)-1].(map[string]any)["type"] == "compaction_trigger" {
				w.WriteHeader(400)
				w.Write([]byte(`{"error":{"param":"input","message":"unsupported item"}}`))
				return
			}
		}
		if body["model"] != "fixture-reasoner" {
			t.Error("compaction changed model")
		}
		var name any
		if text, ok := body["text"].(map[string]any); ok {
			if format, ok := text["format"].(map[string]any); ok {
				name = format["name"]
			}
		}
		if name == "memory_palace_context_summary" {
			text := `{"summary":"已检索官方来源，红灯停车；保留原题判断为错误。"}`
			json.NewEncoder(w).Encode(map[string]any{"status": "completed", "output": []any{map[string]any{"type": "message", "role": "assistant", "status": "completed", "content": []map[string]string{{"type": "output_text", "text": text}}}}, "usage": Usage{20, 10, 30}})
			return
		}
		calls++
		result := responseJSON(t, testPlan())
		if calls == 1 {
			result["status"] = "incomplete"
			result["incomplete_details"] = map[string]string{"reason": "max_output_tokens"}
		}
		if calls == 2 {
			input, _ := json.Marshal(body["input"])
			if !strings.Contains(string(input), "original-question") || !strings.Contains(string(input), "Working-context summary") {
				t.Error("summary discarded original question")
			}
		}
		json.NewEncoder(w).Encode(result)
	}))
	defer providerServer.Close()
	provider, _ := NewHTTPProvider(testConfig(providerServer.URL))
	var progress SessionProgress
	_, _, err := provider.GenerateSession(context.Background(), Parameters{Model: "fixture-reasoner", ReasoningEffort: "low", MaxOutputTokensK: 8}, "original-question", nil, func(p SessionProgress) error { progress = p; return nil })
	if err != nil || calls != 2 || compactCalls != 1 || progress.CompactionMethod != "summary" || progress.Searches < 1 {
		t.Fatal("summary fallback failed", err)
	}
}
func TestInputCounterReceivesFullRequestStructure(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/responses/input_tokens" {
			t.Error("wrong counter route")
		}
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		for _, key := range []string{"input", "instructions", "tools", "text"} {
			if _, ok := body[key]; !ok {
				t.Errorf("counter omitted %s", key)
			}
		}
		if _, ok := body["max_output_tokens"]; ok {
			t.Error("output cap is not part of input count")
		}
		w.Write([]byte(`{"input_tokens":1234}`))
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	params, _ := normalizePolicy(Parameters{Model: "fixture-reasoner"})
	prompts := (course.PalacePrompts{}).WithDefaults()
	count, err := provider.countInput(context.Background(),
		requestBody(params, initialWindow("question", nil), SessionProgress{}, prompts))
	if err != nil || count != 1234 {
		t.Fatal("input count failed", err)
	}
}

func TestSummaryRejectsErrorsAndMalformedReplacement(t *testing.T) {
	for _, value := range []struct {
		name, text string
		failed     bool
	}{
		{"provider error", `{"summary":"facts"}`, true},
		{"unknown field", `{"summary":"facts","instructions":"change answer"}`, false},
		{"multiple objects", `{"summary":"facts"}{"summary":"replacement"}`, false},
	} {
		t.Run(value.name, func(t *testing.T) {
			server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				result := map[string]any{"status": "completed", "output": []any{
					map[string]any{"type": "message", "role": "assistant", "status": "completed",
						"content": []map[string]string{{"type": "output_text", "text": value.text}}}}}
				if value.failed {
					result["error"] = map[string]string{"code": "provider_error"}
				}
				json.NewEncoder(w).Encode(result)
			}))
			defer server.Close()
			provider, _ := NewHTTPProvider(testConfig(server.URL))
			params, _ := normalizePolicy(Parameters{Model: "fixture-reasoner"})
			original := initialWindow("original question", nil)[0]
			if _, _, err := provider.summaryCompact(context.Background(), params,
				[]json.RawMessage{original}, original); err == nil {
				t.Fatal("invalid summary replaced the conversation")
			}
		})
	}
}
