package palace

import (
	"strings"
	"testing"

	"test-driven-study/internal/course"
	"test-driven-study/internal/study"
)

func TestExtendedPromptUsesReferenceAnswer(t *testing.T) {
	pkg, err := course.Load("../../courses/step-up-english-1")
	if err != nil {
		t.Fatal(err)
	}
	item := pkg.Units["extended-practice"].Items[1]
	q := study.Question{}
	if !q.ProjectExtended(item) {
		t.Fatal("the listening item did not project")
	}
	template := course.PalaceTemplate{Prompt: "Q {{QUESTION_TEXT}}\nA {{REFERENCE_ANSWER}}"}
	prompt, err := renderPrompt(template, q, "")
	if err != nil || !strings.Contains(prompt, "Where are the gloves?") ||
		!strings.Contains(prompt, `A {"sub_answers":{"checklist":false,"location":["second"]}}`) ||
		strings.Contains(prompt, item.Transcript.Lines[0].Text) {
		t.Fatalf("review template lost the prompt or answer, or duplicated the transcript: %s; %v",
			prompt, err)
	}
}
