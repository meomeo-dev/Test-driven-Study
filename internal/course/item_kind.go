package course

import (
	"encoding/json"
	"fmt"
	"slices"
	"strconv"
	"strings"
)

// ItemKind defines the per-type validation, grading, and media behavior for one
// canonical QuestionType.
type ItemKind struct {
	Type              QuestionType
	MediaCapable      bool
	Validate          func(Item, int) error
	Grade             func(Item, Response) (bool, error)
	Evaluate          func(Item, ExtendedResponse) (ExtendedResponse, float64, error)
	ExpectedResponse  func(Item) ExtendedResponse
	ListeningLines    func(Item) []TranscriptLine
	ParseSubAnswer    func(json.RawMessage) (Response, json.RawMessage, error)
	ExpectedSubAnswer func(Item) json.RawMessage
}

var itemKinds map[QuestionType]ItemKind

func init() {
	itemKinds = map[QuestionType]ItemKind{
		SingleChoice: {
			Type:         SingleChoice,
			MediaCapable: true,
			Validate: func(item Item, protocol int) error {
				return validateObjectiveItem(item, protocol)
			},
			Grade:             gradeChoice,
			ListeningLines:    explicitTranscriptLines,
			ParseSubAnswer:    parseChoiceSubAnswer,
			ExpectedSubAnswer: expectedChoiceSubAnswer,
		},
		MultipleChoice: {
			Type:         MultipleChoice,
			MediaCapable: true,
			Validate: func(item Item, protocol int) error {
				return validateObjectiveItem(item, protocol)
			},
			Grade:             gradeChoice,
			ListeningLines:    explicitTranscriptLines,
			ParseSubAnswer:    parseChoiceSubAnswer,
			ExpectedSubAnswer: expectedChoiceSubAnswer,
		},
		TrueFalse: {
			Type:         TrueFalse,
			MediaCapable: true,
			Validate: func(item Item, protocol int) error {
				return validateTrueFalseItem(item, protocol)
			},
			Grade:             gradeTrueFalse,
			ListeningLines:    explicitTranscriptLines,
			ParseSubAnswer:    parseBooleanSubAnswer,
			ExpectedSubAnswer: expectedBooleanSubAnswer,
		},
		Numeric: {
			Type:         Numeric,
			MediaCapable: true,
			Validate: func(item Item, protocol int) error {
				return validateNumericItem(item, protocol)
			},
			Grade:             gradeNumericItem,
			ListeningLines:    explicitTranscriptLines,
			ParseSubAnswer:    parseNumericSubAnswer,
			ExpectedSubAnswer: expectedNumericSubAnswer,
		},
		Cloze: {
			Type:         Cloze,
			MediaCapable: false,
			Validate: func(item Item, protocol int) error {
				if err := item.validateCommonOptions(protocol); err != nil {
					return err
				}
				if protocol == 2 {
					return item.validateBlanks()
				}
				return nil
			},
			Evaluate: func(item Item, r ExtendedResponse) (ExtendedResponse, float64, error) {
				score, err := item.gradeBlanks(r.Blanks)
				return ExtendedResponse{Blanks: r.Blanks}, score, err
			},
			ExpectedResponse: func(item Item) ExtendedResponse {
				answers := make(map[int][]string, len(item.Blanks))
				for _, blank := range item.Blanks {
					answers[blank.Index] = blank.Grading.ChoiceIDs
				}
				return ExtendedResponse{Blanks: answers}
			},
		},
		Listening: {
			Type:         Listening,
			MediaCapable: true,
			Validate: func(item Item, protocol int) error {
				if err := item.validateCommonOptions(protocol); err != nil {
					return err
				}
				if protocol == 2 {
					return item.validateComposite()
				}
				return nil
			},
			Evaluate: func(item Item, r ExtendedResponse) (ExtendedResponse, float64, error) {
				answers, score, err := item.gradeSubQuestions(r.SubAnswers)
				return ExtendedResponse{SubAnswers: answers}, score, err
			},
			ExpectedResponse: expectedCompositeResponse,
			ListeningLines:   resolveListeningLines,
		},
		Reading: {
			Type:         Reading,
			MediaCapable: false,
			Validate: func(item Item, protocol int) error {
				if err := item.validateCommonOptions(protocol); err != nil {
					return err
				}
				if protocol == 2 {
					return item.validateComposite()
				}
				return nil
			},
			Evaluate: func(item Item, r ExtendedResponse) (ExtendedResponse, float64, error) {
				answers, score, err := item.gradeSubQuestions(r.SubAnswers)
				return ExtendedResponse{SubAnswers: answers}, score, err
			},
			ExpectedResponse: expectedCompositeResponse,
		},
		Writing: {
			Type:         Writing,
			MediaCapable: false,
			Validate: func(item Item, protocol int) error {
				if err := item.validateCommonOptions(protocol); err != nil {
					return err
				}
				if protocol == 2 && item.MaxWords != 0 && item.MinWords > item.MaxWords {
					return fmt.Errorf("min_words exceeds max_words")
				}
				return nil
			},
			Evaluate: func(item Item, r ExtendedResponse) (ExtendedResponse, float64, error) {
				text, ok := written(r.Text)
				if !ok {
					return ExtendedResponse{}, 0, ErrResponse
				}
				wordCount := len(strings.FieldsFunc(text, wordSeparator))
				return ExtendedResponse{Text: &text, WordCount: &wordCount},
					item.gradeWriting(text, wordCount), nil
			},
			ExpectedResponse: func(item Item) ExtendedResponse {
				return ExtendedResponse{Text: &item.Sample}
			},
		},
		Translation: {
			Type:         Translation,
			MediaCapable: false,
			Validate: func(item Item, protocol int) error {
				return item.validateCommonOptions(protocol)
			},
			Evaluate: func(item Item, r ExtendedResponse) (ExtendedResponse, float64, error) {
				text, ok := written(r.Translation)
				if !ok {
					return ExtendedResponse{}, 0, ErrResponse
				}
				return ExtendedResponse{Translation: &text}, item.gradeTranslation(text), nil
			},
			ExpectedResponse: func(item Item) ExtendedResponse {
				return ExtendedResponse{Translation: &item.Reference}
			},
		},
	}
}

// ItemKindFor returns the registered ItemKind for t.
func ItemKindFor(t QuestionType) (ItemKind, bool) {
	kind, ok := itemKinds[t]
	return kind, ok
}

func explicitTranscriptLines(item Item) []TranscriptLine {
	if item.Transcript == nil || len(item.Transcript.Lines) == 0 {
		return nil
	}
	return slices.Clone(item.Transcript.Lines)
}

func resolveListeningLines(item Item) []TranscriptLine {
	var lines []TranscriptLine
	if item.Transcript != nil {
		lines = item.Transcript.Lines
	}
	if len(lines) == 0 && item.Passage != nil {
		lines = []TranscriptLine{{Text: item.Passage.String()}}
	}
	if item.Listening == nil {
		return lines
	}
	resolved := make([]TranscriptLine, len(lines))
	for i, line := range lines {
		cfg := TTSConfig{}
		if line.TTS != nil {
			cfg = line.TTS.Config
		}
		if cfg.Voice == "" {
			cfg.Voice = item.Listening.VoiceFemale
			if strings.EqualFold(line.Speaker, "M") {
				cfg.Voice = item.Listening.VoiceMale
			}
		}
		line.TTS = &OptionTTS{Enabled: true, Config: cfg}
		resolved[i] = line
	}
	return resolved
}

func expectedCompositeResponse(item Item) ExtendedResponse {
	answers := make(map[string]json.RawMessage, len(item.SubQuestions))
	for _, sub := range item.SubQuestions {
		kind, ok := itemKinds[sub.Type]
		if ok && kind.ExpectedSubAnswer != nil {
			answers[sub.ID] = kind.ExpectedSubAnswer(sub)
		}
	}
	return ExtendedResponse{SubAnswers: answers}
}

func parseChoiceSubAnswer(raw json.RawMessage) (Response, json.RawMessage, error) {
	var answer Response
	if json.Unmarshal(raw, &answer.ChoiceIDs) != nil {
		return answer, nil, ErrResponse
	}
	slices.Sort(answer.ChoiceIDs)
	normalized, err := json.Marshal(answer.ChoiceIDs)
	return answer, normalized, err
}

func parseBooleanSubAnswer(raw json.RawMessage) (Response, json.RawMessage, error) {
	var answer Response
	if json.Unmarshal(raw, &answer.Boolean) != nil {
		return answer, nil, ErrResponse
	}
	normalized, err := json.Marshal(answer.Boolean)
	return answer, normalized, err
}

func parseNumericSubAnswer(raw json.RawMessage) (Response, json.RawMessage, error) {
	var answer Response
	if json.Unmarshal(raw, &answer.Value) != nil {
		return answer, nil, ErrResponse
	}
	normalized, err := json.Marshal(answer.Value)
	return answer, normalized, err
}

func expectedChoiceSubAnswer(sub Item) json.RawMessage {
	encoded, _ := json.Marshal(sub.Grading.ChoiceIDs)
	return encoded
}

func expectedBooleanSubAnswer(sub Item) json.RawMessage {
	if sub.Grading.Boolean == nil {
		return nil
	}
	return json.RawMessage(strconv.FormatBool(*sub.Grading.Boolean))
}

func expectedNumericSubAnswer(sub Item) json.RawMessage {
	encoded, _ := json.Marshal(sub.Grading.Value)
	return encoded
}
