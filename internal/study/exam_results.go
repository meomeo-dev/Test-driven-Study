package study

import (
	"context"
	"fmt"
	"math"

	"test-driven-study/internal/storage/storedb"
)

func (r *examRecord) finish(ctx context.Context, q *storedb.Queries, now int64, reason string) error {
	var score float64
	for i, item := range r.paper {
		answer := r.answers[i]
		if answer.AnsweredAtMS == 0 {
			continue
		}
		credit, err := scoreAnswer(item.Question, answer.input())
		if err != nil {
			return err
		}
		score += credit * float64(r.rule.Points)
		if err = r.recordAttempt(ctx, q, i, item, answer, credit); err != nil {
			return err
		}
	}
	r.row.Status = "finished"
	r.row.Score = wholeExamPoints(score)
	r.row.FinishedAtMs = now
	r.row.Reason = reason
	return nil
}

func (r *examRecord) recordAttempt(ctx context.Context, q *storedb.Queries, index int, item examPaperItem,
	answer examAnswer, credit float64) error {
	id := fmt.Sprintf("exam-%s-%d", r.row.ID, index)
	revision := item.Revision
	if revision == "" {
		revision = questionRevision(item.Question)
	}
	err := q.CreatePresentation(ctx, storedb.CreatePresentationParams{ID: id, QuestionID: item.Question.QuestionID,
		QuestionRevision: revision, OpenedAtMs: r.row.StartedAtMs, PriorExposure: item.PriorExposure})
	if err != nil {
		return err
	}
	choicesJSON, expectedJSON, err := encodeAttempt(item.Question, answer.input(), credit)
	if err != nil {
		return err
	}
	correct := int64(0)
	if credit == 1 {
		correct = 1
	}
	return q.CreateAttempt(ctx, storedb.CreateAttemptParams{PresentationID: id,
		QuestionID: item.Question.QuestionID, SubjectID: item.Question.SubjectID, ChapterID: item.Question.ChapterID,
		ChapterName: item.Question.ChapterName, QuestionTitle: item.Question.Title, QuestionRevision: revision,
		SelectedJson: choicesJSON, CorrectAnswerJson: expectedJSON, IsCorrect: correct,
		PriorExposure: item.PriorExposure, OpenedAtMs: r.row.StartedAtMs, AnsweredAtMs: answer.AnsweredAtMS})
}

// The terminal stores whole points. Sum fractional credit across the paper
// before taking the floor; the tolerance corrects floating-point drift.
func wholeExamPoints(points float64) int64 {
	return int64(math.Floor(points + 1e-9))
}
