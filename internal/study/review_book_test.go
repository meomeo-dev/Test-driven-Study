package study_test

import (
	"context"
	"database/sql"
	"fmt"
	"path/filepath"
	"slices"
	"testing"
	"time"

	"test-driven-study/internal/storage"
	"test-driven-study/internal/storage/storedb"
	"test-driven-study/internal/study"
	"test-driven-study/internal/testsupport"
)

func TestReviewBookReusesExistingPracticeExamAndChatHistory(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	s, db, root, _ := practiceDB(t)
	ctx := context.Background()
	practice := func(id string, question, sign int64) {
		t.Helper()
		if _, err := s.OpenPresentation(ctx, id, question); err != nil {
			t.Fatal(err)
		}
		if _, err := s.SubmitAnswer(ctx, id, []int64{sign}); err != nil {
			t.Fatal(err)
		}
	}
	practice("review-practice-mistake-0001", 4, 1)
	stamp := time.Now().UnixMilli()
	for _, q := range []int64{4, 6, 9} {
		if _, err := db.Exec(`INSERT INTO chat_conversations
			(id,question_id,messages_json,message_count,created_at_ms,updated_at_ms)
			VALUES (CAST(? AS TEXT),?,
			CASE WHEN ?=9 THEN '[]' ELSE json_array(
				json_object('role','user','created_at_ms',?),
				json_object('role','assistant','created_at_ms',?)) END,
			CASE WHEN ?=9 THEN 0 ELSE 2 END,?,?)`, q, q, q, stamp, stamp, q, stamp, stamp); err != nil {
			t.Fatal(err)
		}
	}
	const examID = "36000000-0000-4000-8000-000000000001"
	exam, err := s.CreateExam(ctx, examID, 1)
	if err != nil {
		t.Fatal(err)
	}
	index := slices.IndexFunc(exam.Items, func(item study.ExamItem) bool {
		return !slices.Contains([]int64{4, 6, 9}, item.Detail.Question.QuestionID)
	})
	question := exam.Items[index].Detail.Question
	correct := examExpected(t, s, question.QuestionID)[0]
	wrong := question.Items[slices.IndexFunc(question.Items, func(option study.Option) bool {
		return option.Sign != correct
	})].Sign
	if _, err := s.AnswerExam(ctx, examID, index, []int64{wrong}); err != nil {
		t.Fatal(err)
	}
	book, err := s.ReviewBook(ctx, 1)
	if err != nil || len(book.Items) != 2 {
		t.Fatal("active exam or empty chat entered the book", book, err)
	}
	// Distinguish the actual answer timestamps at millisecond resolution.
	time.Sleep(2 * time.Millisecond)
	practice("review-practice-after-exam-0002", question.QuestionID, correct)
	for range 2 {
		if _, err := s.FinishExam(ctx, examID); err != nil {
			t.Fatal(err)
		}
	}
	s = study.New(db, root)
	book, err = s.ReviewBook(ctx, 1)
	if err != nil || len(book.Items) != 3 {
		t.Fatal("expected three unique questions", book, err)
	}
	items := map[int64]study.ReviewItem{}
	for _, item := range book.Items {
		items[item.QuestionID] = item
	}
	if item := items[4]; item.PracticeErrors != 1 || item.HelpRequests != 1 || item.ExamErrors != 0 {
		t.Fatal("overlapping practice and chat evidence was not merged", item)
	}
	if item := items[6]; item.HelpRequests != 1 || item.LastCorrect != nil || item.PracticeErrors != 0 {
		t.Fatal("chat-only question received a grade", item)
	}
	if item := items[question.QuestionID]; item.ExamErrors != 1 || item.LastCorrect == nil ||
		!*item.LastCorrect || item.Confirmations != 0 {
		t.Fatal("exam finalization replaced answer chronology or counted twice", item)
	}
	queue, err := s.PracticeQuestions(ctx, study.Filter{SubjectID: 1, ChapterID: -1, State: "review"})
	if err != nil || len(queue) != 2 || queue[0].QuestionID != book.Items[0].QuestionID {
		t.Fatal("review practice queue lost book order or kept cooldown item", queue, err)
	}
	other, err := s.ReviewBook(ctx, 4)
	if err != nil || len(other.Items) != 0 {
		t.Fatal("review evidence leaked into another subject", other, err)
	}
}

func TestReviewPracticeExcludesCooldownLearningAndMastered(t *testing.T) {
	ctx := context.Background()
	s, db, subject := openReviewFixtureUnit(t)
	rows, err := s.PracticeQuestions(ctx, study.Filter{
		SubjectID: subject, ChapterID: -1, State: "all",
	})
	if err != nil || len(rows) < 8 {
		t.Fatalf("expected at least 8 fixture questions, got %d (%v)", len(rows), err)
	}

	hour := int64(time.Hour / time.Millisecond)
	day := 24 * hour
	now := time.Now().UnixMilli()

	// 0: needs_review (recent wrong answer) -> due in practice queue.
	seedReviewAttempt(t, db, rows[0], subject, "rev-q0-w", false, now-2*hour)
	// 1: needs_review (open help request) -> due in practice queue.
	seedReviewHelp(t, db, rows[1].QuestionID, "rev-q1-h", now-hour)
	// 2: due (confirmation #1 interval elapsed) -> due in practice queue.
	seedReviewAttempt(t, db, rows[2], subject, "rev-q2-w", false, now-4*day)
	seedReviewAttempt(t, db, rows[2], subject, "rev-q2-c1", true, now-2*day)
	// 3: learning (wrong + same-day retry within 24h) -> excluded.
	seedReviewAttempt(t, db, rows[3], subject, "rev-q3-w", false, now-3*hour)
	seedReviewAttempt(t, db, rows[3], subject, "rev-q3-c0", true, now-hour)
	// 4: learning (confirmation #1 within 1d interval) -> excluded.
	seedReviewAttempt(t, db, rows[4], subject, "rev-q4-w", false, now-30*hour)
	seedReviewAttempt(t, db, rows[4], subject, "rev-q4-c1", true, now-2*hour)
	// 5: learning (confirmation #2 within 3d interval) -> excluded.
	seedReviewAttempt(t, db, rows[5], subject, "rev-q5-w", false, now-6*day)
	seedReviewAttempt(t, db, rows[5], subject, "rev-q5-c1", true, now-4*day)
	seedReviewAttempt(t, db, rows[5], subject, "rev-q5-c2", true, now-day)
	// 6: learning (same-day retry whose 24h cooldown elapsed) -> due in queue.
	seedReviewAttempt(t, db, rows[6], subject, "rev-q6-w", false, now-27*hour)
	seedReviewAttempt(t, db, rows[6], subject, "rev-q6-c0", true, now-26*hour)
	// 7: mastered (3 spaced confirmations within 7d interval) -> excluded.
	seedReviewAttempt(t, db, rows[7], subject, "rev-q7-w", false, now-10*day)
	seedReviewAttempt(t, db, rows[7], subject, "rev-q7-c1", true, now-8*day)
	seedReviewAttempt(t, db, rows[7], subject, "rev-q7-c2", true, now-6*day)
	seedReviewAttempt(t, db, rows[7], subject, "rev-q7-c3", true, now-2*day)

	book, err := s.ReviewBook(ctx, subject)
	if err != nil {
		t.Fatal(err)
	}
	if len(book.Items) != 8 {
		t.Fatalf("expected 8 review book items, got %d: %+v", len(book.Items), book.Items)
	}
	wantStatus := map[int64]string{
		rows[0].QuestionID: "needs_review",
		rows[1].QuestionID: "needs_review",
		rows[2].QuestionID: "due",
		rows[3].QuestionID: "learning",
		rows[4].QuestionID: "learning",
		rows[5].QuestionID: "learning",
		rows[6].QuestionID: "learning",
		rows[7].QuestionID: "mastered",
	}
	statusCounts := map[string]int{}
	expectedOrder := make([]int64, 0, 4)
	activeSet := map[int64]bool{
		rows[0].QuestionID: true,
		rows[1].QuestionID: true,
		rows[2].QuestionID: true,
		rows[6].QuestionID: true,
	}
	for _, item := range book.Items {
		statusCounts[item.Status]++
		if want := wantStatus[item.QuestionID]; item.Status != want {
			t.Fatalf("question %d: status %q, want %q (%+v)",
				item.QuestionID, item.Status, want, item)
		}
		if activeSet[item.QuestionID] {
			expectedOrder = append(expectedOrder, item.QuestionID)
		}
	}
	if statusCounts["needs_review"] != 2 || statusCounts["due"] != 1 ||
		statusCounts["learning"] != 4 || statusCounts["mastered"] != 1 {
		t.Fatalf("unexpected review book status breakdown: %+v", statusCounts)
	}

	queue, err := s.PracticeQuestions(ctx, study.Filter{
		SubjectID: subject, ChapterID: -1, State: "review",
	})
	if err != nil {
		t.Fatal(err)
	}
	gotOrder := make([]int64, len(queue))
	for i, row := range queue {
		gotOrder[i] = row.QuestionID
	}
	if !slices.Equal(gotOrder, expectedOrder) {
		t.Fatalf("review queue = %v, want %v", gotOrder, expectedOrder)
	}
}

func openReviewFixtureUnit(t *testing.T) (*study.Service, *sql.DB, int64) {
	t.Helper()
	ctx := context.Background()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	db, err := storage.Open(ctx, root, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	courseDir := filepath.Join(root, "courses", "golden-course-template")
	if _, err := storage.InstallCourse(ctx, db, courseDir); err != nil {
		t.Fatal(err)
	}
	s := study.New(db, root)
	courses, err := s.Courses(ctx)
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range courses {
		if entry.ID == "golden-course-template" {
			for _, unit := range entry.Units {
				if unit.ID == "extended-practice" {
					return s, db, unit.SubjectID
				}
			}
		}
	}
	t.Fatal("bundled extended-practice unit was not installed")
	return nil, nil, 0
}

func seedReviewAttempt(
	t *testing.T, db *sql.DB, row storedb.ListPracticeQuestionsRow,
	subject int64, id string, correct bool, atMS int64,
) {
	t.Helper()
	isCorrect := 0
	if correct {
		isCorrect = 1
	}
	if _, err := db.Exec(`INSERT INTO practice_presentations
		(id, question_id, question_revision, opened_at_ms, prior_exposure)
		VALUES (?, ?, 'rev', ?, 0)`, id, row.QuestionID, atMS); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`INSERT INTO answer_attempts
		(presentation_id, question_id, subject_id, chapter_id, chapter_name,
		 question_title, question_revision, selected_json, correct_answer_json,
		 is_correct, is_first_attempt, prior_exposure, opened_at_ms, answered_at_ms)
		VALUES (?, ?, ?, ?, ?, ?, 'rev', '[1]', '[2]', ?, 1, 0, ?, ?)`,
		id, row.QuestionID, subject, row.ChapterID, row.ChapterName,
		row.Title, isCorrect, atMS, atMS); err != nil {
		t.Fatal(err)
	}
}

func seedReviewHelp(
	t *testing.T, db *sql.DB, questionID int64, id string, atMS int64,
) {
	t.Helper()
	messages := fmt.Sprintf(
		`[{"role":"user","created_at_ms":%d},{"role":"assistant","created_at_ms":%d}]`,
		atMS, atMS,
	)
	if _, err := db.Exec(`INSERT INTO chat_conversations
		(id, question_id, messages_json, message_count, created_at_ms, updated_at_ms)
		VALUES (?, ?, ?, 2, ?, ?)`, id, questionID, messages, atMS, atMS); err != nil {
		t.Fatal(err)
	}
}
