package study

import (
	"encoding/json"
	"slices"

	"test-driven-study/internal/course"
)

const NumericQuestion = 4

type AnswerInput struct {
	Selected []int64 `json:"selected"`
	Numeric  *string `json:"numeric,omitempty"`
}

func (input AnswerInput) HasAnswer() bool {
	return len(input.Selected) != 0 || input.Numeric != nil
}

func normalizeAnswer(q Question, input AnswerInput) (AnswerInput, error) {
	if q.QuestionType == NumericQuestion {
		if input.Numeric == nil || len(input.Selected) != 0 {
			return AnswerInput{}, ErrInvalid
		}
		if _, err := gradeNumeric(q, input.Numeric); err != nil {
			return AnswerInput{}, err
		}
		return AnswerInput{Numeric: input.Numeric}, nil
	}
	if input.Numeric != nil {
		return AnswerInput{}, ErrInvalid
	}
	choices, err := normalizeSelection(q, input.Selected)
	return AnswerInput{Selected: choices}, err
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

func gradeAnswer(q Question, answer AnswerInput) (bool, error) {
	if q.QuestionType == NumericQuestion {
		return gradeNumeric(q, answer.Numeric)
	}
	expected, err := originalAnswer(q)
	return slices.Equal(answer.Selected, expected), err
}

func sameAnswer(a, b AnswerInput) bool {
	if a.Numeric != nil && b.Numeric != nil {
		return *a.Numeric == *b.Numeric
	}
	return a.Numeric == nil && b.Numeric == nil && slices.Equal(a.Selected, b.Selected)
}

func encodeAttempt(q Question, answer AnswerInput) (string, string, error) {
	if q.QuestionType == NumericQuestion {
		selected, err := json.Marshal(course.Response{Value: answer.Numeric})
		if err != nil {
			return "", "", err
		}
		expected, err := json.Marshal(course.Response{Value: &q.Answer})
		return string(selected), string(expected), err
	}
	expected, err := originalAnswer(q)
	if err != nil {
		return "", "", err
	}
	selectedJSON, _ := json.Marshal(answer.Selected)
	expectedJSON, _ := json.Marshal(expected)
	return string(selectedJSON), string(expectedJSON), nil
}
