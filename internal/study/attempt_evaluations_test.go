package study_test

import (
	"context"
	"database/sql"
	"errors"
	"slices"
	"testing"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage/storedb"
	"test-driven-study/internal/study"
)

func findQuestionBySourceID(
	t *testing.T, rows []storedb.ListPracticeQuestionsRow, sourceID string,
) storedb.ListPracticeQuestionsRow {
	t.Helper()
	index := slices.IndexFunc(rows, func(r storedb.ListPracticeQuestionsRow) bool {
		return r.SourceItemID == sourceID
	})
	if index < 0 {
		t.Fatalf("missing fixture item %q", sourceID)
	}
	return rows[index]
}

func findConceptStatus(
	t *testing.T, graph study.ConceptGraph, id string,
) study.ConceptStatus {
	t.Helper()
	index := slices.IndexFunc(graph.Concepts, func(c study.ConceptStatus) bool {
		return c.ID == id
	})
	if index < 0 {
		t.Fatalf("missing concept %q in graph", id)
	}
	return graph.Concepts[index]
}

func TestAttemptEvaluationsImmutabilityTriggers(t *testing.T) {
	ctx := context.Background()
	s, db, subject := openReviewFixtureUnit(t)
	rows, err := s.PracticeQuestions(ctx, study.Filter{
		SubjectID: subject, ChapterID: -1, State: "all",
	})
	if err != nil {
		t.Fatal(err)
	}
	translationRow := findQuestionBySourceID(t, rows, "sue1-extended-translation")

	presID := "eval-immutable-trans-0001"
	if _, err := s.OpenPresentation(ctx, presID, translationRow.QuestionID); err != nil {
		t.Fatal(err)
	}
	// Paraphrase matches all key_terms -> capped at 0.5, answer_attempts.is_correct = 0.
	paraphrase := "请把签字好的清单放在前台处。"
	submitted, err := s.SubmitResponse(ctx, presID, study.AnswerInput{
		ExtendedResponse: course.ExtendedResponse{Translation: &paraphrase},
	})
	if err != nil || submitted.Attempt.Correct || submitted.Attempt.Score == nil ||
		*submitted.Attempt.Score != 0.5 {
		t.Fatalf("expected 0.5 capped translation attempt, got %+v / %v", submitted.Attempt, err)
	}

	eval, err := s.RecordSelfCheckEvaluation(ctx, presID, true, []string{"签字", "清单", "前台"})
	if err != nil || !eval.Passed || eval.ScorePct != 100 ||
		eval.Source != study.EvaluationSourceSelfCheck {
		t.Fatalf("unexpected self-check evaluation: %+v / %v", eval, err)
	}

	// Raw answer_attempts row must stay immutable with is_correct = 0.
	var rawCorrect int
	if err := db.QueryRow(
		`SELECT is_correct FROM answer_attempts WHERE presentation_id = ?`, presID,
	).Scan(&rawCorrect); err != nil || rawCorrect != 0 {
		t.Fatalf("raw answer_attempts row changed: is_correct=%d err=%v", rawCorrect, err)
	}
	if _, err := db.Exec(`UPDATE answer_attempts SET is_correct = 1`); err == nil {
		t.Fatal("answer_attempts allowed UPDATE")
	}
	if _, err := db.Exec(`DELETE FROM answer_attempts`); err == nil {
		t.Fatal("answer_attempts allowed DELETE")
	}

	// attempt_evaluations must also reject UPDATE and DELETE.
	if _, err := db.Exec(`UPDATE attempt_evaluations SET passed = 0`); err == nil {
		t.Fatal("attempt_evaluations allowed UPDATE")
	}
	if _, err := db.Exec(`DELETE FROM attempt_evaluations`); err == nil {
		t.Fatal("attempt_evaluations allowed DELETE")
	}
}

func TestTranslationParaphraseAndAppendOnlyMasteryFlow(t *testing.T) {
	ctx := context.Background()
	s, _, subject := openReviewFixtureUnit(t)
	rows, err := s.PracticeQuestions(ctx, study.Filter{
		SubjectID: subject, ChapterID: -1, State: "all",
	})
	if err != nil {
		t.Fatal(err)
	}
	translationRow := findQuestionBySourceID(t, rows, "sue1-extended-translation")

	// Before any evaluation, paraphrased translation hits 0.5 cap and fails everywhere.
	presID := "eval-paraphrase-flow-0001"
	if _, err := s.OpenPresentation(ctx, presID, translationRow.QuestionID); err != nil {
		t.Fatal(err)
	}
	paraphrase := "请把签字好的清单放在前台处。"
	if _, err := s.SubmitResponse(ctx, presID, study.AnswerInput{
		ExtendedResponse: course.ExtendedResponse{Translation: &paraphrase},
	}); err != nil {
		t.Fatal(err)
	}
	if latest, err := s.GetLatestAttemptEvaluation(ctx, presID); err != nil || latest != nil {
		t.Fatalf("expected nil evaluation before grading, got %+v / %v", latest, err)
	}
	assertEffectivePassState(t, s, subject, translationRow.QuestionID, "workplace-instructions", false)

	// 1. Offline self-check pass overcomes 0.5 cap across review book, analysis, practice, concepts.
	scPass, err := s.RecordSelfCheckEvaluation(ctx, presID, true, []string{" 准确表达含义 ", "签字", "签字"})
	if err != nil || !scPass.Passed || !slices.Equal(scPass.CheckedCriteria, []string{"准确表达含义", "签字"}) {
		t.Fatalf("self-check pass failed: %+v / %v", scPass, err)
	}
	assertEffectivePassState(t, s, subject, translationRow.QuestionID, "workplace-instructions", true)

	// 2. Append-only re-evaluation: self-check fail supersedes prior pass (latest wins).
	scFail, err := s.RecordSelfCheckEvaluation(ctx, presID, false, nil)
	if err != nil || scFail.Passed || scFail.ScorePct != 0 || scFail.ID <= scPass.ID {
		t.Fatalf("self-check fail failed: %+v / %v", scFail, err)
	}
	assertEffectivePassState(t, s, subject, translationRow.QuestionID, "workplace-instructions", false)

	// 3. Append-only LLM evaluation pass supersedes self-check fail and is retrievable by source.
	llmPayload := `{"criteria":[{"name":"meaning","points":54,"max_points":60,"comment":"语义准确"},{"name":"terminology","points":22,"max_points":25,"comment":"术语恰当"},{"name":"fluency","points":14,"max_points":15,"comment":"通顺"}],"summary":"整体准确"}`
	llmPass, err := s.RecordLLMEvaluation(ctx, presID, true, 90, llmPayload)
	if err != nil || !llmPass.Passed || llmPass.ScorePct != 90 ||
		llmPass.Source != study.EvaluationSourceLLM ||
		llmPass.Summary != "整体准确" || len(llmPass.Criteria) != 3 {
		t.Fatalf("LLM evaluation failed: %+v / %v", llmPass, err)
	}
	assertEffectivePassState(t, s, subject, translationRow.QuestionID, "workplace-instructions", true)

	// 4. Subsequent self-check fail becomes latest overall while LLM cache stays intact.
	scFail2, err := s.RecordSelfCheckEvaluation(ctx, presID, false, []string{"需要润色"})
	if err != nil || scFail2.ID <= llmPass.ID {
		t.Fatalf("second self-check failed: %+v / %v", scFail2, err)
	}
	latestAll, err := s.GetLatestAttemptEvaluation(ctx, presID)
	if err != nil || latestAll == nil || latestAll.ID != scFail2.ID || latestAll.Passed {
		t.Fatalf("latest evaluation mismatch: %+v / %v", latestAll, err)
	}
	latestLLM, err := s.GetLatestLLMEvaluation(ctx, presID)
	if err != nil || latestLLM == nil || latestLLM.ID != llmPass.ID || !latestLLM.Passed || latestLLM.ScorePct != 90 {
		t.Fatalf("latest LLM evaluation mismatch: %+v / %v", latestLLM, err)
	}
	assertEffectivePassState(t, s, subject, translationRow.QuestionID, "workplace-instructions", false)
}

func TestWrittenEvaluationsUnlockConceptMastery(t *testing.T) {
	ctx := context.Background()
	s, _, subject := openReviewFixtureUnit(t)
	rows, err := s.PracticeQuestions(ctx, study.Filter{
		SubjectID: subject, ChapterID: -1, State: "all",
	})
	if err != nil {
		t.Fatal(err)
	}

	// Mark prerequisite known so handover-writing is unlocked, then submit 3 writing items
	// that fail keyword exact-match (is_correct = 0) and pass via offline self-check / LLM.
	if _, err := s.SetConceptKnown(ctx, "golden-course-template", "workplace-instructions", true); err != nil {
		t.Fatal(err)
	}
	writingItems := []struct {
		sourceID string
		presID   string
		text     string
		viaLLM   bool
	}{
		{"sue1-extended-writing", "eval-writing-mastery-001", "The shipment arrives next week instead of today.", false},
		{"sue1-extended-writing-short", "eval-writing-mastery-002", "Hi Mia, our van broke down today so the shipment will arrive tomorrow morning at ten. Please reply if that time works for your team. Thanks very much for understanding and helping us coordinate the unloading schedule cleanly at the warehouse dock. Best, Sam", false},
		{"sue1-extended-writing-full", "eval-writing-mastery-003", "Switching between traditional forms and electronic records changes how shift teams share information. Traditional sheets work offline without batteries, yet pages smudge or vanish easily. Electronic records keep every shift aligned in one screen and make searching faster, though tablet power can drop unexpectedly. I recommend using electronic records daily while storing printed emergency sheets beside the desk. Whenever tablets lose charge or network access, operators can write dates, times, and open tasks clearly on emergency sheets, and leads can copy them into the system once power returns. That balanced workflow prevents lost notes during outages and keeps daily handovers fast, searchable, and consistent for incoming staff across every shift.", true},
	}

	for _, tc := range writingItems {
		row := findQuestionBySourceID(t, rows, tc.sourceID)
		if _, err := s.OpenPresentation(ctx, tc.presID, row.QuestionID); err != nil {
			t.Fatal(err)
		}
		text := tc.text
		res, err := s.SubmitResponse(ctx, tc.presID, study.AnswerInput{
			ExtendedResponse: course.ExtendedResponse{Text: &text},
		})
		if err != nil || res.Attempt.Correct {
			t.Fatalf("%s: expected initial heuristic fail, got %+v / %v", tc.sourceID, res.Attempt, err)
		}
	}

	before, err := s.Concepts(ctx, "golden-course-template")
	if err != nil {
		t.Fatal(err)
	}
	if st := findConceptStatus(t, before, "handover-writing"); st.Correct != 0 || st.State != study.ConceptLearning {
		t.Fatalf("expected handover-writing learning with 0 correct, got %+v", st)
	}
	if st := findConceptStatus(t, before, "handover-self-check"); st.Unlocked {
		t.Fatalf("dependent concept should remain locked before mastery: %+v", st)
	}

	for _, tc := range writingItems {
		if tc.viaLLM {
			fb := `{"criteria":[{"name":"task_completion","points":40,"max_points":45,"comment":"完整"},{"name":"language_accuracy","points":26,"max_points":30,"comment":"准确"},{"name":"coherence","points":22,"max_points":25,"comment":"连贯"}],"summary":"达标"}`
			if _, err := s.RecordLLMEvaluation(ctx, tc.presID, true, 88, fb); err != nil {
				t.Fatal(err)
			}
		} else {
			if _, err := s.RecordSelfCheckEvaluation(ctx, tc.presID, true, []string{"符合要点"}); err != nil {
				t.Fatal(err)
			}
		}
	}

	after, err := s.Concepts(ctx, "golden-course-template")
	if err != nil {
		t.Fatal(err)
	}
	if st := findConceptStatus(t, after, "handover-writing"); st.Correct != 3 || st.State != study.ConceptMastered {
		t.Fatalf("expected handover-writing mastered after evaluations, got %+v", st)
	}
	if st := findConceptStatus(t, after, "handover-self-check"); !st.Unlocked || st.State != study.ConceptReady {
		t.Fatalf("expected dependent concept unlocked after writing mastery, got %+v", st)
	}
}

func TestAttemptEvaluationGuardsRejectInvalidStates(t *testing.T) {
	ctx := context.Background()
	s, _, subject := openReviewFixtureUnit(t)
	rows, err := s.PracticeQuestions(ctx, study.Filter{
		SubjectID: subject, ChapterID: -1, State: "all",
	})
	if err != nil {
		t.Fatal(err)
	}
	translationRow := findQuestionBySourceID(t, rows, "sue1-extended-translation")
	judgmentRow := findQuestionBySourceID(t, rows, "sue1-extended-judgment")

	// 1. Malformed presentation ID -> ErrInvalid.
	if _, err := s.RecordSelfCheckEvaluation(ctx, "bad", true, nil); !errors.Is(err, study.ErrInvalid) {
		t.Fatalf("expected ErrInvalid for malformed ID, got %v", err)
	}
	// 2. Nonexistent presentation ID -> sql.ErrNoRows.
	if _, err := s.GetLatestAttemptEvaluation(ctx, "missing-presentation-0001"); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("expected sql.ErrNoRows for missing presentation, got %v", err)
	}
	// 3. Opened but unanswered presentation -> ErrInvalid (must not evaluate before submit).
	unansweredID := "eval-unanswered-trans-001"
	if _, err := s.OpenPresentation(ctx, unansweredID, translationRow.QuestionID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.RecordSelfCheckEvaluation(ctx, unansweredID, true, nil); !errors.Is(err, study.ErrInvalid) {
		t.Fatalf("expected ErrInvalid on unanswered presentation, got %v", err)
	}
	if _, err := s.GetLatestAttemptEvaluation(ctx, unansweredID); !errors.Is(err, study.ErrInvalid) {
		t.Fatalf("expected ErrInvalid reading evaluation on unanswered presentation, got %v", err)
	}
	// 4. Submitted non-written/non-translation item -> ErrInvalid.
	nonWrittenID := "eval-non-written-tf-0001"
	if _, err := s.OpenPresentation(ctx, nonWrittenID, judgmentRow.QuestionID); err != nil {
		t.Fatal(err)
	}
	val := false
	if _, err := s.SubmitResponse(ctx, nonWrittenID, study.AnswerInput{
		ExtendedResponse: course.ExtendedResponse{Value: &val},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.RecordSelfCheckEvaluation(ctx, nonWrittenID, true, nil); !errors.Is(err, study.ErrInvalid) {
		t.Fatalf("expected ErrInvalid on true_false item, got %v", err)
	}
	if _, err := s.RecordLLMEvaluation(ctx, nonWrittenID, true, 80, `{"summary":"ok"}`); !errors.Is(err, study.ErrInvalid) {
		t.Fatalf("expected ErrInvalid for LLM eval on true_false item, got %v", err)
	}
	// 5. Mock exam presentation IDs (active or finished) -> ErrInvalid.
	const examID = "c7000000-0000-4000-8000-000000000001"
	paper, err := s.CreateExam(ctx, examID, subject)
	if err != nil {
		t.Fatal(err)
	}
	transIdx := slices.IndexFunc(paper.Items, func(item study.ExamItem) bool {
		return item.Detail.Question.SourceItemID == "sue1-extended-translation"
	})
	if transIdx < 0 {
		t.Fatal("exam missing translation item")
	}
	examPresID := "exam-" + examID + "-0"
	if _, err := s.RecordSelfCheckEvaluation(ctx, examPresID, true, nil); !errors.Is(err, study.ErrInvalid) {
		t.Fatalf("expected ErrInvalid for active exam presentation, got %v", err)
	}
	text := "请把签字好的清单放在前台处。"
	if _, err := s.AnswerExamResponse(ctx, examID, transIdx, study.AnswerInput{
		ExtendedResponse: course.ExtendedResponse{Translation: &text},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.FinishExam(ctx, examID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.RecordSelfCheckEvaluation(ctx, examPresID, true, nil); !errors.Is(err, study.ErrInvalid) {
		t.Fatalf("expected ErrInvalid for finished exam presentation, got %v", err)
	}

	// 6. Invalid LLM score/JSON and invalid self-check criteria on a valid submission.
	validID := "eval-valid-trans-guards-1"
	if _, err := s.OpenPresentation(ctx, validID, translationRow.QuestionID); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SubmitResponse(ctx, validID, study.AnswerInput{
		ExtendedResponse: course.ExtendedResponse{Translation: &text},
	}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.RecordLLMEvaluation(ctx, validID, true, 101, `{"summary":"ok"}`); !errors.Is(err, study.ErrInvalid) {
		t.Fatalf("expected ErrInvalid for score_pct > 100, got %v", err)
	}
	if _, err := s.RecordLLMEvaluation(ctx, validID, true, 80, `not-json`); !errors.Is(err, study.ErrInvalid) {
		t.Fatalf("expected ErrInvalid for invalid JSON, got %v", err)
	}
	if _, err := s.RecordSelfCheckEvaluation(ctx, validID, true, []string{"   "}); !errors.Is(err, study.ErrInvalid) {
		t.Fatalf("expected ErrInvalid for blank criterion, got %v", err)
	}
}

func assertEffectivePassState(
	t *testing.T, s *study.Service, subject, questionID int64,
	conceptID string, wantPass bool,
) {
	t.Helper()
	ctx := context.Background()

	// Check ReviewBook.
	book, err := s.ReviewBook(ctx, subject)
	if err != nil {
		t.Fatal(err)
	}
	inBook := slices.ContainsFunc(book.Items, func(item study.ReviewItem) bool {
		return item.QuestionID == questionID
	})
	if inBook == wantPass {
		t.Fatalf("ReviewBook membership=%v, wantPass=%v (items=%+v)", inBook, wantPass, book.Items)
	}

	// Check Analysis.
	analysis, err := s.Analysis(ctx, subject, 30)
	if err != nil {
		t.Fatal(err)
	}
	wantCorrectCount := int64(0)
	wantLatestWrong := int64(1)
	if wantPass {
		wantCorrectCount, wantLatestWrong = 1, 0
	}
	if analysis.Overall.Correct != wantCorrectCount || analysis.LatestIncorrect != wantLatestWrong {
		t.Fatalf("Analysis mismatch for wantPass=%v: overall=%+v latestWrong=%d",
			wantPass, analysis.Overall, analysis.LatestIncorrect)
	}

	// Check PracticeQuestions state.
	rows, err := s.PracticeQuestions(ctx, study.Filter{
		SubjectID: subject, ChapterID: -1, State: "all",
	})
	if err != nil {
		t.Fatal(err)
	}
	idx := slices.IndexFunc(rows, func(r storedb.ListPracticeQuestionsRow) bool {
		return r.QuestionID == questionID
	})
	wantState := "incorrect"
	if wantPass {
		wantState = "correct"
	}
	if idx < 0 || rows[idx].State != wantState {
		t.Fatalf("PracticeQuestions state=%q, want %q", rows[idx].State, wantState)
	}

	// Check Concepts evidence.
	graph, err := s.Concepts(ctx, "golden-course-template")
	if err != nil {
		t.Fatal(err)
	}
	st := findConceptStatus(t, graph, conceptID)
	wantConceptCorrect := 0
	if wantPass {
		wantConceptCorrect = 1
	}
	if st.Attempted != 1 || st.Correct != wantConceptCorrect {
		t.Fatalf("Concept %q evidence=%+v, want attempted=1 correct=%d",
			conceptID, st, wantConceptCorrect)
	}
}
