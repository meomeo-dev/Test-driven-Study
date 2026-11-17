package study

import (
	"context"

	"test-driven-study/internal/course"
)

type ExamRule = course.ExamRule

func (s *Service) ExamRules(subject int64) (ExamRule, error) {
	return s.ExamRulesForUnit(context.Background(), subject)
}

func (s *Service) ExamRulesForUnit(ctx context.Context, subject int64) (ExamRule, error) {
	return s.defaultExamRules(ctx, subject)
}

func (s *Service) defaultExamRules(ctx context.Context, subject int64) (ExamRule, error) {
	if _, err := s.WorkspaceUnit(ctx, subject); err != nil {
		return ExamRule{}, ErrInvalid
	}
	pool, err := s.eligibleExamQuestions(ctx, subject)
	if err != nil {
		return ExamRule{}, err
	}
	count := min(len(pool), 20)
	if count == 0 {
		return ExamRule{}, ErrInvalid
	}
	return ExamRule{
		SubjectID: subject,
		Count:     count,
		Minutes:   max(5, count),
		Points:    1,
		PassScore: (9*count + 9) / 10,
		Version:   "default-1",
	}, nil
}
