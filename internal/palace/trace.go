package palace

import (
	"context"
	"time"

	"test-driven-study/internal/storage/storedb"
	"test-driven-study/internal/tasktrace"
)

type TraceEvent struct {
	ID           int64  `json:"id"`
	SpanID       string `json:"span_id"`
	ParentID     string `json:"parent_id"`
	Kind         string `json:"kind"`
	Label        string `json:"label"`
	Type         string `json:"type"`
	Status       string `json:"status"`
	Origin       string `json:"origin"`
	Content      string `json:"content"`
	ObservedAtMS int64  `json:"observed_at_ms"`
}
type TracePage struct {
	Events  []TraceEvent `json:"events"`
	Cursor  int64        `json:"cursor"`
	HasMore bool         `json:"has_more"`
	Limited bool         `json:"limited"`
	Status  string       `json:"status"`
}

func (s *Service) Trace(ctx context.Context, id string, after int64) (TracePage, error) {
	if after < 0 {
		return TracePage{}, ErrInvalid
	}
	job, err := s.Get(ctx, id)
	if err != nil {
		return TracePage{}, err
	}
	rows, err := s.queries.ListTraceEvents(ctx, storedb.ListTraceEventsParams{JobID: id, ID: after})
	if err != nil {
		return TracePage{}, err
	}
	count, err := s.queries.CountTraceEvents(ctx, id)
	if err != nil {
		return TracePage{}, err
	}
	page := TracePage{Events: []TraceEvent{}, Cursor: after, HasMore: len(rows) == 256,
		Limited: count >= tasktrace.MaxEvents-256, Status: job.Status}
	for _, row := range rows {
		page.Events = append(page.Events, TraceEvent{ID: row.ID, SpanID: row.SpanID,
			ParentID: row.ParentID, Kind: row.Kind, Label: row.Label, Type: row.EventType,
			Status: row.Status, Origin: row.Origin, Content: row.Content, ObservedAtMS: row.ObservedAtMs})
		page.Cursor = row.ID
	}
	return page, nil
}

func (s *Service) traceRun(ctx context.Context, id string) (context.Context, func()) {
	ctx = tasktrace.With(ctx, s.queries, id)
	ctx, span := tasktrace.Begin(ctx, "pipeline", "流水线执行")
	return ctx, func() {
		read, cancel := context.WithTimeout(context.Background(), 3*time.Second)
		defer cancel()
		job, err := s.Get(read, id)
		status := "interrupted"
		if err == nil {
			status = job.Status
		}
		// A fast Resume can enqueue the next run before this run's deferred
		// trace closes. The serial worker has still ended at a paused boundary.
		if status == "queued" {
			status = "paused"
		}
		if status == "succeeded" {
			status = "completed"
		}
		span.End(status, "")
	}
}
