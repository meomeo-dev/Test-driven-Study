package palace

import (
	"context"
	"sync/atomic"
	"testing"

	"test-driven-study/internal/testsupport"
	"time"
)

type boundaryPlanner struct {
	started, requested, observed, release chan struct{}
	paused                                atomic.Bool
}

func (p *boundaryPlanner) Prepare(value PlanningParameters) (PlanningParameters, error) {
	return value, nil
}
func (p *boundaryPlanner) Generate(ctx context.Context, input PlanningInput) (PlanningResult, error) {
	close(p.started)
	select {
	case <-p.requested:
	case <-ctx.Done():
		return PlanningResult{}, ctx.Err()
	}
	err := input.Checkpoint(ctx)
	close(p.observed)
	select {
	case <-p.release:
	case <-time.After(3 * time.Second):
		return PlanningResult{}, ctx.Err()
	}
	// Model the LLM completing its paused persistence after local cancellation.
	p.paused.Store(true)
	return PlanningResult{}, err
}

func TestStopRacingWithPausedChildPersistenceDiscardsTheLateCheckpoint(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	ctx := context.Background()
	planner := &boundaryPlanner{started: make(chan struct{}), requested: make(chan struct{}), observed: make(chan struct{}), release: make(chan struct{})}
	var images atomic.Int32
	options := testOptions(t, providerFunc(func(context.Context, ProviderInput) (ProviderOutput, error) {
		images.Add(1)
		return ProviderOutput{}, nil
	}))
	options.Planner = planner
	options.DiscardPlan = func(context.Context, string) error { planner.paused.Store(false); return nil }
	service := newService(t, options)
	input := CreateInput{ID: "10000000-0000-4000-8000-000000000099", QuestionID: 4,
		Settings: Settings{GenerationMode: "pipeline"}}
	if _, err := service.Create(ctx, input); err != nil {
		t.Fatal(err)
	}
	// Claiming a row marks it running before the worker enters Generate. Wait
	// for the actual planner so a cooperative pause cannot precede this step.
	select {
	case <-planner.started:
	case <-time.After(3 * time.Second):
		t.Fatal("planner did not start")
	}
	if _, err := service.Pause(ctx, input.ID); err != nil {
		t.Fatal(err)
	}
	close(planner.requested)
	select {
	case <-planner.observed:
	case <-time.After(3 * time.Second):
		t.Fatal("pause boundary not reached")
	}
	if _, err := service.Cancel(ctx, input.ID); err != nil {
		t.Fatal(err)
	}
	close(planner.release)
	// A subsequent queued task cannot be claimed until the previous worker has
	// completed its late-pause cleanup. Use that boundary instead of a timer.
	next := input
	next.ID = "10000000-0000-4000-8000-000000000098"
	next.GenerationMode = ""
	if _, err := service.Create(ctx, next); err != nil {
		t.Fatal(err)
	}
	waitJob(t, service, next.ID, "failed")
	if planner.paused.Load() || images.Load() != 1 {
		t.Fatal("late child survived stop or stopped task reached images")
	}
	waitJob(t, service, input.ID, "canceled")
}
