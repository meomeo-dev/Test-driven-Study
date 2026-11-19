package study

import (
	"context"
	"slices"
	"strconv"
	"strings"

	"test-driven-study/internal/course"
)

// Visibility controls which fields ToPublic includes in a learner-facing payload.
type Visibility uint8

const (
	VisibilityPractice Visibility = iota
	VisibilityActiveExam
	VisibilityFinishedExam
)

func optionTTS(option course.Option) *OptionTTS {
	if option.TTS == nil || !option.TTS.Enabled {
		return nil
	}
	text := option.TTS.Config.Text
	if text == "" {
		text = option.Text
	}
	return &OptionTTS{
		Voice: option.TTS.Config.Voice,
		Text:  text,
		Speed: option.TTS.Config.Speed,
	}
}

func projectMedia(q *Question, item course.Item) {
	q.AudioURL = item.AudioPath()
	if item.Transcript != nil {
		q.TranscriptURL = item.Transcript.String()
	}
	if lines := item.ListeningLines(); len(lines) > 0 {
		q.TranscriptLines = lines
	}
}

func projectChoice(base Question, item course.Item) (Question, error) {
	projectMedia(&base, item)
	base.Items = make([]Option, 0, len(item.Options))
	signs := make(map[string]string, len(item.Options))
	for i, option := range item.Options {
		sign := int64(i + 1)
		signs[option.ID] = strconv.FormatInt(sign, 10)
		base.Items = append(base.Items, Option{
			Sign:      sign,
			ItemTitle: option.Text,
			Pinyin:    option.Pinyin,
			TTS:       optionTTS(option),
		})
	}
	answers := make([]string, 0, len(item.Grading.ChoiceIDs))
	for _, id := range item.Grading.ChoiceIDs {
		answers = append(answers, signs[id])
	}
	base.Answer = strings.Join(answers, ",")
	return base, nil
}

func projectTrueFalse(base Question, item course.Item) (Question, error) {
	projectMedia(&base, item)
	options := item.Options
	if len(options) == 0 {
		yes, no := true, false
		options = []course.Option{
			{Text: "正确", Value: &yes},
			{Text: "错误", Value: &no},
		}
	}
	base.Items = make([]Option, 0, len(options))
	for i, option := range options {
		sign := int64(i + 1)
		base.Items = append(base.Items, Option{
			Sign:         sign,
			ItemTitle:    option.Text,
			BooleanValue: option.Value,
			Pinyin:       option.Pinyin,
			TTS:          optionTTS(option),
		})
		if item.Grading.Boolean != nil && option.Value != nil && *option.Value == *item.Grading.Boolean {
			base.Answer = strconv.FormatInt(sign, 10)
		}
	}
	return base, nil
}

func projectNumeric(base Question, item course.Item) (Question, error) {
	projectMedia(&base, item)
	base.Items = nil
	base.Answer = item.Grading.Value
	base.NumberTolerance = item.Grading.AbsoluteTolerance
	return base, nil
}

func projectReviewCopy(item course.Item) *course.Item {
	review := item
	review.Concepts = nil
	return &review
}

func projectSubQuestions(items []course.Item) []SubQuestionPrompt {
	out := make([]SubQuestionPrompt, 0, len(items))
	for _, sub := range items {
		out = append(out, SubQuestionPrompt{
			ID:      sub.ID,
			Type:    sub.Type,
			Stem:    sub.Stem,
			Options: sub.Options,
		})
	}
	return out
}

func projectCloze(base Question, item course.Item) (Question, error) {
	base.Items = nil
	blanks := make([]BlankPrompt, 0, len(item.Blanks))
	for _, b := range item.Blanks {
		blanks = append(blanks, BlankPrompt{Index: b.Index, Options: b.Options})
	}
	var passage *course.RichContent
	if item.Passage != nil {
		passage = &course.RichContent{Segments: item.Passage.ClozeSegments()}
	}
	base.Content = &QuestionContent{
		Passage: passage,
		Blanks:  blanks,
	}
	base.QuestionReview = projectReviewCopy(item)
	return base, nil
}

func projectListening(base Question, item course.Item) (Question, error) {
	base.Items = nil
	projectMedia(&base, item)
	base.Content = &QuestionContent{
		SubQuestions: projectSubQuestions(item.SubQuestions),
	}
	base.QuestionReview = projectReviewCopy(item)
	return base, nil
}

func projectReading(base Question, item course.Item) (Question, error) {
	base.Items = nil
	base.Content = &QuestionContent{
		Passage:      item.Passage,
		SubQuestions: projectSubQuestions(item.SubQuestions),
	}
	base.QuestionReview = projectReviewCopy(item)
	return base, nil
}

func projectWriting(base Question, item course.Item) (Question, error) {
	base.Items = nil
	base.Content = &QuestionContent{
		Subtype:      item.Subtype,
		Requirements: item.Requirements,
		MinWords:     item.MinWords,
		MaxWords:     item.MaxWords,
	}
	base.QuestionReview = projectReviewCopy(item)
	return base, nil
}

func projectTranslation(base Question, item course.Item) (Question, error) {
	base.Items = nil
	base.Content = &QuestionContent{
		Direction:  item.Direction,
		SourceText: item.Source,
	}
	base.QuestionReview = projectReviewCopy(item)
	return base, nil
}

func nonNilOptions(items []Option) []Option {
	if len(items) == 0 {
		return []Option{}
	}
	return slices.Clone(items)
}

func publicBase(q Question) PublicQuestion {
	return PublicQuestion{
		Content:        q.Content,
		QuestionID:     q.QuestionID,
		QuestionType:   q.QuestionType,
		Title:          q.Title,
		RichContent:    q.RichContent,
		ImageURL:       q.ImageURL,
		ImageType:      q.ImageType,
		Difficulty:     q.Difficulty,
		Tags:           q.Tags,
		LicenceID:      q.LicenceID,
		SubjectID:      q.SubjectID,
		ChapterID:      q.ChapterID,
		ChapterName:    q.ChapterName,
		SubChapterID:   q.SubChapterID,
		SubChapterName: q.SubChapterName,
		CourseID:       q.CourseID,
		CourseName:     q.CourseName,
		Sort:           q.Sort,
		ProvinceID:     q.ProvinceID,
		CityID:         q.CityID,
		PackageID:      q.PackageID,
		PackageVersion: q.PackageVersion,
		SourceItemID:   q.SourceItemID,
	}
}

func publicMedia(q Question, vis Visibility, withItems bool) PublicQuestion {
	p := publicBase(q)
	if withItems {
		p.Items = nonNilOptions(q.Items)
	}
	p.AudioURL = q.AudioURL
	if vis != VisibilityActiveExam {
		p.TranscriptURL = q.TranscriptURL
		p.TranscriptLines = slices.Clone(q.TranscriptLines)
	}
	return p
}

func publicNonMedia(q Question, _ Visibility) PublicQuestion {
	return publicBase(q)
}

func mediaTranscriptText(ctx context.Context, s *Service, q Question) (string, error) {
	if len(q.TranscriptLines) > 0 {
		transcript := course.Transcript{Lines: q.TranscriptLines}
		return transcript.String(), nil
	}
	if q.TranscriptURL == "" {
		return "", nil
	}
	text, err := s.CourseAsset(ctx, q.PackageID, q.PackageVersion, q.TranscriptURL)
	return string(text), err
}

func noTranscriptText(context.Context, *Service, Question) (string, error) {
	return "", nil
}
