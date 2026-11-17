package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"test-driven-study/internal/course"
	"test-driven-study/internal/study"
)

func TestCourseAIProfilesStayPinnedToInstalledVersions(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	db, err := Open(ctx, root, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	service := study.New(db, root)
	folder := t.TempDir()
	template := "Picture {{QUESTION_TEXT}} with {{REFERENCE_ANSWER}}"
	for _, release := range []struct {
		version, guidance, prompt string
	}{
		{"1.0.0", "Explain the first release.", ""},
		{"1.1.0", "Explain the second release.", template},
	} {
		directory := writeProfileRelease(t, folder, release.version, release.guidance, release.prompt)
		if _, err := InstallCourse(ctx, db, directory); err != nil {
			t.Fatal(err)
		}
	}
	rejected := writeProfileRelease(t, folder, "1.2.0", "Invalid release.", template+" {{PROXY}}")
	if _, err := InstallCourse(ctx, db, rejected); err == nil ||
		!strings.Contains(err.Error(), "unsupported placeholder") {
		t.Fatalf("invalid template accepted: %v", err)
	}
	for _, version := range []string{"1.0.0", "1.1.0"} {
		profile, identity, err := service.QuestionAIProfile(ctx, study.Question{
			PackageID: "profile-test", PackageVersion: version,
		})
		if err != nil || identity == nil || identity.CourseVersion != version ||
			identity.CourseID != "profile-test" {
			t.Fatalf("wrong identity for %s: %+v / %v", version, identity, err)
		}
		if version == "1.0.0" && (profile.Palace != nil || profile.Assistant != "Explain the first release.") {
			t.Fatalf("previous release changed: %+v", profile)
		}
		if version == "1.1.0" && (profile.Palace == nil || profile.Palace.Prompt != template ||
			profile.Assistant != "Explain the second release.") {
			t.Fatalf("latest release did not resolve: %+v", profile)
		}
		prompts, err := service.PalacePrompts(ctx, *identity)
		if err != nil || prompts.Planning != "Plan release "+version ||
			prompts.Research != "Research release "+version {
			t.Fatalf("palace instructions did not stay pinned: %+v / %v", prompts, err)
		}
		if _, err := service.CourseAsset(ctx, "profile-test", version,
			"profiles/palace-planning.txt"); !errors.Is(err, sql.ErrNoRows) {
			t.Fatalf("planning instructions are reachable as public media: %v", err)
		}
		if _, err := service.CourseAsset(ctx, "profile-test", version, "profiles/tutor.txt"); !errors.Is(err, sql.ErrNoRows) {
			t.Fatalf("private resource is reachable as public media: %v", err)
		}
	}
}

func writeProfileRelease(t *testing.T, folder, version, guidance, prompt string) string {
	t.Helper()
	directory, err := course.Scaffold(filepath.Join(folder, version), "profile-test", "Profile", "en")
	if err != nil {
		t.Fatal(err)
	}
	pkg, err := course.Load(directory)
	if err != nil {
		t.Fatal(err)
	}
	manifest := pkg.Manifest
	manifest.Version = version
	manifest.AIProfile.PalaceTemplate = ""
	manifest.AIProfile.AssistantInstructions = "profiles/tutor.txt"
	for name, instruction := range map[string]string{
		manifest.AIProfile.PalacePlanningInstructions: "Plan release " + version,
		manifest.AIProfile.PalaceResearchInstructions: "Research release " + version,
	} {
		if err := os.WriteFile(filepath.Join(directory, name), []byte(instruction), 0644); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.WriteFile(filepath.Join(directory, "profiles/tutor.txt"), []byte(guidance), 0644); err != nil {
		t.Fatal(err)
	}
	if prompt != "" {
		manifest.AIProfile.PalaceTemplate = "profiles/palace.json"
		writeProfileJSON(t, directory, manifest.AIProfile.PalaceTemplate, course.PalaceTemplate{
			ID: "sample", Version: version, Prompt: prompt,
		})
	}
	writeProfileJSON(t, directory, course.ManifestFile, manifest)
	return directory
}

func writeProfileJSON(t *testing.T, directory, name string, value any) {
	t.Helper()
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(directory, name), data, 0644); err != nil {
		t.Fatal(err)
	}
}
