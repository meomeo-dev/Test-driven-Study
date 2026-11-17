package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"test-driven-study/internal/course"
)

func TestCompactionReplaysWholeWindowAndPreservesSourceEvidence(t *testing.T) {
	rounds, compacts := 0, 0
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		if r.URL.Path == "/responses/compact" {
			compacts++
			compactInput := body["input"].([]any)
			if len(compactInput) != 3 || compactInput[2].(map[string]any)["encrypted_content"] != "opaque-reasoning" {
				t.Error("encrypted reasoning was reconstructed or lost")
			}
			original := body["input"].([]any)[0]
			json.NewEncoder(w).Encode(map[string]any{"output": []any{original, map[string]string{"type": "compaction", "encrypted_content": "opaque"},
				map[string]any{"role": "user", "content": []map[string]string{{"type": "input_text", "text": "retained tail"}}}}, "usage": Usage{20, 10, 30}})
			return
		}
		rounds++
		if rounds == 1 {
			tools := body["tools"].([]any)
			if len(tools) != 1 || body["tool_choice"] != "required" {
				t.Error("hosted search routing or tool definition changed")
			}
			input := body["input"].([]any)[0].(map[string]any)["content"].([]any)
			if len(input) != 3 || !strings.HasPrefix(input[2].(map[string]any)["image_url"].(string), "data:image/png;base64,") {
				t.Error("missing image input")
			}
			result := responseJSON(t, testPlan())
			result["status"] = "incomplete"
			result["incomplete_details"] = map[string]string{"reason": "max_output_tokens"}
			result["output"] = []any{result["output"].([]any)[0], map[string]string{"type": "reasoning", "encrypted_content": "opaque-reasoning"}}
			json.NewEncoder(w).Encode(result)
			return
		}
		input := body["input"].([]any)
		if len(input) != 4 || input[1].(map[string]any)["type"] != "compaction" || input[2].(map[string]any)["role"] != "user" {
			t.Error("compacted window was pruned or reordered")
		}
		if _, ok := body["tools"]; ok {
			t.Error("search was forced again after evidence was obtained")
		}
		json.NewEncoder(w).Encode(responseJSON(t, testPlan()))
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	var progress SessionProgress
	plan, usage, err := provider.GenerateSession(context.Background(), Parameters{Model: "fixture-reasoner", ReasoningEffort: "low", MaxOutputTokensK: 8}, "source", []InputImage{imageInput([]byte("png fixture"), "image/png", 1, 1)}, func(p SessionProgress) error { progress = p; return nil })
	if err != nil || plan.Research == nil || rounds != 2 || compacts != 1 || progress.Compactions != 1 || usage.TotalTokens != 430 {
		t.Fatal("continuation failed", err, usage)
	}
}
func TestResearchRejectsInventedSourceAndAnswerConflict(t *testing.T) {
	plan := testPlan()
	progress := SessionProgress{Searches: 1, Sources: []Source{{URL: "https://www.gov.cn/"}}}
	if validateResearch(plan, true, progress) != nil {
		t.Fatal("valid research rejected")
	}
	plan.Research.Sources[0].URL = "https://www.gov.cn/not-retrieved"
	if validateResearch(plan, true, progress) == nil {
		t.Fatal("invented citation accepted")
	}
	plan = testPlan()
	plan.Research.Status = "conflict"
	if validateResearch(plan, true, progress) == nil {
		t.Fatal("conflicting answer accepted")
	}
	if validateResearch(testPlan(), true, SessionProgress{}) == nil {
		t.Fatal("unexecuted search accepted")
	}
}

func TestGeneralCourseStopsSupplementingEvenWhenSearchFindsNewSources(t *testing.T) {
	ctx := context.WithValue(context.Background(), generalCourseKey{}, true)
	for _, completed := range []int{0, maxGeneralCourseRounds - 2} {
		t.Run(fmt.Sprint(completed), func(t *testing.T) {
			calls := 0
			server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				var body struct{ Tools []json.RawMessage }
				if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
					t.Error(err)
					w.WriteHeader(http.StatusBadRequest)
					return
				}
				calls++
				if calls > maxGeneralCourseRounds {
					w.WriteHeader(http.StatusInternalServerError)
					return
				}
				plan := testPlan()
				plan.Research.Status = "insufficient"
				result := responseJSON(t, plan)
				items := result["output"].([]any)
				if len(body.Tools) == 0 {
					result["output"] = items[1:]
				} else {
					items[0].(map[string]any)["action"] = map[string]any{"type": "search",
						"sources": []Source{{URL: fmt.Sprintf("https://example.test/listening/%d", calls)}}}
					items[2].(map[string]any)["content"] = []map[string]string{
						{"type": "output_text", "text": "Teaching advice from the retrieved source."}}
				}
				json.NewEncoder(w).Encode(result)
			}))
			defer server.Close()
			provider, err := NewHTTPProvider(testConfig(server.URL))
			if err != nil {
				t.Fatal(err)
			}
			hooks := &sessionHooks{save: func(*planningSession, string) error { return nil },
				restore: func(s *planningSession) error { s.progress.Rounds = completed; return nil }}
			_, _, err = provider.generateSession(ctx, Parameters{WebSearch: "required"},
				"A supplied listening transcript", nil, nil, hooks, course.PalacePrompts{})
			var failure *Failure
			if !errors.As(err, &failure) || failure.Code != "planning_round_limit" ||
				calls != maxGeneralCourseRounds-completed {
				t.Fatalf("got %d model calls and %v", calls, err)
			}
		})
	}
}
func TestBudgetSeparatesContextAndSingleOutput(t *testing.T) {
	p, err := normalizePolicy(Parameters{})
	if err != nil || p.ContextBudgetK != 274 || p.CompactThresholdK != 210 || p.CompactReserveK != 64 || p.MaxOutputTokensK != 64 {
		t.Fatal("wrong default policy")
	}
	if compactThreshold(p, false) != 210*1024 || compactThreshold(p, true) >= 128000-p.MaxOutputTokensK*1024 {
		t.Fatal("search-specific window was not respected")
	}
	p.MaxOutputTokensK = 274
	if _, err := normalizePolicy(p); err == nil {
		t.Fatal("context target was incorrectly used as an output ceiling")
	}
}

func TestNativeCompactionAndExplicitUnverifiedMode(t *testing.T) {
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		if _, ok := body["tools"]; ok {
			t.Error("disabled search still invoked a tool")
		}
		plan := testPlan()
		plan.Research = &Research{Status: "not_requested", Explanation: "搜索已明确关闭，未核验。", Sources: []SourceClaim{}}
		result := responseJSON(t, plan)
		result["output"] = append([]any{map[string]string{"type": "compaction", "encrypted_content": "opaque-native"}}, result["output"].([]any)[1:]...)
		json.NewEncoder(w).Encode(result)
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	var progress SessionProgress
	_, _, err := provider.GenerateSession(context.Background(), Parameters{Model: "fixture-reasoner", ReasoningEffort: "low", MaxOutputTokensK: 8, WebSearch: "off"}, "source", nil, func(p SessionProgress) error { progress = p; return nil })
	if err != nil || progress.Compactions != 1 {
		t.Fatal("native compaction or explicit mode failed", err)
	}
}

func TestCompletedMalformedPlanIsReplacedWithoutConcatenatingJSON(t *testing.T) {
	calls := 0
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		result := responseJSON(t, testPlan())
		if calls == 1 {
			items := result["output"].([]any)
			message := items[len(items)-1].(map[string]any)
			message["content"] = []any{map[string]string{"type": "output_text", "text": "{not complete JSON"}}
		}
		json.NewEncoder(w).Encode(result)
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	plan, _, err := provider.Generate(context.Background(), Parameters{Model: "fixture-reasoner", ReasoningEffort: "low", MaxOutputTokensK: 8}, "source")
	if err != nil || calls != 2 || plan.ImagePrompt == "" {
		t.Fatal("malformed JSON was not replaced safely", err)
	}
}

func TestFirstCoursePlanReceivesLimitsAndCorrectionIdentifiesField(t *testing.T) {
	calls := 0
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		var body struct {
			Instructions string
			Input        []json.RawMessage
			Text         struct {
				Format struct {
					Schema struct {
						Properties map[string]struct {
							Pattern  string
							MaxItems int
						}
					}
				}
			}
		}
		if err := json.NewDecoder(req.Body).Decode(&body); err != nil {
			t.Error(err)
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		calls++
		plan := testPlan()
		plan.Research = &Research{Status: "not_requested", Explanation: "Based on course evidence.",
			Sources: []SourceClaim{}}
		switch calls {
		case 1:
			for _, requirement := range []string{"scene 1600", "image_prompt 4000", "0–8 pitfalls"} {
				if !strings.Contains(body.Instructions, requirement) {
					t.Errorf("first planning request omitted %q", requirement)
				}
			}
			fields := body.Text.Format.Schema.Properties
			if fields["scene"].Pattern != `^[\s\S]{1,1600}$` || fields["pitfalls"].MaxItems != 8 {
				t.Error("first structured request omitted the scene or pitfalls bound")
			}
			for range 9 {
				plan.Pitfalls = append(plan.Pitfalls, "A short distraction")
			}
		case 2:
			if len(body.Input) == 0 ||
				!strings.Contains(string(body.Input[len(body.Input)-1]), "pitfalls 有 10 项，上限 8 项") {
				t.Error("replacement request omitted the field, item count or limit")
			}
		default:
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		result := responseJSON(t, plan)
		result["output"] = result["output"].([]any)[1:]
		json.NewEncoder(w).Encode(result)
	}))
	defer server.Close()
	provider, err := NewHTTPProvider(testConfig(server.URL))
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.WithValue(context.Background(), generalCourseKey{}, true)
	plan, _, err := provider.Generate(ctx, Parameters{WebSearch: "off"}, "Course evidence")
	if err != nil || calls != 2 || len(plan.Pitfalls) != 1 {
		t.Fatalf("expected a corrected plan after two calls, got %d and %v", calls, err)
	}
}

func TestPlannerUsesShapeOnlyAfterExplicitLengthConstraintRejection(t *testing.T) {
	for _, rejectAt := range []string{"/responses/input_tokens", "/responses"} {
		t.Run(rejectAt, func(t *testing.T) {
			rejections, plans := 0, 0
			server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				var body struct {
					Instructions string
					Text         json.RawMessage
				}
				if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
					t.Error(err)
					w.WriteHeader(http.StatusBadRequest)
					return
				}
				bounded := strings.Contains(string(body.Text), `"maxItems"`)
				if bounded && r.URL.Path == rejectAt {
					rejections++
					if rejections > 1 {
						w.WriteHeader(http.StatusInternalServerError)
						return
					}
					w.WriteHeader(http.StatusBadRequest)
					w.Write([]byte(`{"error":{"message":"Invalid schema: 'maxItems' is not permitted"}}`))
					return
				}
				if r.URL.Path == "/responses/input_tokens" {
					json.NewEncoder(w).Encode(map[string]int{"input_tokens": 200})
					return
				}
				if bounded || !strings.Contains(body.Instructions, "0–8 pitfalls") {
					t.Error("compatible request must keep instructions and omit unsupported bounds")
				}
				plans++
				plan := testPlan()
				plan.Research = &Research{Status: "not_requested", Explanation: "Course evidence.",
					Sources: []SourceClaim{}}
				result := responseJSON(t, plan)
				result["output"] = result["output"].([]any)[1:]
				json.NewEncoder(w).Encode(result)
			}))
			defer server.Close()
			provider, err := NewHTTPProvider(testConfig(server.URL))
			if err != nil {
				t.Fatal(err)
			}
			_, _, err = provider.Generate(context.Background(), Parameters{WebSearch: "off"}, "source")
			if err != nil || rejections != 1 || plans != 1 {
				t.Fatalf("expected a schema rejection and one valid plan, got %d, %d, %v",
					rejections, plans, err)
			}
		})
	}
}

func TestContextReserveDerivesAnOmittedOutputAllowance(t *testing.T) {
	value, err := normalizePolicy(Parameters{ContextBudgetK: 242, CompactThresholdK: 210, CompactReserveK: 32})
	if err != nil || value.MaxOutputTokensK != 32 {
		t.Fatal("reserve did not determine the default output allowance", err)
	}
}

func TestPreflightCompactsBeforeGenerationAndPublishesReducedWindow(t *testing.T) {
	counts, generations := 0, 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		switch r.URL.Path {
		case "/responses/input_tokens":
			counts++
			value := 100
			if counts == 1 {
				value = 17000
			}
			json.NewEncoder(w).Encode(map[string]int{"input_tokens": value})
		case "/responses/compact":
			json.NewEncoder(w).Encode(map[string]any{"output": []any{
				body["input"].([]any)[0], map[string]string{
					"type": "compaction", "encrypted_content": "opaque"}}})
		case "/responses":
			generations++
			plan := testPlan()
			plan.Research = &Research{Status: "not_requested", Explanation: "Not verified", Sources: []SourceClaim{}}
			result := responseJSON(t, plan)
			result["output"] = result["output"].([]any)[1:]
			json.NewEncoder(w).Encode(result)
		}
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL))
	var beforePost SessionProgress
	_, _, err := provider.GenerateSession(context.Background(), Parameters{
		Model: "fixture-reasoner", ReasoningEffort: "medium", WebSearch: "off",
		ContextBudgetK: 32, CompactThresholdK: 16, CompactReserveK: 16}, "original", nil,
		func(p SessionProgress) error {
			if p.Compactions == 1 && p.Rounds == 0 {
				beforePost = p
			}
			return nil
		})
	if err != nil || generations != 1 || counts != 2 || beforePost.ContextTokens != 100 ||
		beforePost.Phase != "planning" {
		t.Fatal("preflight did not install and publish the compacted window", err)
	}
}
