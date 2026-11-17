package storage

import (
	"context"
	"database/sql"
	"io/fs"
	"path/filepath"
	"testing"

	"test-driven-study/internal/testsupport"

	"github.com/pressly/goose/v3"
)

func TestTaskControlMigrationPreservesLegacyRowsAndBootstrapsHonestHistory(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	ctx := context.Background()
	root, _ := filepath.Abs("../..")
	db, err := sql.Open("sqlite", filepath.Join(t.TempDir(), "study.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	migrationFS, _ := fs.Sub(migrations, "migrations")
	provider, err := goose.NewProvider(goose.DialectSQLite3, db, migrationFS)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = provider.UpTo(ctx, 4); err != nil {
		t.Fatal(err)
	}
	source := filepath.Join(root, "courses", "driving-theory", "source", "question_bank.json")
	if err := importQuestions(ctx, db, source); err != nil {
		t.Fatal(err)
	}
	const snapshot = `{"question":{"title":"Original snapshot"},"prompt":"Exact original prompt"}`
	const id = "00000000-0000-4000-8000-000000000001"
	_, err = db.Exec(`INSERT INTO palace_jobs(id,question_id,subject_id,status,snapshot_json,image_json,error_json,created_at_ms,updated_at_ms)
		VALUES(?,4,1,'failed',?,'','{"code":"legacy"}',1000,2000)`, id, snapshot)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = provider.Up(ctx); err != nil {
		t.Fatal(err)
	}
	var saved, status, control, errorJSON string
	var created, updated int64
	err = db.QueryRow(`SELECT snapshot_json,status,control_state,error_json,created_at_ms,updated_at_ms
		FROM palace_jobs WHERE id=?`, id).Scan(&saved, &status, &control, &errorJSON, &created, &updated)
	if err != nil || saved != snapshot || status != "failed" || control != "run" ||
		errorJSON != `{"code":"legacy"}` || created != 1000 || updated != 2000 {
		t.Fatal("legacy task changed during migration", err)
	}
	var kind, from, to string
	var count int
	err = db.QueryRow("SELECT kind,from_state,to_state,created_at_ms FROM palace_job_events WHERE job_id=?", id).
		Scan(&kind, &from, &to, &updated)
	if err != nil || kind != "historical_snapshot" || from != "" || to != "failed" || updated != 2000 {
		t.Fatal("invented historical transitions", kind, from, to, err)
	}
	if err = db.QueryRow("SELECT count(*) FROM questions").Scan(&count); err != nil || count != 3147 {
		t.Fatal("question bank changed", err)
	}
	if err = db.QueryRow("SELECT count(*) FROM pragma_foreign_key_check").Scan(&count); err != nil || count != 0 {
		t.Fatal("broken foreign keys", err)
	}
}
