package llm

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"os"
	"slices"
	"time"

	"test-driven-study/internal/storage/storedb"
)

func (s *Service) Prepare(params Parameters) (Parameters, error) {
	input, err := s.normalize(PlanInput{ID: "00000000-0000-0000-0000-000000000000", QuestionID: 1, Parameters: params})
	if err != nil {
		return Parameters{}, err
	}
	s.configuration.RLock()
	defer s.configuration.RUnlock()
	if s.provider == nil {
		return Parameters{}, ErrDisabled
	}
	return input.Parameters, nil
}
func (s *Service) RunPipeline(ctx context.Context, input PlanInput, source string, images ...InputImage) (PlanRecord, error) {
	return s.RunControlledPipeline(ctx, input, PlanSource{Prompt: source}, nil, images...)
}

func (s *Service) RunControlledPipeline(ctx context.Context, input PlanInput, source PlanSource,
	control func(context.Context) error, images ...InputImage) (PlanRecord, error) {
	ctx, cancel := context.WithCancel(ctx)
	stop := context.AfterFunc(s.ctx, cancel)
	defer func() { stop(); cancel() }()
	if ctx.Err() != nil {
		return PlanRecord{}, ctx.Err()
	}
	if !eventID.MatchString(input.ID) {
		return PlanRecord{}, ErrInvalid
	}
	for !s.planning.TryLock() {
		timer := time.NewTimer(100 * time.Millisecond)
		select {
		case <-ctx.Done():
			timer.Stop()
			return PlanRecord{}, ctx.Err()
		case <-timer.C:
		}
	}
	defer s.planning.Unlock()
	input, err := s.normalize(input)
	if err != nil {
		return PlanRecord{}, err
	}
	previous, err := s.Get(ctx, input.ID)
	if err == nil {
		if previous.PlanInput != input || !previous.matchesSource(source) {
			return PlanRecord{}, ErrConflict
		}
		if previous.Status == "succeeded" && previous.Plan != nil && validPlan(*previous.Plan) {
			return previous, nil
		}
		if previous.Status == "paused" {
			if len(images) == 0 {
				images, err = s.referenceImages(ctx, input.QuestionID)
				if err != nil {
					return previous, err
				}
			}
			// JSON omitempty restores an empty reference list as nil. Both mean
			// there is no question image and must allow the same checkpoint.
			if !slices.Equal(references(images), previous.References) {
				return previous, checkpointFailure()
			}
			s.configuration.RLock()
			provider := s.provider
			s.configuration.RUnlock()
			if provider == nil {
				return previous, ErrDisabled
			}
			previous.Status = "running"
			previous.Error = nil
			return s.completeControlled(ctx, provider, previous, control, true, images...)
		}
		return previous, &Failure{Code: "previous_request", Message: "构思记录已存在且未成功，不会自动重试"}
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return PlanRecord{}, err
	}
	if source.Prompt == "" || len(source.Prompt) > 100000 {
		return PlanRecord{}, ErrInvalid
	}
	s.configuration.RLock()
	provider := s.provider
	s.configuration.RUnlock()
	if provider == nil {
		return PlanRecord{}, ErrDisabled
	}
	if len(images) == 0 {
		images, err = s.referenceImages(ctx, input.QuestionID)
		if err != nil {
			return PlanRecord{}, err
		}
	}
	now := time.Now().UTC().UnixMilli()
	record := PlanRecord{References: references(images), PlanInput: input,
		SourcePrompt: source.Prompt, ProfileVersion: source.ProfileVersion,
		Status: "running", CreatedAtMS: now, UpdatedAtMS: now}
	payload, err := json.Marshal(record)
	if err != nil {
		return PlanRecord{}, err
	}
	if err := s.queries.CreateLLMPlan(ctx, storedb.CreateLLMPlanParams{ID: input.ID, QuestionID: input.QuestionID, RecordJson: string(payload)}); err != nil {
		return PlanRecord{}, err
	}
	return s.completeControlled(ctx, provider, record, control, false, images...)
}

func (s *Service) DiscardPaused(ctx context.Context, id string) error {
	record, err := s.Get(ctx, id)
	if errors.Is(err, sql.ErrNoRows) {
		return nil
	}
	if err != nil || record.Status != "paused" {
		return err
	}
	record.Status = "failed"
	record.Session.Phase = "failed"
	record.Error = &Failure{Code: "canceled", Message: "任务已终止，后续步骤不会开始"}
	record.UpdatedAtMS = time.Now().UTC().UnixMilli()
	data, err := json.Marshal(record)
	if err != nil {
		return err
	}
	if err = s.queries.FinishLLMPlan(ctx, storedb.FinishLLMPlanParams{Status: "failed", RecordJson: string(data), ID: id}); err != nil {
		return err
	}
	err = os.Remove(s.checkpointFile(id))
	if os.IsNotExist(err) {
		return nil
	}
	return err
}
