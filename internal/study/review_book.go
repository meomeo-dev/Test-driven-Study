package study

import (
	"cmp"
	"context"
	"slices"
	"time"

	"test-driven-study/internal/storage/storedb"
)

type ReviewItem struct {
	QuestionID       int64  `json:"question_id"`
	Title            string `json:"title"`
	ChapterName      string `json:"chapter_name"`
	PracticeErrors   int    `json:"practice_errors"`
	ExamErrors       int    `json:"exam_errors"`
	HelpRequests     int    `json:"help_requests"`
	Confirmations    int    `json:"confirmations"`
	Score            int    `json:"score"`
	Status           string `json:"status"`
	LastAnsweredAtMS int64  `json:"last_answered_at_ms,omitempty"`
	LastCorrect      *bool  `json:"last_correct,omitempty"`
	NextReviewAtMS   int64  `json:"next_review_at_ms,omitempty"`
}

type ReviewBook struct {
	SubjectID int64        `json:"subject_id"`
	AsOfMS    int64        `json:"as_of_ms"`
	Items     []ReviewItem `json:"items"`
}

func (s *Service) ReviewBook(ctx context.Context, subject int64) (ReviewBook, error) {
	if _, err := s.WorkspaceUnit(ctx, subject); err != nil {
		return ReviewBook{}, ErrInvalid
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return ReviewBook{}, err
	}
	defer tx.Rollback()
	now := time.Now().UnixMilli()
	queries := s.queries.WithTx(tx)
	answers, err := queries.ListReviewAnswers(ctx, subject)
	if err != nil {
		return ReviewBook{}, err
	}
	help, err := queries.ListReviewHelp(ctx, subject)
	if err != nil {
		return ReviewBook{}, err
	}
	questions, err := queries.ListQuestions(ctx, storedb.ListQuestionsParams{
		SubjectID: subject, ChapterID: -1, State: "all",
	})
	if err != nil {
		return ReviewBook{}, err
	}
	if err := tx.Commit(); err != nil {
		return ReviewBook{}, err
	}
	events := make([]reviewEvent, 0, len(answers)+len(help))
	for _, answer := range answers {
		events = append(events, reviewEvent{answer.QuestionID, answer.AnsweredAtMs, answer.Kind})
	}
	for _, request := range help {
		events = append(events, reviewEvent{request.QuestionID, request.AskedAtMs, "asked"})
	}
	return ReviewBook{SubjectID: subject, AsOfMS: now,
		Items: buildReviewItems(events, questions, now)}, nil
}

func buildReviewItems(events []reviewEvent, questions []storedb.ListQuestionsRow, now int64) []ReviewItem {
	// Keep the database's attempt ID order on timestamp ties. A same-time help
	// request is applied after scored evidence, so it remains open for review.
	slices.SortStableFunc(events, func(a, b reviewEvent) int {
		return cmp.Compare(a.at, b.at)
	})
	profiles := make(map[int64]*reviewProfile)
	for _, event := range events {
		if event.at <= 0 || event.at > now {
			continue
		}
		profile := profiles[event.questionID]
		if profile == nil {
			profile = &reviewProfile{}
			profiles[event.questionID] = profile
		}
		profile.apply(event, now)
	}
	items := []ReviewItem{}
	for _, question := range questions {
		profile := profiles[question.QuestionID]
		if profile == nil || profile.item.PracticeErrors+profile.item.ExamErrors+profile.item.HelpRequests == 0 {
			continue
		}
		item := profile.result(now)
		item.QuestionID, item.Title, item.ChapterName = question.QuestionID, question.Title, question.ChapterName
		items = append(items, item)
	}
	slices.SortFunc(items, func(a, b ReviewItem) int {
		if (a.Status == "mastered") != (b.Status == "mastered") {
			if a.Status == "mastered" {
				return 1
			}
			return -1
		}
		if a.Score != b.Score {
			return b.Score - a.Score
		}
		return cmp.Compare(a.QuestionID, b.QuestionID)
	})
	return items
}

func (s *Service) reviewPracticeQuestions(ctx context.Context, f Filter) ([]storedb.ListPracticeQuestionsRow, error) {
	book, err := s.ReviewBook(ctx, f.SubjectID)
	if err != nil {
		return nil, err
	}
	f.State = "all"
	rows, err := s.PracticeQuestions(ctx, f)
	if err != nil {
		return nil, err
	}
	byID := make(map[int64]storedb.ListPracticeQuestionsRow, len(rows))
	for _, row := range rows {
		byID[row.QuestionID] = row
	}
	result := []storedb.ListPracticeQuestionsRow{}
	for _, item := range book.Items {
		if row, found := byID[item.QuestionID]; found && item.Status != "mastered" {
			result = append(result, row)
		}
	}
	return result, nil
}
