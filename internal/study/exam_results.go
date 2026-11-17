package study

import (
	"context"
	"fmt"

	"test-driven-study/internal/storage/storedb"
)

func (r *examRecord) finish(ctx context.Context, q *storedb.Queries, now int64, reason string) error {
	var score int64
	for i, item := range r.paper {
		answer := r.answers[i]
		if answer.AnsweredAtMS == 0 {
			continue
		}
		matches, err := gradeAnswer(item.Question, answer.input())
		if err != nil {
			return err
		}
		correct := int64(0)
		if matches {
			correct = 1
			score += int64(r.rule.Points)
		}
		if err = r.recordAttempt(ctx, q, i, item, answer, correct); err != nil {
			return err
		}
	}
	r.row.Status = "finished"
	r.row.Score = score
	r.row.FinishedAtMs = now
	r.row.Reason = reason
	return nil
}

func (r *examRecord) recordAttempt(ctx context.Context, q *storedb.Queries, index int, item examPaperItem,
	answer examAnswer, correct int64) error {
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
	choicesJSON, expectedJSON, err := encodeAttempt(item.Question, answer.input())
	if err != nil {
		return err
	}
	return q.CreateAttempt(ctx, storedb.CreateAttemptParams{PresentationID: id,
		QuestionID: item.Question.QuestionID, SubjectID: item.Question.SubjectID, ChapterID: item.Question.ChapterID,
		ChapterName: item.Question.ChapterName, QuestionTitle: item.Question.Title, QuestionRevision: revision,
		SelectedJson: choicesJSON, CorrectAnswerJson: expectedJSON, IsCorrect: correct,
		PriorExposure: item.PriorExposure, OpenedAtMs: r.row.StartedAtMs, AnsweredAtMs: answer.AnsweredAtMS})
}
