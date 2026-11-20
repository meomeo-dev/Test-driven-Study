package tasktrace

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"test-driven-study/internal/storage"
	"test-driven-study/internal/storage/storedb"
)

func traceQueries(t *testing.T) *storedb.Queries {
	t.Helper()
	root, _ := filepath.Abs("../..")
	db, err := storage.Open(context.Background(), root, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if _, err := storage.InstallCourse(context.Background(), db, filepath.Join(root, "tests", "fixtures", "courses", "basic-math")); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	queries := storedb.New(db)
	question, err := queries.GetWorkspaceQuestionID(context.Background(), storedb.GetWorkspaceQuestionIDParams{
		CourseID: "basic-math", ItemID: "4",
	})
	if err != nil {
		t.Fatal(err)
	}
	unit, err := queries.ListWorkspaceUnits(context.Background(), "basic-math")
	if err != nil || len(unit) != 1 {
		t.Fatalf("missing Basic Math unit: %v", err)
	}
	err = queries.CreatePalaceJob(context.Background(), storedb.CreatePalaceJobParams{
		ID: "trace-test", QuestionID: question, SubjectID: unit[0].ID, SnapshotJson: "{}", CreatedAtMs: 1, UpdatedAtMs: 1})
	if err != nil {
		t.Fatal(err)
	}
	return queries
}
func TestRecorderPreservesParentageAndBoundsTextAfterCancellation(t *testing.T) {
	queries := traceQueries(t)
	ctx, cancel := context.WithCancel(With(context.Background(), queries, "trace-test"))
	ctx, parent := Begin(ctx, "pipeline", "Run")
	_, child := Begin(ctx, "answer", "Answer")
	cancel()
	child.Text(strings.Repeat("文", MaxSpanText+100), "stream")
	child.End("canceled", "Stopped")
	child.End("completed", "Late result")
	parent.End("canceled", "")
	rows, err := queries.ListTraceEvents(context.Background(), storedb.ListTraceEventsParams{JobID: "trace-test"})
	if err != nil {
		t.Fatal(err)
	}
	var characters, ends int
	for _, row := range rows {
		if row.SpanID == child.id && row.ParentID != parent.id {
			t.Fatal("lost real parent")
		}
		if row.EventType == "delta" {
			characters += len([]rune(row.Content))
		}
		if row.SpanID == child.id && row.EventType == "end" {
			ends++
			if row.Status != "canceled" {
				t.Fatal("late overwrite")
			}
		}
	}
	if characters != MaxSpanText || ends != 1 {
		t.Fatal(characters, ends)
	}
}
func TestEventBudgetReservesTerminalEventsAndNoopContextIsSafe(t *testing.T) {
	queries := traceQueries(t)
	ctx := With(context.Background(), queries, "trace-test")
	recorder := ctx.Value(contextKey{}).(scope).recorder
	recorder.count = MaxEvents - 2
	_, span := Begin(ctx, "llm", "Model")
	span.Text("omitted at event cap", "stream")
	span.End("failed", "Request stopped")
	rows, err := queries.ListTraceEvents(context.Background(), storedb.ListTraceEventsParams{JobID: "trace-test"})
	if err != nil || len(rows) != 2 || rows[1].EventType != "end" {
		t.Fatal(rows, err)
	}
	_, noop := Begin(context.Background(), "llm", "No collector")
	noop.Text("ignored", "stream")
	noop.End("completed", "")
}
