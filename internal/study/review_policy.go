package study

import (
	"math"
	"time"
)

const reviewDayMS = int64(24 * time.Hour / time.Millisecond)
const errorHalfLifeDays = 30
const masteryConfirmations = 3

// Each credited recall increases the interval until the next check. The first
// success establishes a baseline, then two spaced checks establish mastery.
var reviewIntervals = [...]int64{1, 3, 7, 14, 30}

type reviewEvent struct {
	questionID int64
	at         int64
	kind       string
}

type reviewProfile struct {
	item         ReviewItem
	lastEvidence int64
	confirmedAt  int64
	helpPending  bool
	wrongWeight  float64
	answerWeight float64
}

func (p *reviewProfile) apply(event reviewEvent, now int64) {
	independent := p.lastEvidence == 0 || event.at-p.lastEvidence >= reviewDayMS
	p.lastEvidence = event.at
	if event.kind == "asked" {
		p.item.HelpRequests++
		p.helpPending = true
		return
	}
	correct := event.kind == "correct"
	p.item.LastCorrect, p.item.LastAnsweredAtMS = &correct, event.at
	weight := math.Exp2(-float64(now-event.at) / float64(errorHalfLifeDays*reviewDayMS))
	if !correct {
		if event.kind == "exam_wrong" {
			p.item.ExamErrors++
		} else {
			p.item.PracticeErrors++
		}
		p.wrongWeight += weight
		p.answerWeight += weight
		p.item.Confirmations, p.confirmedAt = 0, 0
		return
	}
	if !independent {
		return
	}
	p.answerWeight += weight
	p.helpPending = false
	if p.confirmedAt == 0 || event.at >= p.nextReview() {
		p.item.Confirmations = min(p.item.Confirmations+1, len(reviewIntervals))
		p.confirmedAt = event.at
	}
}

func (p *reviewProfile) nextReview() int64 {
	return p.confirmedAt + reviewIntervals[p.item.Confirmations-1]*reviewDayMS
}

func (p *reviewProfile) result(now int64) ReviewItem {
	item := p.item
	memoryLoss := 1.0
	item.Status = "learning"
	if p.confirmedAt > 0 {
		due := p.nextReview()
		memoryLoss = 1 - math.Pow(0.8, float64(now-p.confirmedAt)/float64(due-p.confirmedAt))
		item.NextReviewAtMS = due
		if now >= due {
			item.Status = "due"
		} else if item.Confirmations >= masteryConfirmations {
			item.Status = "mastered"
		}
	}
	if p.helpPending || item.LastCorrect == nil || !*item.LastCorrect {
		item.Status, item.NextReviewAtMS = "needs_review", 0
	}
	// This is a relative review priority, not a probability of an incorrect answer.
	score := 45*memoryLoss + 35*p.wrongWeight/(1+p.answerWeight)
	if item.Confirmations == 0 && item.PracticeErrors+item.ExamErrors > 0 {
		score += 10
	}
	if p.helpPending {
		score += 10
	}
	item.Score = int(math.Round(score))
	return item
}
