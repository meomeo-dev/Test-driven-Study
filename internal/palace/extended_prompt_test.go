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

func TestExtendedPromptOmitsListeningPassageAndConcepts(t *testing.T) {
	pkg, err := course.Load("../../courses/step-up-english-1")
	if err != nil {
		t.Fatal(err)
	}
	item := pkg.Units["extended-practice"].Items[12]
	if item.ID != "sue1-extended-listening-passage" || item.Passage == nil {
		t.Fatalf("unexpected item[12]: %+v", item)
	}
	item.Concepts = []string{"listening-basics"}
	q := study.Question{}
	if !q.ProjectExtended(item) {
		t.Fatal("the listening passage item did not project")
	}
	if len(q.QuestionReview.Concepts) != 0 {
		t.Fatalf("QuestionReview leaked concept tags: %+v", q.QuestionReview.Concepts)
	}
	template := course.PalaceTemplate{Prompt: "Q {{QUESTION_TEXT}}\nA {{REFERENCE_ANSWER}}"}
	prompt, err := renderPrompt(template, q, "")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(prompt, item.Passage.String()) {
		t.Fatalf("listening passage was duplicated inside QUESTION_TEXT: %s", prompt)
	}
	if strings.Contains(prompt, "listening-basics") {
		t.Fatalf("concept tag leaked into palace prompt: %s", prompt)
	}
}
