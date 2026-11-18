package course

import (
	"bytes"
	"encoding/json"
	"slices"
	"strconv"
	"strings"
	"unicode"
	"unicode/utf8"
)

const MaxWrittenResponse = 12000

// ExtendedResponse is the authored-ID answer format. WordCount is recomputed
// by the server, including when a client supplies its own count.
type ExtendedResponse struct {
	Value       *bool                      `json:"value,omitempty"`
	Blanks      map[int][]string           `json:"blanks,omitempty"`
	SubAnswers  map[string]json.RawMessage `json:"sub_answers,omitempty"`
	Text        *string                    `json:"text,omitempty"`
	WordCount   *int                       `json:"word_count,omitempty"`
	Translation *string                    `json:"translation,omitempty"`
}

func (r ExtendedResponse) HasAnswer() bool {
	return r.Value != nil || r.Blanks != nil || r.SubAnswers != nil ||
		r.Text != nil || r.WordCount != nil || r.Translation != nil
}

func (r ExtendedResponse) kindCount() int {
	count := 0
	for _, present := range []bool{r.Value != nil, r.Blanks != nil, r.SubAnswers != nil,
		r.Text != nil, r.Translation != nil} {
		if present {
			count++
		}
	}
	return count
}

// Evaluate returns canonical input and a score in [0,1]. Omitted parts receive
// zero credit. IDs that were never offered are invalid rather than incorrect.
func (item Item) Evaluate(r ExtendedResponse) (ExtendedResponse, float64, error) {
	if r.kindCount() != 1 || (r.WordCount != nil && r.Text == nil) {
		return ExtendedResponse{}, 0, ErrResponse
	}
	switch item.Type {
	case Cloze:
		score, err := item.gradeBlanks(r.Blanks)
		return ExtendedResponse{Blanks: r.Blanks}, score, err
	case Listening, Reading:
		answers, score, err := item.gradeSubQuestions(r.SubAnswers)
		return ExtendedResponse{SubAnswers: answers}, score, err
	case Writing:
		text, ok := written(r.Text)
		if ok {
			wordCount := len(strings.FieldsFunc(text, wordSeparator))
			return ExtendedResponse{Text: &text, WordCount: &wordCount},
				item.gradeWriting(text, wordCount), nil
		}
	case Translation:
		text, ok := written(r.Translation)
		if ok {
			return ExtendedResponse{Translation: &text}, item.gradeTranslation(text), nil
		}
	}
	return ExtendedResponse{}, 0, ErrResponse
}

func (item Item) gradeBlanks(answers map[int][]string) (float64, error) {
	if len(answers) == 0 || len(item.Blanks) == 0 {
		return 0, ErrResponse
	}
	parsed, matched := 0, 0
	for _, blank := range item.Blanks {
		choices, exists := answers[blank.Index]
		if !exists {
			continue
		}
		correct, err := blank.item().Grade(Response{ChoiceIDs: choices})
		if err != nil {
			return 0, err
		}
		parsed++
		if correct {
			matched++
		}
	}
	if parsed != len(answers) {
		return 0, ErrResponse
	}
	return float64(matched) / float64(len(item.Blanks)), nil
}

func (item Item) gradeSubQuestions(answers map[string]json.RawMessage) (
	map[string]json.RawMessage, float64, error,
) {
	if len(answers) == 0 || len(item.SubQuestions) == 0 {
		return nil, 0, ErrResponse
	}
	canonical := make(map[string]json.RawMessage, len(answers))
	matched := 0
	for _, sub := range item.SubQuestions {
		raw, exists := answers[sub.ID]
		if !exists {
			continue
		}
		response, normalized, err := sub.parseSubAnswer(raw)
		if err != nil {
			return nil, 0, err
		}
		correct, err := sub.Grade(response)
		if err != nil {
			return nil, 0, err
		}
		canonical[sub.ID] = normalized
		if correct {
			matched++
		}
	}
	if len(canonical) != len(answers) {
		return nil, 0, ErrResponse
	}
	return canonical, float64(matched) / float64(len(item.SubQuestions)), nil
}

func (item Item) parseSubAnswer(raw json.RawMessage) (
	Response, json.RawMessage, error,
) {
	var answer Response
	var target any
	switch item.Type {
	case SingleChoice, MultipleChoice:
		target = &answer.ChoiceIDs
	case TrueFalse:
		target = &answer.Boolean
	case Numeric:
		target = &answer.Value
	default:
		return answer, nil, ErrResponse
	}
	if bytes.Equal(bytes.TrimSpace(raw), []byte("null")) || json.Unmarshal(raw, target) != nil {
		return answer, nil, ErrResponse
	}
	slices.Sort(answer.ChoiceIDs)
	normalized, err := json.Marshal(target)
	return answer, normalized, err
}

func (item Item) ExpectedResponse() ExtendedResponse {
	switch item.Type {
	case Cloze:
		answers := make(map[int][]string, len(item.Blanks))
		for _, blank := range item.Blanks {
			answers[blank.Index] = blank.Grading.ChoiceIDs
		}
		return ExtendedResponse{Blanks: answers}
	case Listening, Reading:
		answers := make(map[string]json.RawMessage, len(item.SubQuestions))
		for _, sub := range item.SubQuestions {
			switch sub.Type {
			case TrueFalse:
				answers[sub.ID] = json.RawMessage(strconv.FormatBool(*sub.Grading.Boolean))
			case Numeric:
				answers[sub.ID], _ = json.Marshal(sub.Grading.Value)
			default:
				answers[sub.ID], _ = json.Marshal(sub.Grading.ChoiceIDs)
			}
		}
		return ExtendedResponse{SubAnswers: answers}
	case Writing:
		return ExtendedResponse{Text: &item.Sample}
	case Translation:
		return ExtendedResponse{Translation: &item.Reference}
	}
	return ExtendedResponse{}
}

func written(value *string) (string, bool) {
	if value == nil {
		return "", false
	}
	text := strings.TrimSpace(*value)
	return text, text != "" && utf8.RuneCountInString(text) <= MaxWrittenResponse
}

func wordSeparator(r rune) bool {
	return !unicode.IsLetter(r) && !unicode.IsNumber(r) && !unicode.IsMark(r) &&
		r != '\'' && r != '’'
}

func normalizeText(text string) string {
	return strings.Join(strings.FieldsFunc(strings.ToLower(strings.ReplaceAll(text, "’", "'")),
		wordSeparator), " ")
}

func hasTerm(normalized, term string) bool {
	term = normalizeText(term)
	if term == "" {
		return false
	}
	if strings.ContainsFunc(term, func(r rune) bool { return unicode.Is(unicode.Han, r) }) {
		return strings.Contains(normalized, term)
	}
	return strings.Contains(" "+normalized+" ", " "+term+" ")
}

func (item Item) gradeWriting(text string, count int) float64 {
	normalized := normalizeText(text)
	if normalized == "" || count < item.MinWords || (item.MaxWords > 0 && count > item.MaxWords) {
		return 0
	}
	if normalized == normalizeText(item.Sample) {
		return 1
	}
	matched := 0
	for _, keyword := range item.Keywords {
		if hasTerm(normalized, keyword) {
			matched++
		}
	}
	if len(item.Keywords) == 0 {
		return 0
	}
	return float64(matched) / float64(len(item.Keywords))
}

func (item Item) gradeTranslation(text string) float64 {
	normalized := normalizeText(text)
	if normalized == "" {
		return 0
	}
	if normalized == normalizeText(item.Reference) {
		return 1
	}
	for _, alternate := range item.Alternates {
		if normalized == normalizeText(alternate) {
			return 1
		}
	}
	matched := 0
	for _, term := range item.KeyTerms {
		if hasTerm(normalized, term.Term) ||
			slices.ContainsFunc(term.Variants, func(v string) bool { return hasTerm(normalized, v) }) {
			matched++
		}
	}
	if len(item.KeyTerms) == 0 {
		return 0
	}
	// Terminology alone does not establish the meaning of a translation.
	return 0.5 * float64(matched) / float64(len(item.KeyTerms))
}
