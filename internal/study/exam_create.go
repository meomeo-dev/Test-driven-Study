package study

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/json"
	"errors"
	"math/big"
	"time"

	"test-driven-study/internal/storage/storedb"
)

func shuffledQuestions(values []examPaperItem) error {
	for i := len(values) - 1; i > 0; i-- {
		index, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return err
		}
		j := int(index.Int64())
		values[i], values[j] = values[j], values[i]
	}
	return nil
}

func validExamID(id string) bool {
	if len(id) != 36 {
		return false
	}
	for i, c := range id {
		if i == 8 || i == 13 || i == 18 || i == 23 {
			if c != '-' {
				return false
			}
			continue
		}
		if !(c >= '0' && c <= '9' || c >= 'a' && c <= 'f' || c >= 'A' && c <= 'F') {
			return false
		}
	}
	return true
}

func (s *Service) eligibleExamQuestions(ctx context.Context, subject int64) ([]examPaperItem, error) {
	pool, err := s.queries.ExamQuestionPool(ctx, subject)
	if err != nil {
		return nil, err
	}
	values := make([]examPaperItem, 0, len(pool))
	for _, payload := range pool {
		var q Question
		if err = json.Unmarshal([]byte(payload), &q); err != nil {
			return nil, err
		}
		if q.QuestionType == NumericQuestion {
			if _, err := gradeNumeric(q, &q.Answer); err != nil {
				continue
			}
		} else if q.QuestionReview == nil {
			if _, err = originalAnswer(q); err != nil {
				continue
			}
		}
		// A visual question without its local asset cannot support a fair exam.
		available := s.questionImageAvailable(ctx, q)
		if q.ImageURL != "" && !available {
			continue
		}
		values = append(values, examPaperItem{Question: q, ImageAvailable: available})
	}
	return values, nil
}

func selectExamPaper(values []examPaperItem, rule ExamRule) ([]examPaperItem, error) {
	if rule.Blueprint == nil {
		if len(values) < rule.Count {
			return nil, ErrConflict
		}
		if err := shuffledQuestions(values); err != nil {
			return nil, err
		}
		return values[:rule.Count], nil
	}
	byType := map[int64][]examPaperItem{}
	seen := map[int64]bool{}
	for _, item := range values {
		q := item.Question
		if !seen[q.QuestionID] {
			byType[q.QuestionType] = append(byType[q.QuestionType], item)
			seen[q.QuestionID] = true
		}
	}
	var singleResponse, multiple []examPaperItem
	for _, quota := range rule.Blueprint.Types {
		pool := byType[quota.QuestionType]
		if len(pool) < quota.Count {
			return nil, ErrConflict
		}
		if err := shuffledQuestions(pool); err != nil {
			return nil, err
		}
		if quota.QuestionType == 2 {
			multiple = append(multiple, pool[:quota.Count]...)
		} else {
			singleResponse = append(singleResponse, pool[:quota.Count]...)
		}
	}
	// The selected recording groups judgment before single-choice questions.
	// Randomize within each quota, retaining the selected terminal's sections.
	return append(singleResponse, multiple...), nil
}

func (s *Service) examPaper(ctx context.Context, rule ExamRule) ([]examPaperItem, error) {
	values, err := s.eligibleExamQuestions(ctx, rule.SubjectID)
	if err != nil {
		return nil, err
	}
	values, err = selectExamPaper(values, rule)
	if err != nil {
		return nil, err
	}
	for i := range values {
		// Option presentation order is not a revision of the source question.
		values[i].Revision = questionRevision(values[i].Question)
		if values[i].Question.QuestionType != 3 {
			if err = shuffleExamOptions(values[i].Question.Items); err != nil {
				return nil, err
			}
		}
		values[i].PriorExposure, err = s.queries.PriorExposure(ctx, values[i].Question.QuestionID)
		if err != nil {
			return nil, err
		}
	}
	return values, nil
}

func shuffleExamOptions(options []Option) error {
	for i := len(options) - 1; i > 0; i-- {
		index, err := rand.Int(rand.Reader, big.NewInt(int64(i+1)))
		if err != nil {
			return err
		}
		j := int(index.Int64())
		options[i], options[j] = options[j], options[i]
	}
	return nil
}

func (s *Service) CreateExam(ctx context.Context, id string, subject int64) (ExamSession, error) {
	if !validExamID(id) {
		return ExamSession{}, ErrInvalid
	}
	rule, err := s.ExamRulesForUnit(ctx, subject)
	if err != nil {
		return ExamSession{}, err
	}
	if existing, lookup := s.GetExam(ctx, id); lookup == nil {
		if existing.SubjectID != subject {
			return ExamSession{}, ErrConflict
		}
		return existing, nil
	} else if !errors.Is(lookup, sql.ErrNoRows) {
		return ExamSession{}, lookup
	}
	// Expire old papers before enforcing the one-active-paper constraint.
	history, err := s.ListExams(ctx, subject)
	if err != nil {
		return ExamSession{}, err
	}
	for _, exam := range history {
		if exam.Status == "in_progress" {
			return ExamSession{}, ErrConflict
		}
	}
	paper, err := s.examPaper(ctx, rule)
	if err != nil {
		return ExamSession{}, err
	}
	answers := make([]examAnswer, len(paper))
	for i := range answers {
		answers[i].Selected = []int64{}
	}
	ruleJSON, err := json.Marshal(rule)
	if err != nil {
		return ExamSession{}, err
	}
	paperJSON, err := json.Marshal(paper)
	if err != nil {
		return ExamSession{}, err
	}
	answerJSON, err := json.Marshal(answers)
	if err != nil {
		return ExamSession{}, err
	}
	now := time.Now().UTC().UnixMilli()
	err = s.queries.CreateMockExam(ctx, storedb.CreateMockExamParams{ID: id, SubjectID: subject,
		RuleJson: string(ruleJSON), PaperJson: string(paperJSON), AnswersJson: string(answerJSON),
		StartedAtMs: now, DeadlineAtMs: now + int64(rule.Minutes)*60_000})
	if err != nil {
		if existing, lookup := s.GetExam(ctx, id); lookup == nil && existing.SubjectID == subject {
			return existing, nil
		}
		// Only uniqueness races are client conflicts; storage failures must
		// retain their real error instead of looking like an active paper.
		var databaseError interface{ Code() int }
		if errors.As(err, &databaseError) && (databaseError.Code() == 1555 || databaseError.Code() == 2067) {
			return ExamSession{}, ErrConflict
		}
		return ExamSession{}, err
	}
	return s.GetExam(ctx, id)
}
