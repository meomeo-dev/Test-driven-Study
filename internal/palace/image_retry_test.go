package palace

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	"test-driven-study/internal/testsupport"
)

func TestImageRetryReadiness(t *testing.T) {
	for _, state := range []string{"queued", "running", "paused", "pausing", "failed", "succeeded", "canceled", "interrupted"} {
		terminal := state == "failed" || state == "succeeded" || state == "canceled" || state == "interrupted"
		job := Job{Status: state, Snapshot: Snapshot{Prompt: "saved prompt", Settings: Settings{GenerationMode: "pipeline"},
			Pipeline: &Pipeline{Stage: "planning", PlanID: "original"}}}
		if imageRetryReady(job) {
			t.Fatal("unfinished analysis reusable", state)
		}
		job.Snapshot.Pipeline.Stage = "generating"
		if imageRetryReady(job) != terminal {
			t.Fatal("wrong generating readiness", state)
		}
		job.Snapshot.Pipeline.PlanID = ""
		if imageRetryReady(job) {
			t.Fatal("missing plan reusable")
		}
		job.Snapshot.Pipeline = nil
		if imageRetryReady(job) {
			t.Fatal("pipeline without checkpoint reusable")
		}
		job.Snapshot.Settings.GenerationMode = "direct"
		if imageRetryReady(job) != terminal {
			t.Fatal("legacy direct prompt readiness", state)
		}
	}
}

func TestImageRetryRejectsChangedReferenceAndInvalidSettings(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	var calls int
	data := testPNG(t)
	options := testOptions(t, providerFunc(func(context.Context, ProviderInput) (ProviderOutput, error) {
		calls++
		return ProviderOutput{Bytes: data}, nil
	}))
	s := newService(t, options)
	ctx := context.Background()
	source := CreateInput{ID: "e0000000-0000-4000-8000-000000000001", QuestionID: 4,
		Settings: Settings{Model: "gpt-image-2", Size: "1152x2048", Quality: "medium", UseReference: true}}
	if _, err := s.Create(ctx, source); err != nil {
		t.Fatal(err)
	}
	job := waitJob(t, s, source.ID, "succeeded")
	for _, bad := range []ImageRetryInput{
		{ID: "bad"}, {ID: source.ID},
		{ID: "e0000000-0000-4000-8000-000000000002", Model: "unknown"},
		{ID: "e0000000-0000-4000-8000-000000000002", Resolution: "8k"},
		{ID: "e0000000-0000-4000-8000-000000000002", Quality: "bad"},
	} {
		if _, err := s.CreateImageRetry(ctx, source.ID, bad); err == nil {
			t.Fatal("invalid retry accepted")
		}
	}
	job.Snapshot.ReferenceHash = "changed"
	raw, _ := json.Marshal(job.Snapshot)
	if _, err := options.DB.ExecContext(ctx, "UPDATE palace_jobs SET snapshot_json=? WHERE id=?", string(raw), source.ID); err != nil {
		t.Fatal(err)
	}
	_, err := s.CreateImageRetry(ctx, source.ID, ImageRetryInput{ID: "e0000000-0000-4000-8000-000000000002"})
	var failure *Failure
	if !errors.As(err, &failure) || failure.Code != "reference_changed" || calls != 1 {
		t.Fatal("changed reference was submitted", err)
	}
}

func TestImageRetryValidatesSavedAnalysis(t *testing.T) {
	source := Job{QuestionID: 4, Snapshot: Snapshot{Prompt: "template\noriginal scene",
		Pipeline: &Pipeline{Stage: "generating", PlanID: "original"}}}
	for _, scene := range []string{"", "different scene"} {
		s := &Service{resolvePlan: func(context.Context, string, int64, string, string) (string, error) {
			return scene, nil
		}}
		if err := s.validateRetrySource(context.Background(), source); err == nil {
			t.Fatal("missing or mismatched analysis was accepted")
		}
	}
}
