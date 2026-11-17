package main

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"os"
	"reflect"
	"sync/atomic"
	"testing"

	"test-driven-study/internal/palace"
	"test-driven-study/internal/testsupport"
)

func TestImageRetryReusesPlanAcrossFailureSuccessAndRestart(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	var llmCalls, imageCalls atomic.Int32
	provider := modelServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		llmCalls.Add(1)
		planningResponse(w)
	}))
	defer provider.Close()
	options, planner := pipelineOptions(t, provider.URL)
	options.Config.Models = append(options.Config.Models, "alternate-image")
	var original palace.ProviderInput
	options.Provider = imageFunc(func(_ context.Context, input palace.ProviderInput) (palace.ProviderOutput, error) {
		if imageCalls.Add(1) == 1 {
			original = input
			return palace.ProviderOutput{}, &palace.Failure{Code: "fixture_image_failure", Message: "Image failed"}
		}
		if input.Prompt != original.Prompt || !bytes.Equal(input.Reference, original.Reference) {
			t.Error("image-only retry changed the saved prompt or reference")
		}
		data := []byte("image-retry-fixture-bytes")
		return palace.ProviderOutput{Bytes: data}, nil
	})
	ctx := context.Background()
	service, err := palace.New(ctx, options)
	if err != nil {
		t.Fatal(err)
	}
	input := pipelineInput()
	if _, err = service.Create(ctx, input); err != nil {
		t.Fatal(err)
	}
	failed := waitPipeline(t, service, input.ID, "failed")
	if !failed.CanRetryImage {
		t.Fatal("completed analysis was not reusable")
	}
	service.Close()
	// Image retry must work without a configured planner, including after restart.
	options.Planner = nil
	service, err = palace.New(ctx, options)
	if err != nil {
		t.Fatal(err)
	}
	defer service.Close()
	retry := palace.ImageRetryInput{ID: "d0000000-0000-4000-8000-000000000001",
		Model: "alternate-image", AspectRatio: "2:3", Resolution: "1k", Quality: "high"}
	if _, err = service.CreateImageRetry(ctx, failed.ID, retry); err != nil {
		t.Fatal(err)
	}
	saved := waitPipeline(t, service, retry.ID, "succeeded")
	if saved.Snapshot.Pipeline.PlanID != failed.ID || saved.Snapshot.Pipeline.LLMUsage.TotalTokens != 0 ||
		saved.Snapshot.RetryOf != failed.ID || saved.Snapshot.Settings.Size != "672x1008" ||
		saved.Snapshot.Settings.Model != "alternate-image" || saved.Snapshot.Settings.Quality != "high" {
		t.Fatal("retry lost provenance, parameters, or recounted LLM usage")
	}
	if _, err = planner.Get(ctx, saved.ID); err == nil {
		t.Fatal("created a second LLM plan")
	}
	file, _, err := service.ImageFile(ctx, saved.ID)
	if err != nil {
		t.Fatal(err)
	}
	image, err := os.ReadFile(file)
	if err != nil {
		t.Fatal(err)
	}
	// Repeated accepted requests never enqueue another image.
	for range 2 {
		if _, err = service.CreateImageRetry(ctx, failed.ID, retry); err != nil {
			t.Fatal(err)
		}
	}
	changed := retry
	changed.Quality = "low"
	if _, err = service.CreateImageRetry(ctx, failed.ID, changed); !errors.Is(err, palace.ErrConflict) {
		t.Fatal("different parameters reused an accepted UUID")
	}
	next := palace.ImageRetryInput{ID: "d0000000-0000-4000-8000-000000000002"}
	if _, err = service.CreateImageRetry(ctx, saved.ID, next); err != nil {
		t.Fatal(err)
	}
	second := waitPipeline(t, service, next.ID, "succeeded")
	if second.Snapshot.Pipeline.PlanID != failed.ID || second.Image.Filename == saved.Image.Filename {
		t.Fatal("retry chain lost original plan or overwrote image")
	}
	before, _ := service.Get(ctx, failed.ID)
	first, _ := service.Get(ctx, saved.ID)
	current, _ := os.ReadFile(file)
	if !reflect.DeepEqual(before, failed) || !reflect.DeepEqual(first, saved) || !bytes.Equal(image, current) ||
		llmCalls.Load() != 1 || imageCalls.Load() != 3 {
		t.Fatal("source changed or pipeline repeated planning")
	}
}
