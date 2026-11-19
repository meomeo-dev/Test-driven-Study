package study

import (
	"reflect"
	"slices"

	"test-driven-study/internal/course"
)

type AnswerInput struct {
	course.ExtendedResponse
	Selected []int64 `json:"selected"`
	Numeric  *string `json:"numeric,omitempty"`
}

func (input AnswerInput) HasAnswer() bool {
	return len(input.Selected) != 0 || input.Numeric != nil || input.ExtendedResponse.HasAnswer()
}

func normalizeAnswer(q Question, input AnswerInput) (AnswerInput, error) {
	h, ok := TypeHandlerFor(q.QuestionType)
	if !ok {
		return AnswerInput{}, ErrInvalid
	}
	return h.NormalizeInput(q, input)
}

func gradeNumeric(q Question, value *string) (bool, error) {
	item := course.Item{Prompt: course.Prompt{Type: course.Numeric}, Grading: course.Grading{
		Value: q.Answer, AbsoluteTolerance: q.NumberTolerance,
	}}
	correct, err := item.Grade(course.Response{Value: value})
	if err != nil {
		return false, ErrInvalid
	}
	return correct, nil
}

func booleanSelection(q Question, value bool) []int64 {
	for _, option := range q.Items {
		if option.BooleanValue != nil && *option.BooleanValue == value {
			return []int64{option.Sign}
		}
	}
	// Questions imported from the legacy bank may omit Boolean metadata.
	return nil
}

func scoreAnswer(q Question, answer AnswerInput) (float64, error) {
	h, ok := TypeHandlerFor(q.QuestionType)
	if !ok {
		return 0, ErrInvalid
	}
	return h.Score(q, answer)
}

func sameAnswer(a, b AnswerInput) bool {
	return slices.Equal(a.Selected, b.Selected) &&
		reflect.DeepEqual(a.Numeric, b.Numeric) &&
		reflect.DeepEqual(a.ExtendedResponse, b.ExtendedResponse)
}

type extendedAttemptKey struct {
	course.ExtendedResponse
	Score *float64 `json:"score,omitempty"`
}

func encodeAttempt(q Question, answer AnswerInput, score float64) (string, string, error) {
	h, ok := TypeHandlerFor(q.QuestionType)
	if !ok {
		return "", "", ErrInvalid
	}
	return h.EncodeAttempt(q, answer, score)
}
