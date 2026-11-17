package storage

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"test-driven-study/internal/storage/storedb"
)

// A version whose prerequisites close a cycle among the active courses is
// refused, and the previous version stays active.
func TestInstallRefusesRoadmapCycle(t *testing.T) {
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
	// The bundled embedded-mcu requires c-programming.
	cyclic := releaseCourse(t, filepath.Join(root, "courses", "c-programming"), "1.1.1",
		map[string]any{"note": "先学单片机。", "prerequisites": []any{
			map[string]any{"all_of": []any{"embedded-mcu"}, "strength": "required"}}})
	_, err = InstallCourse(ctx, db, cyclic)
	want := `course "c-programming": roadmap prerequisite cycle ` +
		`c-programming requires embedded-mcu requires c-programming`
	if err == nil || err.Error() != want {
		t.Fatalf("got %v, want %s", err, want)
	}
	active, err := storedb.New(db).GetActiveCourse(ctx, "c-programming")
	if err != nil || active.Version != "1.1.0" {
		t.Fatalf("previous version must stay active: %+v, %v", active.Version, err)
	}
	acyclic := releaseCourse(t, filepath.Join(root, "courses", "c-programming"), "1.1.2",
		map[string]any{"note": "建议先学 Python。", "prerequisites": []any{
			map[string]any{"all_of": []any{"python-programming"}, "strength": "recommended"}}})
	if manifest, err := InstallCourse(ctx, db, acyclic); err != nil ||
		manifest.Roadmap == nil || manifest.Version != "1.1.2" {
		t.Fatalf("acyclic release: %+v, %v", manifest, err)
	}
}

// releaseCourse copies a course package to a temporary directory with a new
// version and roadmap.
func releaseCourse(t *testing.T, source, version string, roadmap map[string]any) string {
	t.Helper()
	target := filepath.Join(t.TempDir(), filepath.Base(source))
	if err := os.CopyFS(target, os.DirFS(source)); err != nil {
		t.Fatal(err)
	}
	filename := filepath.Join(target, "course.json")
	data, err := os.ReadFile(filename)
	if err != nil {
		t.Fatal(err)
	}
	var manifest map[string]any
	if err := json.Unmarshal(data, &manifest); err != nil {
		t.Fatal(err)
	}
	manifest["version"], manifest["roadmap"] = version, roadmap
	if data, err = json.Marshal(manifest); err == nil {
		err = os.WriteFile(filename, data, 0o644)
	}
	if err != nil || !strings.Contains(string(data), version) {
		t.Fatal(err)
	}
	return target
}
