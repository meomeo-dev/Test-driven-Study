package study

import (
	"errors"
	"testing"

	"test-driven-study/internal/testsupport"
)

func quotaPool() []examPaperItem {
	var pool []examPaperItem
	for _, kind := range []int64{1, 2, 3} {
		for i := int64(1); i <= 120; i++ {
			pool = append(pool, examPaperItem{Question: Question{
				QuestionID: kind*1000 + i, QuestionType: kind,
			}})
		}
	}
	return pool
}

func TestNewExamPapersEnforceTypeQuotas(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	for _, subject := range []int64{1, 4} {
		rule, err := New(nil, "../..").ExamRules(subject)
		if err != nil {
			t.Fatal(err)
		}
		for range 5 {
			pool := quotaPool()
			pool = append(pool, pool[0])
			paper, err := selectExamPaper(pool, rule)
			if err != nil || len(paper) != rule.Count {
				t.Fatal("incorrect paper size", err)
			}
			counts, seen := map[int64]int{}, map[int64]bool{}
			for _, item := range paper {
				q := item.Question
				if seen[q.QuestionID] {
					t.Fatal("duplicate question")
				}
				seen[q.QuestionID] = true
				counts[q.QuestionType]++
			}
			for _, quota := range rule.Blueprint.Types {
				if counts[quota.QuestionType] != quota.Count {
					t.Fatalf("subject %d: type %d got %d, want %d",
						subject, quota.QuestionType, counts[quota.QuestionType], quota.Count)
				}
			}
		}
	}
}

func TestExamPaperRejectsInsufficientTypeInsteadOfSubstituting(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	rule, _ := New(nil, "../..").ExamRules(1)
	var pool []examPaperItem
	for _, item := range quotaPool() {
		if item.Question.QuestionType != 3 {
			pool = append(pool, item)
		}
	}
	if _, err := selectExamPaper(pool, rule); !errors.Is(err, ErrConflict) {
		t.Fatal("missing judgment questions silently replaced", err)
	}
}

func TestExamBlueprintTotalsAndLocalContentTargets(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	for _, subject := range []int64{1, 4} {
		rule, _ := New(nil, "../..").ExamRules(subject)
		total := 0
		for _, topic := range rule.Blueprint.Topics {
			total += topic.Count
		}
		local := rule.Blueprint.Topics[len(rule.Blueprint.Topics)-1]
		if total != rule.Count || local.Count*10 != rule.Count ||
			rule.Blueprint.ContentAlignment != "unverified" || rule.Count*rule.Points != 100 {
			t.Fatal("invalid target totals or overstated coverage")
		}
	}
}
