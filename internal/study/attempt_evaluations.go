package study

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"slices"
	"strings"
	"time"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage/storedb"
)

const (
	EvaluationSourceLLM       = "llm"
	EvaluationSourceSelfCheck = "self_check"

	maxEvaluationFeedbackBytes = 64 * 1024
	maxSelfCheckCriteria       = 32
	maxSelfCheckCriterionRunes = 200
)

type EvaluationCriterion struct {
	Name    string `json:"name"`
	Points  int    `json:"points"`
	Max     int    `json:"max_points"`
	Comment string `json:"comment"`
}

type AttemptEvaluation struct {
	ID              int64                 `json:"id"`
	PresentationID  string                `json:"presentation_id"`
	Source          string                `json:"source"`
	Passed          bool                  `json:"passed"`
	ScorePct        int                   `json:"score_pct"`
	EvaluatedAtMS   int64                 `json:"evaluated_at_ms"`
	Cached          bool                  `json:"cached,omitempty"`
	Summary         string                `json:"summary,omitempty"`
	Criteria        []EvaluationCriterion `json:"criteria,omitempty"`
	CheckedCriteria []string              `json:"checked_criteria,omitempty"`
	FeedbackJSON    json.RawMessage       `json:"-"`
}

type storedEvaluationFeedback struct {
	Summary         string                `json:"summary,omitempty"`
	Criteria        []EvaluationCriterion `json:"criteria,omitempty"`
	CheckedCriteria []string              `json:"checked_criteria,omitempty"`
}

func (s *Service) requireWrittenPracticeAttempt(
	ctx context.Context, presentationID string,
) (storedb.GetAttemptRow, error) {
	if !validEventID(presentationID) || strings.HasPrefix(presentationID, "exam-") {
		return storedb.GetAttemptRow{}, ErrInvalid
	}
	row, err := s.queries.GetAttempt(ctx, presentationID)
	if errors.Is(err, sql.ErrNoRows) {
		if _, pErr := s.queries.GetPresentation(ctx, presentationID); pErr == nil {
			return storedb.GetAttemptRow{}, invalid("请先提交作答后再评分或自评")
		}
		return storedb.GetAttemptRow{}, sql.ErrNoRows
	}
	if err != nil {
		return storedb.GetAttemptRow{}, err
	}
	if row.QuestionType != course.Writing && row.QuestionType != course.Translation {
		return storedb.GetAttemptRow{}, invalid("仅写作题和翻译题支持评分与自评")
	}
	return row, nil
}

func decodeAttemptEvaluation(row storedb.AttemptEvaluation) (*AttemptEvaluation, error) {
	eval := &AttemptEvaluation{
		ID:             row.ID,
		PresentationID: row.PresentationID,
		Source:         row.Source,
		Passed:         row.Passed == 1,
		ScorePct:       int(row.ScorePct),
		EvaluatedAtMS:  row.EvaluatedAtMs,
		FeedbackJSON:   json.RawMessage(row.FeedbackJson),
	}
	var payload storedEvaluationFeedback
	if err := json.Unmarshal([]byte(row.FeedbackJson), &payload); err != nil {
		return nil, err
	}
	eval.Summary = payload.Summary
	eval.Criteria = payload.Criteria
	eval.CheckedCriteria = payload.CheckedCriteria
	return eval, nil
}

func normalizeCheckedCriteria(raw []string) ([]string, error) {
	if len(raw) > maxSelfCheckCriteria {
		return nil, invalid("自评条目过多，最多支持 32 项")
	}
	result := make([]string, 0, len(raw))
	for _, entry := range raw {
		trimmed := strings.TrimSpace(entry)
		if trimmed == "" || len([]rune(trimmed)) > maxSelfCheckCriterionRunes {
			return nil, invalid("自评条目内容无效")
		}
		if !slices.Contains(result, trimmed) {
			result = append(result, trimmed)
		}
	}
	return result, nil
}

// GetLatestAttemptEvaluation returns the most recent persisted evaluation for a
// submitted writing/translation practice attempt, or (nil, nil) if none exists.
func (s *Service) GetLatestAttemptEvaluation(
	ctx context.Context, presentationID string,
) (*AttemptEvaluation, error) {
	if _, err := s.requireWrittenPracticeAttempt(ctx, presentationID); err != nil {
		return nil, err
	}
	row, err := s.queries.GetLatestAttemptEvaluation(ctx, presentationID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return decodeAttemptEvaluation(row)
}

// GetLatestLLMEvaluation returns the most recent persisted LLM evaluation for a
// submitted writing/translation practice attempt, or (nil, nil) if none exists.
func (s *Service) GetLatestLLMEvaluation(
	ctx context.Context, presentationID string,
) (*AttemptEvaluation, error) {
	if _, err := s.requireWrittenPracticeAttempt(ctx, presentationID); err != nil {
		return nil, err
	}
	row, err := s.queries.GetLatestAttemptEvaluationBySource(
		ctx, storedb.GetLatestAttemptEvaluationBySourceParams{
			PresentationID: presentationID,
			Source:         EvaluationSourceLLM,
		},
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return decodeAttemptEvaluation(row)
}

// RecordLLMEvaluation appends a persisted LLM grading result without mutating
// the original answer_attempts row.
func (s *Service) RecordLLMEvaluation(
	ctx context.Context, presentationID string, passed bool,
	scorePct int, feedbackJSON string,
) (*AttemptEvaluation, error) {
	if _, err := s.requireWrittenPracticeAttempt(ctx, presentationID); err != nil {
		return nil, err
	}
	if scorePct < 0 || scorePct > 100 {
		return nil, ErrInvalid
	}
	trimmed := strings.TrimSpace(feedbackJSON)
	if trimmed == "" || len(trimmed) > maxEvaluationFeedbackBytes ||
		!strings.HasPrefix(trimmed, "{") || !json.Valid([]byte(trimmed)) {
		return nil, ErrInvalid
	}
	var check storedEvaluationFeedback
	if err := json.Unmarshal([]byte(trimmed), &check); err != nil {
		return nil, ErrInvalid
	}
	passedInt := int64(0)
	if passed {
		passedInt = 1
	}
	row, err := s.queries.InsertAttemptEvaluation(
		ctx, storedb.InsertAttemptEvaluationParams{
			PresentationID: presentationID,
			Source:         EvaluationSourceLLM,
			Passed:         passedInt,
			ScorePct:       int64(scorePct),
			FeedbackJson:   trimmed,
			EvaluatedAtMs:  time.Now().UTC().UnixMilli(),
		},
	)
	if err != nil {
		return nil, err
	}
	return decodeAttemptEvaluation(row)
}

// RecordSelfCheckEvaluation appends a persisted offline learner self-check
// evaluation without mutating the original answer_attempts row.
func (s *Service) RecordSelfCheckEvaluation(
	ctx context.Context, presentationID string, passed bool,
	checkedCriteria []string,
) (*AttemptEvaluation, error) {
	if _, err := s.requireWrittenPracticeAttempt(ctx, presentationID); err != nil {
		return nil, err
	}
	cleaned, err := normalizeCheckedCriteria(checkedCriteria)
	if err != nil {
		return nil, err
	}
	encoded, err := json.Marshal(storedEvaluationFeedback{
		CheckedCriteria: cleaned,
	})
	if err != nil {
		return nil, err
	}
	passedInt, scorePct := int64(0), int64(0)
	if passed {
		passedInt, scorePct = 1, 100
	}
	row, err := s.queries.InsertAttemptEvaluation(
		ctx, storedb.InsertAttemptEvaluationParams{
			PresentationID: presentationID,
			Source:         EvaluationSourceSelfCheck,
			Passed:         passedInt,
			ScorePct:       scorePct,
			FeedbackJson:   string(encoded),
			EvaluatedAtMs:  time.Now().UTC().UnixMilli(),
		},
	)
	if err != nil {
		return nil, err
	}
	return decodeAttemptEvaluation(row)
}
