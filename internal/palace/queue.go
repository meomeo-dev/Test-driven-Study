package palace

import (
	"context"
	"encoding/json"
	"time"

	"test-driven-study/internal/storage/storedb"
)

func (s *Service) admit(ctx context.Context) error {
	if s.provider == nil {
		return ErrDisabled
	}
	count, err := s.queries.CountActivePalaceJobs(ctx)
	if err != nil {
		return err
	}
	if count >= 10 {
		return ErrConflict
	}
	return nil
}

// Callers hold creation while admitting and persisting a new immutable snapshot.
func (s *Service) enqueue(ctx context.Context, id string, snapshot Snapshot) (Job, error) {
	payload, err := json.Marshal(snapshot)
	if err != nil {
		return Job{}, err
	}
	now := time.Now().UTC().UnixMilli()
	err = s.queries.CreatePalaceJob(ctx, storedb.CreatePalaceJobParams{ID: id,
		QuestionID: snapshot.Question.QuestionID, SubjectID: snapshot.Question.SubjectID,
		SnapshotJson: string(payload), CreatedAtMs: now, UpdatedAtMs: now})
	if err != nil {
		return Job{}, err
	}
	select {
	case s.wake <- struct{}{}:
	default:
	}
	return s.Get(ctx, id)
}
