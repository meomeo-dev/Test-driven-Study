package study_test

import (
	"math"
	"test-driven-study/internal/study"
	"testing"
	"time"
)

func TestAnalysisWindowChronologyAndLatestQuestionWeighting(t *testing.T) {
	now := time.Date(2026, 11, 1, 7, 0, 0, 0, time.UTC)
	makeAttempt := func(id, question int64, days int, correct bool) study.Attempt {
		stamp := now.AddDate(0, 0, -days).UnixMilli()
		return study.Attempt{ID: id, QuestionID: question, ChapterID: 7, Correct: correct,
			FirstAttempt: id == 1, OpenedAtMS: stamp - 1000, AnsweredAtMS: stamp}
	}
	records := []study.Attempt{makeAttempt(1, 4, 31, false), makeAttempt(2, 4, 3, false),
		makeAttempt(3, 4, 1, true), makeAttempt(4, 6, 14, false), makeAttempt(5, 8, -1, true)}
	chapters := []study.Chapter{{ChapterID: 7, ChapterName: "Traffic", Total: 100}}
	report := study.BuildAnalysis(records, chapters, now, 30)
	if report.Overall.Attempts != 3 || report.UniqueQuestions != 2 || report.ImprovedQuestions != 1 || report.LatestIncorrect != 1 {
		t.Fatal(report)
	}
	expected := 100 * math.Exp2(-1.0/14) / (math.Exp2(-1.0/14) + .5)
	if report.RecentAccuracy == nil || math.Abs(*report.RecentAccuracy-expected) > .000001 {
		t.Fatal("wrong recency weighting", report.RecentAccuracy, expected)
	}
	// Repeating the same question does not add weight to the per-question headline.
	repeated := append(records, makeAttempt(6, 4, 1, true))
	other := study.BuildAnalysis(repeated, chapters, now, 30)
	if math.Abs(*other.RecentAccuracy-*report.RecentAccuracy) > .000001 || other.Overall.Attempts != 4 {
		t.Fatal("repeat dominated recent estimate")
	}
	all := study.BuildAnalysis(records, chapters, now, 0)
	if all.Overall.Attempts != 4 || all.First.Attempts != 1 {
		t.Fatal("all-time or first-attempt separation")
	}
	if report.Forecast.Score != nil {
		t.Fatal("forecast with sparse evidence")
	}
	older := study.BuildAnalysis(records[:4], chapters, now.AddDate(0, 0, 1), 0)
	original := study.BuildAnalysis(records[:4], chapters, now, 0)
	if math.Abs(*older.RecentAccuracy-*original.RecentAccuracy) > .000001 {
		t.Fatal("invented forgetting without new data")
	}
}

func TestAnalysisBoundariesSameTimestampAndForecastCoverage(t *testing.T) {
	now := time.Date(2026, 11, 1, 7, 0, 0, 0, time.UTC)
	chapter := []study.Chapter{{ChapterID: 1, ChapterName: "A", Total: 80}, {ChapterID: 2, ChapterName: "B", Total: 20}}
	attempts := []study.Attempt{}
	for index := int64(0); index < 20; index++ {
		attempts = append(attempts, study.Attempt{ID: index + 1, QuestionID: index + 1,
			ChapterID: 1, Correct: true, OpenedAtMS: now.UnixMilli() - 1, AnsweredAtMS: now.UnixMilli()})
	}
	sparse := study.BuildAnalysis(attempts, chapter, now, 7)
	if sparse.Forecast.Score != nil || sparse.Forecast.MissingChapters != 1 {
		t.Fatal("assumed missing chapter knowledge")
	}
	attempts[19].ChapterID = 2
	attempts[19].Correct = false
	complete := study.BuildAnalysis(attempts, chapter, now, 7)
	if complete.Forecast.Score == nil || *complete.Forecast.Score != 80 || complete.Forecast.Status != "provisional" {
		t.Fatal(complete.Forecast)
	}
	// Stable server sequence breaks ties when two answers share a millisecond.
	attempts = append(attempts, study.Attempt{ID: 100, QuestionID: 20, ChapterID: 2,
		Correct: true, OpenedAtMS: now.UnixMilli() - 1, AnsweredAtMS: now.UnixMilli()})
	updated := study.BuildAnalysis(attempts, chapter, now, 7)
	if updated.LatestIncorrect != 0 || updated.ImprovedQuestions != 1 {
		t.Fatal("same-time ordering unstable")
	}
	boundary := now.AddDate(0, 0, -7).UnixMilli()
	result := study.BuildAnalysis([]study.Attempt{{ID: 1, QuestionID: 1, ChapterID: 1,
		Correct: true, OpenedAtMS: boundary - 1, AnsweredAtMS: boundary}}, chapter, now, 7)
	if result.Trend[0].Attempts != 1 || len(result.Trend) != 8 {
		t.Fatal("rolling window lost its partial boundary day", result.Trend)
	}
	if result.Overall.Attempts != 1 || result.Comparison.Current.Attempts != 1 || result.Comparison.Previous.Attempts != 0 {
		t.Fatal("boundary double-counted")
	}
}
