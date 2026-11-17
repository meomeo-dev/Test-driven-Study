package storage

import (
	"context"
	"path/filepath"
	"strings"
	"testing"

	"test-driven-study/internal/storage/storedb"
)

// Concept tags are stored with the authored item but never projected into the
// learner-facing question payload.
func TestConceptTagsStayOutOfProjectedQuestions(t *testing.T) {
	ctx := context.Background()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	db, err := Open(ctx, root, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	fixture := filepath.Join(root, "tests", "fixtures", "courses", "concept-graph")
	manifest, err := InstallCourse(ctx, db, fixture)
	if err != nil {
		t.Fatal(err)
	}
	if len(manifest.Units[0].Concepts) != 3 {
		t.Fatalf("installed manifest lost concepts: %+v", manifest.Units[0])
	}
	if err := initializeWorkspace(ctx, db); err != nil {
		t.Fatal(err)
	}
	item, err := storedb.New(db).GetCourseItem(ctx, storedb.GetCourseItemParams{
		CourseID: "concept-graph", Version: "1.0.0", ItemID: "addition-1",
	})
	if err != nil || !strings.Contains(item.PayloadJson, `"concepts":["addition"]`) {
		t.Fatalf("stored item lost its tags: %s, %v", item.PayloadJson, err)
	}
	var payload string
	err = db.QueryRowContext(ctx, `SELECT q.payload_json FROM questions q
		JOIN question_keys k ON k.question_id = q.question_id
		WHERE k.course_id = 'concept-graph' AND k.item_id = 'addition-1'`).Scan(&payload)
	if err != nil || strings.Contains(payload, "concepts") || strings.Contains(payload, "addition\"]") {
		t.Fatalf("projected question carries concept tags: %s, %v", payload, err)
	}
}
