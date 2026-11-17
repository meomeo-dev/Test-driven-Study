package study_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"

	"test-driven-study/internal/testsupport"

	"test-driven-study/internal/storage"
	"test-driven-study/internal/study"
)

func practiceDB(t *testing.T) (*study.Service, *sql.DB, string, string) {
	t.Helper()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	directory := t.TempDir()
	db, err := storage.Open(context.Background(), root, directory)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return study.New(db, root), db, root, directory
}

func TestPracticeWithholdsAnswersGradesAndRetainsHistory(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	ctx := context.Background()
	service, db, root, directory := practiceDB(t)
	id := "presentation-test-first-0001"
	opened, err := service.OpenPresentation(ctx, id, 4)
	if err != nil {
		t.Fatal(err)
	}
	encoded, _ := json.Marshal(opened)
	for _, field := range []string{`"answer":`, `"analysis":`, `"skill":`} {
		if strings.Contains(string(encoded), field) {
			t.Fatalf("leaked %s", field)
		}
	}
	again, _ := service.OpenPresentation(ctx, id, 4)
	if opened.OpenedAtMS != again.OpenedAtMS {
		t.Fatal("retry changed start timestamp")
	}
	wrong, err := service.SubmitAnswer(ctx, id, []int64{1})
	if err != nil || wrong.Attempt.Correct || !wrong.Attempt.FirstAttempt {
		t.Fatalf("wrong grade: %+v / %v", wrong, err)
	}
	if wrong.Attempt.AnsweredAtMS < opened.OpenedAtMS || wrong.Detail.Question.Analysis == "" {
		t.Fatal("missing chronology or feedback")
	}
	retry, err := service.SubmitAnswer(ctx, id, []int64{1})
	if err != nil || retry.Attempt.ID != wrong.Attempt.ID {
		t.Fatal("retry duplicated attempt")
	}
	if _, err := service.SubmitAnswer(ctx, id, []int64{2}); !errors.Is(err, study.ErrConflict) {
		t.Fatal("overwrote saved choices", err)
	}
	for _, choices := range [][]int64{nil, {9}, {1, 2}, {2, 2}} {
		if _, err := service.SubmitAnswer(ctx, id, choices); !errors.Is(err, study.ErrInvalid) {
			t.Fatal("accepted invalid selection", choices, err)
		}
	}
	second, err := service.OpenPresentation(ctx, "presentation-test-second-0002", 4)
	if err != nil || !second.PriorExposure || second.PriorAttempts != 1 {
		t.Fatal("lost repeat context", second, err)
	}
	correct, err := service.SubmitAnswer(ctx, second.ID, []int64{2})
	if err != nil || !correct.Attempt.Correct || correct.Attempt.FirstAttempt {
		t.Fatal("repeat grading", correct, err)
	}
	report, err := service.Analysis(ctx, 1, 30)
	if err != nil || report.Overall.Attempts != 2 || report.UniqueQuestions != 1 || report.LatestIncorrect != 0 || report.ImprovedQuestions != 1 {
		t.Fatal("history/latest distinction", report, err)
	}
	if _, err := db.Exec("UPDATE answer_attempts SET is_correct=1"); err == nil {
		t.Fatal("history was mutable")
	}
	if _, err := db.Exec("DELETE FROM answer_attempts"); err == nil {
		t.Fatal("history was deletable")
	}
	if err := service.SetPracticeCursor(ctx, 1, 6); err != nil {
		t.Fatal(err)
	}
	if err := service.SetCursor(ctx, 1, 4); err != nil {
		t.Fatal(err)
	}
	db.Close()
	reopened, err := storage.Open(ctx, root, directory)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	persisted := study.New(reopened, root)
	report, err = persisted.Analysis(ctx, 1, 0)
	if err != nil || report.Overall.Attempts != 2 {
		t.Fatal("attempts lost after reopen", err)
	}
	practice, _ := persisted.PracticeOverview(ctx, 1)
	memory, _ := persisted.Overview(ctx, 1)
	if practice.LastQuestionID != 6 || memory.LastQuestionID != 4 || practice.Correct != 1 {
		t.Fatal("cursor or latest state mismatch")
	}
}

func TestExactMultipleChoiceAndConcurrentRetry(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	ctx := context.Background()
	service, _, _, _ := practiceDB(t)
	rows, _ := service.PracticeQuestions(ctx, study.Filter{SubjectID: 4, ChapterID: -1, State: "all"})
	var question study.Question
	for _, row := range rows {
		if row.QuestionType == 2 {
			detail, _ := service.Detail(ctx, row.QuestionID)
			question = detail.Question
			break
		}
	}
	answer := []int64{}
	for _, part := range strings.Split(question.Answer, ",") {
		number, _ := strconv.ParseInt(part, 10, 64)
		answer = append(answer, number)
	}
	if len(answer) < 2 {
		t.Fatal("expected real multiple choice fixture")
	}
	p, _ := service.OpenPresentation(ctx, "presentation-multi-partial-001", question.QuestionID)
	partial, err := service.SubmitAnswer(ctx, p.ID, answer[:1])
	if err != nil || partial.Attempt.Correct {
		t.Fatal("partial multi-choice credited", err)
	}
	p, _ = service.OpenPresentation(ctx, "presentation-multi-retry-0002", question.QuestionID)
	slices.Reverse(answer)
	var group sync.WaitGroup
	ids := make(chan int64, 2)
	for index := 0; index < 2; index++ {
		group.Add(1)
		go func() {
			defer group.Done()
			result, err := service.SubmitAnswer(ctx, p.ID, answer)
			if err != nil {
				t.Error(err)
				return
			}
			if !result.Attempt.Correct {
				t.Error("exact set rejected")
			}
			ids <- result.Attempt.ID
		}()
	}
	group.Wait()
	close(ids)
	seen := map[int64]bool{}
	for id := range ids {
		seen[id] = true
	}
	if len(seen) != 1 {
		t.Fatal("concurrent retry duplicated event", seen)
	}
	report, _ := service.Analysis(ctx, 4, 30)
	if report.Overall.Attempts != 2 || report.ImprovedQuestions != 1 {
		t.Fatal("incorrect history aggregate", report)
	}
}

func TestExposureAndManualMarksAreNotAttempts(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	ctx := context.Background()
	service, _, _, _ := practiceDB(t)
	if err := service.RecordExposure(ctx, "exposure-test-event-00001", 4); err != nil {
		t.Fatal(err)
	}
	if err := service.SetProgress(ctx, 6, "mastered"); err != nil {
		t.Fatal(err)
	}
	report, _ := service.Analysis(ctx, 1, 30)
	if report.Overall.Attempts != 0 || report.RecentAccuracy != nil || report.Forecast.Score != nil {
		t.Fatal("counted passive activity as a score")
	}
	first, _ := service.OpenPresentation(ctx, "presentation-exposed-00001", 4)
	marked, _ := service.OpenPresentation(ctx, "presentation-marked-000002", 6)
	if !first.PriorExposure || !marked.PriorExposure || first.PriorAttempts != 0 {
		t.Fatal("exposure context missing")
	}
	if err := service.RecordExposure(ctx, "exposure-test-event-00001", 6); !errors.Is(err, study.ErrConflict) {
		t.Fatal("reused event ID for another question")
	}
}
