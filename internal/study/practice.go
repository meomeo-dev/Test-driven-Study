package study

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"slices"
	"strconv"
	"strings"
	"test-driven-study/internal/course"
	"time"

	"test-driven-study/internal/storage/storedb"
)

var ErrConflict = errors.New("practice request conflicts with saved state")

func validEventID(id string) bool {
	if len(id) < 16 || len(id) > 80 {
		return false
	}
	for _, c := range id {
		if (c < 'a' || c > 'z') && (c < 'A' || c > 'Z') &&
			(c < '0' || c > '9') && c != '-' && c != '_' {
			return false
		}
	}
	return true
}

func questionRevision(q Question) string {
	payload, _ := json.Marshal(q)
	digest := sha256.Sum256(payload)
	return hex.EncodeToString(digest[:])
}

func (s *Service) PracticeQuestions(ctx context.Context, f Filter) ([]storedb.ListPracticeQuestionsRow, error) {
	var rows []storedb.ListPracticeQuestionsRow
	var err error
	if f.State == "review" {
		rows, err = s.reviewPracticeQuestions(ctx, f)
	} else {
		rows, err = s.queries.ListPracticeQuestions(ctx, storedb.ListPracticeQuestionsParams{
			SubjectID: f.SubjectID, ChapterID: f.ChapterID, Search: f.Search, State: f.State,
		})
	}
	if err != nil || f.Concept == "" {
		return rows, err
	}
	// The concept filter applies after state selection, so every state,
	// including the ranked review queue, keeps its own order.
	items, err := s.conceptItems(ctx, f.SubjectID, f.Concept)
	if err != nil {
		return nil, err
	}
	filtered := make([]storedb.ListPracticeQuestionsRow, 0, len(rows))
	for _, row := range rows {
		if items[row.SourceItemID] {
			filtered = append(filtered, row)
		}
	}
	return filtered, nil
}

func (s *Service) PracticeOverview(ctx context.Context, subject int64) (PracticeOverview, error) {
	overview, err := s.Overview(ctx, subject)
	if err != nil {
		return PracticeOverview{}, err
	}
	rows, err := s.PracticeQuestions(ctx, Filter{SubjectID: subject, ChapterID: -1, State: "all"})
	if err != nil {
		return PracticeOverview{}, err
	}
	result := PracticeOverview{SubjectID: subject, Total: int64(len(rows)), Chapters: overview.Chapters}
	for _, row := range rows {
		if row.State == "correct" {
			result.Correct++
		}
		if row.State == "incorrect" {
			result.Incorrect++
		}
	}
	result.Unanswered = result.Total - result.Correct - result.Incorrect
	result.LastQuestionID, err = s.queries.GetPracticeCursor(ctx, subject)
	if errors.Is(err, sql.ErrNoRows) {
		err = nil
	}
	return result, err
}

func (s *Service) OpenPresentation(ctx context.Context, id string, questionID int64) (Presentation, error) {
	if !validEventID(id) {
		return Presentation{}, ErrInvalid
	}
	detail, err := s.Detail(ctx, questionID)
	if err != nil {
		return Presentation{}, err
	}
	prior, err := s.queries.PriorExposure(ctx, questionID)
	if err != nil {
		return Presentation{}, err
	}
	row, err := s.savePresentation(ctx, id, detail.Question, prior)
	if err != nil {
		return Presentation{}, err
	}
	detail, err = s.presentationDetail(ctx, row, detail)
	if err != nil {
		return Presentation{}, err
	}
	count, err := s.queries.CountAttempts(ctx, questionID)
	if err != nil {
		return Presentation{}, err
	}
	public := ToPublic(detail.Question, VisibilityPractice)
	return Presentation{ID: id, Detail: PracticeDetail{public, detail.ImageAvailable},
		OpenedAtMS: row.OpenedAtMs, PriorAttempts: count, PriorExposure: row.PriorExposure == 1}, nil
}

func (s *Service) savePresentation(ctx context.Context, id string, question Question,
	prior int64) (storedb.PracticePresentation, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return storedb.PracticePresentation{}, err
	}
	defer tx.Rollback()
	queries := s.queries.WithTx(tx)
	revision := questionRevision(question)
	err = queries.CreatePresentation(ctx, storedb.CreatePresentationParams{
		ID: id, QuestionID: question.QuestionID, QuestionRevision: revision,
		OpenedAtMs: time.Now().UTC().UnixMilli(), PriorExposure: prior,
	})
	if err != nil {
		return storedb.PracticePresentation{}, err
	}
	row, err := queries.GetPresentation(ctx, id)
	if err != nil {
		return storedb.PracticePresentation{}, err
	}
	if row.QuestionID != question.QuestionID {
		return storedb.PracticePresentation{}, ErrConflict
	}
	if question.PackageID != "" && row.QuestionRevision == revision {
		payload, _ := json.Marshal(question)
		if err := queries.SetPresentationSnapshot(ctx, storedb.SetPresentationSnapshotParams{
			PresentationID: id, QuestionJson: string(payload),
		}); err != nil {
			return storedb.PracticePresentation{}, err
		}
	}
	return row, tx.Commit()
}

func normalizeSelection(q Question, selected []int64) ([]int64, error) {
	if len(selected) == 0 || len(selected) > len(q.Items) ||
		(q.QuestionType != course.MultipleChoice && len(selected) != 1) {
		return nil, ErrInvalid
	}
	valid := make(map[int64]bool)
	for _, item := range q.Items {
		valid[item.Sign] = true
	}
	result := slices.Clone(selected)
	slices.Sort(result)
	for index, sign := range result {
		if !valid[sign] || (index > 0 && sign == result[index-1]) {
			return nil, ErrInvalid
		}
	}
	return result, nil
}

func originalAnswer(q Question) ([]int64, error) {
	values := make([]int64, 0)
	for _, part := range strings.Split(q.Answer, ",") {
		sign, err := strconv.ParseInt(part, 10, 64)
		if err != nil {
			return nil, err
		}
		values = append(values, sign)
	}
	return normalizeSelection(q, values)
}

func attemptValue(row storedb.GetAttemptRow) (Attempt, error) {
	value := Attempt{ID: row.ID, PresentationID: row.PresentationID, QuestionID: row.QuestionID,
		QuestionType: row.QuestionType,
		SubjectID:    row.SubjectID, ChapterID: row.ChapterID, ChapterName: row.ChapterName,
		QuestionTitle: row.QuestionTitle, QuestionRevision: row.QuestionRevision,
		Correct: row.IsCorrect == 1, FirstAttempt: row.IsFirstAttempt == 1,
		PriorExposure: row.PriorExposure == 1, OpenedAtMS: row.OpenedAtMs, AnsweredAtMS: row.AnsweredAtMs}
	if strings.HasPrefix(row.SelectedJson, "{") {
		var response course.ExtendedResponse
		if json.Unmarshal([]byte(row.SelectedJson), &response) == nil && response.HasAnswer() {
			var key extendedAttemptKey
			if err := json.Unmarshal([]byte(row.CorrectAnswerJson), &key); err != nil {
				return Attempt{}, err
			}
			value.Selected, value.CorrectAnswer = []int64{}, []int64{}
			value.Response, value.Score = &response, key.Score
			return value, nil
		}
		var selected, expected struct {
			Value *string `json:"value"`
		}
		if err := json.Unmarshal([]byte(row.SelectedJson), &selected); err != nil {
			return Attempt{}, err
		}
		if err := json.Unmarshal([]byte(row.CorrectAnswerJson), &expected); err != nil {
			return Attempt{}, err
		}
		value.Selected, value.CorrectAnswer = []int64{}, []int64{}
		value.Numeric, value.CorrectNumeric = selected.Value, expected.Value
		return value, nil
	}
	if err := json.Unmarshal([]byte(row.SelectedJson), &value.Selected); err != nil {
		return Attempt{}, err
	}
	if err := json.Unmarshal([]byte(row.CorrectAnswerJson), &value.CorrectAnswer); err != nil {
		return Attempt{}, err
	}
	return value, nil
}

func (s *Service) SubmitAnswer(ctx context.Context, id string, selected []int64) (AttemptResult, error) {
	return s.SubmitResponse(ctx, id, AnswerInput{Selected: selected})
}

func (s *Service) presentationDetail(
	ctx context.Context, row storedb.PracticePresentation, detail Detail,
) (Detail, error) {
	if detail.Question.PackageID == "" && questionRevision(detail.Question) == row.QuestionRevision {
		return detail, nil
	}
	snapshot, err := s.queries.GetPresentationSnapshot(ctx, row.ID)
	if errors.Is(err, sql.ErrNoRows) {
		if questionRevision(detail.Question) != row.QuestionRevision {
			return Detail{}, ErrConflict
		}
		return detail, nil
	}
	if err != nil {
		return Detail{}, err
	}
	if err := json.Unmarshal([]byte(snapshot), &detail.Question); err != nil {
		return Detail{}, err
	}
	detail.ImageAvailable = s.questionImageAvailable(ctx, detail.Question)
	return detail, nil
}

func (s *Service) SubmitResponse(ctx context.Context, id string, input AnswerInput) (AttemptResult, error) {
	if !validEventID(id) {
		return AttemptResult{}, ErrInvalid
	}
	presentation, err := s.queries.GetPresentation(ctx, id)
	if err != nil {
		return AttemptResult{}, err
	}
	detail, err := s.Detail(ctx, presentation.QuestionID)
	if err != nil {
		return AttemptResult{}, err
	}
	detail, err = s.presentationDetail(ctx, presentation, detail)
	if err != nil {
		return AttemptResult{}, err
	}
	answer, err := normalizeAnswer(detail.Question, input)
	if err != nil {
		return AttemptResult{}, err
	}
	return s.recordResponse(ctx, presentation, detail, answer)
}

func (s *Service) recordResponse(ctx context.Context, presentation storedb.PracticePresentation,
	detail Detail, answer AnswerInput) (AttemptResult, error) {
	now := time.Now().UTC().UnixMilli()
	if now < presentation.OpenedAtMs {
		return AttemptResult{}, ErrConflict
	}
	prior, err := s.queries.PriorExposure(ctx, presentation.QuestionID)
	if err != nil {
		return AttemptResult{}, err
	}
	if presentation.PriorExposure == 1 {
		prior = 1
	}
	score, err := scoreAnswer(detail.Question, answer)
	if err != nil {
		return AttemptResult{}, err
	}
	encodedChoices, encodedAnswer, err := encodeAttempt(detail.Question, answer, score)
	if err != nil {
		return AttemptResult{}, err
	}
	correct := int64(0)
	if score == 1 {
		correct = 1
	}
	id := presentation.ID
	err = s.queries.CreateAttempt(ctx, storedb.CreateAttemptParams{
		PresentationID: id, QuestionID: detail.Question.QuestionID, SubjectID: detail.Question.SubjectID,
		ChapterID: detail.Question.ChapterID, ChapterName: detail.Question.ChapterName,
		QuestionTitle: detail.Question.Title, QuestionRevision: presentation.QuestionRevision,
		SelectedJson: encodedChoices, CorrectAnswerJson: encodedAnswer, IsCorrect: correct,
		PriorExposure: prior, OpenedAtMs: presentation.OpenedAtMs, AnsweredAtMs: now,
	})
	if err != nil {
		return AttemptResult{}, err
	}
	saved, err := s.queries.GetAttempt(ctx, id)
	if err != nil {
		return AttemptResult{}, err
	}
	attempt, err := attemptValue(saved)
	if err != nil {
		return AttemptResult{}, err
	}
	if attempt.Response != nil && attempt.Response.Value != nil {
		attempt.Selected = booleanSelection(detail.Question, *attempt.Response.Value)
		attempt.CorrectAnswer, err = originalAnswer(detail.Question)
		if err != nil {
			return AttemptResult{}, err
		}
	}
	savedAnswer := AnswerInput{Selected: attempt.Selected, Numeric: attempt.Numeric}
	if attempt.Response != nil {
		savedAnswer.ExtendedResponse = *attempt.Response
	}
	if !sameAnswer(savedAnswer, answer) {
		return AttemptResult{}, ErrConflict
	}
	return AttemptResult{Attempt: attempt, Detail: detail}, nil
}

func (s *Service) RecordExposure(ctx context.Context, id string, questionID int64) error {
	if !validEventID(id) {
		return ErrInvalid
	}
	if _, err := s.queries.GetQuestion(ctx, questionID); err != nil {
		return err
	}
	if err := s.queries.RecordExposure(ctx, storedb.RecordExposureParams{
		ID: id, QuestionID: questionID, ViewedAtMs: time.Now().UTC().UnixMilli(),
	}); err != nil {
		return err
	}
	saved, err := s.queries.GetExposure(ctx, id)
	if err == nil && saved.QuestionID != questionID {
		return ErrConflict
	}
	return err
}

func (s *Service) SetPracticeCursor(ctx context.Context, subject, id int64) error {
	detail, err := s.Detail(ctx, id)
	if err != nil {
		return err
	}
	if detail.Question.SubjectID != subject {
		return ErrInvalid
	}
	return s.queries.SetPracticeCursor(ctx, storedb.SetPracticeCursorParams{SubjectID: subject, QuestionID: id})
}
