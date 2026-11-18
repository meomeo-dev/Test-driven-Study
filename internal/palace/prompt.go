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

func renderPrompt(template course.PalaceTemplate, q study.Question, address string) (string, error) {
	if q.QuestionReview != nil {
		return renderExtendedPrompt(template, *q.QuestionReview, address)
	}
	if q.QuestionType == study.NumericQuestion {
		return strings.NewReplacer("{{QUESTION_TEXT}}", q.Title+"\n"+q.Analysis,
			"{{REFERENCE_ANSWER}}", q.Answer, "{{PALACE_ADDRESS}}", address).Replace(template.Prompt), nil
	}
	var question strings.Builder
	question.WriteString("随附图像如有，仅为原题配图；完整题干与选项如下。\n")
	fmt.Fprintf(&question, "题型：%s\n题干：%s\n选项：\n", map[int64]string{1: "单选题", 2: "多选题", 3: "判断题"}[q.QuestionType], q.Title)
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
		label := "题库原讲解"
		if q.PackageID == "" {
			label += "（未经现行法规核验）"
		}
		fmt.Fprintf(&question, "\n%s：\n%s\n", label, q.Analysis)
	}
	if q.Skill != "" {
		fmt.Fprintf(&question, "\n题库提示：\n%s\n", q.Skill)
	}
	return strings.NewReplacer("{{QUESTION_TEXT}}", question.String(),
		"{{REFERENCE_ANSWER}}", strings.Join(answers, "；"),
		"{{PALACE_ADDRESS}}", address).Replace(template.Prompt), nil
}

func renderExtendedPrompt(template course.PalaceTemplate, item course.Item, address string) (
	string, error,
) {
	// The preview appends the transcript separately as listening evidence.
	item.Transcript = nil
	if item.Type == course.Listening {
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
	return strings.NewReplacer("{{QUESTION_TEXT}}", string(content),
		"{{REFERENCE_ANSWER}}", string(key), "{{PALACE_ADDRESS}}", address).Replace(template.Prompt), nil
}

func (s *Service) questionTemplate(q study.Question) course.PalaceTemplate {
	if q.PackageID != "" {
		return sharedTemplate
	}
	return s.template
}
