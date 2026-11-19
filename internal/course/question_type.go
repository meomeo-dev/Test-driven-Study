package course

import (
	"bytes"
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"slices"
)

// QuestionType identifies a canonical question kind across course packages,
// SQLite storage, HTTP contracts, and Go services.
type QuestionType string

const (
	SingleChoice   QuestionType = "single_choice"
	MultipleChoice QuestionType = "multiple_choice"
	TrueFalse      QuestionType = "true_false"
	Numeric        QuestionType = "numeric"
	Cloze          QuestionType = "cloze"
	Listening      QuestionType = "listening"
	Reading        QuestionType = "reading_comprehension"
	Writing        QuestionType = "writing"
	Translation    QuestionType = "translation"
)

var allQuestionTypes = []QuestionType{
	SingleChoice,
	MultipleChoice,
	TrueFalse,
	Numeric,
	Cloze,
	Listening,
	Reading,
	Writing,
	Translation,
}

var legacyQuestionTypes = map[int64]QuestionType{
	1: SingleChoice,
	2: MultipleChoice,
	3: TrueFalse,
	4: Numeric,
	5: Cloze,
	6: Listening,
	7: Reading,
	8: Writing,
	9: Translation,
}

// AllQuestionTypes returns a copy of the 9 canonical question types in order.
func AllQuestionTypes() []QuestionType {
	return slices.Clone(allQuestionTypes)
}

// Valid reports whether t is one of the 9 canonical question types.
func (t QuestionType) Valid() bool {
	return slices.Contains(allQuestionTypes, t)
}

// IsMediaCapable reports whether t may carry audio or transcript fields.
func (t QuestionType) IsMediaCapable() bool {
	switch t {
	case SingleChoice, MultipleChoice, TrueFalse, Numeric, Listening:
		return true
	default:
		return false
	}
}

// ParseQuestionType validates and returns a canonical QuestionType string.
func ParseQuestionType(raw string) (QuestionType, error) {
	t := QuestionType(raw)
	if !t.Valid() {
		return "", fmt.Errorf("invalid question type %q", raw)
	}
	return t, nil
}

func questionTypeFromInt(code int64) (QuestionType, error) {
	t, ok := legacyQuestionTypes[code]
	if !ok {
		return "", fmt.Errorf("invalid legacy question type %d", code)
	}
	return t, nil
}

// UnmarshalJSON accepts both canonical semantic strings and legacy integers 1..9.
func (t *QuestionType) UnmarshalJSON(data []byte) error {
	trimmed := bytes.TrimSpace(data)
	if bytes.Equal(trimmed, []byte("null")) {
		return nil
	}
	if len(trimmed) > 0 && trimmed[0] == '"' {
		var raw string
		if err := json.Unmarshal(trimmed, &raw); err != nil {
			return err
		}
		parsed, err := ParseQuestionType(raw)
		if err != nil {
			return err
		}
		*t = parsed
		return nil
	}
	var code int64
	if err := json.Unmarshal(trimmed, &code); err != nil {
		return fmt.Errorf("invalid question type %s", string(trimmed))
	}
	parsed, err := questionTypeFromInt(code)
	if err != nil {
		return err
	}
	*t = parsed
	return nil
}

// MarshalJSON always emits the canonical semantic question type string.
func (t QuestionType) MarshalJSON() ([]byte, error) {
	if !t.Valid() {
		return nil, fmt.Errorf("invalid question type %q", t)
	}
	return json.Marshal(string(t))
}

// Scan decodes a SQLite string (or legacy integer) into QuestionType.
func (t *QuestionType) Scan(value any) error {
	switch v := value.(type) {
	case string:
		parsed, err := ParseQuestionType(v)
		if err != nil {
			return err
		}
		*t = parsed
		return nil
	case []byte:
		parsed, err := ParseQuestionType(string(v))
		if err != nil {
			return err
		}
		*t = parsed
		return nil
	case int64:
		parsed, err := questionTypeFromInt(v)
		if err != nil {
			return err
		}
		*t = parsed
		return nil
	default:
		return fmt.Errorf("unsupported question_type scan type %T", value)
	}
}

// Value encodes QuestionType as a canonical SQLite string.
func (t QuestionType) Value() (driver.Value, error) {
	if !t.Valid() {
		return nil, fmt.Errorf("invalid question type %q", t)
	}
	return string(t), nil
}
