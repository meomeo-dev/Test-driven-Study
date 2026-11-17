package main

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"test-driven-study/internal/llm"
	"test-driven-study/internal/palace"
	"test-driven-study/internal/testsupport"
)

func TestPausedResearchSurvivesRestartWithoutReplayingCompletedRound(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	ctx := context.Background()
	started, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	defer once.Do(func() { close(release) })
	var calls, images atomic.Int32
	provider := modelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		input, _ := json.Marshal(body["input"])
		if !strings.Contains(string(input), "input_image") {
			t.Error("original image was lost")
		}
		if calls.Add(1) == 1 {
			close(started)
			select {
			case <-release:
			case <-r.Context().Done():
				return
			}
			json.NewEncoder(w).Encode(map[string]any{"status": "completed", "output": []any{
				map[string]any{"type": "web_search_call", "status": "completed", "action": map[string]any{
					"type": "search", "sources": []map[string]string{{"url": "https://www.gov.cn/", "title": "Primary source"}}}},
				map[string]any{"type": "reasoning", "summary": []any{}, "encrypted_content": "opaque-resume-exact"},
				map[string]any{"type": "message", "role": "assistant", "status": "completed", "content": []any{
					map[string]string{"type": "output_text", "text": "Research notes from the first completed round."}}}},
				"usage": map[string]int{"input_tokens": 30, "output_tokens": 14, "total_tokens": 44}})
			return
		}
		if !strings.Contains(string(input), "opaque-resume-exact") ||
			!strings.Contains(string(input), "first completed round") {
			t.Error("resume omitted completed round or opaque state")
		}
		planningResponse(w)
	}))
	defer provider.Close()
	options, planner := pipelineOptions(t, provider.URL)
	options.DiscardPlan = planner.DiscardPaused
	options.Provider = imageFunc(func(context.Context, palace.ProviderInput) (palace.ProviderOutput, error) {
		images.Add(1)
		data := []byte("task-control-fixture")
		return palace.ProviderOutput{Bytes: data}, nil
	})
	service, err := palace.New(ctx, options)
	if err != nil {
		t.Fatal(err)
	}
	defer service.Close()
	input := pipelineInput()
	if _, err = service.Create(ctx, input); err != nil {
		t.Fatal(err)
	}
	select {
	case <-started:
	case <-time.After(5 * time.Second):
		t.Fatal("research did not start")
	}
	if job, err := service.Pause(ctx, input.ID); err != nil || job.Status != "pausing" {
		t.Fatal(job.Status, err)
	}
	once.Do(func() { close(release) })
	waitPipeline(t, service, input.ID, "paused")
	record, err := planner.Get(ctx, input.ID)
	if err != nil || record.Status != "paused" || record.Usage.TotalTokens != 44 {
		t.Fatal("paused record lost", record, err)
	}
	checkpoint := filepath.Join(options.DataDirectory, "llm-checkpoints", input.ID+".json")
	data, err := os.ReadFile(checkpoint)
	if err != nil {
		t.Fatal(err)
	}
	for _, secret := range []string{"data:image/", "separate-llm-key", provider.URL} {
		if strings.Contains(string(data), secret) {
			t.Fatal("checkpoint contains raw image or provider credentials")
		}
	}
	if info, err := os.Stat(checkpoint); err != nil || info.Mode().Perm() != 0600 {
		t.Fatal("unsafe checkpoint permissions")
	}
	service.Close()
	planner.Close()
	planner, err = llm.New(ctx, llm.Options{DB: options.DB, DataDirectory: options.DataDirectory, Credentials: memoryCredentials{},
		Config: llm.Config{BaseURL: provider.URL, APIKey: "separate-llm-key", Models: []string{"fixture"}, DefaultModel: "fixture", ReasoningEffort: "medium", MaxOutputTokensK: 16}})
	if err != nil {
		t.Fatal(err)
	}
	defer planner.Close()
	options.Planner = palacePlanner{service: planner, root: options.Root}
	options.DiscardPlan = planner.DiscardPaused
	service, err = palace.New(ctx, options)
	if err != nil {
		t.Fatal(err)
	}
	defer service.Close()
	waitPipeline(t, service, input.ID, "paused")
	if _, err = service.Resume(ctx, input.ID); err != nil {
		t.Fatal(err)
	}
	job := waitPipeline(t, service, input.ID, "succeeded")
	if calls.Load() != 2 || images.Load() != 1 || job.Snapshot.Pipeline.LLMUsage.TotalTokens != 114 {
		t.Fatal("completed research replayed or cumulative usage lost", calls.Load(), images.Load(), job)
	}
	if _, err = os.Stat(checkpoint); !os.IsNotExist(err) {
		t.Fatal("terminal checkpoint retained")
	}
	events, err := service.Events(ctx, input.ID)
	if err != nil {
		t.Fatal(err)
	}
	var states []string
	for _, event := range events {
		states = append(states, event.ToState)
	}
	if strings.Join(states, ",") != "queued,running,pausing,paused,queued,running,succeeded" {
		t.Fatal(states)
	}
}

func TestPauseAfterPlanningSkipsCompletedLLMOnResume(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	ctx := context.Background()
	var calls, images atomic.Int32
	started, release := make(chan struct{}), make(chan struct{})
	var once sync.Once
	defer once.Do(func() { close(release) })
	provider := modelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		close(started)
		select {
		case <-release:
			planningResponse(w)
		case <-r.Context().Done():
		}
	}))
	defer provider.Close()
	options, _ := pipelineOptions(t, provider.URL)
	options.Provider = imageFunc(func(context.Context, palace.ProviderInput) (palace.ProviderOutput, error) {
		images.Add(1)
		data := []byte("task-control-fixture")
		return palace.ProviderOutput{Bytes: data}, nil
	})
	service, err := palace.New(ctx, options)
	if err != nil {
		t.Fatal(err)
	}
	defer service.Close()
	input := pipelineInput()
	service.Create(ctx, input)
	select {
	case <-started:
	case <-time.After(5 * time.Second):
		t.Fatal("planning did not start")
	}
	if _, err = service.Pause(ctx, input.ID); err != nil {
		t.Fatal(err)
	}
	once.Do(func() { close(release) })
	job := waitPipeline(t, service, input.ID, "paused")
	if job.Snapshot.Pipeline.Stage != "generating" || images.Load() != 0 {
		t.Fatal("unsafe stage boundary")
	}
	if _, err = service.Resume(ctx, input.ID); err != nil {
		t.Fatal(err)
	}
	job = waitPipeline(t, service, input.ID, "succeeded")
	if calls.Load() != 1 || images.Load() != 1 || strings.Count(job.Snapshot.Prompt, "补充记忆场景") != 1 {
		t.Fatal("planning stage replayed")
	}
}
