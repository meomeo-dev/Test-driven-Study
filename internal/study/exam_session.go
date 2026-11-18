package study

import (
	"context"
	"encoding/json"
	"time"

	"test-driven-study/internal/storage/storedb"
)

type examRecord struct {
	row     storedb.MockExam
	rule    ExamRule
	paper   []examPaperItem
	answers []examAnswer
}

func decodeExam(row storedb.MockExam) (examRecord, error) {
	value := examRecord{row: row}
	if err := json.Unmarshal([]byte(row.RuleJson), &value.rule); err != nil {
		return value, err
	}
	if err := json.Unmarshal([]byte(row.PaperJson), &value.paper); err != nil {
		return value, err
	}
	if err := json.Unmarshal([]byte(row.AnswersJson), &value.answers); err != nil {
		return value, err
	}
	maximum := value.rule.Count * value.rule.Points
	if len(value.paper) != value.rule.Count || len(value.answers) != len(value.paper) ||
		value.rule.SubjectID != row.SubjectID || maximum < 1 || maximum > 100 ||
		value.rule.PassScore < 1 || value.rule.PassScore > maximum || row.CurrentIndex < 0 ||
		row.CurrentIndex >= int64(len(value.paper)) {
		return value, ErrConflict
	}
	return value, nil
}

func (r *examRecord) public(now int64) (ExamSession, error) {
	value := ExamSession{ID: r.row.ID, SubjectID: r.row.SubjectID, Status: r.row.Status, Rule: r.rule,
		StartedAtMS: r.row.StartedAtMs, DeadlineAtMS: r.row.DeadlineAtMs, FinishedAtMS: r.row.FinishedAtMs,
		Reason: r.row.Reason, CurrentIndex: r.row.CurrentIndex, ServerNowMS: now, Items: make([]ExamItem, len(r.paper))}
	for i, item := range r.paper {
		payload, err := json.Marshal(item.Question)
		if err != nil {
			return ExamSession{}, err
		}
		var public PublicQuestion
		if err = json.Unmarshal(payload, &public); err != nil {
			return ExamSession{}, err
		}
		answer := r.answers[i]
		if r.row.Status != "finished" {
			public.TranscriptURL = ""
			public.TranscriptLines = nil
		}
		visible := ExamItem{Detail: PracticeDetail{public, item.ImageAvailable}, Selected: answer.Selected,
			Numeric: answer.Numeric, Answered: answer.AnsweredAtMS != 0, Flagged: answer.Flagged}
		if answer.ExtendedResponse.HasAnswer() {
			visible.Response = &answer.ExtendedResponse
		}
		if r.row.Status != "finished" && item.Question.QuestionType == ListeningQuestion &&
			item.Question.AudioURL == "" {
			visible.AudioSpeeds = listeningSpeeds(item.Question)
		}
		// The terminal gives feedback after commitment. The transcript stays
		// hidden until the entire paper is finished.
		if r.row.Status == "finished" || visible.Answered {
			var credit float64
			if visible.Answered {
				credit, err = scoreAnswer(item.Question, answer.input())
				if err != nil {
					return ExamSession{}, err
				}
			}
			correct := credit == 1
			visible.Correct = &correct
			if item.Question.QuestionReview != nil {
				visible.Credit = &credit
			}
			review := item.Question
			if r.row.Status != "finished" {
				review.TranscriptURL, review.TranscriptLines = "", nil
				if item.Question.QuestionType == ListeningQuestion {
					key := *review.QuestionReview
					key.Transcript, key.Passage = nil, nil
					review.QuestionReview = &key
				}
			}
			visible.Review = &review
		}
		value.Items[i] = visible
	}
	if r.row.Status == "finished" {
		value.Score = &r.row.Score
	}
	return value, nil
}

type examEdit func(*examRecord, *storedb.Queries, int64) error

func (s *Service) editExam(ctx context.Context, id string, edit examEdit) (ExamSession, error) {
	if !validExamID(id) {
		return ExamSession{}, ErrInvalid
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return ExamSession{}, err
	}
	defer tx.Rollback()
	queries := s.queries.WithTx(tx)
	row, err := queries.GetMockExam(ctx, id)
	if err != nil {
		return ExamSession{}, err
	}
	r, err := decodeExam(row)
	if err != nil {
		return ExamSession{}, err
	}
	now := time.Now().UTC().UnixMilli()
	if r.row.Status == "in_progress" && now >= r.row.DeadlineAtMs {
		if err = r.finish(ctx, queries, r.row.DeadlineAtMs, "expired"); err != nil {
			return ExamSession{}, err
		}
	} else if edit != nil {
		if err = edit(&r, queries, now); err != nil {
			return ExamSession{}, err
		}
	}
	encoded, err := json.Marshal(r.answers)
	if err != nil {
		return ExamSession{}, err
	}
	err = queries.SaveMockExam(ctx, storedb.SaveMockExamParams{ID: id, Status: r.row.Status,
		AnswersJson: string(encoded), FinishedAtMs: r.row.FinishedAtMs, Reason: r.row.Reason,
		Score: r.row.Score, CurrentIndex: r.row.CurrentIndex})
	if err != nil {
		return ExamSession{}, err
	}
	if err = tx.Commit(); err != nil {
		return ExamSession{}, err
	}
	return r.public(now)
}

func (s *Service) GetExam(ctx context.Context, id string) (ExamSession, error) {
	return s.editExam(ctx, id, nil)
}

func (s *Service) AnswerExam(ctx context.Context, id string, index int, selected []int64) (ExamSession, error) {
	return s.AnswerExamResponse(ctx, id, index, AnswerInput{Selected: selected})
}

func (s *Service) AnswerExamResponse(ctx context.Context, id string, index int, input AnswerInput) (ExamSession, error) {
	return s.editExam(ctx, id, func(r *examRecord, q *storedb.Queries, now int64) error {
		return r.commitAnswer(ctx, q, index, input, now)
	})
}

func (s *Service) MoveExam(ctx context.Context, id string, index int, flag *bool) (ExamSession, error) {
	return s.editExam(ctx, id, func(r *examRecord, _ *storedb.Queries, _ int64) error {
		if index < 0 || index >= len(r.paper) {
			return ErrInvalid
		}
		r.row.CurrentIndex = int64(index)
		if flag != nil && r.row.Status == "in_progress" {
			r.answers[index].Flagged = *flag
		}
		return nil
	})
}

func (s *Service) FinishExam(ctx context.Context, id string) (ExamSession, error) {
	return s.editExam(ctx, id, func(r *examRecord, q *storedb.Queries, now int64) error {
		if r.row.Status == "finished" {
			return nil
		}
		return r.finish(ctx, q, now, "submitted")
	})
}

func (s *Service) ListExams(ctx context.Context, subject int64) ([]ExamSummary, error) {
	if subject != 1 && subject != 4 {
		if _, err := s.WorkspaceUnit(ctx, subject); err != nil {
			return nil, ErrInvalid
		}
	}
	rows, err := s.queries.ListMockExams(ctx, subject)
	if err != nil {
		return nil, err
	}
	values := make([]ExamSummary, 0, len(rows))
	for _, row := range rows {
		if row.Status == "in_progress" && time.Now().UnixMilli() >= row.DeadlineAtMs {
			if _, err = s.GetExam(ctx, row.ID); err != nil {
				return nil, err
			}
			row, err = s.queries.GetMockExam(ctx, row.ID)
			if err != nil {
				return nil, err
			}
		}
		r, err := decodeExam(row)
		if err != nil {
			return nil, err
		}
		item := ExamSummary{ID: row.ID, SubjectID: subject, Status: row.Status, StartedAtMS: row.StartedAtMs,
			FinishedAtMS: row.FinishedAtMs, Total: len(r.paper), Reason: row.Reason}
		for _, a := range r.answers {
			if a.AnsweredAtMS != 0 {
				item.Answered++
			}
		}
		if row.Status == "finished" {
			item.Score = &row.Score
		}
		values = append(values, item)
	}
	return values, nil
}
