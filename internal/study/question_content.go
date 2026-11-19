package study

import "test-driven-study/internal/course"

// QuestionContent has only the information needed before answering. Keep the
// authored grading data in the separate review on the private paper snapshot.
type QuestionContent struct {
	Passage      *course.RichContent `json:"passage,omitempty"`
	Blanks       []BlankPrompt       `json:"blanks,omitempty"`
	SubQuestions []SubQuestionPrompt `json:"sub_questions,omitempty"`
	Subtype      string              `json:"subtype,omitempty"`
	Requirements []string            `json:"requirements,omitempty"`
	MinWords     int                 `json:"min_words,omitempty"`
	MaxWords     int                 `json:"max_words,omitempty"`
	Direction     string              `json:"direction,omitempty"`
	SourceText    string              `json:"source_text,omitempty"`
	SourceTextTTS *course.TTSConfig   `json:"source_text_tts,omitempty"`
}

type BlankPrompt struct {
	Index   int             `json:"index"`
	Options []course.Option `json:"options"`
}

type SubQuestionPrompt struct {
	ID      string              `json:"id"`
	Type    course.QuestionType `json:"type"`
	Stem    course.RichContent  `json:"stem"`
	Options []course.Option     `json:"options,omitempty"`
}
