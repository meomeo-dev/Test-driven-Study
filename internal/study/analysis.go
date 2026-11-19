package study

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	"test-driven-study/internal/storage/storedb"
)

const recencyHalfLifeDays = 14
const minimumForecastQuestions = 20

func percent(correct, total int64) *float64 {
	if total == 0 {
		return nil
	}
	value := 100 * float64(correct) / float64(total)
	return &value
}

func addRate(rate *Rate, correct bool) {
	rate.Attempts++
	if correct {
		rate.Correct++
	}
	rate.Accuracy = percent(rate.Correct, rate.Attempts)
}

func (s *Service) Analysis(ctx context.Context, subject int64, days int) (Analysis, error) {
	if days != 0 && days != 7 && days != 30 && days != 90 {
		return Analysis{}, ErrInvalid
	}
	overview, err := s.Overview(ctx, subject)
	if err != nil {
		return Analysis{}, err
	}
	records, err := s.queries.ListAttempts(ctx, subject)
	if err != nil {
		return Analysis{}, err
	}
	attempts := make([]Attempt, 0, len(records))
	for _, record := range records {
		attempt, err := attemptValue(storedb.GetAttemptRow(record))
		if err != nil {
			return Analysis{}, err
		}
		attempts = append(attempts, attempt)
	}
	result := BuildAnalysis(attempts, overview.Chapters, time.Now().UTC(), days)
	result.SubjectID = subject
	return result, nil
}

// BuildAnalysis uses only server-timestamped, submitted attempts. Manual marks
// and presentation/exposure events never enter a scored denominator.
func BuildAnalysis(records []Attempt, chapters []Chapter, now time.Time, days int) Analysis {
	result := Analysis{WindowDays: days, AsOfMS: now.UnixMilli(), HalfLifeDays: recencyHalfLifeDays,
		Chapters: []ChapterAnalysis{}, Trend: []DailyAnalysis{}, Advice: []string{}, RecentAttempts: []Attempt{}}
	since := int64(0)
	if days > 0 {
		since = now.AddDate(0, 0, -days).UnixMilli()
		result.SinceMS = &since
	}
	ordered := append([]Attempt(nil), records...)
	sort.Slice(ordered, func(i, j int) bool {
		if ordered[i].AnsweredAtMS == ordered[j].AnsweredAtMS {
			return ordered[i].ID < ordered[j].ID
		}
		return ordered[i].AnsweredAtMS < ordered[j].AnsweredAtMS
	})
	inWindow, latest, previouslyWrong := collectAttempts(ordered, &result, since, now)
	result.UniqueQuestions = int64(len(latest))
	result.RecentAccuracy = recentAccuracy(latest, now)
	for _, chapter := range chapters {
		stats := chapterStats(chapter, inWindow, latest, previouslyWrong, now)
		result.Chapters = append(result.Chapters, stats)
		result.TotalQuestions += chapter.Total
		result.LatestIncorrect += stats.LatestIncorrect
		result.ImprovedQuestions += stats.ImprovedQuestions
	}
	if result.TotalQuestions > 0 {
		result.Coverage = 100 * float64(result.UniqueQuestions) / float64(result.TotalQuestions)
	}
	if result.Comparison.Current.Attempts >= 5 && result.Comparison.Previous.Attempts >= 5 {
		difference := *result.Comparison.Current.Accuracy - *result.Comparison.Previous.Accuracy
		result.Comparison.ChangePP = &difference
	}
	result.TrendDays = days
	if days == 0 {
		result.TrendDays = 30
	}
	result.Trend = dailyTrend(inWindow, now, result.TrendDays)
	for index := len(inWindow) - 1; index >= 0 && len(result.RecentAttempts) < 20; index-- {
		result.RecentAttempts = append(result.RecentAttempts, inWindow[index])
	}
	result.Forecast = forecast(result.Chapters, result.UniqueQuestions, result.TotalQuestions)
	result.Advice = analysisAdvice(result)
	return result
}

func collectAttempts(ordered []Attempt, result *Analysis, since int64, now time.Time) (
	[]Attempt, map[int64]Attempt, map[int64]bool,
) {
	latest, previouslyWrong := map[int64]Attempt{}, map[int64]bool{}
	inWindow := make([]Attempt, 0)
	for _, attempt := range ordered {
		if attempt.AnsweredAtMS > result.AsOfMS {
			continue
		}
		stamp := attempt.AnsweredAtMS
		result.LastAttemptMS = &stamp
		addComparison(&result.Comparison, attempt, now)
		if stamp < since {
			continue
		}
		inWindow = append(inWindow, attempt)
		latest[attempt.QuestionID] = attempt
		if !attempt.Correct {
			previouslyWrong[attempt.QuestionID] = true
		}
		addRate(&result.Overall, attempt.Correct)
		if attempt.FirstAttempt {
			addRate(&result.First, attempt.Correct)
		} else {
			addRate(&result.Repeat, attempt.Correct)
		}
		if attempt.PriorExposure {
			result.PriorExposureAttempts++
		}
	}
	return inWindow, latest, previouslyWrong
}

func addComparison(comparison *PeriodComparison, attempt Attempt, now time.Time) {
	recent := now.AddDate(0, 0, -7).UnixMilli()
	previous := now.AddDate(0, 0, -14).UnixMilli()
	if attempt.AnsweredAtMS >= recent {
		addRate(&comparison.Current, attempt.Correct)
	} else if attempt.AnsweredAtMS >= previous {
		addRate(&comparison.Previous, attempt.Correct)
	}
}

func recentAccuracy(latest map[int64]Attempt, now time.Time) *float64 {
	total, correct := 0.0, 0.0
	for _, attempt := range latest {
		ageDays := float64(now.UnixMilli()-attempt.AnsweredAtMS) / float64(24*time.Hour/time.Millisecond)
		weight := math.Exp2(-ageDays / recencyHalfLifeDays)
		total += weight
		if attempt.Correct {
			correct += weight
		}
	}
	if total == 0 {
		return nil
	}
	value := 100 * correct / total
	return &value
}

func chapterStats(chapter Chapter, attempts []Attempt, latest map[int64]Attempt,
	wrong map[int64]bool, now time.Time) ChapterAnalysis {
	result := ChapterAnalysis{ChapterID: chapter.ChapterID, ChapterName: chapter.ChapterName, Total: chapter.Total}
	selected := map[int64]Attempt{}
	for _, attempt := range attempts {
		if attempt.ChapterID != chapter.ChapterID {
			continue
		}
		result.Attempts++
		if !attempt.Correct {
			result.WrongAttempts++
		}
	}
	for id, attempt := range latest {
		if attempt.ChapterID != chapter.ChapterID {
			continue
		}
		selected[id] = attempt
		if !attempt.Correct {
			result.LatestIncorrect++
		}
		if attempt.Correct && wrong[id] {
			result.ImprovedQuestions++
		}
	}
	result.UniqueQuestions = int64(len(selected))
	result.ErrorRate = percent(result.WrongAttempts, result.Attempts)
	result.RecentAccuracy = recentAccuracy(selected, now)
	return result
}

func dailyTrend(attempts []Attempt, now time.Time, days int) []DailyAnalysis {
	result := make([]DailyAnalysis, 0, days)
	buckets := map[string]*DailyAnalysis{}
	cutoff := now.AddDate(0, 0, -days).UnixMilli()
	first := time.UnixMilli(cutoff).UTC().Truncate(24 * time.Hour)
	last := now.UTC().Truncate(24 * time.Hour)
	// A rolling N-day interval can overlap N+1 calendar dates. Keep the
	// partial first and last dates instead of dropping boundary evidence.
	for day := first; !day.After(last); day = day.AddDate(0, 0, 1) {
		result = append(result, DailyAnalysis{Day: day.Format("2006-01-02")})
	}
	for index := range result {
		buckets[result[index].Day] = &result[index]
	}
	for _, attempt := range attempts {
		if attempt.AnsweredAtMS < cutoff {
			continue
		}
		key := time.UnixMilli(attempt.AnsweredAtMS).UTC().Format("2006-01-02")
		if bucket := buckets[key]; bucket != nil {
			bucket.Attempts++
			if attempt.Correct {
				bucket.Correct++
			}
		}
	}
	return result
}

func forecast(chapters []ChapterAnalysis, sample, total int64) ScoreForecast {
	result := ScoreForecast{Status: "insufficient_data", SampleQuestions: sample,
		Basis: "chapter-weighted-question-bank; not calibrated to exams", MinimumQuestions: minimumForecastQuestions}
	score := 0.0
	for _, chapter := range chapters {
		if chapter.RecentAccuracy == nil {
			result.MissingChapters++
			continue
		}
		if total > 0 {
			score += float64(chapter.Total) / float64(total) * *chapter.RecentAccuracy
		}
	}
	if sample >= minimumForecastQuestions && result.MissingChapters == 0 && total > 0 {
		rounded := math.Round(score)
		result.Score = &rounded
		result.Status = "provisional"
	}
	return result
}

func analysisAdvice(result Analysis) []string {
	if result.Overall.Attempts == 0 {
		return []string{"当前时间窗口没有答题记录。先完成一组题，再查看错误分布和学习变化。"}
	}
	advice := []string{}
	weakest := ChapterAnalysis{}
	for _, chapter := range result.Chapters {
		if chapter.LatestIncorrect > weakest.LatestIncorrect {
			weakest = chapter
		}
	}
	if weakest.LatestIncorrect > 0 {
		advice = append(advice, fmt.Sprintf("%s：%d 次作答中错 %d 次，%d 道题最近仍答错。先复习该章，再间隔重答。",
			weakest.ChapterName, weakest.Attempts, weakest.WrongAttempts, weakest.LatestIncorrect))
	}
	if result.ImprovedQuestions > 0 {
		advice = append(advice, fmt.Sprintf("%d 道题已从答错转为最近答对；保留间隔复习，确认不是短时记住答案。", result.ImprovedQuestions))
	}
	if result.UniqueQuestions < result.TotalQuestions {
		advice = append(advice, fmt.Sprintf("本窗口尚有 %d 道题没有作答记录，补充未答题可减少覆盖不足。", result.TotalQuestions-result.UniqueQuestions))
	}
	if result.PriorExposureAttempts > 0 {
		advice = append(advice, "部分题目在作答前已经见过。对照首次与重复作答表现，避免把熟悉题面的正确率当成考试保证。")
	}
	if len(advice) == 0 {
		advice = append(advice, "继续混合章节练习，并通过独立的模拟考试检验表现。")
	}
	return advice
}
