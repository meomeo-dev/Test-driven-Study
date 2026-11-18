package study

import (
	"context"
	"encoding/json"

	"test-driven-study/internal/course"
)

// WrittenFeedbackSource uses the version presented to the learner, even if a
// newer course version has since replaced the current question.
func (s *Service) WrittenFeedbackSource(ctx context.Context, id string) (
	course.Item, course.ExtendedResponse, error,
) {
	if !validEventID(id) {
		return course.Item{}, course.ExtendedResponse{}, ErrInvalid
	}
	row, err := s.queries.GetAttempt(ctx, id)
	if err != nil {
		return course.Item{}, course.ExtendedResponse{}, err
	}
	attempt, err := attemptValue(row)
	if err != nil {
		return course.Item{}, course.ExtendedResponse{}, err
	}
	if attempt.Response == nil || (attempt.Response.Text == nil && attempt.Response.Translation == nil) {
		return course.Item{}, course.ExtendedResponse{}, ErrInvalid
	}
	payload, err := s.queries.GetPresentationSnapshot(ctx, id)
	if err != nil {
		return course.Item{}, course.ExtendedResponse{}, err
	}
	var question Question
	if err := json.Unmarshal([]byte(payload), &question); err != nil {
		return course.Item{}, course.ExtendedResponse{}, err
	}
	if question.QuestionReview == nil {
		return course.Item{}, course.ExtendedResponse{}, ErrInvalid
	}
	return *question.QuestionReview, *attempt.Response, nil
}
