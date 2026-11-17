package main

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"test-driven-study/internal/llm"
	"test-driven-study/internal/palace"
	"test-driven-study/internal/storage"
	"test-driven-study/internal/study"
	"test-driven-study/internal/testsupport"
)

type memoryCredentials map[string]string

func (s memoryCredentials) Get(k string) (string, error) { return s[k], nil }
func (s memoryCredentials) Set(k, v string) error        { s[k] = v; return nil }
func (s memoryCredentials) Delete(k string) error        { delete(s, k); return nil }

type imageFunc func(context.Context, palace.ProviderInput) (palace.ProviderOutput, error)

func (f imageFunc) Generate(ctx context.Context, p palace.ProviderInput) (palace.ProviderOutput, error) {
	return f(ctx, p)
}

func pipelineOptions(t *testing.T, server string) (palace.Options, *llm.Service) {
	t.Helper()
	root, _ := filepath.Abs("../..")
	directory := t.TempDir()
	db, err := storage.Open(context.Background(), root, directory)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	planner, err := llm.New(context.Background(), llm.Options{DB: db, DataDirectory: directory, Credentials: memoryCredentials{},
		Config: llm.Config{BaseURL: server, APIKey: "separate-llm-key", Models: []string{"fixture"}, DefaultModel: "fixture", ReasoningEffort: "medium", MaxOutputTokensK: 16}})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(planner.Close)
	options := palace.Options{DB: db, Root: root, DataDirectory: directory, Study: study.New(db, root),
		Config:  palace.Config{BaseURL: "http://127.0.0.1:1/v1", APIKey: "separate-image-key", Models: []string{"gpt-image-2"}, DefaultModel: "gpt-image-2"},
		Planner: palacePlanner{service: planner, root: root}, ResolvePlan: planner.Resolve, Credentials: memoryCredentials{}}
	return options, planner
}
func planningResponse(w http.ResponseWriter) {
	text, _ := json.Marshal(map[string]any{"title": "红灯入口", "scene": "入口停车", "anchors": []map[string]string{{"cue": "红灯", "meaning": "停车等候"}},
		"pitfalls": []string{}, "image_prompt": "自动记忆宫殿：红灯前停车，正确答案为错误。",
		"research": map[string]any{"status": "supported", "explanation": "测试研究结果", "sources": []any{map[string]string{"url": "https://www.gov.cn/", "title": "政府测试来源", "claim": "测试规则"}}}})
	json.NewEncoder(w).Encode(map[string]any{"status": "completed", "output": []any{
		map[string]any{"type": "web_search_call", "status": "completed", "action": map[string]any{"type": "search", "sources": []map[string]string{{"url": "https://www.gov.cn/", "title": "政府测试来源"}}}},
		map[string]any{"type": "message", "role": "assistant", "status": "completed", "content": []any{map[string]string{"type": "output_text", "text": string(text)}}}},
		"usage": map[string]int{"input_tokens": 30, "output_tokens": 40, "total_tokens": 70}})
}
func pipelineInput() palace.CreateInput {
	return palace.CreateInput{ID: "67332b60-317e-46fd-a701-4b601c3708f3", QuestionID: 4, Settings: palace.Settings{
		GenerationMode: "pipeline", LLM: palace.PlanningParameters{Model: "fixture", ReasoningEffort: "low", MaxOutputTokensK: 8},
		Model: "gpt-image-2", Size: "1152x2048", Quality: "medium", UseReference: true}}
}
func waitPipeline(t *testing.T, s *palace.Service, id, status string) palace.Job {
	t.Helper()
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		job, err := s.Get(context.Background(), id)
		if err != nil {
			t.Fatal(err)
		}
		if job.Status == status {
			return job
		}
		time.Sleep(10 * time.Millisecond)
	}
	job, _ := s.Get(context.Background(), id)
	t.Fatalf("status %s, wanted %s, error %v", job.Status, status, job.Error)
	return palace.Job{}
}
func TestPipelineRunsOrderedStagesOnceAndPersistsPrompt(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	var llmCalls, imageCalls atomic.Int32
	started, release := make(chan struct{}), make(chan struct{})
	provider := modelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		llmCalls.Add(1)
		if r.URL.Path != "/responses" || r.Header.Get("Authorization") != "Bearer separate-llm-key" {
			t.Error("mixed provider route or key")
		}
		var body map[string]any
		json.NewDecoder(r.Body).Decode(&body)
		if body["max_output_tokens"] != float64(8192) || body["reasoning"].(map[string]any)["effort"] != "low" {
			t.Error("pipeline parameters changed")
		}
		close(started)
		select {
		case <-release:
			planningResponse(w)
		case <-r.Context().Done():
		}
	}))
	defer provider.Close()
	options, planner := pipelineOptions(t, provider.URL)
	var service *palace.Service
	options.Provider = imageFunc(func(ctx context.Context, input palace.ProviderInput) (palace.ProviderOutput, error) {
		imageCalls.Add(1)
		job, err := service.Get(ctx, pipelineInput().ID)
		if err != nil || job.Snapshot.Pipeline.Stage != "generating" || !strings.Contains(input.Prompt, "自动记忆宫殿") || len(input.Reference) == 0 {
			t.Error("image request preceded durable valid plan/reference")
		}
		plan, err := planner.Get(ctx, job.ID)
		if err != nil || plan.Status != "succeeded" {
			t.Error("plan was not durable")
		}
		bytes := []byte("pipeline-fixture-image")
		return palace.ProviderOutput{Bytes: bytes}, nil
	})
	var err error
	service, err = palace.New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	defer service.Close()
	input := pipelineInput()
	if _, err := service.Create(context.Background(), input); err != nil {
		t.Fatal(err)
	}
	<-started
	if _, err := service.Create(context.Background(), input); err != nil {
		t.Fatal(err)
	}
	if imageCalls.Load() != 0 {
		t.Fatal("image started before planning completed")
	}
	close(release)
	job := waitPipeline(t, service, input.ID, "succeeded")
	if llmCalls.Load() != 1 || imageCalls.Load() != 1 || job.Snapshot.Pipeline.LLMUsage.TotalTokens != 70 || job.Snapshot.Pipeline.PlanID != job.ID {
		t.Fatal("duplicate calls or lost provenance")
	}
	if _, err := service.Create(context.Background(), input); err != nil || llmCalls.Load() != 1 {
		t.Fatal("completed submission replayed")
	}
	changed := input
	changed.LLM.ReasoningEffort = "high"
	if _, err := service.Create(context.Background(), changed); !errors.Is(err, palace.ErrConflict) {
		t.Fatal("different pipeline parameters reused ID")
	}
}
func TestPipelineStopsBeforeImagesOnIncompletePlan(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	var llmCalls, imageCalls atomic.Int32
	provider := modelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		llmCalls.Add(1)
		w.Write([]byte(`{"status":"incomplete","incomplete_details":{"reason":"max_output_tokens"}}`))
	}))
	defer provider.Close()
	options, planner := pipelineOptions(t, provider.URL)
	options.Provider = imageFunc(func(context.Context, palace.ProviderInput) (palace.ProviderOutput, error) {
		imageCalls.Add(1)
		return palace.ProviderOutput{}, nil
	})
	service, err := palace.New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	defer service.Close()
	input := pipelineInput()
	if _, err := service.Create(context.Background(), input); err != nil {
		t.Fatal(err)
	}
	job := waitPipeline(t, service, input.ID, "failed")
	if imageCalls.Load() != 0 || llmCalls.Load() != 1 || job.Error.Code != "llm_missing_state" || job.Snapshot.Pipeline.Stage != "planning" {
		t.Fatal("incomplete planning reached images")
	}
	plan, _ := planner.Get(context.Background(), input.ID)
	if plan.Status != "failed" {
		t.Fatal("failed planning record missing")
	}
}
func TestCancelPlanningPreventsImageStage(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	var imageCalls atomic.Int32
	started := make(chan struct{})
	provider := modelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.Copy(io.Discard, r.Body)
		close(started)
		<-r.Context().Done()
	}))
	defer provider.Close()
	options, planner := pipelineOptions(t, provider.URL)
	options.Provider = imageFunc(func(context.Context, palace.ProviderInput) (palace.ProviderOutput, error) {
		imageCalls.Add(1)
		return palace.ProviderOutput{}, nil
	})
	service, err := palace.New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	defer service.Close()
	input := pipelineInput()
	if _, err := service.Create(context.Background(), input); err != nil {
		t.Fatal(err)
	}
	<-started
	if _, err := service.Cancel(context.Background(), input.ID); err != nil {
		t.Fatal(err)
	}
	waitPipeline(t, service, input.ID, "canceled")
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		record, _ := planner.Get(context.Background(), input.ID)
		if record.Status != "running" {
			if imageCalls.Load() != 0 {
				t.Fatal("image submitted after cancellation")
			}
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	t.Fatal("planning call did not stop after cancellation")
}

func TestShutdownInterruptsPipelineWithoutReplay(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	var llmCalls, imageCalls atomic.Int32
	started := make(chan struct{})
	provider := modelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.Copy(io.Discard, r.Body)
		llmCalls.Add(1)
		close(started)
		<-r.Context().Done()
	}))
	defer provider.Close()
	options, _ := pipelineOptions(t, provider.URL)
	options.Provider = imageFunc(func(context.Context, palace.ProviderInput) (palace.ProviderOutput, error) {
		imageCalls.Add(1)
		return palace.ProviderOutput{}, nil
	})
	service, err := palace.New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	input := pipelineInput()
	if _, err := service.Create(context.Background(), input); err != nil {
		t.Fatal(err)
	}
	<-started
	service.Close()
	restarted, err := palace.New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	defer restarted.Close()
	job := waitPipeline(t, restarted, input.ID, "interrupted")
	if job.Snapshot.Pipeline.Stage != "planning" || llmCalls.Load() != 1 || imageCalls.Load() != 0 {
		t.Fatal("restart lost stage or replayed a request")
	}
}
func TestImageFailureDoesNotRepeatTheCompletedPlan(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	var llmCalls, imageCalls atomic.Int32
	provider := modelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { llmCalls.Add(1); planningResponse(w) }))
	defer provider.Close()
	options, _ := pipelineOptions(t, provider.URL)
	options.Provider = imageFunc(func(context.Context, palace.ProviderInput) (palace.ProviderOutput, error) {
		imageCalls.Add(1)
		return palace.ProviderOutput{}, &palace.Failure{Code: "image_failure", Message: "fixture"}
	})
	service, err := palace.New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	defer service.Close()
	input := pipelineInput()
	if _, err := service.Create(context.Background(), input); err != nil {
		t.Fatal(err)
	}
	job := waitPipeline(t, service, input.ID, "failed")
	if job.Snapshot.Pipeline.Stage != "generating" || llmCalls.Load() != 1 || imageCalls.Load() != 1 {
		t.Fatal("image failure lost completed planning stage")
	}
	if _, err := service.Create(context.Background(), input); err != nil {
		t.Fatal(err)
	}
	if llmCalls.Load() != 1 || imageCalls.Load() != 1 {
		t.Fatal("failed pipeline was replayed")
	}
}

func modelServer(handler http.Handler) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/responses/input_tokens" {
			w.Write([]byte(`{"input_tokens":100}`))
			return
		}
		handler.ServeHTTP(w, r)
	}))
}
