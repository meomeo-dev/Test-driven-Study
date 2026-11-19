package study_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"strings"
	"testing"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage"
	"test-driven-study/internal/study"
)

func TestTypeHandlerRegistryCoversAllQuestionTypes(t *testing.T) {
	for _, qt := range course.AllQuestionTypes() {
		h, ok := study.TypeHandlerFor(qt)
		if !ok {
			t.Fatalf("missing TypeHandler for %q", qt)
		}
		if h.Type != qt || h.Project == nil || h.ToPublic == nil ||
			h.NormalizeInput == nil || h.Score == nil || h.EncodeAttempt == nil ||
			h.IsEligibleExam == nil || h.PrepareExamItem == nil ||
			h.ExamAudioSpeeds == nil || h.ExamSpeechLine == nil ||
			h.ExamReview == nil || h.TranscriptText == nil {
			t.Fatalf("incomplete TypeHandler for %q: %+v", qt, h)
		}
		if h.MediaCapable != qt.IsMediaCapable() {
			t.Fatalf("MediaCapable mismatch for %q: %v vs %v", qt, h.MediaCapable, qt.IsMediaCapable())
		}
	}
}

func TestProjectorVisibilityAndCrossTypeIsolationMatrix(t *testing.T) {
	s, _, subject := setupExtendedCourse(t)
	ctx := context.Background()
	rows, err := s.PracticeQuestions(ctx, study.Filter{SubjectID: subject, ChapterID: -1, State: "all"})
	if err != nil || len(rows) == 0 {
		t.Fatalf("load extended rows: %v", err)
	}

	seenTypes := map[course.QuestionType]bool{}
	for _, row := range rows {
		seenTypes[row.QuestionType] = true
		detail, err := s.Detail(ctx, row.QuestionID)
		if err != nil {
			t.Fatalf("detail %d: %v", row.QuestionID, err)
		}
		q := detail.Question
		if !q.QuestionType.IsMediaCapable() {
			assertNoMediaJSON(t, q.QuestionType, "Question", q)
			transcript, err := s.QuestionTranscript(ctx, q)
			if err != nil || transcript != "" {
				t.Fatalf("%s returned transcript %q (%v)", q.QuestionType, transcript, err)
			}
		}

		for _, vis := range []study.Visibility{
			study.VisibilityPractice,
			study.VisibilityActiveExam,
			study.VisibilityFinishedExam,
		} {
			pub := study.ToPublic(q, vis)
			wire, err := json.Marshal(pub)
			if err != nil {
				t.Fatalf("marshal public %s: %v", q.QuestionType, err)
			}
			for _, secret := range []string{`"answer":`, `"analysis":`, `"skill":`, `"question_review":`, `"number_tolerance":`} {
				if bytes.Contains(wire, []byte(secret)) {
					t.Fatalf("%s (vis=%d) leaked %s: %s", q.QuestionType, vis, secret, wire)
				}
			}
			if !q.QuestionType.IsMediaCapable() {
				assertNoMediaJSON(t, q.QuestionType, "PublicQuestion", pub)
			} else if vis == study.VisibilityActiveExam {
				if bytes.Contains(wire, []byte(`"transcript_url":`)) || bytes.Contains(wire, []byte(`"transcript_lines":`)) {
					t.Fatalf("%s active exam leaked transcript: %s", q.QuestionType, wire)
				}
			}
		}

		assertCrossTypeRejections(t, ctx, s, q)
	}

	for _, qt := range course.AllQuestionTypes() {
		if !seenTypes[qt] {
			t.Fatalf("matrix did not cover %q", qt)
		}
	}
}

func assertNoMediaJSON(t *testing.T, qt course.QuestionType, label string, v any) {
	t.Helper()
	wire, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal %s (%s): %v", label, qt, err)
	}
	for _, forbidden := range []string{`"audio_url":`, `"transcript_url":`, `"transcript_lines":`, `"items":`} {
		if bytes.Contains(wire, []byte(forbidden)) {
			t.Fatalf("%s for non-media %s emitted %s: %s", label, qt, forbidden, wire)
		}
	}
}

func assertCrossTypeRejections(t *testing.T, ctx context.Context, s *study.Service, q study.Question) {
	t.Helper()
	presID := "matrix-" + string(q.QuestionType) + "-" + q.SourceItemID
	if _, err := s.OpenPresentation(ctx, presID, q.QuestionID); err != nil {
		t.Fatalf("open presentation %s: %v", presID, err)
	}

	invalidByType := map[course.QuestionType][]string{
		course.SingleChoice:   {`{"numeric":"1"}`, `{"value":true}`, `{"blanks":{"1":["a"]}}`, `{"sub_answers":{"q":["a"]}}`, `{"text":"hello"}`, `{"translation":"hi"}`},
		course.MultipleChoice: {`{"numeric":"1"}`, `{"value":true}`, `{"blanks":{"1":["a"]}}`, `{"sub_answers":{"q":["a"]}}`, `{"text":"hello"}`, `{"translation":"hi"}`},
		course.TrueFalse:      {`{"numeric":"1"}`, `{"blanks":{"1":["a"]}}`, `{"sub_answers":{"q":["a"]}}`, `{"text":"hello"}`, `{"translation":"hi"}`},
		course.Numeric:        {`{"selected":[1]}`, `{"value":true}`, `{"blanks":{"1":["a"]}}`, `{"sub_answers":{"q":["a"]}}`, `{"text":"hello"}`, `{"translation":"hi"}`},
		course.Cloze:          {`{"selected":[1]}`, `{"numeric":"1"}`, `{"value":true}`, `{"sub_answers":{"q":["a"]}}`, `{"text":"hello"}`, `{"translation":"hi"}`},
		course.Listening:      {`{"selected":[1]}`, `{"numeric":"1"}`, `{"value":true}`, `{"blanks":{"1":["a"]}}`, `{"text":"hello"}`, `{"translation":"hi"}`},
		course.Reading:        {`{"selected":[1]}`, `{"numeric":"1"}`, `{"value":true}`, `{"blanks":{"1":["a"]}}`, `{"text":"hello"}`, `{"translation":"hi"}`},
		course.Writing:        {`{"selected":[1]}`, `{"numeric":"1"}`, `{"value":true}`, `{"blanks":{"1":["a"]}}`, `{"sub_answers":{"q":["a"]}}`, `{"translation":"hi"}`},
		course.Translation:    {`{"selected":[1]}`, `{"numeric":"1"}`, `{"value":true}`, `{"blanks":{"1":["a"]}}`, `{"sub_answers":{"q":["a"]}}`, `{"text":"hello"}`},
	}

	for _, payload := range invalidByType[q.QuestionType] {
		var input study.AnswerInput
		if err := json.Unmarshal([]byte(payload), &input); err != nil {
			t.Fatal(err)
		}
		if _, err := s.SubmitResponse(ctx, presID, input); !errors.Is(err, study.ErrInvalid) {
			t.Fatalf("%s accepted foreign input %s: got %v, want ErrInvalid", q.QuestionType, payload, err)
		}
	}
}

func TestAttemptIncludesQuestionTypeInSubmissionAndAnalysis(t *testing.T) {
	ctx := context.Background()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	db, err := storage.Open(ctx, root, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := storage.InstallCourse(ctx, db, filepath.Join(root, "courses", "golden-course-template")); err != nil {
		t.Fatal(err)
	}
	s := study.New(db, root)
	courses, err := s.Courses(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var subject int64
	for _, entry := range courses {
		if entry.ID == "golden-course-template" {
			subject = entry.Units[0].SubjectID
		}
	}
	rows, err := s.PracticeQuestions(ctx, study.Filter{SubjectID: subject, ChapterID: -1, State: "all"})
	if err != nil {
		t.Fatal(err)
	}
	var writingID int64
	for _, r := range rows {
		if r.QuestionType == course.Writing {
			writingID = r.QuestionID
			break
		}
	}
	if writingID == 0 {
		t.Fatal("writing question missing")
	}
	const presID = "attempt-question-type-check"
	if _, err := s.OpenPresentation(ctx, presID, writingID); err != nil {
		t.Fatal(err)
	}
	res, err := s.SubmitResponse(ctx, presID, extendedInput(t, `{"text":"The delivery has been moved to Friday."}`))
	if err != nil {
		t.Fatal(err)
	}
	if res.Attempt.QuestionType != course.Writing {
		t.Fatalf("attempt QuestionType got %q, want %q", res.Attempt.QuestionType, course.Writing)
	}
	analysis, err := s.Analysis(ctx, subject, 30)
	if err != nil || len(analysis.RecentAttempts) != 1 {
		t.Fatalf("analysis failed: %+v, %v", analysis, err)
	}
	if analysis.RecentAttempts[0].QuestionType != course.Writing {
		t.Fatalf("analysis RecentAttempts[0].QuestionType got %q, want %q",
			analysis.RecentAttempts[0].QuestionType, course.Writing)
	}
	wire, err := json.Marshal(analysis.RecentAttempts[0])
	if err != nil || !strings.Contains(string(wire), `"question_type":"writing"`) {
		t.Fatalf("serialized Attempt missing canonical question_type: %s, %v", wire, err)
	}
}
