package study_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"slices"
	"strconv"
	"strings"
	"sync"
	"testing"

	"test-driven-study/internal/testsupport"
	"time"

	"test-driven-study/internal/study"
)

func examExpected(t *testing.T, s *study.Service, id int64) []int64 {
	t.Helper()
	detail, err := s.Detail(context.Background(), id)
	if err != nil {
		t.Fatal(err)
	}
	var expected []int64
	for _, value := range strings.Split(detail.Question.Answer, ",") {
		n, err := strconv.ParseInt(value, 10, 64)
		if err != nil {
			t.Fatal(err)
		}
		expected = append(expected, n)
	}
	slices.Sort(expected)
	return expected
}

func TestExamPaperPrivacyScoringAndIdempotentAnalysis(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	s, db, root, _ := practiceDB(t)
	ctx := context.Background()
	id := "a6000000-0000-4000-8000-000000000001"
	started, err := s.CreateExam(ctx, id, 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(started.Items) != 100 || started.Rule.Minutes != 45 || started.Rule.Points != 1 || started.Score != nil {
		t.Fatal("invalid initial rules or exposed score")
	}
	seen := map[int64]bool{}
	counts := map[int64]int{}
	for _, item := range started.Items {
		counts[item.Detail.Question.QuestionType]++
		qid := item.Detail.Question.QuestionID
		if seen[qid] || item.Review != nil || item.Correct != nil {
			t.Fatal("duplicate or leaked answer")
		}
		seen[qid] = true
	}
	if counts[3] != 40 || counts[1] != 60 || counts[2] != 0 {
		t.Fatal("subject one type quotas not applied to stored paper", counts)
	}
	payload, _ := json.Marshal(started)
	var public map[string]any
	json.Unmarshal(payload, &public)
	for _, value := range public["items"].([]any) {
		item := value.(map[string]any)
		q := item["detail"].(map[string]any)["question"].(map[string]any)
		for _, key := range []string{"answer", "analysis", "skill"} {
			if _, ok := q[key]; ok {
				t.Fatal("answer field leaked", key)
			}
		}
	}
	replayed, err := s.CreateExam(ctx, id, 1)
	if err != nil || replayed.StartedAtMS != started.StartedAtMS || replayed.Items[0].Detail.Question.QuestionID != started.Items[0].Detail.Question.QuestionID {
		t.Fatal("idempotent creation changed paper")
	}
	if _, err = s.CreateExam(ctx, "a6000000-0000-4000-8000-000000000002", 1); !errors.Is(err, study.ErrConflict) {
		t.Fatal("second active paper accepted")
	}
	for i := 0; i < 12; i++ {
		answer := examExpected(t, s, started.Items[i].Detail.Question.QuestionID)
		value, err := s.AnswerExam(ctx, id, i, answer)
		if err != nil {
			t.Fatal(err)
		}
		if value.Items[i].Correct == nil || !*value.Items[i].Correct ||
			value.Items[i].Review == nil || value.Score != nil || value.Items[20].Review != nil {
			t.Fatal("committed feedback missing or unanswered feedback exposed")
		}
		if _, err = s.AnswerExam(ctx, id, i, answer); err != nil {
			t.Fatal("identical answer rejected")
		}
	}
	flag := true
	if _, err = s.MoveExam(ctx, id, 15, &flag); err != nil {
		t.Fatal(err)
	}
	s = study.New(db, root)
	resumed, err := s.GetExam(ctx, id)
	if err != nil || resumed.CurrentIndex != 15 || !resumed.Items[15].Flagged || !resumed.Items[0].Answered {
		t.Fatal("resume lost state")
	}
	var group sync.WaitGroup
	for range 3 {
		group.Go(func() {
			if _, err := s.FinishExam(ctx, id); err != nil {
				t.Error(err)
			}
		})
	}
	group.Wait()
	result, err := s.GetExam(ctx, id)
	if err != nil || *result.Score != 12 || result.Status != "finished" || result.Items[0].Review == nil || !*result.Items[0].Correct || *result.Items[20].Correct {
		t.Fatal("incorrect result", err)
	}
	var count int
	db.QueryRow("SELECT count(*) FROM answer_attempts WHERE presentation_id LIKE 'exam-%'").Scan(&count)
	if count != 12 {
		t.Fatal("answers duplicated or unanswered questions recorded", count)
	}
	analysis, err := s.Analysis(ctx, 1, 0)
	if err != nil || analysis.Overall.Attempts != 12 {
		t.Fatal("analysis missing exam attempts")
	}
	if _, err = s.AnswerExam(ctx, id, 50, []int64{1}); !errors.Is(err, study.ErrConflict) {
		t.Fatal("finished paper accepted an answer")
	}
}

func TestExamMultipleChoiceExpiryAndGuards(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	s, db, _, _ := practiceDB(t)
	ctx := context.Background()
	id := "a6000000-0000-4000-8000-000000000003"
	value, err := s.CreateExam(ctx, id, 4)
	if err != nil {
		t.Fatal(err)
	}
	if len(value.Items) != 50 || value.Rule.Points != 2 || value.Rule.PassScore != 90 {
		t.Fatal("wrong subject four rule")
	}
	for i, item := range value.Items {
		if (item.Detail.Question.QuestionType == 2) != (i >= 40) {
			t.Fatal("subject four composition/order changed")
		}
	}
	counts := map[int64]int{}
	for _, item := range value.Items {
		counts[item.Detail.Question.QuestionType]++
	}
	if counts[3] != 20 || counts[1] != 20 || counts[2] != 10 {
		t.Fatal("subject four type quotas not applied to stored paper", counts)
	}
	for _, index := range []int{-1, 50} {
		if _, err = s.AnswerExam(ctx, id, index, []int64{1}); !errors.Is(err, study.ErrInvalid) {
			t.Fatal("invalid index accepted")
		}
	}
	q := value.Items[0].Detail.Question
	if _, err = s.AnswerExam(ctx, id, 0, []int64{99}); !errors.Is(err, study.ErrInvalid) {
		t.Fatal("invalid option accepted")
	}
	selected := []int64{q.Items[0].Sign}
	if _, err = s.AnswerExam(ctx, id, 0, selected); err != nil {
		t.Fatal(err)
	}
	if _, err = s.AnswerExam(ctx, id, 0, []int64{q.Items[1].Sign}); !errors.Is(err, study.ErrConflict) {
		t.Fatal("locked answer changed")
	}
	// Advance the server deadline in the isolated database; clients cannot set it.
	time.Sleep(3 * time.Millisecond)
	now := time.Now().UnixMilli()
	_, err = db.Exec("UPDATE mock_exams SET started_at_ms=?,deadline_at_ms=? WHERE id=?", now-3_000_000, now-1, id)
	if err != nil {
		t.Fatal(err)
	}
	expired, err := s.AnswerExam(ctx, id, 1, []int64{value.Items[1].Detail.Question.Items[0].Sign})
	if err != nil || expired.Status != "finished" || expired.Reason != "expired" || expired.Items[1].Answered {
		t.Fatal("late answer accepted", err)
	}
	if _, err = s.GetExam(ctx, id); err != nil {
		t.Fatal(err)
	}
	var count int
	db.QueryRow("SELECT count(*) FROM answer_attempts").Scan(&count)
	if count != 1 {
		t.Fatal("expiry replay duplicated attempts")
	}
	for i := 0; i < 3; i++ {
		if _, err = s.CreateExam(ctx, fmt.Sprintf("invalid-exam-%016d", i), int64(i+6)); err == nil {
			t.Fatal("invalid subject accepted")
		}
	}
}

func TestExamMultiplePartialCreditAndEarlyFailure(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	s, db, _, _ := practiceDB(t)
	ctx := context.Background()
	id := "a6000000-0000-4000-8000-000000000004"
	value, err := s.CreateExam(ctx, id, 4)
	if err != nil {
		t.Fatal(err)
	}
	for i := 40; i < 46; i++ {
		expected := examExpected(t, s, value.Items[i].Detail.Question.QuestionID)
		if len(expected) < 2 {
			t.Fatal("fixture multiple-choice answer should have several options")
		}
		value, err = s.AnswerExam(ctx, id, i, expected[:1])
		if err != nil {
			t.Fatal(err)
		}
		if i < 45 && value.Status != "in_progress" {
			t.Fatal("ended before six errors")
		}
	}
	if value.Status != "finished" || value.Reason != "failed_limit" || *value.Score != 0 {
		t.Fatal("partial credit or missing early failure")
	}
	var count int
	db.QueryRow("SELECT count(*) FROM answer_attempts").Scan(&count)
	if count != 6 {
		t.Fatal("early-end learning record mismatch")
	}
}

func TestExamNinetyPointsPassBoundary(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	s, _, _, _ := practiceDB(t)
	ctx := context.Background()
	id := "a6000000-0000-4000-8000-000000000005"
	value, err := s.CreateExam(ctx, id, 1)
	if err != nil {
		t.Fatal(err)
	}
	for i, item := range value.Items {
		expected := examExpected(t, s, item.Detail.Question.QuestionID)
		selected := expected
		if i >= 90 {
			for _, option := range item.Detail.Question.Items {
				if option.Sign != expected[0] {
					selected = []int64{option.Sign}
					break
				}
			}
		}
		if _, err = s.AnswerExam(ctx, id, i, selected); err != nil {
			t.Fatal(err)
		}
	}
	result, err := s.FinishExam(ctx, id)
	if err != nil || *result.Score != 90 || result.Reason != "submitted" {
		t.Fatal("90-point pass boundary failed", err)
	}
}

func TestExamEleventhSubjectOneErrorEndsPaper(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	s, _, _, _ := practiceDB(t)
	ctx := context.Background()
	id := "a6000000-0000-4000-8000-000000000006"
	value, err := s.CreateExam(ctx, id, 1)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 11; i++ {
		item := value.Items[i]
		expected := examExpected(t, s, item.Detail.Question.QuestionID)
		var wrong int64
		for _, option := range item.Detail.Question.Items {
			if option.Sign != expected[0] {
				wrong = option.Sign
				break
			}
		}
		value, err = s.AnswerExam(ctx, id, i, []int64{wrong})
		if err != nil {
			t.Fatal(err)
		}
		if i < 10 && value.Status != "in_progress" {
			t.Fatal("ended before eleventh error")
		}
	}
	if value.Reason != "failed_limit" || *value.Score != 0 || value.Items[11].Answered {
		t.Fatal("incorrect Subject 1 early-failure boundary")
	}
}

func TestExamGradesItsSavedQuestionSnapshot(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	s, db, _, _ := practiceDB(t)
	ctx := context.Background()
	id := "a6000000-0000-4000-8000-000000000007"
	value, err := s.CreateExam(ctx, id, 1)
	if err != nil {
		t.Fatal(err)
	}
	// Papers created before blueprint metadata was introduced stay readable;
	// the current rules must never be substituted for a saved rule snapshot.
	legacy := value.Rule
	legacy.Version, legacy.Blueprint = "2026-11-03", nil
	encodedRule, _ := json.Marshal(legacy)
	if _, err = db.Exec("UPDATE mock_exams SET rule_json=? WHERE id=?", string(encodedRule), id); err != nil {
		t.Fatal(err)
	}
	questionID := value.Items[0].Detail.Question.QuestionID
	original, err := s.Detail(ctx, questionID)
	if err != nil {
		t.Fatal(err)
	}
	expected := examExpected(t, s, questionID)
	changed := original.Question
	changed.Title = "Updated question after the examination began"
	for _, option := range changed.Items {
		if option.Sign != expected[0] {
			changed.Answer = strconv.FormatInt(option.Sign, 10)
			break
		}
	}
	payload, err := json.Marshal(changed)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = db.Exec("UPDATE questions SET payload_json=? WHERE question_id=?", string(payload), questionID); err != nil {
		t.Fatal(err)
	}
	if _, err = s.AnswerExam(ctx, id, 0, expected); err != nil {
		t.Fatal(err)
	}
	result, err := s.FinishExam(ctx, id)
	if err != nil || *result.Score != 1 || result.Items[0].Review.Title != original.Question.Title ||
		result.Items[0].Review.Answer != original.Question.Answer ||
		result.Rule.Blueprint != nil || result.Rule.Version != legacy.Version {
		t.Fatal("bank change altered a saved paper or grading", err)
	}
}
