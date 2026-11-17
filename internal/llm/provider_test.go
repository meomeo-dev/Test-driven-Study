package llm

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func testConfig(base string) Config {
	return Config{BaseURL: base, APIKey: "private-llm-test-key", Models: []string{"fixture-reasoner"},
		DefaultModel: "fixture-reasoner", ReasoningEffort: "medium", MaxOutputTokensK: 16}
}
func testPlan() Plan {
	return Plan{Title: "红灯入口", Scene: "入口前停住", Anchors: []Anchor{{"红灯", "停车等待"}},
		Pitfalls: []string{"不能加速通过"}, ImagePrompt: "记忆宫殿：红灯前停车，正确答案为错误。",
		Research: &Research{Status: "supported", Explanation: "测试来源支持停车等候。", Sources: []SourceClaim{{URL: "https://www.gov.cn/", Title: "政府测试来源", Claim: "测试规则"}}}}
}
func responseJSON(t *testing.T, plan Plan) map[string]any {
	t.Helper()
	text, _ := json.Marshal(plan)
	return map[string]any{"status": "completed", "output": []any{
		map[string]any{"type": "web_search_call", "status": "completed", "action": map[string]any{"type": "search", "sources": []Source{{URL: "https://www.gov.cn/", Title: "政府测试来源"}}}},
		map[string]any{"type": "reasoning", "summary": []any{}},
		map[string]any{"type": "message", "role": "assistant", "status": "completed",
			"content": []any{map[string]string{"type": "output_text", "text": string(text)}}}},
		"usage": Usage{120, 80, 200}}
}
func TestResponsesWireFormatAndDefaultEffort(t *testing.T) {
	for _, effort := range []string{"high", "default"} {
		t.Run(effort, func(t *testing.T) {
			var calls int
			server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				calls++
				if req.URL.Path != "/responses" || req.Header.Get("Authorization") != "Bearer private-llm-test-key" {
					t.Error("wrong route or LLM key")
				}
				var body map[string]any
				if json.NewDecoder(req.Body).Decode(&body) != nil {
					t.Error("invalid body")
				}
				if body["store"] != false || body["stream"] != false || body["max_output_tokens"] != float64(8192) {
					t.Error("budget/store semantics changed")
				}
				if effort == "default" {
					if _, ok := body["reasoning"]; ok {
						t.Error("default effort was sent")
					}
				} else if body["reasoning"].(map[string]any)["effort"] != effort {
					t.Error("missing effort")
				}
				format := body["text"].(map[string]any)["format"].(map[string]any)
				if format["type"] != "json_schema" || format["strict"] != true || format["schema"].(map[string]any)["additionalProperties"] != false {
					t.Error("non-strict schema")
				}
				for _, forbidden := range []string{"temperature", "response_format", "api_key"} {
					if _, ok := body[forbidden]; ok {
						t.Errorf("unexpected field %s", forbidden)
					}
				}
				plan := testPlan()
				plan.Research = &Research{Status: "not_requested", Explanation: "测试明确关闭搜索。", Sources: []SourceClaim{}}
				json.NewEncoder(w).Encode(responseJSON(t, plan))
			}))
			defer server.Close()
			provider, err := NewHTTPProvider(testConfig(server.URL))
			if err != nil {
				t.Fatal(err)
			}
			plan, usage, err := provider.Generate(context.Background(), Parameters{Model: "fixture-reasoner", ReasoningEffort: effort, MaxOutputTokensK: 8, WebSearch: "off"}, "original source")
			if err != nil || plan.ImagePrompt == "" || usage.TotalTokens != 200 || calls != 1 {
				t.Fatal("invalid generation result", err)
			}
		})
	}
}
func TestRejectIncompleteRefusedAndInvalidPlans(t *testing.T) {
	good, _ := json.Marshal(responseJSON(t, testPlan()))
	badPlan := testPlan()
	badPlan.Anchors = nil
	invalid, _ := json.Marshal(responseJSON(t, badPlan))
	cases := []string{
		strings.ReplaceAll(string(good), `"completed"`, `"incomplete"`),
		strings.Replace(string(good), `"output_text"`, `"refusal"`, 1),
		strings.Replace(string(good), `"output_text"`, `"output_audio"`, 1),
		`{"status":"completed","output":[{"type":"message","role":"assistant","status":"completed","content":[{"type":"output_text","text":"{\"unexpected\":1}"}]}]}`,
		string(invalid), `{}`, `{"status":"completed","output":[]}`,
		`{"status":"completed","error":{"message":"private-diagnostic"}}`,
	}
	for _, body := range cases {
		if _, _, err := parseResponse([]byte(body)); err == nil {
			t.Error("accepted unsafe output")
		}
	}
	over := testPlan()
	over.ImagePrompt = strings.Repeat("字", 4001)
	if validPlan(over) {
		t.Error("unbounded output accepted")
	}
}
func TestExplicitProxyNoRedirectAndNoProviderDiagnosticLeak(t *testing.T) {
	config := testConfig("https://remote.example.test/v1")
	if _, err := NewHTTPProvider(config); err == nil {
		t.Fatal("remote direct connection allowed")
	}
	calls := 0
	proxy := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		calls++
		w.Header().Set("Location", "http://127.0.0.1:1/leak")
		w.WriteHeader(302)
		w.Write([]byte("private-llm-test-key provider diagnostic"))
	}))
	defer proxy.Close()
	config.BaseURL = "http://127.0.0.1:1/v1"
	config.ProxyURL = proxy.URL
	provider, err := NewHTTPProvider(config)
	if err != nil {
		t.Fatal(err)
	}
	_, _, err = provider.Generate(context.Background(), Parameters{Model: "fixture-reasoner", ReasoningEffort: "low", MaxOutputTokensK: 4}, "source")
	if calls != 1 || err == nil || strings.Contains(err.Error(), "private-llm-test-key") {
		t.Fatal("unsafe retry, redirect or diagnostic")
	}
}

func TestIncompleteTokenBudgetPreservesUsageAndExplainsReason(t *testing.T) {
	plan, usage, err := parseResponse([]byte(`{"status":"incomplete","incomplete_details":{"reason":"max_output_tokens"},"usage":{"input_tokens":4,"output_tokens":8192,"total_tokens":8196}}`))
	if err == nil || !strings.Contains(err.Error(), "预算") || usage.OutputTokens != 8192 || plan.ImagePrompt != "" {
		t.Fatal("incomplete output or usage was mishandled")
	}
}

func TestCredentialAccountAndSchemaRequiredFields(t *testing.T) {
	if !validAccount("llm-ABCDEFGHIJKLMNOPQRSTUVWXYZ") || validAccount("image-ABCDEFGHIJKLMNOPQRSTUVWXYZ") || validAccount("llm-short") {
		t.Fatal("credential account boundaries are incorrect")
	}
	var schema struct {
		Required   []string       `json:"required"`
		Properties map[string]any `json:"properties"`
	}
	if json.Unmarshal(planSchema, &schema) != nil || len(schema.Required) != 6 || len(schema.Properties) != 6 {
		t.Fatal("incomplete strict schema")
	}
}

func TestCompatibilityDiagnosticsExposeOnlyKnownParameterNames(t *testing.T) {
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(400)
		w.Write([]byte(`{"error":{"param":"","message":"Unknown context_management: private-key-and-provider-details"}}`))
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	_, _, err := provider.Generate(context.Background(), Parameters{Model: "fixture-reasoner", ReasoningEffort: "low", MaxOutputTokensK: 8}, "source")
	failure, ok := err.(*Failure)
	if !ok || failure.Parameter != "context_management" || strings.Contains(err.Error(), "private-key") {
		t.Fatal("unsafe or missing compatibility diagnostic")
	}
}

func TestNestedProviderParameterCannotLeakPrivateLabels(t *testing.T) {
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(400)
		w.Write([]byte(`{"error":{"param":"text.format.private-key-and-provider-details","message":"rejected"}}`))
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	_, _, err := provider.Generate(context.Background(),
		Parameters{Model: "fixture-reasoner", ReasoningEffort: "low"}, "source")
	failure, ok := err.(*Failure)
	if !ok || failure.Parameter != "text" || strings.Contains(err.Error(), "private-key") {
		t.Fatal("nested diagnostic leaked private content")
	}
}

func newModelServer(handler http.Handler) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/responses/input_tokens" {
			w.Header().Set("Content-Type", "application/json")
			w.Write([]byte(`{"input_tokens":100}`))
			return
		}
		handler.ServeHTTP(w, r)
	}))
}
