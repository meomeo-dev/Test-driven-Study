package study_test

import (
	"context"
	"slices"
	"testing"

	"test-driven-study/internal/testsupport"
	"time"

	"test-driven-study/internal/study"
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
	if err != nil || len(queue) != 3 || queue[0].QuestionID != book.Items[0].QuestionID {
		t.Fatal("review practice queue lost book order", queue, err)
	}
	other, err := s.ReviewBook(ctx, 4)
	if err != nil || len(other.Items) != 0 {
		t.Fatal("review evidence leaked into another subject", other, err)
	}
}
