package llm

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestEvidenceGapSurvivesPreflightCompaction(t *testing.T) {
	counts, calls, compactions := 0, 0, 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		switch r.URL.Path {
		case "/responses/input_tokens":
			counts++
			value := 100
			if counts == 2 {
				value = 220000
			}
			json.NewEncoder(w).Encode(map[string]int{"input_tokens": value})
		case "/responses/compact":
			compactions++
			json.NewEncoder(w).Encode(map[string]any{"output": []any{
				body["input"].([]any)[0], map[string]string{"type": "compaction", "encrypted_content": "opaque"}}})
		case "/responses":
			calls++
			plan := testPlan()
			if calls == 1 {
				plan.Research.Status = "insufficient"
				plan.Research.Explanation = "尚缺适用日期原文。"
			} else {
				input, _ := json.Marshal(body["input"])
				if !strings.Contains(body["instructions"].(string), "尚缺适用日期") ||
					!strings.Contains(string(input), "opaque") || body["tool_choice"] != "required" {
					t.Error("compaction lost the independent evidence gap or hosted tools")
				}
			}
			json.NewEncoder(w).Encode(responseJSON(t, plan))
		}
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	_, _, err := provider.Generate(context.Background(), Parameters{
		Model: "fixture-reasoner", ReasoningEffort: "medium"}, "original")
	if err != nil || calls != 2 || compactions != 1 {
		t.Fatal("gap-aware compaction failed", err)
	}
}

func TestReadingProgressIgnoresFreshIDsAndNormalizesPatterns(t *testing.T) {
	s := planningSession{}
	for i, pattern := range []string{" Applicable   Clause ", "applicable clause"} {
		output := []json.RawMessage{rawValue(map[string]any{"type": "web_search_call",
			"id": i, "status": "completed", "action": map[string]string{
				"type": "find_in_page", "url": "https://www.gov.cn/law?utm_source=test", "pattern": pattern}})}
		activity := inspectOutput(output)
		if activity.Finds != 1 || len(activity.Sources) != 1 || s.newEvidence(activity) != (i == 0) {
			t.Fatal("repeated reading was counted as new evidence")
		}
	}
	activity := inspectOutput([]json.RawMessage{rawValue(map[string]any{
		"type": "web_search_call", "status": "in_progress", "action": map[string]string{
			"type": "open_page", "url": "https://www.gov.cn/another"}})})
	if activity.Opens != 0 || s.newEvidence(activity) {
		t.Fatal("unfinished reading counted as evidence")
	}
}

func TestCitationTitleEnrichesSourcesWithoutResettingStagnation(t *testing.T) {
	s := planningSession{}
	first := retrievalActivity{Sources: []Source{{URL: "https://www.gov.cn/"}}}
	if !s.newEvidence(first) {
		t.Fatal("initial source was not registered")
	}
	annotation := retrievalActivity{Sources: []Source{
		{URL: "https://www.gov.cn/", Title: "Title from citation metadata"}}}
	if s.newEvidence(annotation) || s.progress.Sources[0].Title != annotation.Sources[0].Title {
		t.Fatal("title enrichment was lost or counted as new research evidence")
	}
}

func TestNoEligibleSourcesCannotLoopOnFreshQueries(t *testing.T) {
	calls := 0
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		result := researchNote(t, "No eligible government source.", "https://example.org/")
		result["output"].([]any)[0].(map[string]any)["action"] = map[string]any{
			"type": "search", "sources": []Source{{URL: "https://example.org/"}}}
		json.NewEncoder(w).Encode(result)
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	_, _, err := provider.Generate(context.Background(), Parameters{
		Model: "fixture-reasoner", ReasoningEffort: "medium"}, "original")
	if failure, ok := err.(*Failure); !ok || failure.Code != "no_research_progress" || calls != 3 {
		t.Fatal("unusable retrieval kept looping", err)
	}
}

func TestDirectPrimaryPageReadingCanSupportAnAssessment(t *testing.T) {
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		result := responseJSON(t, testPlan())
		result["output"].([]any)[0].(map[string]any)["action"] = map[string]string{
			"type": "open_page", "url": "https://www.gov.cn/"}
		json.NewEncoder(w).Encode(result)
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	_, _, err := provider.Generate(context.Background(), Parameters{
		Model: "fixture-reasoner", ReasoningEffort: "medium"}, "original")
	if err != nil {
		t.Fatal("actual page reading was mistaken for an unused tool", err)
	}
}

func TestCancelDuringSupplementDoesNotStartAnotherRound(t *testing.T) {
	entered := make(chan struct{})
	calls := 0
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		json.NewDecoder(r.Body).Decode(new(any))
		calls++
		if calls == 2 {
			close(entered)
			<-r.Context().Done()
			return
		}
		plan := testPlan()
		plan.Research.Status = "insufficient"
		json.NewEncoder(w).Encode(responseJSON(t, plan))
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	finished := make(chan error, 1)
	go func() {
		_, _, err := provider.Generate(ctx, Parameters{
			Model: "fixture-reasoner", ReasoningEffort: "medium"}, "original")
		finished <- err
	}()
	select {
	case <-entered:
	case <-time.After(3 * time.Second):
		t.Fatal("supplemental research did not start")
	}
	cancel()
	select {
	case err := <-finished:
		if err == nil || calls != 2 {
			t.Fatal("canceled research continued", err, calls)
		}
	case <-time.After(3 * time.Second):
		t.Fatal("supplemental research ignored cancellation")
	}
}
