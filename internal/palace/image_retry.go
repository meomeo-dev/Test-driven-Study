package palace

import (
	"context"
	"database/sql"
	"errors"
	"strings"
)

type ImageRetryInput struct {
	ID          string `json:"id"`
	Model       string `json:"model,omitempty"`
	AspectRatio string `json:"aspect_ratio,omitempty"`
	Resolution  string `json:"resolution,omitempty"`
	Quality     string `json:"quality,omitempty"`
}

func imageRetryReady(job Job) bool {
	if job.Status != "succeeded" && job.Status != "failed" && job.Status != "canceled" && job.Status != "interrupted" {
		return false
	}
	if strings.TrimSpace(job.Snapshot.Prompt) == "" {
		return false
	}
	if pipeline := job.Snapshot.Pipeline; pipeline != nil {
		return pipeline.Stage == "generating" && pipeline.PlanID != ""
	}
	return job.Snapshot.Settings.GenerationMode != "pipeline"
}

func imageRetrySettings(original Settings, input ImageRetryInput) (Settings, error) {
	if input.Model != "" {
		original.Model = input.Model
	}
	if input.Quality != "" {
		original.Quality = input.Quality
	}
	if original.Model == "" || original.Quality == "" {
		return Settings{}, ErrInvalid
	}
	if input.AspectRatio != "" || input.Resolution != "" {
		original.Size = ""
		if input.AspectRatio != "" {
			original.AspectRatio = input.AspectRatio
		}
		if input.Resolution != "" {
			original.Resolution = input.Resolution
		}
	}
	return normalizeSize(original)
}

func (s *Service) CreateImageRetry(ctx context.Context, sourceID string, input ImageRetryInput) (Job, error) {
	if !eventID.MatchString(input.ID) {
		return Job{}, ErrInvalid
	}
	if input.ID == sourceID {
		return Job{}, ErrConflict
	}
	s.creation.Lock()
	defer s.creation.Unlock()
	source, err := s.Get(ctx, sourceID)
	if err != nil {
		return Job{}, err
	}
	if !imageRetryReady(source) {
		return Job{}, ErrConflict
	}
	settings, err := imageRetrySettings(source.Snapshot.Settings, input)
	if err != nil {
		return Job{}, err
	}
	previous, err := s.Get(ctx, input.ID)
	if err == nil {
		if previous.Snapshot.RetryOf != sourceID || previous.Snapshot.Settings != settings ||
			previous.Snapshot.Prompt != source.Snapshot.Prompt {
			return Job{}, ErrConflict
		}
		return previous, nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return Job{}, err
	}
	if err = s.admit(ctx); err != nil {
		return Job{}, err
	}
	// Validate only image parameters. Reusing a saved plan must not require its
	// old LLM model/provider to remain configured or call Prepare/Generate again.
	imageSettings := settings
	imageSettings.GenerationMode = "direct"
	imageSettings.LLM = PlanningParameters{}
	imageSettings.PlanID = ""
	if _, err = s.normalize(imageSettings); err != nil {
		return Job{}, err
	}
	if err = s.validateRetrySource(ctx, source); err != nil {
		return Job{}, err
	}
	snapshot := source.Snapshot
	snapshot.RetryOf = sourceID
	snapshot.Settings = settings
	if snapshot.Pipeline != nil {
		pipeline := *snapshot.Pipeline
		pipeline.LLMUsage = Usage{}
		snapshot.Pipeline = &pipeline
	}
	return s.enqueue(ctx, input.ID, snapshot)
}

func (s *Service) validateRetrySource(ctx context.Context, source Job) error {
	planID := source.Snapshot.Settings.PlanID
	if source.Snapshot.Pipeline != nil {
		planID = source.Snapshot.Pipeline.PlanID
	}
	if planID != "" {
		if s.resolvePlan == nil {
			return ErrConflict
		}
		scene, err := s.resolvePlan(ctx, planID, source.QuestionID,
			source.Snapshot.Settings.PalaceAddress, "")
		if err != nil || strings.TrimSpace(scene) == "" || !strings.HasSuffix(source.Snapshot.Prompt, scene) {
			return &Failure{"saved_plan_unavailable", "原构思记录不可用或与最终提示词不一致，请重新构思"}
		}
	}
	if source.Snapshot.Settings.UseReference {
		_, hash, err := s.reference(ctx, source.Snapshot.Question)
		if err != nil || hash != source.Snapshot.ReferenceHash {
			return &Failure{"reference_changed", "原题配图已变化或不可读取，未提交生图请求"}
		}
	}
	return nil
}
