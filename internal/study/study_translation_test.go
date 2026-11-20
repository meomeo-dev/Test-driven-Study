package study_test

import (
	"context"
	"encoding/json"
	"slices"
	"strings"
	"testing"

	"test-driven-study/internal/study"
)

func TestV2StudyTranslationsAreReviewOnly(t *testing.T) {
	s, _, subject := setupExtendedCourse(t)
	ctx := context.Background()
	const examID = "a7990000-0000-4000-8000-000000000002"
	paper, err := s.CreateExam(ctx, examID, subject)
	if err != nil {
		t.Fatal(err)
	}
	assertStudyTranslationVisibility(t, paper, false)
	indices := make([]int, 0, 2)
	for _, test := range []struct{ sourceID, response string }{
		{"sue1-extended-listening", `{"sub_answers":{"location":["second"],"checklist":false}}`},
		{"sue1-extended-reading", `{"sub_answers":{"opening":"8","visitors":["badge","sign"]}}`},
	} {
		index := slices.IndexFunc(paper.Items, func(item study.ExamItem) bool {
			return item.Detail.Question.SourceItemID == test.sourceID
		})
		if index < 0 {
			t.Fatalf("exam missing %s", test.sourceID)
		}
		indices = append(indices, index)
		checkPracticeStudyTranslation(t, s, test.sourceID, paper.Items[index], test.response)
		paper, err = s.AnswerExamResponse(ctx, examID, index, extendedInput(t, test.response))
		if err != nil || paper.Status != "in_progress" || paper.Items[index].Review == nil {
			t.Fatalf("%s: missing active exam review: %v", test.sourceID, err)
		}
		assertStudyTranslationVisibility(t, paper, false)
	}
	final, err := s.FinishExam(ctx, examID)
	if err != nil || final.Status != "finished" {
		t.Fatalf("failed to finish exam: %v", err)
	}
	for _, index := range indices {
		assertStudyTranslationVisibility(t, final.Items[index].Review, true)
		assertStudyTranslationVisibility(t, final.Items[index].Detail, false)
	}
}

func checkPracticeStudyTranslation(
	t *testing.T, s *study.Service, sourceID string, item study.ExamItem, response string,
) {
	t.Helper()
	ctx := context.Background()
	questionID := item.Detail.Question.QuestionID
	detail, err := s.Detail(ctx, questionID)
	if err != nil {
		t.Fatal(err)
	}
	assertStudyTranslationVisibility(t, detail, true)
	presentationID := "study-translation-practice-" + sourceID
	presentation, err := s.OpenPresentation(ctx, presentationID, questionID)
	if err != nil {
		t.Fatal(err)
	}
	assertStudyTranslationVisibility(t, presentation, false)
	result, err := s.SubmitResponse(ctx, presentationID, extendedInput(t, response))
	if err != nil {
		t.Fatal(err)
	}
	assertStudyTranslationVisibility(t, result.Detail, true)
}

func assertStudyTranslationVisibility(t *testing.T, value any, want bool) {
	t.Helper()
	wire, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(wire), `"study_translation":`) != want {
		t.Fatalf("study translation visibility wanted %t, got %s", want, wire)
	}
}
