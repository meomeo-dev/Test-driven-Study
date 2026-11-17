package tasktrace

import (
	"context"
	"crypto/rand"
	"log/slog"
	"strings"
	"sync"
	"time"

	"test-driven-study/internal/storage/storedb"
)

const MaxEvents = 12000
const MaxSpanText = 48000

type contextKey struct{}
type scope struct {
	recorder *Recorder
	parent   string
}

type Recorder struct {
	queries *storedb.Queries
	jobID   string
	mu      sync.Mutex
	count   int64
}

type Span struct {
	owner                   *Recorder
	id, parent, kind, label string
	mu                      sync.Mutex
	ended                   bool
	characters              int
}

func With(ctx context.Context, queries *storedb.Queries, jobID string) context.Context {
	count, err := queries.CountTraceEvents(ctx, jobID)
	if err != nil {
		count = MaxEvents
	}
	return context.WithValue(ctx, contextKey{}, scope{recorder: &Recorder{
		queries: queries, jobID: jobID, count: count}})
}

func Enabled(ctx context.Context) bool {
	value, ok := ctx.Value(contextKey{}).(scope)
	return ok && value.recorder != nil
}

func Begin(ctx context.Context, kind, label string) (context.Context, *Span) {
	value, ok := ctx.Value(contextKey{}).(scope)
	if !ok || value.recorder == nil {
		return ctx, nil
	}
	span := &Span{owner: value.recorder, id: rand.Text(), parent: value.parent,
		kind: kind, label: bounded(label, 160)}
	span.emit("start", "running", "application", "")
	return context.WithValue(ctx, contextKey{}, scope{value.recorder, span.id}), span
}

func (s *Span) emit(event, status, origin, content string) {
	if s == nil {
		return
	}
	s.owner.mu.Lock()
	defer s.owner.mu.Unlock()
	if s.owner.count >= MaxEvents {
		return
	}
	// Retain control/end records after the text budget is exhausted.
	if event == "delta" && s.owner.count >= MaxEvents-256 {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	err := s.owner.queries.AppendTraceEvent(ctx, storedb.AppendTraceEventParams{
		JobID: s.owner.jobID, SpanID: s.id, ParentID: s.parent, Kind: s.kind, Label: s.label,
		EventType: event, Status: status, Origin: origin, Content: bounded(content, 6000),
		ObservedAtMs: time.Now().UTC().UnixMilli()})
	if err != nil {
		slog.Error("task trace persistence failed", "job_id", s.owner.jobID)
		return
	}
	s.owner.count++
}

func (s *Span) Text(text, origin string) {
	if s == nil || text == "" {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.ended || s.characters >= MaxSpanText {
		return
	}
	runes := []rune(text)
	if len(runes) > MaxSpanText-s.characters {
		runes = runes[:MaxSpanText-s.characters]
	}
	for len(runes) > 0 {
		part := min(len(runes), 6000)
		s.emit("delta", "running", origin, string(runes[:part]))
		runes = runes[part:]
		s.characters += part
	}
}

func (s *Span) End(status, detail string) {
	if s == nil {
		return
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.ended {
		return
	}
	s.ended = true
	if s.characters >= MaxSpanText {
		detail += " · 展示文本已达保存上限"
	}
	s.emit("end", status, "application", detail)
}

func Note(ctx context.Context, kind, label, detail string) {
	value, ok := ctx.Value(contextKey{}).(scope)
	if !ok || value.recorder == nil {
		return
	}
	span := &Span{owner: value.recorder, id: rand.Text(), parent: value.parent, kind: kind, label: bounded(label, 160)}
	span.emit("note", "completed", "application", detail)
}

func bounded(text string, limit int) string {
	text = strings.ReplaceAll(text, "\x00", "")
	runes := []rune(text)
	if len(runes) > limit {
		return string(runes[:limit])
	}
	return text
}
