package study

import (
	"testing"

	"test-driven-study/internal/storage/storedb"
)

func TestReviewMasteryRequiresSpacedConfirmationAndExpires(t *testing.T) {
	day := reviewDayMS
	start := 100 * day
	first := start + day + 1000
	second := first + day + 1000
	third := second + 3*day
	questions := []storedb.ListQuestionsRow{{QuestionID: 4}}
	events := []reviewEvent{{4, start, "practice_wrong"}, {4, start + 1000, "correct"}}
	check := func(now int64, status string, confirmations int) ReviewItem {
		t.Helper()
		items := buildReviewItems(events, questions, now)
		if len(items) != 1 || items[0].Status != status || items[0].Confirmations != confirmations {
			t.Fatalf("day %d: expected %s with %d confirmations, got %+v",
				(now-start)/day, status, confirmations, items)
		}
		return items[0]
	}
	check(start+1000, "learning", 0)
	// A finalized exam may arrive later in storage than a newer practice answer.
	events = append(events, reviewEvent{4, third, "correct"},
		reviewEvent{4, second, "correct"}, reviewEvent{4, first, "correct"},
		reviewEvent{4, first + 1000, "correct"})
	check(first+1000, "learning", 1)
	check(second-1000, "due", 1)
	check(second, "learning", 2)
	fresh := check(third, "mastered", 3)
	if fresh.NextReviewAtMS != third+7*day {
		t.Fatalf("unexpected review date: %+v", fresh)
	}
	events = append(events, reviewEvent{4, third + day, "correct"})
	expired := check(third+7*day, "due", 3)
	if expired.Score <= fresh.Score || expired.NextReviewAtMS != fresh.NextReviewAtMS {
		t.Fatal("early correct refreshed the decay clock", fresh, expired)
	}
	events = append(events, reviewEvent{4, third + 7*day, "exam_wrong"})
	lapse := check(third+7*day, "needs_review", 0)
	if lapse.ExamErrors != 1 || lapse.PracticeErrors != 1 || lapse.Score <= expired.Score {
		t.Fatal("later error did not reset mastery and raise priority", lapse)
	}
}

func TestReviewHelpReopensMasteryWithoutScoringAnError(t *testing.T) {
	day := reviewDayMS
	start := 100 * day
	questions := []storedb.ListQuestionsRow{{QuestionID: 4}, {QuestionID: 6}, {QuestionID: 9}}
	events := []reviewEvent{{4, start, "correct"}, {4, start + day, "correct"},
		{4, start + 4*day, "correct"}, {4, start + 5*day, "asked"},
		{4, start + 5*day + 1000, "correct"}, {6, start + 5*day, "exam_wrong"},
		{9, start, "correct"}}
	items := buildReviewItems(events, questions, start+5*day+1000)
	if len(items) != 2 || items[0].QuestionID != 6 || items[1].QuestionID != 4 {
		t.Fatalf("incorrect membership or priority: %+v", items)
	}
	helped := items[1]
	if helped.Status != "needs_review" || helped.HelpRequests != 1 || helped.Confirmations != 3 ||
		helped.PracticeErrors != 0 || helped.ExamErrors != 0 || helped.LastCorrect == nil || !*helped.LastCorrect {
		t.Fatalf("help was treated as a graded outcome or cleared by a rapid answer: %+v", helped)
	}
	events = append(events, reviewEvent{4, start + 6*day + 1000, "correct"})
	items = buildReviewItems(events, questions, start+6*day+1000)
	if items[1].Status != "mastered" || items[1].NextReviewAtMS != start+11*day {
		t.Fatalf("delayed answer should clear help without postponing the scheduled review: %+v", items)
	}
}
