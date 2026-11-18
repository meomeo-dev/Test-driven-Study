package course

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

type ExtendedFields struct {
	Passage      *RichContent    `json:"passage,omitempty"`
	Blanks       []ClozeBlank    `json:"blanks,omitempty"`
	SubQuestions []Item          `json:"sub_questions,omitempty"`
	Listening    *ListeningAudio `json:"-"`
	Subtype      string          `json:"subtype,omitempty"`
	Requirements []string        `json:"requirements,omitempty"`
	Keywords     []string        `json:"keywords,omitempty"`
	MinWords     int             `json:"min_words,omitempty"`
	MaxWords     int             `json:"max_words,omitempty"`
	Sample       string          `json:"sample_response,omitempty"`
	Rubric       map[string]int  `json:"rubric,omitempty"`
	Direction    string          `json:"direction,omitempty"`
	Source       string          `json:"source_text,omitempty"`
	Reference    string          `json:"reference_translation,omitempty"`
	Alternates   []string        `json:"acceptable_alternates,omitempty"`
	KeyTerms     []KeyTerm       `json:"key_terms,omitempty"`
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

// ListeningLines resolves voice defaults once, so the stored paper can play
// the same lines without sending the transcript to an active exam client.
func (item Item) ListeningLines() []TranscriptLine {
	var lines []TranscriptLine
	if item.Transcript != nil {
		lines = item.Transcript.Lines
	}
	if len(lines) == 0 && item.Passage != nil && item.Type != Reading {
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

func (item Item) validateV2() error {
	if err := uniformOptionAudio(item.Options); err != nil {
		return err
	}
	switch item.Type {
	case Cloze:
		return item.validateBlanks()
	case Listening, Reading:
		return item.validateComposite()
	case Writing:
		if item.MaxWords != 0 && item.MinWords > item.MaxWords {
			return fmt.Errorf("min_words exceeds max_words")
		}
	}
	return nil
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
	if item.Type == Listening && item.AudioPath() == "" && len(item.ListeningLines()) == 0 {
		return fmt.Errorf("listening requires a recording, transcript lines, or spoken passage")
	}
	if item.Listening != nil {
		switch item.Listening.Mode {
		case "recording":
			if item.AudioPath() == "" {
				return fmt.Errorf("recording mode requires an audio asset")
			}
		case "dialogue":
			if item.Transcript == nil || len(item.Transcript.Lines) == 0 {
				return fmt.Errorf("dialogue mode requires transcript lines")
			}
		case "passage":
			if item.Passage == nil || strings.TrimSpace(item.Passage.String()) == "" {
				return fmt.Errorf("passage mode requires spoken passage text")
			}
		}
	}
	ids := map[string]bool{}
	for _, sub := range item.SubQuestions {
		if ids[sub.ID] {
			return fmt.Errorf("duplicate sub-question %q", sub.ID)
		}
		ids[sub.ID] = true
		if err := sub.validateV2(); err != nil {
			return fmt.Errorf("sub-question %q: %w", sub.ID, err)
		}
		if err := sub.validateOptions(); err != nil {
			return fmt.Errorf("sub-question %q: %w", sub.ID, err)
		}
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
		if err := uniformOptionAudio(blank.Options); err != nil {
			return fmt.Errorf("blank %d: %w", blank.Index, err)
		}
		if err := blank.item().validateOptions(); err != nil {
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
