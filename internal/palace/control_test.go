package palace

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"

	"test-driven-study/internal/testsupport"
	"time"
)

func TestQueuedPauseRestartStopAndExplicitRetry(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	ctx := context.Background()
	started, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	defer once.Do(func() { close(release) })
	options := testOptions(t, providerFunc(func(ctx context.Context, _ ProviderInput) (ProviderOutput, error) {
		once.Do(func() { close(started) })
		<-ctx.Done()
		return ProviderOutput{}, ctx.Err()
	}))
	service, err := New(ctx, options)
	if err != nil {
		t.Fatal(err)
	}
	defer service.Close()
	first := CreateInput{ID: "10000000-0000-4000-8000-000000000001", QuestionID: 4}
	if _, err = service.Create(ctx, first); err != nil {
		t.Fatal(err)
	}
	select {
	case <-started:
	case <-time.After(3 * time.Second):
		t.Fatal("image not started")
	}
	second := first
	second.ID = "10000000-0000-4000-8000-000000000002"
	if _, err = service.Create(ctx, second); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if job, err := service.Pause(ctx, second.ID); err != nil || job.Status != "paused" {
			t.Fatal(job.Status, err)
		}
	}
	service.Close()
	service, err = New(ctx, options)
	if err != nil {
		t.Fatal(err)
	}
	defer service.Close()
	waitJob(t, service, second.ID, "paused")
	if job, err := service.Cancel(ctx, second.ID); err != nil || job.Status != "canceled" {
		t.Fatal(job, err)
	}
	if _, err = service.Resume(ctx, second.ID); !errors.Is(err, ErrConflict) {
		t.Fatal("stopped task resumed")
	}
	const retryID = "10000000-0000-4000-8000-000000000003"
	for i := 0; i < 2; i++ {
		if job, err := service.Retry(ctx, second.ID, retryID); err != nil || job.ID != retryID {
			t.Fatal("retry not idempotent", err)
		}
	}
	service.Cancel(ctx, retryID)
	page, err := service.Tasks(ctx, "active", "")
	if err != nil || len(page.Tasks) != 0 {
		t.Fatal("stopped tasks remain active", page, err)
	}
	if _, err = service.Tasks(ctx, "all", "bad-cursor"); !errors.Is(err, ErrInvalid) {
		t.Fatal("invalid cursor accepted")
	}
}

func TestPauseDuringFinalImageKeepsSuccess(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	ctx := context.Background()
	started, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	defer once.Do(func() { close(release) })
	data := testPNG(t)
	service := newService(t, testOptions(t, providerFunc(func(ctx context.Context, _ ProviderInput) (ProviderOutput, error) {
		close(started)
		select {
		case <-release:
			return ProviderOutput{Bytes: data}, nil
		case <-ctx.Done():
			return ProviderOutput{}, ctx.Err()
		}
	})))
	input := CreateInput{ID: "10000000-0000-4000-8000-000000000004", QuestionID: 4}
	if _, err := service.Create(ctx, input); err != nil {
		t.Fatal(err)
	}
	select {
	case <-started:
	case <-time.After(3 * time.Second):
		t.Fatal("image not started")
	}
	if _, err := service.Pause(ctx, input.ID); err != nil {
		t.Fatal(err)
	}
	once.Do(func() { close(release) })
	waitJob(t, service, input.ID, "succeeded")
	if _, err := service.Pause(ctx, input.ID); !errors.Is(err, ErrConflict) {
		t.Fatal("completed task paused")
	}
	if _, err := service.Resume(ctx, input.ID); !errors.Is(err, ErrConflict) {
		t.Fatal("completed task resumed")
	}
}

func TestTaskPaginationUsesStableTimestampAndID(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	ctx := context.Background()
	options := testOptions(t, providerFunc(func(context.Context, ProviderInput) (ProviderOutput, error) { return ProviderOutput{}, nil }))
	service := newService(t, options)
	snapshot, _ := json.Marshal(Snapshot{Settings: Settings{Model: "fixture"}})
	for i := 0; i < 55; i++ {
		_, err := options.DB.Exec(`INSERT INTO palace_jobs(id,question_id,subject_id,status,snapshot_json,created_at_ms,updated_at_ms)
			VALUES(?,4,1,'failed',?,1000,1000)`, fmt.Sprintf("10000000-0000-4000-8000-%012d", i), string(snapshot))
		if err != nil {
			t.Fatal(err)
		}
	}
	page, err := service.Tasks(ctx, "all", "")
	if err != nil || len(page.Tasks) != 50 || page.NextCursor == "" {
		t.Fatal(page, err)
	}
	next, err := service.Tasks(ctx, "all", page.NextCursor)
	if err != nil || len(next.Tasks) != 5 || next.NextCursor != "" {
		t.Fatal(next, err)
	}
	seen := map[string]bool{}
	for _, task := range append(page.Tasks, next.Tasks...) {
		if seen[task.ID] {
			t.Fatal("duplicate pagination item")
		}
		seen[task.ID] = true
	}
	events, err := service.Events(ctx, page.Tasks[0].ID)
	if err != nil || len(events) != 1 || !strings.Contains(events[0].Kind, "created") {
		t.Fatal(events, err)
	}
}
