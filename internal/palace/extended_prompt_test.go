package palace

import (
	"context"
	"strings"
	"testing"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage"
	"test-driven-study/internal/study"
)

func TestExtendedPromptUsesReferenceAnswer(t *testing.T) {
	pkg, err := course.Load("../../courses/golden-course-template")
	if err != nil {
		t.Fatal(err)
	}
	item := pkg.Units["extended-practice"].Items[1]
	q, err := study.ProjectQuestion(study.Question{}, item)
	if err != nil {
		t.Fatalf("the listening item did not project: %v", err)
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
	pkg, err := course.Load("../../courses/golden-course-template")
	if err != nil {
		t.Fatal(err)
	}
	item := pkg.Units["extended-practice"].Items[12]
	if item.ID != "sue1-extended-listening-passage" || item.Passage == nil {
		t.Fatalf("unexpected item[12]: %+v", item)
	}
	item.Concepts = []string{"listening-basics"}
	q, err := study.ProjectQuestion(study.Question{}, item)
	if err != nil {
		t.Fatalf("the listening passage item did not project: %v", err)
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

func TestPromptRendererCoversAllQuestionTypes(t *testing.T) {
	all := course.AllQuestionTypes()
	if len(promptRenderers) != len(all) {
		t.Fatalf("promptRenderers count %d != AllQuestionTypes count %d", len(promptRenderers), len(all))
	}
	for _, qt := range all {
		if _, ok := promptRenderers[qt]; !ok {
			t.Fatalf("missing promptRenderer for %q", qt)
		}
	}
}

func TestClozeNeverReceivesListeningTranscriptInPreview(t *testing.T) {
	options := testOptions(t, providerFunc(func(context.Context, ProviderInput) (ProviderOutput, error) {
		return ProviderOutput{}, nil
	}))
	if _, err := storage.InstallCourse(context.Background(), options.DB, "../../courses/golden-course-template"); err != nil {
		t.Fatal(err)
	}
	s := newService(t, options)
	pkg, err := course.Load("../../courses/golden-course-template")
	if err != nil {
		t.Fatal(err)
	}
	clozeItem := pkg.Units["extended-practice"].Items[0]
	if clozeItem.Type != course.Cloze {
		t.Fatalf("expected cloze item, got %q", clozeItem.Type)
	}
	q, err := study.ProjectQuestion(study.Question{QuestionID: 999999, PackageID: pkg.Manifest.ID, PackageVersion: pkg.Manifest.Version}, clozeItem)
	if err != nil {
		t.Fatal(err)
	}
	// Simulate stale polluted fields before preview.
	q.TranscriptURL = "Every worker must sign."
	q.TranscriptLines = []course.TranscriptLine{{Speaker: "W", Text: "Every worker must sign."}}
	preview, err := s.questionPreview(context.Background(), study.Detail{Question: q}, "Desk", "")
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(preview.Prompt, "<listening_transcript>") {
		t.Fatalf("cloze preview leaked <listening_transcript>: %s", preview.Prompt)
	}
}
