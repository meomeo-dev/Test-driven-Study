package study

import (
	"encoding/json"
	"reflect"
	"slices"

	"test-driven-study/internal/course"
)

const NumericQuestion = 4

type AnswerInput struct {
	course.ExtendedResponse
	Selected []int64 `json:"selected"`
	Numeric  *string `json:"numeric,omitempty"`
}

func (input AnswerInput) HasAnswer() bool {
	return len(input.Selected) != 0 || input.Numeric != nil || input.ExtendedResponse.HasAnswer()
}

func normalizeAnswer(q Question, input AnswerInput) (AnswerInput, error) {
	if q.QuestionReview != nil {
		if input.Numeric != nil || len(input.Selected) != 0 {
			return AnswerInput{}, ErrInvalid
		}
		normalized, _, err := q.QuestionReview.Evaluate(input.ExtendedResponse)
		if err != nil {
			return AnswerInput{}, ErrInvalid
		}
		return AnswerInput{ExtendedResponse: normalized}, nil
	}
	if input.ExtendedResponse.HasAnswer() {
		if q.QuestionType != 3 || input.Value == nil || input.Numeric != nil ||
			len(input.Selected) != 0 ||
			!reflect.DeepEqual(input.ExtendedResponse, course.ExtendedResponse{Value: input.Value}) {
			return AnswerInput{}, ErrInvalid
		}
		input.Selected = booleanSelection(q, *input.Value)
	}

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
	if err != nil {
		return AnswerInput{}, err
	}
	answer := AnswerInput{Selected: choices}
	if q.QuestionType == 3 && q.AnalysisContent != nil {
		for _, option := range q.Items {
			if option.Sign == choices[0] {
				answer.Value = option.BooleanValue
			}
		}
	}
	return answer, nil
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
	if q.QuestionReview != nil {
		_, score, err := q.QuestionReview.Evaluate(answer.ExtendedResponse)
		return score, err
	}
	var correct bool
	var err error
	if q.QuestionType == NumericQuestion {
		correct, err = gradeNumeric(q, answer.Numeric)
	} else {
		var expected []int64
		expected, err = originalAnswer(q)
		correct = slices.Equal(answer.Selected, expected)
	}
	if correct {
		return 1, err
	}
	return 0, err
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
	if q.QuestionReview != nil || answer.Value != nil {
		var key course.ExtendedResponse
		if q.QuestionReview != nil {
			key = q.QuestionReview.ExpectedResponse()
		} else {
			expected, err := originalAnswer(q)
			if err != nil {
				return "", "", err
			}
			for _, option := range q.Items {
				if option.Sign == expected[0] {
					key.Value = option.BooleanValue
				}
			}
		}
		actual, err := json.Marshal(answer.ExtendedResponse)
		if err != nil {
			return "", "", err
		}
		review, err := json.Marshal(extendedAttemptKey{ExtendedResponse: key, Score: &score})
		return string(actual), string(review), err
	}
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
