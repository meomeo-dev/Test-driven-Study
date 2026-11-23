package main

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage"
)

func TestCourseCLIPackCheckInstallRollbackDeactivate(t *testing.T) {
	workDir := t.TempDir()
	dataDir := filepath.Join(workDir, "data")
	coursesDir := filepath.Join(workDir, "courses")

	origWD, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(workDir); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(origWD) })

	// 1. Scaffold v1.0.0 course, pack into zip, check both dir and zip.
	if err := run([]string{
		"new", "--dir", coursesDir, "--id", "cli-zip-demo",
		"--title", "CLI Zip Demo", "--language", "en",
	}); err != nil {
		t.Fatalf("course new: %v", err)
	}
	courseDir := filepath.Join(coursesDir, "cli-zip-demo")
	zipV1 := filepath.Join(workDir, "cli-zip-demo-v1.zip")
	if err := run([]string{"pack", "--out", zipV1, courseDir}); err != nil {
		t.Fatalf("course pack v1: %v", err)
	}
	if err := run([]string{"check", courseDir}); err != nil {
		t.Fatalf("course check dir: %v", err)
	}
	if err := run([]string{"check", zipV1}); err != nil {
		t.Fatalf("course check zip: %v", err)
	}

	// 2. Install v1 from zip.
	if err := run([]string{"install", "--data-dir", dataDir, zipV1}); err != nil {
		t.Fatalf("course install v1 zip: %v", err)
	}

	// 3. Bump to v1.1.0, pack (positional output path), and install v1.1.0 from zip.
	bumpCourseVersion(t, courseDir, "1.1.0", "CLI Zip Demo v1.1")
	zipV2 := filepath.Join(workDir, "cli-zip-demo-v2.zip")
	if err := run([]string{"pack", courseDir, zipV2}); err != nil {
		t.Fatalf("course pack v2: %v", err)
	}
	if err := run([]string{"install", "--data-dir", dataDir, zipV2}); err != nil {
		t.Fatalf("course install v2 zip: %v", err)
	}

	// 4. Rollback without explicit version activates previous version (1.0.0).
	if err := run([]string{"rollback", "--data-dir", dataDir, "cli-zip-demo"}); err != nil {
		t.Fatalf("course rollback default: %v", err)
	}
	assertCourseActiveState(t, workDir, dataDir, "cli-zip-demo", true, "1.0.0")

	// 5. Rollback with explicit --version switches back to 1.1.0.
	if err := run([]string{
		"rollback", "--data-dir", dataDir, "--version", "1.1.0", "cli-zip-demo",
	}); err != nil {
		t.Fatalf("course rollback explicit: %v", err)
	}
	assertCourseActiveState(t, workDir, dataDir, "cli-zip-demo", true, "1.1.0")

	// 6. Deactivate removes course from active set without losing installed versions.
	if err := run([]string{"deactivate", "--data-dir", dataDir, "cli-zip-demo"}); err != nil {
		t.Fatalf("course deactivate: %v", err)
	}
	assertCourseActiveState(t, workDir, dataDir, "cli-zip-demo", false, "")
}

func TestCourseCLIInstallMultiplePaths(t *testing.T) {
	workDir := t.TempDir()
	dataDir := filepath.Join(workDir, "data")
	coursesDir := filepath.Join(workDir, "courses")

	origWD, err := os.Getwd()
	if err != nil {
		t.Fatal(err)
	}
	if err := os.Chdir(workDir); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = os.Chdir(origWD) })

	dirA, err := course.Scaffold(coursesDir, "batch-alpha", "Batch Alpha", "en")
	if err != nil {
		t.Fatal(err)
	}
	dirB, err := course.Scaffold(coursesDir, "batch-beta", "Batch Beta", "zh-CN")
	if err != nil {
		t.Fatal(err)
	}
	zipB := filepath.Join(workDir, "batch-beta.zip")
	if err := course.PackZip(dirB, zipB); err != nil {
		t.Fatal(err)
	}

	if err := run([]string{"install", "--data-dir", dataDir, dirA, zipB}); err != nil {
		t.Fatalf("multi-path course install failed: %v", err)
	}

	ctx := context.Background()
	db, err := storage.Open(ctx, workDir, dataDir)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	pkgs, err := storage.ListInstalledPackages(ctx, db)
	if err != nil {
		t.Fatal(err)
	}
	found := map[string]bool{}
	for _, pkg := range pkgs {
		if pkg.Active && pkg.ActiveVersion == "1.0.0" {
			found[pkg.CourseID] = true
		}
	}
	if !found["batch-alpha"] || !found["batch-beta"] {
		t.Fatalf("expected both batch courses installed and active, got %+v", pkgs)
	}
}

func TestCourseCLIUsageErrors(t *testing.T) {
	cases := [][]string{
		nil,
		{"unknown"},
		{"check"},
		{"install"},
		{"pack"},
		{"pack", "--out", "a.zip", "dir", "b.zip"},
		{"deactivate"},
		{"rollback"},
		{"rollback", "--version", "1.0.0", "demo", "1.1.0"},
	}
	for _, args := range cases {
		if err := run(args); err == nil {
			t.Fatalf("expected error for args %v", args)
		}
	}
}

func bumpCourseVersion(t *testing.T, courseDir, version, title string) {
	t.Helper()
	manifestPath := filepath.Join(courseDir, course.ManifestFile)
	raw, err := os.ReadFile(manifestPath)
	if err != nil {
		t.Fatal(err)
	}
	var manifest course.Manifest
	if err := json.Unmarshal(raw, &manifest); err != nil {
		t.Fatal(err)
	}
	manifest.Version = version
	manifest.Title = title
	encoded, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(manifestPath, append(encoded, '\n'), 0o644); err != nil {
		t.Fatal(err)
	}
}

func assertCourseActiveState(
	t *testing.T, root, dataDir, courseID string, wantActive bool, wantVersion string,
) {
	t.Helper()
	ctx := context.Background()
	db, err := storage.Open(ctx, root, dataDir)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	pkgs, err := storage.ListInstalledPackages(ctx, db)
	if err != nil {
		t.Fatal(err)
	}
	for _, pkg := range pkgs {
		if pkg.CourseID == courseID {
			if pkg.Active != wantActive || pkg.ActiveVersion != wantVersion || len(pkg.Versions) != 2 {
				t.Fatalf("unexpected package state: %+v (want active=%v version=%q)",
					pkg, wantActive, wantVersion)
			}
			return
		}
	}
	t.Fatalf("course %q not found in installed packages: %+v", courseID, pkgs)
}
