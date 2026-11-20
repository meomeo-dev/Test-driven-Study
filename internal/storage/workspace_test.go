package storage

import (
	"context"
	"path/filepath"
	"testing"

	"test-driven-study/internal/storage/storedb"
)

func TestWorkspaceImportsTypedHistoryOnce(t *testing.T) {
	ctx := context.Background()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	data := t.TempDir()
	db, err := Open(ctx, root, data)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := InstallCourse(ctx, db, filepath.Join(root, "tests", "fixtures", "courses", "basic-math")); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO course_presentations
		(course_id,id,version,unit_id,item_id,opened_at_ms)
		VALUES ('basic-math','typed-legacy-presentation',
		(SELECT version FROM active_courses WHERE course_id='basic-math'),'intro','4',1000)`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO course_attempts
		(course_id,presentation_id,item_id,response_json,correct,answered_at_ms)
		VALUES ('basic-math','typed-legacy-presentation','4','{"value":"0.250"}',1,2000)`); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	for range 2 {
		db, err := Open(ctx, root, data)
		if err != nil {
			t.Fatal(err)
		}
		queries := storedb.New(db)
		math, err := queries.GetWorkspaceQuestionID(ctx, storedb.GetWorkspaceQuestionIDParams{
			CourseID: "basic-math", ItemID: "4",
		})
		if err != nil || math == 4 {
			t.Fatalf("math question reused legacy storage identity: %d / %v", math, err)
		}
		var count, correct int
		err = db.QueryRow(`SELECT count(*),sum(is_correct) FROM answer_attempts
			WHERE question_id=? AND json_extract(selected_json,'$.value')='0.250'
			  AND opened_at_ms=1000 AND answered_at_ms=2000`, math).Scan(&count, &correct)
		db.Close()
		if err != nil || count != 1 || correct != 1 {
			t.Fatalf("old result not preserved exactly once: %d / %d / %v", count, correct, err)
		}
	}
}
