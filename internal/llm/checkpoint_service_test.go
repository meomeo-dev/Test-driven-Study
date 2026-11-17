package llm

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"strings"
	"testing"

	"test-driven-study/internal/testsupport"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage/storedb"
)

func TestPausedQuestionWithoutImagesContinuesFromPersistedEmptyReferences(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	ctx := context.Background()
	calls := 0
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct{ Instructions string }
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Error(err)
		}
		calls++
		if calls == 1 {
			if !strings.Contains(body.Instructions, "Pinned research") {
				t.Error("first request omitted installed research instructions")
			}
			json.NewEncoder(w).Encode(researchNote(t, "Retained original research.", "https://www.gov.cn/"))
			return
		}
		if !strings.Contains(body.Instructions, "Pinned planning") {
			t.Error("resumed request omitted installed planning instructions")
		}
		json.NewEncoder(w).Encode(responseJSON(t, testPlan()))
	}))
	defer server.Close()
	options := testOptions(t, server.URL)
	profile := course.AIProfileVersion{CourseID: "basic-math", CourseVersion: "1.0.0"}
	options.ResolvePalacePrompts = func(_ context.Context, ref course.AIProfileVersion) (course.PalacePrompts, error) {
		if ref != profile {
			t.Errorf("resolved prompt profile %+v, want %+v", ref, profile)
		}
		return course.PalacePrompts{Planning: "Pinned planning", Research: "Pinned research"}, nil
	}
	service, err := New(ctx, options)
	if err != nil {
		t.Fatal(err)
	}
	defer service.Close()
	input := PlanInput{ID: "00000000-0000-4000-8000-000000000088", QuestionID: 17,
		Parameters: Parameters{Model: "fixture-reasoner", ReasoningEffort: "medium"}}
	control := func(context.Context) error {
		if calls > 0 {
			return ErrPaused
		}
		return nil
	}
	source := PlanSource{Prompt: "Question without images", ProfileVersion: &profile}
	if _, err = service.RunControlledPipeline(ctx, input, source, control); !errors.Is(err, ErrPaused) {
		t.Fatal(err)
	}
	saved, err := service.Get(ctx, input.ID)
	if err != nil || saved.Status != "paused" || saved.References != nil ||
		saved.ProfileVersion == nil || *saved.ProfileVersion != profile {
		t.Fatal("empty references not restored", saved, err)
	}
	record, err := service.RunControlledPipeline(ctx, input, source, nil)
	if err != nil || record.Status != "succeeded" || calls != 2 {
		t.Fatal("image-free checkpoint failed", record, err)
	}
}

func TestDiscardPausedPlanClearsPrivateCheckpointAndReleasesLLMSettings(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	ctx := context.Background()
	options := testOptions(t, "http://127.0.0.1:1/v1")
	service, err := New(ctx, options)
	if err != nil {
		t.Fatal(err)
	}
	defer service.Close()
	id := "00000000-0000-4000-8000-000000000089"
	record := PlanRecord{PlanInput: PlanInput{ID: id, QuestionID: 4}, Status: "paused"}
	payload, _ := json.Marshal(record)
	if err = service.queries.CreateLLMPlan(ctx, storedb.CreateLLMPlanParams{ID: id, QuestionID: 4, RecordJson: string(payload)}); err != nil {
		t.Fatal(err)
	}
	if err = atomicCheckpoint(service.checkpointFile(id), []byte(`{}`)); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 2; i++ {
		if err = service.DiscardPaused(ctx, id); err != nil {
			t.Fatal(err)
		}
	}
	saved, err := service.Get(ctx, id)
	if err != nil || saved.Status != "failed" || saved.Error.Code != "canceled" {
		t.Fatal(saved, err)
	}
	if _, err = os.Stat(service.checkpointFile(id)); !os.IsNotExist(err) {
		t.Fatal("stopped checkpoint retained")
	}
	var count int
	if err = options.DB.QueryRow("SELECT count(*) FROM llm_plans WHERE status='running'").Scan(&count); err != nil || count != 0 {
		t.Fatal("paused child still blocks settings", count, err)
	}
}
