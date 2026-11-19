package study_test

import (
	"context"
	"errors"
	"testing"

	"test-driven-study/internal/course"
	"test-driven-study/internal/testsupport"

	"test-driven-study/internal/study"
)

func TestExamNavigationCommitsAtomicallyAndReplaysWithoutDuplicates(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	s, db, _, _ := practiceDB(t)
	ctx := context.Background()
	id := "a7000000-0000-4000-8000-000000000001"
	paper, err := s.CreateExam(ctx, id, 1)
	if err != nil {
		t.Fatal(err)
	}
	answer := examExpected(t, s, paper.Items[0].Detail.Question.QuestionID)
	if _, err = s.NavigateExam(ctx, id, 0, 100, answer); !errors.Is(err, study.ErrInvalid) {
		t.Fatal("invalid destination accepted")
	}
	paper, _ = s.GetExam(ctx, id)
	if paper.Items[0].Answered || paper.CurrentIndex != 0 {
		t.Fatal("invalid navigation partially committed")
	}
	for range 2 {
		paper, err = s.NavigateExam(ctx, id, 0, 1, answer)
		if err != nil || paper.CurrentIndex != 1 || !paper.Items[0].Answered ||
			paper.Items[0].Correct == nil || !*paper.Items[0].Correct ||
			paper.Items[1].Correct != nil || paper.Items[1].Review != nil || paper.Score != nil {
			t.Fatal("atomic navigation or feedback boundary failed", err)
		}
	}
	if _, err = s.NavigateExam(ctx, id, 5, 1, []int64{1}); !errors.Is(err, study.ErrConflict) {
		t.Fatal("stale navigation committed another unanswered question")
	}
	paper, err = s.NavigateExam(ctx, id, 1, 12, nil)
	if err != nil || paper.Items[1].Answered || paper.Items[5].Answered || paper.CurrentIndex != 12 {
		t.Fatal("skip behavior changed", err)
	}
	for range 2 {
		if _, err = s.FinishExam(ctx, id); err != nil {
			t.Fatal(err)
		}
	}
	var count int
	db.QueryRow("SELECT count(*) FROM answer_attempts").Scan(&count)
	if count != 1 {
		t.Fatal("replayed navigation duplicated learning attempts", count)
	}
}

func TestExamShuffledOptionsKeepSourceRevisionAndStableAnswerSigns(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	s, db, _, _ := practiceDB(t)
	ctx := context.Background()
	id := "a7000000-0000-4000-8000-000000000002"
	paper, err := s.CreateExam(ctx, id, 1)
	if err != nil {
		t.Fatal(err)
	}
	item := paper.Items[40]
	if item.Detail.Question.QuestionType != course.SingleChoice {
		t.Fatal("recorded terminal section order changed")
	}
	source, _ := s.Detail(ctx, item.Detail.Question.QuestionID)
	presentation, _ := s.OpenPresentation(ctx, "revision-compare-exam", source.Question.QuestionID)
	answer := examExpected(t, s, source.Question.QuestionID)
	if _, err = s.AnswerExam(ctx, id, 40, answer); err != nil {
		t.Fatal(err)
	}
	result, err := s.FinishExam(ctx, id)
	if err != nil || *result.Score != 1 || !*result.Items[40].Correct {
		t.Fatal("option shuffle changed grading", err)
	}
	var revision string
	db.QueryRow("SELECT question_revision FROM answer_attempts WHERE presentation_id=?", "exam-"+id+"-40").Scan(&revision)
	var sourceRevision string
	db.QueryRow("SELECT question_revision FROM practice_presentations WHERE id=?", presentation.ID).Scan(&sourceRevision)
	if revision != sourceRevision || revision == "" {
		t.Fatal("option shuffle fabricated a new source revision")
	}
}
