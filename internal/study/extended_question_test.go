package study_test

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"slices"
	"strings"
	"testing"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage"
	"test-driven-study/internal/storage/storedb"
	"test-driven-study/internal/study"
)

func TestV2PracticeUsesSavedAttemptAndHidesReview(t *testing.T) {
	s, queries, subject := setupExtendedCourse(t)
	ctx := context.Background()
	rows, err := s.PracticeQuestions(ctx, study.Filter{SubjectID: subject, ChapterID: -1, State: "all"})
	if err != nil || len(rows) != 15 {
		t.Fatalf("projected questions: %v, %v", rows, err)
	}
	presentationID := "saved-v2-written-attempt"
	presentation, err := s.OpenPresentation(ctx, presentationID, rows[3].QuestionID)
	if err != nil || presentation.Detail.Question.Content == nil {
		t.Fatalf("writing presentation: %+v, %v", presentation, err)
	}
	wire, _ := json.Marshal(presentation)
	for _, secret := range []string{"question_review", "sample_response", "rubric", "keywords"} {
		if bytes.Contains(wire, []byte(secret)) {
			t.Fatalf("practice leaked %s: %s", secret, wire)
		}
	}
	input := extendedInput(t, `{"text":"The delivery has been moved to Friday.","word_count":500}`)
	first, err := s.SubmitResponse(ctx, presentationID, input)
	if err != nil || first.Attempt.Score == nil || *first.Attempt.Score != 1 ||
		*first.Attempt.Response.WordCount != 7 {
		t.Fatalf("writing attempt: %+v, %v", first.Attempt, err)
	}
	retry, err := s.SubmitResponse(ctx, presentationID,
		extendedInput(t, `{"text":"The delivery has been moved to Friday."}`))
	if err != nil || retry.Attempt.ID != first.Attempt.ID {
		t.Fatalf("idempotent retry: %+v, %v", retry.Attempt, err)
	}
	if _, err := s.SubmitResponse(ctx, presentationID,
		extendedInput(t, `{"text":"The delivery has been cancelled."}`)); !errors.Is(err, study.ErrConflict) {
		t.Fatalf("changed retry was not rejected: %v", err)
	}
	item, answer, err := s.WrittenFeedbackSource(ctx, presentationID)
	if err != nil || item.Type != course.Writing || *answer.Text != *input.Text {
		t.Fatalf("feedback must use saved data: %+v, %+v, %v", item, answer, err)
	}
	judgmentID := "saved-v2-judgment-attempt"
	if _, err := s.OpenPresentation(ctx, judgmentID, rows[5].QuestionID); err != nil {
		t.Fatal(err)
	}
	judgment, err := s.SubmitResponse(ctx, judgmentID, extendedInput(t, `{"value":false}`))
	if err != nil || !judgment.Attempt.Correct || len(judgment.Attempt.Selected) != 1 {
		t.Fatalf("Boolean response: %+v, %v", judgment.Attempt, err)
	}
	saved, err := queries.GetAttempt(ctx, judgmentID)
	if err != nil || saved.SelectedJson != `{"value":false}` {
		t.Fatalf("Boolean response was not persisted: %s, %v", saved.SelectedJson, err)
	}
}

func TestV2ExamKeepsListeningAudioAndPartialCreditInSnapshot(t *testing.T) {
	s, _, subject := setupExtendedCourse(t)
	ctx := context.Background()
	id := "a7990000-0000-4000-8000-000000000001"
	paper, err := s.CreateExam(ctx, id, subject)
	if err != nil || len(paper.Items) != 15 {
		t.Fatalf("create exam: %+v, %v", paper, err)
	}
	listening := slices.IndexFunc(paper.Items, func(i study.ExamItem) bool {
		return i.Detail.Question.SourceItemID == "sue1-extended-listening"
	})
	cloze := slices.IndexFunc(paper.Items, func(i study.ExamItem) bool {
		return i.Detail.Question.QuestionType == course.Cloze
	})
	if listening < 0 || cloze < 0 {
		t.Fatalf("new types are missing from the paper: %+v", paper.Items)
	}
	prompt := paper.Items[listening]
	if prompt.Review != nil || len(prompt.Detail.Question.TranscriptLines) != 0 ||
		!slices.Equal(prompt.AudioSpeeds, []float64{1, .9}) {
		t.Fatalf("invalid public listening prompt: %+v", prompt)
	}
	line, err := s.ExamSpeech(ctx, id, listening, 0)
	if err != nil || line.TTS.Config.Voice != "tide" || line.Text == "" {
		t.Fatalf("protected listening playback: %+v, %v", line, err)
	}
	detail, err := s.Detail(ctx, prompt.Detail.Question.QuestionID)
	if err != nil {
		t.Fatal(err)
	}
	transcript, err := s.QuestionTranscript(ctx, detail.Question)
	if err != nil || !strings.Contains(transcript, "M: "+line.Text) {
		t.Fatalf("inline transcript should also be usable as lesson evidence: %s, %v", transcript, err)
	}

	paper, err = s.AnswerExamResponse(ctx, id, listening,
		extendedInput(t, `{"sub_answers":{"location":["second"],"checklist":false}}`))
	if err != nil || paper.Status != "in_progress" {
		t.Fatalf("listening commit: %v, %v", paper.Status, err)
	}
	if q := paper.Items[listening].Review; q == nil ||
		len(q.TranscriptLines) != 0 || q.QuestionReview.Transcript != nil {
		t.Fatalf("active review disclosed the transcript: %+v", q)
	}
	if _, err := s.AnswerExamResponse(ctx, id, cloze,
		extendedInput(t, `{"blanks":{"1":["must"]}}`)); err != nil {
		t.Fatal(err)
	}
	paper, err = s.FinishExam(ctx, id)
	if err != nil || paper.Score == nil || *paper.Score != 1 || *paper.Items[cloze].Credit != .5 ||
		len(paper.Items[listening].Detail.Question.TranscriptLines) != 2 {
		t.Fatalf("partial credit or transcript reveal failed: %+v, %v", paper, err)
	}
}

func setupExtendedCourse(t *testing.T) (*study.Service, *storedb.Queries, int64) {
	t.Helper()
	ctx := context.Background()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	db, err := storage.Open(ctx, root, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	if _, err := storage.InstallCourse(ctx, db, filepath.Join(root, "courses", "step-up-english-1")); err != nil {
		t.Fatal(err)
	}
	s := study.New(db, root)
	courses, err := s.Courses(ctx)
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range courses {
		if entry.ID == "step-up-english-1" {
			for _, unit := range entry.Units {
				if unit.ID == "extended-practice" {
					return s, storedb.New(db), unit.SubjectID
				}
			}
		}
	}
	t.Fatal("bundled extended-practice unit was not installed")
	return nil, nil, 0
}

func extendedInput(t *testing.T, value string) study.AnswerInput {
	t.Helper()
	var input study.AnswerInput
	if err := json.Unmarshal([]byte(value), &input); err != nil {
		t.Fatal(err)
	}
	return input
}
