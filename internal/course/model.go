package course

import (
	"encoding/json"
	"errors"
	"strings"
)

const (
	SingleChoice   = "single_choice"
	MultipleChoice = "multiple_choice"
	TrueFalse      = "true_false"
	Numeric        = "numeric"
)

type Manifest struct {
	ProtocolVersion int                `json:"protocol_version"`
	ID              string             `json:"course_id"`
	Version         string             `json:"version"`
	Title           string             `json:"title"`
	Language        string             `json:"language"`
	Description     string             `json:"description,omitempty"`
	Logo            string             `json:"logo,omitempty"`
	Units           []Unit             `json:"units"`
	AIProfile       *AIProfileRef      `json:"ai_profile,omitempty"`
	Roadmap         *Roadmap           `json:"roadmap,omitempty"`
}

// Prerequisite strengths record how firmly the course README states a
// relation. Both order the roadmap; neither blocks opening a course.
const (
	StrengthRequired    = "required"
	StrengthRecommended = "recommended"
)

// Roadmap relates a course to other installed courses. Note quotes the README
// sentence that states the relations. Prerequisites are alternative groups in
// disjunctive normal form, like concept prerequisites; ParallelWith lists
// courses to study alongside, which orders nothing.
type Roadmap struct {
	Note          string               `json:"note"`
	Prerequisites []CoursePrerequisite `json:"prerequisites,omitempty"`
	ParallelWith  []string             `json:"parallel_with,omitempty"`
}

type CoursePrerequisite struct {
	AllOf    []string `json:"all_of"`
	Strength string   `json:"strength"`
}

type Unit struct {
	ID           string      `json:"id"`
	Title        string      `json:"title"`
	QuestionFile string      `json:"question_file,omitempty"`
	Lessons      []LessonRef `json:"lessons,omitempty"`
	Concepts     []Concept   `json:"concepts,omitempty"`
}

// Concept is one node of a course's knowledge graph. Prerequisites are
// alternative groups: the concept unlocks when every member of any one group
// is satisfied, which expresses AND/OR rules in disjunctive normal form.
type Concept struct {
	ID               string              `json:"id"`
	Title            string              `json:"title"`
	Summary          string              `json:"summary,omitempty"`
	EstimatedMinutes int                 `json:"estimated_minutes"`
	Lesson           string              `json:"lesson,omitempty"`
	Prerequisites    []PrerequisiteGroup `json:"prerequisites,omitempty"`
}

type PrerequisiteGroup struct {
	AllOf []string `json:"all_of"`
}

type LessonRef struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	File  string `json:"file"`
}

type TTSConfig struct {
	Voice string   `json:"voice,omitempty"`
	Text  string   `json:"text,omitempty"`
	Speed *float64 `json:"speed,omitempty"`
}

type OptionTTS struct {
	Enabled bool
	Config  TTSConfig
}

func (o *OptionTTS) UnmarshalJSON(b []byte) error {
	var boolean bool
	if err := json.Unmarshal(b, &boolean); err == nil {
		o.Enabled = boolean
		return nil
	}
	var cfg TTSConfig
	if err := json.Unmarshal(b, &cfg); err == nil {
		o.Enabled = true
		o.Config = cfg
		return nil
	}
	return errors.New("invalid option tts format")
}

func (o OptionTTS) MarshalJSON() ([]byte, error) {
	if o.Config.Voice != "" || o.Config.Text != "" || o.Config.Speed != nil {
		return json.Marshal(o.Config)
	}
	return json.Marshal(o.Enabled)
}

type Option struct {
	ID    string     `json:"id"`
	Text  string     `json:"text"`
	Value *bool      `json:"value,omitempty"`
	TTS   *OptionTTS `json:"tts,omitempty"`
}

type ContentSegment struct {
	Type  string     `json:"type"`
	Text  string     `json:"text,omitempty"`
	TTS   *OptionTTS `json:"tts,omitempty"`
	Index *int       `json:"index,omitempty"`
}

type RichContent struct {
	Text     string           `json:"-"`
	Segments []ContentSegment `json:"-"`
}

func (r *RichContent) String() string {
	if len(r.Segments) > 0 {
		var sb strings.Builder
		for _, seg := range r.Segments {
			sb.WriteString(seg.Text)
		}
		return sb.String()
	}
	return r.Text
}

func (r *RichContent) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err == nil {
		r.Text = s
		r.Segments = nil
		return nil
	}
	var segs []ContentSegment
	if err := json.Unmarshal(b, &segs); err == nil {
		r.Segments = segs
		var sb strings.Builder
		for _, seg := range segs {
			sb.WriteString(seg.Text)
		}
		r.Text = sb.String()
		return nil
	}
	return errors.New("invalid rich content format")
}

func (r RichContent) MarshalJSON() ([]byte, error) {
	if len(r.Segments) > 0 {
		return json.Marshal(r.Segments)
	}
	return json.Marshal(r.Text)
}

type TranscriptLine struct {
	Speaker string     `json:"speaker"`
	Text    string     `json:"text"`
	TTS     *OptionTTS `json:"tts,omitempty"`
}

type Transcript struct {
	Text  string           `json:"-"`
	Lines []TranscriptLine `json:"-"`
}

func (t *Transcript) String() string {
	if len(t.Lines) > 0 {
		var sb strings.Builder
		for i, line := range t.Lines {
			if i > 0 {
				sb.WriteString("\n")
			}
			sb.WriteString(line.Speaker)
			sb.WriteString(": ")
			sb.WriteString(line.Text)
		}
		return sb.String()
	}
	return t.Text
}

func (t *Transcript) UnmarshalJSON(b []byte) error {
	var s string
	if err := json.Unmarshal(b, &s); err == nil {
		t.Text = s
		t.Lines = nil
		return nil
	}
	var lines []TranscriptLine
	if err := json.Unmarshal(b, &lines); err == nil {
		t.Lines = lines
		t.Text = t.String()
		return nil
	}
	return errors.New("invalid transcript format")
}

func (t Transcript) MarshalJSON() ([]byte, error) {
	if len(t.Lines) > 0 {
		return json.Marshal(t.Lines)
	}
	return json.Marshal(t.Text)
}

type Prompt struct {
	ID         string      `json:"id"`
	Type       string      `json:"type"`
	Stem       RichContent `json:"stem"`
	Chapter    string      `json:"chapter,omitempty"`
	Image      string      `json:"image,omitempty"`
	Audio      string      `json:"audio,omitempty"`
	Transcript *Transcript `json:"transcript,omitempty"`
	Options    []Option    `json:"options,omitempty"`
}

type Grading struct {
	ChoiceIDs         []string `json:"choice_ids,omitempty"`
	Boolean           *bool    `json:"boolean,omitempty"`
	Value             string   `json:"value,omitempty"`
	AbsoluteTolerance string   `json:"absolute_tolerance,omitempty"`
}

// Item is the authored question. Concept tags stay outside the learner-facing
// Prompt so that they never reach the browser or AI prompts.
type Item struct {
	Prompt
	Explanation string   `json:"explanation,omitempty"`
	Hint        string   `json:"hint,omitempty"`
	Concepts    []string `json:"concepts,omitempty"`
	Grading     Grading  `json:"grading"`
}

type Response struct {
	ChoiceIDs []string `json:"choice_ids,omitempty"`
	Boolean   *bool    `json:"boolean,omitempty"`
	Value     *string  `json:"value,omitempty"`
}
