package httpapi_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"slices"
	"sync/atomic"
	"testing"

	"test-driven-study/internal/course"
	"test-driven-study/internal/httpapi"
	"test-driven-study/internal/llm"
	"test-driven-study/internal/storage"
	"test-driven-study/internal/study"
)

type evaluationViewWire struct {
	Evaluation *study.AttemptEvaluation `json:"evaluation"`
}

type writtenFeedbackWire struct {
	ID             int64                       `json:"id"`
	PresentationID string                      `json:"presentation_id"`
	Criteria       []study.EvaluationCriterion `json:"criteria"`
	Summary        string                      `json:"summary"`
	Source         string                      `json:"source"`
	Passed         bool                        `json:"passed"`
	ScorePct       int                         `json:"score_pct"`
	EvaluatedAtMS  int64                       `json:"evaluated_at_ms"`
	Cached         bool                        `json:"cached"`
}

func setupEvaluationEnv(t *testing.T, providerURL string) (
	*study.Service, *llm.Service, string, int64, map[course.QuestionType]int64,
) {
	t.Helper()
	ctx := context.Background()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	dataDir := t.TempDir()
	db, err := storage.Open(ctx, root, dataDir)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	pkgDir := filepath.Join(root, "courses", "golden-course-template")
	if _, err := storage.InstallCourse(ctx, db, pkgDir); err != nil {
		t.Fatal(err)
	}
	studyService := study.New(db, root)
	courses, err := studyService.Courses(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var subject int64
	for _, entry := range courses {
		if entry.ID == "golden-course-template" {
			for _, unit := range entry.Units {
				if unit.ID == "extended-practice" {
					subject = unit.SubjectID
				}
			}
		}
	}
	rows, err := studyService.PracticeQuestions(ctx, study.Filter{
		SubjectID: subject, ChapterID: -1, State: "all",
	})
	if err != nil {
		t.Fatal(err)
	}
	byType := map[course.QuestionType]int64{}
	for _, row := range rows {
		if _, exists := byType[row.QuestionType]; !exists {
			byType[row.QuestionType] = row.QuestionID
		}
	}
	var planner *llm.Service
	if providerURL != "" {
		planner, err = llm.New(ctx, llm.Options{
			DB: db, DataDirectory: dataDir,
			Config: llm.Config{
				BaseURL:          providerURL,
				APIKey:           "written-feedback-test-key",
				Models:           []string{"fixture-reasoner"},
				DefaultModel:     "fixture-reasoner",
				ReasoningEffort:  "medium",
				MaxOutputTokensK: 16,
			},
			Credentials: testCredentials{},
		})
		if err != nil {
			t.Fatal(err)
		}
		t.Cleanup(planner.Close)
	}
	return studyService, planner, root, subject, byType
}

func submitJSONAnswer(t *testing.T, svc *study.Service, presID string, qID int64, raw string) {
	t.Helper()
	ctx := context.Background()
	if _, err := svc.OpenPresentation(ctx, presID, qID); err != nil {
		t.Fatal(err)
	}
	var input study.AnswerInput
	if err := json.Unmarshal([]byte(raw), &input); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.SubmitResponse(ctx, presID, input); err != nil {
		t.Fatal(err)
	}
}

func mockCountedFeedbackProvider(
	t *testing.T, ratio float64, calls *atomic.Int32,
) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		var evidence struct {
			Rubric map[string]int `json:"rubric"`
		}
		if err := json.Unmarshal([]byte(body["input"].(string)), &evidence); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		criteria := make([]map[string]any, 0, len(evidence.Rubric))
		for name, maxPoints := range evidence.Rubric {
			pts := int(float64(maxPoints) * ratio)
			criteria = append(criteria, map[string]any{
				"name": name, "points": pts, "max_points": maxPoints,
				"comment": "满足评分要求。",
			})
		}
		text, _ := json.Marshal(map[string]any{
			"criteria": criteria, "summary": "表达准确清晰。",
		})
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status": "completed",
			"output": []any{map[string]any{
				"type": "message", "role": "assistant", "status": "completed",
				"content": []any{map[string]string{"type": "output_text", "text": string(text)}},
			}},
		})
	}))
	t.Cleanup(server.Close)
	return server
}

func TestWrittenFeedbackPersistsAndReusesCachedLLMEvaluation(t *testing.T) {
	var calls atomic.Int32
	provider := mockCountedFeedbackProvider(t, 1.0, &calls)
	studySvc, planner, root, _, byType := setupEvaluationEnv(t, provider.URL)

	presID := "eval-cache-writing-00001"
	submitJSONAnswer(t, studySvc, presID, byType[course.Writing],
		`{"text":"The delivery has been moved to Friday."}`)
	uncachedID := "eval-cache-writing-00002"
	submitJSONAnswer(t, studySvc, uncachedID, byType[course.Writing],
		`{"text":"The delivery has been moved to Friday."}`)

	server := httptest.NewServer(httpapi.New(studySvc, nil, root, "43188", "43187", planner))
	defer server.Close()

	res, payload := call(t, server, http.MethodGet,
		"/api/practice/presentations/"+presID+"/evaluation", "", "")
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET evaluation: %d %s", res.StatusCode, payload)
	}
	view := decode[evaluationViewWire](t, payload)
	if view.Evaluation != nil {
		t.Fatalf("expected null initial evaluation, got %+v", view.Evaluation)
	}

	res, payload = call(t, server, http.MethodPost,
		"/api/practice/presentations/"+presID+"/feedback", "{}", "")
	if res.StatusCode != http.StatusOK {
		t.Fatalf("1st POST feedback: %d %s", res.StatusCode, payload)
	}
	first := decode[writtenFeedbackWire](t, payload)
	if first.ID <= 0 || first.PresentationID != presID || first.Source != "llm" ||
		!first.Passed || first.ScorePct != 100 || first.Cached || first.EvaluatedAtMS <= 0 ||
		first.Summary != "表达准确清晰。" || len(first.Criteria) == 0 {
		t.Fatalf("unexpected 1st feedback: %+v", first)
	}
	if calls.Load() != 1 {
		t.Fatalf("expected 1 LLM call, got %d", calls.Load())
	}

	res, payload = call(t, server, http.MethodPost,
		"/api/practice/presentations/"+presID+"/feedback", "{}", "")
	if res.StatusCode != http.StatusOK {
		t.Fatalf("2nd POST feedback: %d %s", res.StatusCode, payload)
	}
	second := decode[writtenFeedbackWire](t, payload)
	if !second.Cached || second.ID != first.ID || second.EvaluatedAtMS != first.EvaluatedAtMS ||
		second.Summary != first.Summary || len(second.Criteria) != len(first.Criteria) {
		t.Fatalf("expected cached evaluation reuse: got %+v want id=%d", second, first.ID)
	}
	if calls.Load() != 1 {
		t.Fatalf("cached feedback must not invoke LLM again: calls=%d", calls.Load())
	}

	res, payload = call(t, server, http.MethodGet,
		"/api/practice/presentations/"+presID+"/evaluation", "", "")
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET persisted LLM evaluation: %d %s", res.StatusCode, payload)
	}
	view = decode[evaluationViewWire](t, payload)
	if view.Evaluation == nil || view.Evaluation.ID != first.ID ||
		view.Evaluation.Source != "llm" || !view.Evaluation.Passed ||
		view.Evaluation.ScorePct != 100 || view.Evaluation.Summary != "表达准确清晰。" ||
		len(view.Evaluation.Criteria) == 0 {
		t.Fatalf("unexpected persisted LLM evaluation view: %+v", view.Evaluation)
	}

	// Offline/disabled LLM server still returns cached LLM evaluation, while rejecting uncached.
	offlineServer := httptest.NewServer(httpapi.New(studySvc, nil, root, "43188", "43187"))
	defer offlineServer.Close()
	res, payload = call(t, offlineServer, http.MethodPost,
		"/api/practice/presentations/"+presID+"/feedback", "{}", "")
	if res.StatusCode != http.StatusOK || !decode[writtenFeedbackWire](t, payload).Cached {
		t.Fatalf("offline server should serve cached LLM evaluation: %d %s", res.StatusCode, payload)
	}
	res, _ = call(t, offlineServer, http.MethodPost,
		"/api/practice/presentations/"+uncachedID+"/feedback", "{}", "")
	if res.StatusCode != http.StatusServiceUnavailable {
		t.Fatalf("offline server should return 503 for uncached feedback, got %d", res.StatusCode)
	}

	// Sub-60% LLM score persists passed=false.
	var lowCalls atomic.Int32
	lowProvider := mockCountedFeedbackProvider(t, 0.5, &lowCalls)
	lowStudy, lowPlanner, lowRoot, _, lowTypes := setupEvaluationEnv(t, lowProvider.URL)
	lowPres := "eval-low-score-writing-001"
	submitJSONAnswer(t, lowStudy, lowPres, lowTypes[course.Writing],
		`{"text":"The delivery has been moved to Friday."}`)
	lowServer := httptest.NewServer(httpapi.New(lowStudy, nil, lowRoot, "43188", "43187", lowPlanner))
	defer lowServer.Close()
	res, payload = call(t, lowServer, http.MethodPost,
		"/api/practice/presentations/"+lowPres+"/feedback", "{}", "")
	if res.StatusCode != http.StatusOK {
		t.Fatalf("low-score feedback: %d %s", res.StatusCode, payload)
	}
	lowFB := decode[writtenFeedbackWire](t, payload)
	if lowFB.ScorePct != 50 || lowFB.Passed {
		t.Fatalf("expected 50%% and passed=false, got %+v", lowFB)
	}
}

func TestSelfCheckAndEvaluationHTTPContract(t *testing.T) {
	studySvc, _, root, _, byType := setupEvaluationEnv(t, "")
	ctx := context.Background()

	transID := "eval-selfcheck-trans-0001"
	submitJSONAnswer(t, studySvc, transID, byType[course.Translation],
		`{"translation":"请把包裹送到前门。"}`)
	unansweredID := "eval-unanswered-write-001"
	if _, err := studySvc.OpenPresentation(ctx, unansweredID, byType[course.Writing]); err != nil {
		t.Fatal(err)
	}
	tfID := "eval-nonwritten-tf-00001"
	submitJSONAnswer(t, studySvc, tfID, byType[course.TrueFalse], `{"value":false}`)

	server := httptest.NewServer(httpapi.New(studySvc, nil, root, "43188", "43187"))
	defer server.Close()

	// Validation on self-check body.
	expectProblem(t, server, http.MethodPost,
		"/api/practice/presentations/"+transID+"/self-check", `{}`, 400, "请说明自评是否通过")
	expectProblem(t, server, http.MethodPost,
		"/api/practice/presentations/"+transID+"/self-check",
		`{"passed":true,"extra":1}`, 400, "")

	// Self-check pass persists and is restored by GET /evaluation.
	res, payload := call(t, server, http.MethodPost,
		"/api/practice/presentations/"+transID+"/self-check",
		`{"passed":true,"checked_criteria":["meaning","terminology"]}`, "")
	if res.StatusCode != http.StatusOK {
		t.Fatalf("POST self-check pass: %d %s", res.StatusCode, payload)
	}
	first := decode[study.AttemptEvaluation](t, payload)
	if first.ID <= 0 || first.Source != "self_check" || !first.Passed ||
		first.ScorePct != 100 || !slices.Equal(first.CheckedCriteria, []string{"meaning", "terminology"}) {
		t.Fatalf("unexpected self-check result: %+v", first)
	}

	res, payload = call(t, server, http.MethodGet,
		"/api/practice/presentations/"+transID+"/evaluation", "", "")
	if res.StatusCode != http.StatusOK {
		t.Fatalf("GET evaluation: %d %s", res.StatusCode, payload)
	}
	view := decode[evaluationViewWire](t, payload)
	if view.Evaluation == nil || view.Evaluation.ID != first.ID || !view.Evaluation.Passed {
		t.Fatalf("unexpected restored self-check view: %+v", view.Evaluation)
	}

	// Append-only re-evaluation: newer self-check row wins.
	res, payload = call(t, server, http.MethodPost,
		"/api/practice/presentations/"+transID+"/self-check",
		`{"passed":false,"checked_criteria":[]}`, "")
	if res.StatusCode != http.StatusOK {
		t.Fatalf("POST self-check retry: %d %s", res.StatusCode, payload)
	}
	second := decode[study.AttemptEvaluation](t, payload)
	if second.ID <= first.ID || second.Passed || second.ScorePct != 0 {
		t.Fatalf("expected newer append-only row with passed=false: %+v", second)
	}
	_, payload = call(t, server, http.MethodGet,
		"/api/practice/presentations/"+transID+"/evaluation", "", "")
	view = decode[evaluationViewWire](t, payload)
	if view.Evaluation == nil || view.Evaluation.ID != second.ID || view.Evaluation.Passed {
		t.Fatalf("latest evaluation did not win: %+v", view.Evaluation)
	}

	// Guardrails: unanswered (400), nonexistent (404), non-written (400), invalid ID (400),
	// and exam presentation IDs (400) are rejected.
	missingID := "eval-nonexistent-pres-001"
	for _, tc := range []struct {
		method, path, body string
		status             int
	}{
		{http.MethodPost, "/api/practice/presentations/" + unansweredID + "/self-check", `{"passed":true}`, 400},
		{http.MethodGet, "/api/practice/presentations/" + unansweredID + "/evaluation", "", 400},
		{http.MethodPost, "/api/practice/presentations/" + missingID + "/self-check", `{"passed":true}`, 404},
		{http.MethodGet, "/api/practice/presentations/" + missingID + "/evaluation", "", 404},
		{http.MethodPost, "/api/practice/presentations/" + tfID + "/self-check", `{"passed":true}`, 400},
		{http.MethodGet, "/api/practice/presentations/" + tfID + "/evaluation", "", 400},
		{http.MethodPost, "/api/practice/presentations/bad/self-check", `{"passed":true}`, 400},
		{http.MethodGet, "/api/practice/presentations/bad/evaluation", "", 400},
		{http.MethodPost, "/api/practice/presentations/exam-a7990000-0000-4000-8000-000000000001-0/self-check", `{"passed":true}`, 400},
		{http.MethodGet, "/api/practice/presentations/exam-a7990000-0000-4000-8000-000000000001-0/evaluation", "", 400},
	} {
		res, body := call(t, server, tc.method, tc.path, tc.body, "")
		if res.StatusCode != tc.status {
			t.Fatalf("%s %s: got %d want %d (%s)", tc.method, tc.path, res.StatusCode, tc.status, body)
		}
	}
}
