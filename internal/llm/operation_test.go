package llm

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestFailureIdentifiesCountingVersusGeneration(t *testing.T) {
	for _, operation := range []string{"input_count", "response"} {
		t.Run(operation, func(t *testing.T) {
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path == "/responses/input_tokens" && operation == "response" {
					w.Write([]byte(`{"input_tokens":10}`))
					return
				}
				w.WriteHeader(400)
				w.Write([]byte(`{"error":{"param":"tool_choice","message":"private endpoint and secret"}}`))
			}))
			defer server.Close()
			provider, _ := NewHTTPProvider(testConfig(server.URL))
			var progress SessionProgress
			_, _, err := provider.GenerateSession(context.Background(),
				Parameters{Model: "fixture-reasoner", ReasoningEffort: "medium"},
				"public test", nil, func(value SessionProgress) error { progress = value; return nil })
			failure, ok := err.(*Failure)
			if !ok || failure.Operation != operation || failure.Parameter != "tool_choice" ||
				strings.Contains(failure.Message, "图片") || strings.Contains(failure.Message, "private") {
				t.Fatal("operation was conflated or diagnostics leaked", err)
			}
			if operation == "response" && progress.ContextTokens != 10 {
				t.Fatal("successful preflight count was lost after generation rejection")
			}
		})
	}
}
