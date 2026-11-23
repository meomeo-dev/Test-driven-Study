package httpapi_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"test-driven-study/internal/course"
	"test-driven-study/internal/httpapi"
	"test-driven-study/internal/llm"
	"test-driven-study/internal/storage"
	"test-driven-study/internal/study"
)

type deadlineRecorder struct {
	*httptest.ResponseRecorder
	deadline    time.Time
	deadlineSet bool
}

func (r *deadlineRecorder) SetWriteDeadline(deadline time.Time) error {
	r.deadline = deadline
	r.deadlineSet = true
	return nil
}

func setupWrittenFeedbackHandler(t *testing.T, providerURL string) (http.Handler, string) {
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
	if subject == 0 {
		t.Fatal("golden-course-template extended-practice unit not found")
	}
	rows, err := studyService.PracticeQuestions(ctx, study.Filter{
		SubjectID: subject, ChapterID: -1, State: "all",
	})
	if err != nil {
		t.Fatal(err)
	}
	var writingID int64
	for _, row := range rows {
		if row.QuestionType == course.Writing {
			writingID = row.QuestionID
			break
		}
	}
	if writingID == 0 {
		t.Fatal("writing question not found in extended-practice")
	}
	presentationID := "written-feedback-http-test-001"
	if _, err := studyService.OpenPresentation(ctx, presentationID, writingID); err != nil {
		t.Fatal(err)
	}
	var input study.AnswerInput
	if err := json.Unmarshal(
		[]byte(`{"text":"The delivery has been moved to Friday."}`), &input,
	); err != nil {
		t.Fatal(err)
	}
	if _, err := studyService.SubmitResponse(ctx, presentationID, input); err != nil {
		t.Fatal(err)
	}
	planner, err := llm.New(ctx, llm.Options{
		DB:            db,
		DataDirectory: dataDir,
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
	handler := httpapi.New(studyService, nil, root, "43188", "43187", planner)
	return handler, presentationID
}

func mockWrittenFeedbackProvider(t *testing.T, delay time.Duration) *httptest.Server {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/responses" {
			w.WriteHeader(http.StatusNotFound)
			return
		}
		var body map[string]any
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		format, _ := body["text"].(map[string]any)["format"].(map[string]any)
		if format["type"] != "json_schema" || format["strict"] != true ||
			format["name"] != "written_feedback" {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		var evidence struct {
			Rubric map[string]int `json:"rubric"`
		}
		input, _ := body["input"].(string)
		if err := json.Unmarshal([]byte(input), &evidence); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		if delay > 0 {
			time.Sleep(delay)
		}
		criteria := make([]map[string]any, 0, len(evidence.Rubric))
		for name, maxPoints := range evidence.Rubric {
			criteria = append(criteria, map[string]any{
				"name":       name,
				"points":     maxPoints,
				"max_points": maxPoints,
				"comment":    "满足评分要求。",
			})
		}
		text, _ := json.Marshal(map[string]any{
			"criteria": criteria,
			"summary":  "表达准确清晰。",
		})
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status": "completed",
			"output": []any{map[string]any{
				"type":   "message",
				"role":   "assistant",
				"status": "completed",
				"content": []any{map[string]string{
					"type": "output_text",
					"text": string(text),
				}},
			}},
		})
	}))
	t.Cleanup(server.Close)
	return server
}

func TestWrittenFeedbackExtendsWriteDeadlinePastServerTimeout(t *testing.T) {
	provider := mockWrittenFeedbackProvider(t, 250*time.Millisecond)
	handler, presentationID := setupWrittenFeedbackHandler(t, provider.URL)
	server := httptest.NewUnstartedServer(handler)
	server.Config.WriteTimeout = 100 * time.Millisecond
	server.Start()
	defer server.Close()

	req, err := http.NewRequest(
		http.MethodPost,
		server.URL+"/api/practice/presentations/"+presentationID+"/feedback",
		strings.NewReader("{}"),
	)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := server.Client().Do(req)
	if err != nil {
		t.Fatalf("written feedback failed under tight WriteTimeout: %v", err)
	}
	defer res.Body.Close()
	payload, err := io.ReadAll(res.Body)
	if err != nil {
		t.Fatal(err)
	}
	if res.StatusCode != http.StatusOK {
		t.Fatalf("got %d: %s", res.StatusCode, payload)
	}
	var feedback llm.WrittenFeedback
	if err := json.Unmarshal(payload, &feedback); err != nil {
		t.Fatal(err)
	}
	if feedback.Summary != "表达准确清晰。" || len(feedback.Criteria) == 0 {
		t.Fatalf("unexpected feedback payload: %+v", feedback)
	}
}

func TestWrittenFeedbackWriteDeadlineExceedsLLMTimeout(t *testing.T) {
	provider := mockWrittenFeedbackProvider(t, 0)
	handler, presentationID := setupWrittenFeedbackHandler(t, provider.URL)

	before := time.Now()
	req := httptest.NewRequest(
		http.MethodPost,
		"http://127.0.0.1:43188/api/practice/presentations/"+presentationID+"/feedback",
		strings.NewReader("{}"),
	)
	req.Header.Set("Content-Type", "application/json")
	rec := &deadlineRecorder{ResponseRecorder: httptest.NewRecorder()}
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("got %d: %s", rec.Code, rec.Body.String())
	}
	if !rec.deadlineSet {
		t.Fatal("SetWriteDeadline was not invoked")
	}
	minExpected := before.Add(llm.WrittenFeedbackTimeout)
	if rec.deadline.Before(minExpected) {
		t.Fatalf("write deadline %v is shorter than LLM timeout (%v)",
			rec.deadline.Sub(before), llm.WrittenFeedbackTimeout)
	}
}
