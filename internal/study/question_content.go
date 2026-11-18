package study

import "test-driven-study/internal/course"

const (
	ClozeQuestion int64 = iota + 5
	ListeningQuestion
	ReadingQuestion
	WritingQuestion
	TranslationQuestion
)

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
	Direction    string              `json:"direction,omitempty"`
	SourceText   string              `json:"source_text,omitempty"`
}

type BlankPrompt struct {
	Index   int             `json:"index"`
	Options []course.Option `json:"options"`
}

type SubQuestionPrompt struct {
	ID      string             `json:"id"`
	Type    string             `json:"type"`
	Stem    course.RichContent `json:"stem"`
	Options []course.Option    `json:"options,omitempty"`
}

func (q *Question) ProjectExtended(item course.Item) bool {
	switch item.Type {
	case course.Cloze:
		q.QuestionType = ClozeQuestion
	case course.Listening:
		q.QuestionType = ListeningQuestion
	case course.Reading:
		q.QuestionType = ReadingQuestion
	case course.Writing:
		q.QuestionType = WritingQuestion
	case course.Translation:
		q.QuestionType = TranslationQuestion
	default:
		return false
	}
	content := &QuestionContent{
		Subtype: item.Subtype, Requirements: item.Requirements, MinWords: item.MinWords,
		MaxWords: item.MaxWords, Direction: item.Direction, SourceText: item.Source,
	}
	switch item.Type {
	case course.Cloze:
		content.Passage = &course.RichContent{Segments: item.Passage.ClozeSegments()}
		for _, b := range item.Blanks {
			content.Blanks = append(content.Blanks, BlankPrompt{Index: b.Index, Options: b.Options})
		}
	case course.Reading:
		content.Passage = item.Passage
	}
	for _, sub := range item.SubQuestions {
		content.SubQuestions = append(content.SubQuestions, SubQuestionPrompt{
			ID: sub.ID, Type: sub.Type, Stem: sub.Stem, Options: sub.Options,
		})
	}
	q.Content = content
	review := item
	review.Concepts = nil
	q.QuestionReview = &review
	return true
}
