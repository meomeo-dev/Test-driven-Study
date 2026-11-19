package palace

import (
	"encoding/json"
	"fmt"
	"strconv"
	"strings"

	"test-driven-study/internal/course"
	"test-driven-study/internal/study"
)

var sharedTemplate = course.DefaultPalaceTemplate()

type promptRenderer func(template course.PalaceTemplate, q study.Question, address string) (string, error)

var promptRenderers = map[course.QuestionType]promptRenderer{
	course.SingleChoice:   renderChoicePrompt("单选题"),
	course.MultipleChoice: renderChoicePrompt("多选题"),
	course.TrueFalse:      renderChoicePrompt("判断题"),
	course.Numeric:        renderNumericPrompt,
	course.Cloze:          renderReviewPrompt(false),
	course.Listening:      renderReviewPrompt(true),
	course.Reading:        renderReviewPrompt(false),
	course.Writing:        renderReviewPrompt(false),
	course.Translation:    renderReviewPrompt(false),
}

func renderPrompt(template course.PalaceTemplate, q study.Question, address string) (string, error) {
	renderer, ok := promptRenderers[q.QuestionType]
	if !ok {
		return "", ErrInvalid
	}
	return renderer(template, q, address)
}

func renderNumericPrompt(template course.PalaceTemplate, q study.Question, address string) (string, error) {
	return strings.NewReplacer(
		"{{QUESTION_TEXT}}", q.Title+"\n"+q.Analysis,
		"{{REFERENCE_ANSWER}}", q.Answer,
		"{{PALACE_ADDRESS}}", address,
	).Replace(template.Prompt), nil
}

func renderChoicePrompt(label string) promptRenderer {
	return func(template course.PalaceTemplate, q study.Question, address string) (string, error) {
		var question strings.Builder
		question.WriteString("随附图像如有，仅为原题配图；完整题干与选项如下。\n")
		fmt.Fprintf(&question, "题型：%s\n题干：%s\n选项：\n", label, q.Title)
		options := map[int64]string{}
		for _, item := range q.Items {
			fmt.Fprintf(&question, "%d. %s\n", item.Sign, item.ItemTitle)
			options[item.Sign] = item.ItemTitle
		}
		answers := []string{}
		for _, value := range strings.Split(q.Answer, ",") {
			sign, err := strconv.ParseInt(value, 10, 64)
			text, ok := options[sign]
			if err != nil || !ok {
				return "", ErrInvalid
			}
			answers = append(answers, fmt.Sprintf("%d. %s", sign, text))
		}
		if q.Analysis != "" {
			analysisLabel := "题库原讲解"
			if q.PackageID == "" {
				analysisLabel += "（未经现行法规核验）"
			}
			fmt.Fprintf(&question, "\n%s：\n%s\n", analysisLabel, q.Analysis)
		}
		if q.Skill != "" {
			fmt.Fprintf(&question, "\n题库提示：\n%s\n", q.Skill)
		}
		return strings.NewReplacer(
			"{{QUESTION_TEXT}}", question.String(),
			"{{REFERENCE_ANSWER}}", strings.Join(answers, "；"),
			"{{PALACE_ADDRESS}}", address,
		).Replace(template.Prompt), nil
	}
}

func renderReviewPrompt(isListening bool) promptRenderer {
	return func(template course.PalaceTemplate, q study.Question, address string) (string, error) {
		if q.QuestionReview == nil {
			return "", ErrInvalid
		}
		return renderExtendedPrompt(template, *q.QuestionReview, address, isListening)
	}
}

func renderExtendedPrompt(template course.PalaceTemplate, item course.Item, address string, isListening bool) (
	string, error,
) {
	// The preview appends the transcript separately as listening evidence.
	item.Transcript = nil
	if isListening {
		item.Passage = nil
	}
	content, err := json.MarshalIndent(item, "", "  ")
	if err != nil {
		return "", err
	}
	key, err := json.Marshal(item.ExpectedResponse())
	if err != nil {
		return "", err
	}
	return strings.NewReplacer(
		"{{QUESTION_TEXT}}", string(content),
		"{{REFERENCE_ANSWER}}", string(key),
		"{{PALACE_ADDRESS}}", address,
	).Replace(template.Prompt), nil
}

func (s *Service) questionTemplate(q study.Question) course.PalaceTemplate {
	if q.PackageID != "" {
		return sharedTemplate
	}
	return s.template
}
