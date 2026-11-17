package study

import (
	"context"

	"test-driven-study/internal/storage/storedb"
)

func (r *examRecord) commitAnswer(ctx context.Context, q *storedb.Queries,
	index int, input AnswerInput, now int64) error {
	if index < 0 || index >= len(r.paper) {
		return ErrInvalid
	}
	answer, err := normalizeAnswer(r.paper[index].Question, input)
	if err != nil {
		return err
	}
	previous := r.answers[index]
	if previous.AnsweredAtMS != 0 {
		if sameAnswer(previous.input(), answer) {
			return nil
		}
		return ErrConflict
	}
	if r.row.Status != "in_progress" {
		return ErrConflict
	}
	r.answers[index].Selected = answer.Selected
	if answer.Numeric != nil {
		r.answers[index].Selected = []int64{}
	}
	r.answers[index].Numeric = answer.Numeric
	r.answers[index].AnsweredAtMS = now
	lost, err := r.lostPoints()
	if err != nil {
		return err
	}
	if r.rule.Count*r.rule.Points-lost < r.rule.PassScore {
		return r.finish(ctx, q, now, "failed_limit")
	}
	return nil
}

func (r *examRecord) lostPoints() (int, error) {
	lost := 0
	for i, answer := range r.answers {
		if answer.AnsweredAtMS == 0 {
			continue
		}
		correct, err := gradeAnswer(r.paper[i].Question, answer.input())
		if err != nil {
			return 0, err
		}
		if !correct {
			lost += r.rule.Points
		}
	}
	return lost, nil
}

// NavigateExam commits a pending choice and moves the cursor in one transaction.
// Retrying a lost response cannot commit twice or leave the cursor half updated.
func (s *Service) NavigateExam(ctx context.Context, id string,
	from, target int, selected []int64) (ExamSession, error) {
	return s.NavigateExamResponse(ctx, id, from, target, AnswerInput{Selected: selected})
}

func (s *Service) NavigateExamResponse(ctx context.Context, id string,
	from, target int, input AnswerInput) (ExamSession, error) {
	return s.editExam(ctx, id, func(r *examRecord, q *storedb.Queries, now int64) error {
		if from < 0 || from >= len(r.paper) || target < 0 || target >= len(r.paper) {
			return ErrInvalid
		}
		if r.row.Status != "in_progress" || r.row.CurrentIndex != int64(from) {
			// A repeated successful navigation may arrive after the cursor moved
			// or its answer ended the paper. Only an identical commitment can replay.
			if input.HasAnswer() && r.answers[from].AnsweredAtMS != 0 &&
				(r.row.CurrentIndex == int64(target) || r.row.Status == "finished") {
				answer, err := normalizeAnswer(r.paper[from].Question, input)
				if err != nil {
					return err
				}
				if sameAnswer(answer, r.answers[from].input()) {
					return nil
				}
			}
			if !input.HasAnswer() && r.row.Status == "in_progress" && r.row.CurrentIndex == int64(target) {
				return nil
			}
			return ErrConflict
		}
		if input.HasAnswer() {
			if err := r.commitAnswer(ctx, q, from, input, now); err != nil {
				return err
			}
		}
		if r.row.Status == "in_progress" {
			r.row.CurrentIndex = int64(target)
		}
		return nil
	})
}
