package course

import (
	"errors"
	"math/big"
	"regexp"
	"slices"
)

var ErrResponse = errors.New("invalid response")

var decimalPattern = regexp.MustCompile(`^-?[0-9]+(\.[0-9]+)?$`)

func decimal(value string) (*big.Rat, bool) {
	if len(value) > 64 || !decimalPattern.MatchString(value) {
		return nil, false
	}
	return new(big.Rat).SetString(value)
}

func (item Item) Grade(response Response) (bool, error) {
	switch item.Type {
	case SingleChoice, MultipleChoice:
		if response.Boolean != nil || response.Value != nil || len(response.ChoiceIDs) == 0 ||
			(item.Type == SingleChoice && len(response.ChoiceIDs) != 1) {
			return false, ErrResponse
		}
		ids, err := normalizeChoices(item.Options, response.ChoiceIDs)
		if err != nil {
			return false, err
		}
		expected := slices.Clone(item.Grading.ChoiceIDs)
		slices.Sort(expected)
		return slices.Equal(ids, expected), nil
	case TrueFalse:
		if response.Boolean == nil || response.ChoiceIDs != nil || response.Value != nil {
			return false, ErrResponse
		}
		return *response.Boolean == *item.Grading.Boolean, nil
	case Numeric:
		if response.Value == nil || response.ChoiceIDs != nil || response.Boolean != nil {
			return false, ErrResponse
		}
		return item.gradeNumber(*response.Value)
	default:
		return false, ErrResponse
	}
}

func (item Item) gradeNumber(value string) (bool, error) {
	actual, ok := decimal(value)
	if !ok {
		return false, ErrResponse
	}
	expected, _ := decimal(item.Grading.Value)
	tolerance, _ := decimal(item.Grading.AbsoluteTolerance)
	difference := new(big.Rat).Sub(actual, expected)
	return difference.Abs(difference).Cmp(tolerance) <= 0, nil
}

func normalizeChoices(options []Option, selection []string) ([]string, error) {
	valid := make(map[string]bool, len(options))
	for _, option := range options {
		valid[option.ID] = true
	}
	ids := slices.Clone(selection)
	slices.Sort(ids)
	for index, id := range ids {
		if !valid[id] || (index > 0 && id == ids[index-1]) {
			return nil, ErrResponse
		}
	}
	return ids, nil
}
