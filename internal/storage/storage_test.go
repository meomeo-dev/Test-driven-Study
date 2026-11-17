package storage_test

import (
	"context"
	"database/sql"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"test-driven-study/internal/testsupport"

	"test-driven-study/internal/storage"
	"test-driven-study/internal/study"
)

func repository(t *testing.T) string {
	t.Helper()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	return root
}

func TestRealImportAndRestartPersistence(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	ctx := context.Background()
	root, directory := repository(t), t.TempDir()
	db, err := storage.Open(ctx, root, directory)
	if err != nil {
		t.Fatal(err)
	}
	service := study.New(db, root)
	for subject, count := range map[int64]int64{1: 1734, 4: 1413} {
		overview, err := service.Overview(ctx, subject)
		if err != nil || overview.Total != count {
			t.Fatalf("subject %d: %+v / %v", subject, overview, err)
		}
	}
	if err := service.SetProgress(ctx, 4, "mastered"); err != nil {
		t.Fatal(err)
	}
	if err := service.SetCursor(ctx, 1, 6); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	reopened, err := storage.Open(ctx, root, directory)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	overview, err := study.New(reopened, root).Overview(ctx, 1)
	if err != nil || overview.Mastered != 1 || overview.LastQuestionID != 6 {
		t.Fatalf("lost saved state: %+v / %v", overview, err)
	}
	var enabled int
	if err := reopened.QueryRow("PRAGMA foreign_keys").Scan(&enabled); err != nil || enabled != 1 {
		t.Fatalf("foreign keys disabled: %d / %v", enabled, err)
	}
}

func copySource(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	sourceDir := filepath.Join(root, "courses", "driving-theory", "source")
	repoDir := filepath.Join(repository(t), "courses", "driving-theory", "source")
	payload, err := os.ReadFile(filepath.Join(repoDir, "question_bank.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(sourceDir, 0700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(sourceDir, "question_bank.json"), payload, 0600); err != nil {
		t.Fatal(err)
	}
	return root
}

func TestChangedSourceDoesNotReplaceLearningData(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	root, directory := copySource(t), t.TempDir()
	db, err := storage.Open(context.Background(), root, directory)
	if err != nil {
		t.Fatal(err)
	}
	if err := study.New(db, root).SetProgress(context.Background(), 4, "review"); err != nil {
		t.Fatal(err)
	}
	db.Close()
	filename := filepath.Join(root, "courses", "driving-theory", "source", "question_bank.json")
	payload, _ := os.ReadFile(filename)
	if err := os.WriteFile(filename, append(payload, '\n'), 0600); err != nil {
		t.Fatal(err)
	}
	_, err = storage.Open(context.Background(), root, directory)
	if err == nil || !strings.Contains(err.Error(), "source changed") {
		t.Fatalf("expected protected import, got %v", err)
	}
	if err := os.WriteFile(filename, payload, 0600); err != nil {
		t.Fatal(err)
	}
	reopened, err := storage.Open(context.Background(), root, directory)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	detail, err := study.New(reopened, root).Detail(context.Background(), 4)
	if err != nil || detail.State != "review" {
		t.Fatalf("progress changed: %+v / %v", detail, err)
	}
}

func TestFailedImportRollsBackAllQuestions(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	root, directory := copySource(t), t.TempDir()
	filename := filepath.Join(root, "courses", "driving-theory", "source", "question_bank.json")
	payload, _ := os.ReadFile(filename)
	var rows []json.RawMessage
	if err := json.Unmarshal(payload, &rows); err != nil {
		t.Fatal(err)
	}
	duplicate, _ := json.Marshal([]json.RawMessage{rows[0], rows[0]})
	if err := os.WriteFile(filename, duplicate, 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := storage.Open(context.Background(), root, directory); err == nil {
		t.Fatal("duplicate IDs must fail")
	}
	db, err := sql.Open("sqlite", filepath.Join(directory, "study.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM questions").Scan(&count); err != nil || count != 0 {
		t.Fatalf("partially imported data: %d / %v", count, err)
	}
}
