package llm

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"
)

func researchNote(t *testing.T, text, url string) map[string]any {
	t.Helper()
	result := responseJSON(t, testPlan())
	items := result["output"].([]any)
	items[len(items)-1].(map[string]any)["content"] = []any{map[string]any{
		"type": "output_text", "text": text, "annotations": []map[string]string{
			{"type": "url_citation", "url": url, "title": "Official fixture"}}}}
	return result
}

func TestInsufficientAssessmentReopensResearchAndThenCompletes(t *testing.T) {
	calls := 0
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		_, tools := body["tools"]
		if tools != (calls == 1 || calls == 3) || body["model"] != "fixture-reasoner" {
			t.Error("research tools or selected model did not follow the loop")
		}
		input, _ := json.Marshal(body["input"])
		if !strings.Contains(string(input), "data:image/png;base64,") {
			t.Error("original diagram was lost")
		}
		result := responseJSON(t, testPlan())
		switch calls {
		case 1:
			result = researchNote(t, "Initial search lacks the applicable condition.", "https://www.gov.cn/")
		case 2:
			plan := testPlan()
			plan.Research = &Research{Status: "insufficient", Explanation: "缺少适用条件，需要打开原文。", Sources: []SourceClaim{}}
			result = responseJSON(t, plan)
			result["output"] = result["output"].([]any)[1:]
		case 3:
			if !strings.Contains(body["instructions"].(string), "缺少适用条件") ||
				body["tool_choice"] != "required" {
				t.Error("the identified gap did not reach the new research request")
			}
			result = researchNote(t, "Opened the primary page and found the condition.", "https://www.gov.cn/primary")
			result["output"] = append(result["output"].([]any),
				map[string]any{"type": "web_search_call", "status": "completed", "action": map[string]string{
					"type": "open_page", "url": "https://www.gov.cn/primary"}},
				map[string]any{"type": "web_search_call", "status": "completed", "action": map[string]string{
					"type": "find_in_page", "url": "https://www.gov.cn/primary", "pattern": "condition"}})
		case 4:
			plan := testPlan()
			plan.Research.Sources[0].URL = "https://www.gov.cn/primary"
			result = responseJSON(t, plan)
			result["output"] = result["output"].([]any)[1:]
		default:
			t.Error("validated planning was repeated")
			w.WriteHeader(500)
			return
		}
		json.NewEncoder(w).Encode(result)
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	var progress SessionProgress
	plan, usage, err := provider.GenerateSession(context.Background(), Parameters{
		Model: "fixture-reasoner", ReasoningEffort: "medium", MaxOutputTokensK: 8}, "original",
		[]InputImage{imageInput([]byte("diagram"), "image/png", 1, 1)}, func(p SessionProgress) error { progress = p; return nil })
	if err != nil || calls != 4 || plan.Research.Status != "supported" ||
		progress.Searches != 2 || progress.ResearchRounds != 2 || progress.PageOpens != 1 ||
		progress.PageFinds != 1 || progress.EvidenceGap != "" || usage.TotalTokens != 800 {
		t.Fatal("research did not continue to a supported plan", err, progress)
	}
}

func TestFreshIDsDoNotHideStalledResearch(t *testing.T) {
	calls := 0
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		plan := testPlan()
		plan.Research.Status = "insufficient"
		result := responseJSON(t, plan)
		result["output"].([]any)[0].(map[string]any)["id"] = fmt.Sprintf("new-id-%d", calls)
		json.NewEncoder(w).Encode(result)
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	var progress SessionProgress
	plan, _, err := provider.GenerateSession(context.Background(), Parameters{
		Model: "fixture-reasoner", ReasoningEffort: "medium"}, "original", nil,
		func(p SessionProgress) error { progress = p; return nil })
	failure, ok := err.(*Failure)
	if !ok || failure.Code != "no_research_progress" || calls != 4 ||
		plan.Research == nil || plan.Research.Status != "insufficient" || progress.EvidenceGap == "" {
		t.Fatal("research stagnation or draft persistence failed", err, calls, progress, plan)
	}
}

func TestNewEvidenceCanContinueBeyondFourResearchRounds(t *testing.T) {
	calls := 0
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		plan := testPlan()
		url := fmt.Sprintf("https://www.gov.cn/source-%d", calls)
		plan.Research.Sources[0].URL = url
		if calls < 6 {
			plan.Research.Status = "insufficient"
		}
		result := responseJSON(t, plan)
		result["output"].([]any)[0].(map[string]any)["action"] = map[string]any{
			"type": "search", "sources": []Source{{URL: url, Title: "new source"}}}
		json.NewEncoder(w).Encode(result)
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	_, _, err := provider.Generate(context.Background(), Parameters{
		Model: "fixture-reasoner", ReasoningEffort: "medium"}, "original")
	if err != nil || calls != 6 {
		t.Fatal("a fixed total-round limit stopped useful research", err)
	}
}

func TestSourceBackedConflictStillStopsImmediately(t *testing.T) {
	calls := 0
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		plan := testPlan()
		plan.Research.Status = "conflict"
		json.NewEncoder(w).Encode(responseJSON(t, plan))
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	_, _, err := provider.Generate(context.Background(), Parameters{
		Model: "fixture-reasoner", ReasoningEffort: "medium"}, "original")
	if failure, ok := err.(*Failure); !ok || failure.Code != "answer_conflict" || calls != 1 {
		t.Fatal("a conflicting answer was forced through additional research", err)
	}
}

func TestUnverifiedCitationRequiresNewResearchBeforeAcceptance(t *testing.T) {
	calls := 0
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		if _, enabled := body["tools"]; !enabled {
			t.Error("unverified citations were repaired without actual research")
		}
		plan := testPlan()
		if calls == 1 {
			plan.Research.Sources[0].URL = "https://www.gov.cn/not-retrieved"
		} else if !strings.Contains(body["instructions"].(string), "引用来源无法") {
			t.Error("citation-validation gap did not reach the model")
		}
		json.NewEncoder(w).Encode(responseJSON(t, plan))
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	_, _, err := provider.Generate(context.Background(), Parameters{
		Model: "fixture-reasoner", ReasoningEffort: "medium"}, "original")
	if err != nil || calls != 2 {
		t.Fatal("citation verification did not return to research", err)
	}
}
