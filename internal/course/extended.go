package course

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

type ExtendedFields struct {
	Passage      *RichContent    `json:"passage,omitempty"`
	PassageTTS   *TTSConfig      `json:"passage_tts,omitempty"`
	Blanks       []ClozeBlank    `json:"blanks,omitempty"`
	SubQuestions []Item          `json:"sub_questions,omitempty"`
	Listening    *ListeningAudio `json:"-"`
	Subtype      string          `json:"subtype,omitempty"`
	Requirements []string        `json:"requirements,omitempty"`
	Keywords     []string        `json:"keywords,omitempty"`
	MinWords     int             `json:"min_words,omitempty"`
	MaxWords     int             `json:"max_words,omitempty"`
	Sample       *RichContent    `json:"sample_response,omitempty"`
	SampleTTS    *TTSConfig      `json:"sample_response_tts,omitempty"`
	Rubric       map[string]int  `json:"rubric,omitempty"`
	Direction    string          `json:"direction,omitempty"`
	Source       string          `json:"source_text,omitempty"`
	SourceTTS    *TTSConfig      `json:"source_text_tts,omitempty"`
	Reference    string          `json:"reference_translation,omitempty"`
	ReferenceTTS *TTSConfig      `json:"reference_translation_tts,omitempty"`
	Alternates   []string        `json:"acceptable_alternates,omitempty"`
	KeyTerms     []KeyTerm       `json:"key_terms,omitempty"`

	StudyTranslation *StudyTranslation `json:"study_translation,omitempty"`
}

type ListeningAudio struct {
	Mode        string `json:"mode"`
	VoiceMale   string `json:"voice_male,omitempty"`
	VoiceFemale string `json:"voice_female,omitempty"`
	Src         string `json:"src,omitempty"`
}

type KeyTerm struct {
	Term     string   `json:"term"`
	Variants []string `json:"variants,omitempty"`
}

type ClozeBlank struct {
	Index       int          `json:"index"`
	Options     []Option     `json:"options"`
	Grading     Grading      `json:"grading"`
	Explanation *RichContent `json:"explanation,omitempty"`
}

func (b ClozeBlank) item() Item {
	return Item{Prompt: Prompt{Type: SingleChoice, Options: b.Options}, Grading: b.Grading}
}

func (item Item) AudioPath() string {
	if item.Listening != nil {
		return item.Listening.Src
	}
	return item.Audio
}

func (item Item) SampleText() string {
	if item.Sample == nil {
		return ""
	}
	return item.Sample.String()
}

func (item *Item) UnmarshalJSON(data []byte) error {
	type plain Item
	var wire struct {
		*plain
		Audio json.RawMessage `json:"audio"`
	}
	*item = Item{}
	wire.plain = (*plain)(item)
	if err := json.Unmarshal(data, &wire); err != nil {
		return err
	}
	if len(wire.Audio) == 0 {
		return nil
	}
	if wire.Audio[0] == '{' {
		return json.Unmarshal(wire.Audio, &item.Listening)
	}
	return json.Unmarshal(wire.Audio, &item.Audio)
}

func (item Item) MarshalJSON() ([]byte, error) {
	type plain Item
	if item.Listening == nil {
		return json.Marshal(plain(item))
	}
	return json.Marshal(struct {
		plain
		Audio *ListeningAudio `json:"audio"`
	}{plain(item), item.Listening})
}

// Boolean values in the v2 course contract share the legacy Boolean grader.
func (g *Grading) UnmarshalJSON(data []byte) error {
	type plain Grading
	var wire struct {
		*plain
		Value json.RawMessage `json:"value"`
	}
	*g = Grading{}
	wire.plain = (*plain)(g)
	if err := json.Unmarshal(data, &wire); err != nil {
		return err
	}
	if len(wire.Value) == 0 {
		return nil
	}
	if wire.Value[0] == 't' || wire.Value[0] == 'f' {
		g.booleanValueKey = true
		return json.Unmarshal(wire.Value, &g.Boolean)
	}
	return json.Unmarshal(wire.Value, &g.Value)
}

func (g Grading) MarshalJSON() ([]byte, error) {
	if g.booleanValueKey {
		return json.Marshal(struct {
			Value *bool `json:"value"`
		}{g.Boolean})
	}
	type plain Grading
	return json.Marshal(plain(g))
}

// ListeningLines resolves listening transcript lines strictly for media-capable
// types (Listening or items with an explicit Transcript). Non-media types return nil.
func (item Item) ListeningLines() []TranscriptLine {
	kind, ok := itemKinds[item.Type]
	if !ok || kind.ListeningLines == nil {
		return nil
	}
	return kind.ListeningLines(item)
}

func (item Item) validate(protocol int) error {
	kind, ok := itemKinds[item.Type]
	if !ok || kind.Validate == nil {
		return fmt.Errorf("unsupported question type %q", item.Type)
	}
	return kind.Validate(item, protocol)
}

func uniformOptionAudio(options []Option) error {
	if len(options) == 0 {
		return nil
	}
	hasAudio := func(o Option) bool { return o.TTS != nil && o.TTS.Enabled }
	for _, option := range options[1:] {
		if hasAudio(option) != hasAudio(options[0]) {
			return fmt.Errorf("option TTS must be enabled on all or none of the options")
		}
	}
	return nil
}

func (item Item) validateComposite() error {
	if item.Type == Reading {
		if item.Listening != nil || item.Audio != "" || item.Transcript != nil {
			return fmt.Errorf("reading_comprehension forbids audio and transcript")
		}
	}
	if item.Type == Listening && item.AudioPath() == "" && len(resolveListeningLines(item)) == 0 {
		return fmt.Errorf("listening requires a recording, transcript lines, or spoken passage")
	}
	if item.Listening != nil {
		switch item.Listening.Mode {
		case "recording":
			if item.AudioPath() == "" {
				return fmt.Errorf("recording mode requires an audio asset")
			}
			if item.Passage != nil {
				return fmt.Errorf("recording mode forbids passage")
			}
		case "dialogue":
			if item.Transcript == nil || len(item.Transcript.Lines) == 0 {
				return fmt.Errorf("dialogue mode requires transcript lines")
			}
			if item.Passage != nil {
				return fmt.Errorf("dialogue mode forbids passage")
			}
		case "passage":
			if item.Passage == nil || strings.TrimSpace(item.Passage.String()) == "" {
				return fmt.Errorf("passage mode requires spoken passage text")
			}
			if item.Transcript != nil {
				return fmt.Errorf("passage mode forbids transcript")
			}
		}
	}
	optionsBySubID := make(map[string][]Option, len(item.SubQuestions))
	for _, sub := range item.SubQuestions {
		if _, exists := optionsBySubID[sub.ID]; exists {
			return fmt.Errorf("duplicate sub-question %q", sub.ID)
		}
		optionsBySubID[sub.ID] = sub.Options
		if err := sub.validate(2); err != nil {
			return fmt.Errorf("sub-question %q: %w", sub.ID, err)
		}
	}
	if item.StudyTranslation != nil {
		return item.validateStudyTranslation(optionsBySubID)
	}
	return nil
}

func (item Item) validateBlanks() error {
	seen := map[int]bool{}
	for _, blank := range item.Blanks {
		if seen[blank.Index] {
			return fmt.Errorf("duplicate blank index %d", blank.Index)
		}
		seen[blank.Index] = true
		if err := blank.item().validate(2); err != nil {
			return fmt.Errorf("blank %d: %w", blank.Index, err)
		}
	}
	for _, marker := range item.Passage.ClozeSegments() {
		if marker.Type != "blank" {
			continue
		}
		if marker.Index == nil || !seen[*marker.Index] {
			return fmt.Errorf("passage blank must reference a unique declared index")
		}
		delete(seen, *marker.Index)
	}
	if len(seen) > 0 {
		return fmt.Errorf("every blank must appear in the passage")
	}
	return nil
}

func (content RichContent) ClozeSegments() []ContentSegment {
	if len(content.Segments) > 0 {
		return content.Segments
	}
	var segments []ContentSegment
	text := content.Text
	for {
		before, rest, found := strings.Cut(text, "{{")
		if !found {
			return append(segments, ContentSegment{Type: "text", Text: text})
		}
		segments = append(segments, ContentSegment{Type: "text", Text: before})
		number, after, closed := strings.Cut(rest, "}}")
		index, err := strconv.Atoi(number)
		blank := ContentSegment{Type: "blank"}
		if closed && err == nil && index > 0 && strconv.Itoa(index) == number {
			blank.Index = &index
		}
		segments = append(segments, blank)
		text = after
	}
}
