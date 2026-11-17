package llm

import (
	"context"
	"encoding/json"
	"net/http"
	"testing"
)

func TestResearchAndSynthesisAreAutomaticAndSourcesSurvive(t *testing.T) {
	calls := 0
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		if calls == 1 {
			if body["text"].(map[string]any)["format"].(map[string]any)["type"] != "text" {
				t.Error("research was forced into JSON")
			}
			result := responseJSON(t, testPlan())
			items := result["output"].([]any)
			items[len(items)-1].(map[string]any)["content"] = []map[string]string{{"type": "output_text", "text": "官方来源证实红灯停车。"}}
			json.NewEncoder(w).Encode(result)
			return
		}
		if body["text"].(map[string]any)["format"].(map[string]any)["type"] != "json_schema" {
			t.Error("synthesis lost structured schema")
		}
		json.NewEncoder(w).Encode(responseJSON(t, testPlan()))
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	_, _, err := provider.Generate(context.Background(), Parameters{Model: "fixture-reasoner", ReasoningEffort: "low", MaxOutputTokensK: 8}, "source")
	if err != nil || calls != 2 {
		t.Fatal("research-to-JSON progression failed", err)
	}
}
func TestToolFreeResearchCannotStartSynthesisOrRetry(t *testing.T) {
	calls := 0
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		tools := body["tools"].([]any)
		if tools[0].(map[string]any)["type"] != "web_search" ||
			body["tool_choice"] != "required" {
			t.Error("research did not require current hosted search")
		}
		result := responseJSON(t, testPlan())
		result["output"] = result["output"].([]any)[1:]
		json.NewEncoder(w).Encode(result)
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	_, _, err := provider.Generate(context.Background(), Parameters{Model: "fixture-reasoner", ReasoningEffort: "low", MaxOutputTokensK: 8}, "source")
	if err == nil || calls != 1 {
		t.Fatal("tool-free answer was accepted or replayed", err)
	}
}
