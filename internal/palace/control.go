package palace

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"test-driven-study/internal/storage/storedb"
)

// A pause is cooperative: the current paid request finishes before this boundary.
// Cancellation is immediate locally and is never converted into a resumable pause.
func (s *Service) boundary(ctx context.Context, id string) error {
	job, err := s.Get(ctx, id)
	if err != nil {
		return err
	}
	switch job.Status {
	case "pausing", "paused":
		return ErrPaused
	case "running":
		return nil
	default:
		return context.Canceled
	}
}

func (s *Service) Pause(ctx context.Context, id string) (Job, error) {
	job, err := s.Get(ctx, id)
	if err != nil {
		return Job{}, err
	}
	if job.Status == "paused" || job.Status == "pausing" {
		return job, nil
	}
	if job.Status != "queued" && job.Status != "running" {
		return Job{}, ErrConflict
	}
	_, err = s.queries.RequestPalacePause(ctx, storedb.RequestPalacePauseParams{
		ID: id, UpdatedAtMs: time.Now().UTC().UnixMilli()})
	if err != nil {
		return Job{}, err
	}
	return s.Get(ctx, id)
}

func (s *Service) Resume(ctx context.Context, id string) (Job, error) {
	job, err := s.Get(ctx, id)
	if err != nil {
		return Job{}, err
	}
	if job.Status == "queued" || job.Status == "running" {
		return job, nil
	}
	if job.Status != "paused" {
		return Job{}, ErrConflict
	}
	_, err = s.queries.ResumePalaceJob(ctx, storedb.ResumePalaceJobParams{
		ID: id, UpdatedAtMs: time.Now().UTC().UnixMilli()})
	if err != nil {
		return Job{}, err
	}
	select {
	case s.wake <- struct{}{}:
	default:
	}
	return s.Get(ctx, id)
}

func (s *Service) park(id string) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_, err := s.queries.ParkPalaceJob(ctx, storedb.ParkPalaceJobParams{
		ID: id, UpdatedAtMs: time.Now().UTC().UnixMilli()})
	if err != nil {
		slog.Error("could not persist paused task", "job_id", id)
		s.finish(id, "failed", nil, &Failure{"pause_save_failed", "暂停状态未能保存，请检查记录后重新生成"})
	}
	// Stop may race with the LLM writing its paused record. Check again after
	// that write, so the earlier cancellation cannot leave a paused child alive.
	job, readErr := s.Get(ctx, id)
	if readErr == nil && (job.Status == "canceled" || job.Status == "failed") && s.discardPlan != nil {
		if err := s.discardPlan(ctx, id); err != nil {
			slog.Error("could not discard stopped planning checkpoint", "job_id", id)
		}
	}
}

func (s *Service) Retry(ctx context.Context, id, newID string) (Job, error) {
	job, err := s.Get(ctx, id)
	if err != nil {
		return Job{}, err
	}
	if job.Status == "queued" || job.Status == "running" ||
		job.Status == "pausing" || job.Status == "paused" || newID == id {
		return Job{}, ErrConflict
	}
	return s.Create(ctx, CreateInput{ID: newID, QuestionID: job.QuestionID,
		Settings: job.Snapshot.Settings})
}

func (s *Service) stopAtBoundary(ctx context.Context, id string) bool {
	err := s.boundary(ctx, id)
	if errors.Is(err, ErrPaused) {
		s.park(id)
	} else if err != nil && !errors.Is(err, context.Canceled) {
		s.finish(id, "failed", nil, &Failure{"task_state_unavailable", "任务状态无法读取，后续请求未提交"})
	} else if ctx.Err() != nil {
		// The SQL terminal-state guard preserves an explicit user stop.
		s.finish(id, "interrupted", nil, &Failure{"interrupted", "服务已停止，请手动重新生成"})
	}
	return err != nil
}
