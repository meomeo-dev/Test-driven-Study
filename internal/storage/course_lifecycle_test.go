package storage

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"image"
	"image/color"
	"image/png"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage/storedb"
	"test-driven-study/internal/study"
)

func buildLifecycleFixtureZip(
	t *testing.T, parent, id, version, title, lesson string,
) string {
	t.Helper()
	stage := t.TempDir()
	dir, err := course.Scaffold(stage, id, title, "zh-CN")
	if err != nil {
		t.Fatal(err)
	}
	manifestPath := filepath.Join(dir, course.ManifestFile)
	raw, err := os.ReadFile(manifestPath)
	if err != nil {
		t.Fatal(err)
	}
	var manifest course.Manifest
	if err := json.Unmarshal(raw, &manifest); err != nil {
		t.Fatal(err)
	}
	manifest.ID = id
	manifest.Version = version
	manifest.Title = title
	manifest.Logo = "assets/logo.png"
	updated, err := json.Marshal(manifest)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(manifestPath, updated, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(dir, "lessons", "intro.md"), []byte(lesson), 0o644,
	); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(dir, "assets"), 0o755); err != nil {
		t.Fatal(err)
	}
	img := image.NewGray(image.Rect(0, 0, 1, 1))
	img.SetGray(0, 0, color.Gray{Y: 180})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "assets", "logo.png"), buf.Bytes(), 0o644); err != nil {
		t.Fatal(err)
	}
	zipPath := filepath.Join(parent, id+"-"+version+".zip")
	if err := course.PackZip(dir, zipPath); err != nil {
		t.Fatal(err)
	}
	return zipPath
}

func TestCourseZipLifecyclePreservesKeysAndLearnerHistory(t *testing.T) {
	ctx := context.Background()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	dataDir := t.TempDir()
	db, err := Open(ctx, root, dataDir)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	work := t.TempDir()
	zipV1 := buildLifecycleFixtureZip(t, work, "zip-demo", "1.0.0", "Zip Demo V1", "# Lesson V1\n")
	zipV2 := buildLifecycleFixtureZip(t, work, "zip-demo", "1.1.0", "Zip Demo V2", "# Lesson V2\n")

	// 1. Install v1.0.0 via InstallCourse (zip path) and verify stored asset + history setup.
	m1, err := InstallCourse(ctx, db, zipV1)
	if err != nil || m1.ID != "zip-demo" || m1.Version != "1.0.0" {
		t.Fatalf("install zip v1: %+v / %v", m1, err)
	}
	svc := study.New(db, root)
	if asset, err := svc.CourseAsset(ctx, "zip-demo", "1.0.0", "assets/logo.png"); err != nil || len(asset) == 0 {
		t.Fatalf("stored zip asset missing: %d / %v", len(asset), err)
	}
	qID, err := storedb.New(db).GetWorkspaceQuestionID(ctx, storedb.GetWorkspaceQuestionIDParams{
		CourseID: "zip-demo", ItemID: "1",
	})
	if err != nil {
		t.Fatal(err)
	}
	unitsBefore, err := storedb.New(db).ListWorkspaceUnits(ctx, "zip-demo")
	if err != nil || len(unitsBefore) != 1 {
		t.Fatalf("expected 1 active unit, got %+v / %v", unitsBefore, err)
	}
	subjectID := unitsBefore[0].ID
	if err := svc.SetProgress(ctx, qID, "mastered"); err != nil {
		t.Fatal(err)
	}
	const presID = "zip-lifecycle-attempt-0001"
	if _, err := svc.OpenPresentation(ctx, presID, qID); err != nil {
		t.Fatal(err)
	}
	answer := "0.25"
	res, err := svc.SubmitResponse(ctx, presID, study.AnswerInput{Numeric: &answer})
	if err != nil || !res.Attempt.Correct {
		t.Fatalf("submit response: %+v / %v", res, err)
	}

	// 2. Upgrade to v1.1.0 via InstallCourseZip (raw zip bytes).
	v2Bytes, err := os.ReadFile(zipV2)
	if err != nil {
		t.Fatal(err)
	}
	m2, err := InstallCourseZip(ctx, db, v2Bytes)
	if err != nil || m2.Version != "1.1.0" {
		t.Fatalf("install zip v2: %+v / %v", m2, err)
	}
	pkgs, err := ListInstalledPackages(ctx, db)
	if err != nil {
		t.Fatal(err)
	}
	idx := slices.IndexFunc(pkgs, func(p InstalledCoursePackage) bool { return p.CourseID == "zip-demo" })
	if idx < 0 || !pkgs[idx].Active || pkgs[idx].ActiveVersion != "1.1.0" || len(pkgs[idx].Versions) != 2 {
		t.Fatalf("unexpected installed packages after upgrade: %+v", pkgs)
	}
	if pkgs[idx].Versions[0].Version != "1.1.0" || !pkgs[idx].Versions[0].Active ||
		pkgs[idx].Versions[0].InstalledAtMS <= 0 || pkgs[idx].Versions[1].Version != "1.0.0" {
		t.Fatalf("unexpected version ordering/metadata: %+v", pkgs[idx].Versions)
	}

	// 3. Auto-rollback selects most recently installed non-active version (1.0.0).
	rolled, err := RollbackCourse(ctx, db, "zip-demo", "")
	if err != nil || rolled != "1.0.0" {
		t.Fatalf("rollback failed: %q / %v", rolled, err)
	}
	active, err := storedb.New(db).GetActiveCourse(ctx, "zip-demo")
	if err != nil || active.Version != "1.0.0" {
		t.Fatalf("expected active 1.0.0 after rollback, got %+v / %v", active, err)
	}

	// 4. Deactivate hides workspace units/questions without deleting versions or history.
	if err := DeactivateCourse(ctx, db, "zip-demo"); err != nil {
		t.Fatal(err)
	}
	if units, err := storedb.New(db).ListWorkspaceUnits(ctx, "zip-demo"); err != nil || len(units) != 0 {
		t.Fatalf("deactivated course still has active units: %+v / %v", units, err)
	}
	var projectedCount int
	if err := db.QueryRow(
		`SELECT COUNT(*) FROM questions WHERE subject_id = ?`, subjectID,
	).Scan(&projectedCount); err != nil || projectedCount != 0 {
		t.Fatalf("deactivated course still has active questions: %d / %v", projectedCount, err)
	}
	activeCourses, err := svc.Courses(ctx)
	if err != nil || slices.ContainsFunc(activeCourses, func(c study.CourseSummary) bool {
		return c.ID == "zip-demo"
	}) {
		t.Fatalf("deactivated course appeared in active catalog: %+v / %v", activeCourses, err)
	}
	pkgs, err = ListInstalledPackages(ctx, db)
	if err != nil {
		t.Fatal(err)
	}
	idx = slices.IndexFunc(pkgs, func(p InstalledCoursePackage) bool { return p.CourseID == "zip-demo" })
	if idx < 0 || pkgs[idx].Active || pkgs[idx].ActiveVersion != "" || len(pkgs[idx].Versions) != 2 {
		t.Fatalf("deactivated package metadata broken: %+v", pkgs[idx])
	}

	// 5. Deactivating a bundled default course must survive restart without auto-reactivating.
	if err := DeactivateCourse(ctx, db, "golden-course-template"); err != nil {
		t.Fatal(err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}
	db, err = Open(ctx, root, dataDir)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	svc = study.New(db, root)
	if _, err := storedb.New(db).GetActiveCourse(ctx, "golden-course-template"); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("reopened DB reactivated deactivated default course: %v", err)
	}

	// 6. Reactivating v1.1.0 restores exact subject_id, question_id, progress, and attempts.
	if err := ActivateCourseVersion(ctx, db, "zip-demo", "1.1.0"); err != nil {
		t.Fatal(err)
	}
	unitsAfter, err := storedb.New(db).ListWorkspaceUnits(ctx, "zip-demo")
	if err != nil || len(unitsAfter) != 1 || unitsAfter[0].ID != subjectID {
		t.Fatalf("subject_id changed across deactivate/reactivate: want %d got %+v (%v)",
			subjectID, unitsAfter, err)
	}
	qIDAfter, err := storedb.New(db).GetWorkspaceQuestionID(ctx, storedb.GetWorkspaceQuestionIDParams{
		CourseID: "zip-demo", ItemID: "1",
	})
	if err != nil || qIDAfter != qID {
		t.Fatalf("question_id changed: want %d got %d (%v)", qID, qIDAfter, err)
	}
	detail, err := svc.Detail(ctx, qID)
	if err != nil || detail.State != "mastered" || detail.Question.PackageVersion != "1.1.0" {
		t.Fatalf("learner progress or version not restored: %+v / %v", detail, err)
	}
	analysis, err := svc.Analysis(ctx, subjectID, 30)
	if err != nil || analysis.Overall.Attempts != 1 || analysis.Overall.Correct != 1 {
		t.Fatalf("learner attempts lost after reactivate: %+v / %v", analysis, err)
	}
	var fkViolations int
	if err := db.QueryRow("SELECT count(*) FROM pragma_foreign_key_check").Scan(&fkViolations); err != nil ||
		fkViolations != 0 {
		t.Fatalf("foreign key check failed: %d / %v", fkViolations, err)
	}
}

func TestCourseLifecycleErrorGuards(t *testing.T) {
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

	work := t.TempDir()
	zipA := buildLifecycleFixtureZip(t, work, "guard-course", "1.0.0", "Guard A", "# A\n")
	zipB := buildLifecycleFixtureZip(t, t.TempDir(), "guard-course", "1.0.0", "Guard B", "# B\n")
	if _, err := InstallCourse(ctx, db, zipA); err != nil {
		t.Fatal(err)
	}
	bytesB, err := os.ReadFile(zipB)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := InstallCourseZip(ctx, db, bytesB); !errors.Is(err, study.ErrConflict) {
		t.Fatalf("expected ErrConflict on modified same version, got %v", err)
	}
	if _, err := RollbackCourse(ctx, db, "guard-course", ""); !errors.Is(err, study.ErrInvalid) {
		t.Fatalf("expected ErrInvalid rolling back single-version course, got %v", err)
	}
	if err := ActivateCourseVersion(ctx, db, "guard-course", "9.9.9"); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("expected sql.ErrNoRows for missing version, got %v", err)
	}
	if err := DeactivateCourse(ctx, db, "missing-course"); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("expected sql.ErrNoRows for missing course, got %v", err)
	}
	if err := DeactivateCourse(ctx, db, "Bad_ID"); !errors.Is(err, study.ErrInvalid) {
		t.Fatalf("expected ErrInvalid for bad course ID, got %v", err)
	}
}
