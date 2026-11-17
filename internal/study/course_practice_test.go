package study_test

import (
	"bytes"
	"context"
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
	"test-driven-study/internal/storage"
	"test-driven-study/internal/storage/storedb"
	"test-driven-study/internal/study"
)

func TestCourseAttemptsAndAssetsAreScopedAndVersioned(t *testing.T) {
	ctx := context.Background()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	db, err := storage.Open(ctx, root, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	service := study.New(db, root)
	parent := t.TempDir()
	first := fixtureCourse(t, parent, "first", 100)
	second := fixtureCourse(t, parent, "second", 200)
	for _, directory := range []string{first, second} {
		if _, err := storage.InstallCourse(ctx, db, directory); err != nil {
			t.Fatal(err)
		}
	}
	questions := storedb.New(db)
	for _, id := range []string{"first", "second"} {
		question, err := questions.GetWorkspaceQuestionID(ctx, storedb.GetWorkspaceQuestionIDParams{
			CourseID: id, ItemID: "1",
		})
		if err != nil {
			t.Fatal(err)
		}
		if _, err := service.OpenPresentation(ctx, id+"-saved-presentation", question); err != nil {
			t.Fatal(err)
		}
	}
	modifyCourseVersion(t, first)
	if _, err := storage.InstallCourse(ctx, db, first); err != nil {
		t.Fatal(err)
	}
	answer := "0.250"
	for _, id := range []string{"first", "second"} {
		presentation := id + "-saved-presentation"
		input := study.AnswerInput{Numeric: &answer}
		result, err := service.SubmitResponse(ctx, presentation, input)
		if err != nil || !result.Attempt.Correct {
			t.Fatalf("%s should grade the saved revision: %+v / %v", id, result, err)
		}
		replay, err := service.SubmitResponse(ctx, presentation, input)
		if err != nil || replay.Attempt.ID != result.Attempt.ID {
			t.Fatalf("same response was not idempotent: %+v / %v", replay, err)
		}
	}
	bad := "1"
	_, err = service.SubmitResponse(ctx, "first-saved-presentation", study.AnswerInput{Numeric: &bad})
	if !errors.Is(err, study.ErrConflict) {
		t.Fatalf("expected conflict on changed response, got %v", err)
	}
	a, err := service.CourseAsset(ctx, "first", "1.0.0", "assets/shared.png")
	if err != nil {
		t.Fatal(err)
	}
	b, err := service.CourseAsset(ctx, "second", "1.0.0", "assets/shared.png")
	if err != nil || bytes.Equal(a, b) {
		t.Fatalf("asset namespace collision: %v", err)
	}
	catalog, err := service.Courses(ctx)
	if err != nil {
		t.Fatal(err)
	}
	index := slices.IndexFunc(catalog, func(entry study.CourseSummary) bool {
		return entry.ID == "first"
	})
	if index < 0 || catalog[index].Version != "1.1.0" {
		t.Fatalf("unexpected installed version: %+v", catalog)
	}
}

func fixtureCourse(t *testing.T, parent, id string, shade uint8) string {
	t.Helper()
	directory, err := course.Scaffold(parent, id, id, "en")
	if err != nil {
		t.Fatal(err)
	}
	updateJSON[course.Manifest](t, filepath.Join(directory, course.ManifestFile),
		func(value *course.Manifest) { value.Logo = "assets/shared.png" })
	picture := image.NewGray(image.Rect(0, 0, 1, 1))
	picture.SetGray(0, 0, color.Gray{Y: shade})
	var data bytes.Buffer
	if err := png.Encode(&data, picture); err != nil {
		t.Fatal(err)
	}
	if err := os.Mkdir(filepath.Join(directory, "assets"), 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(directory, "assets", "shared.png"), data.Bytes(), 0644); err != nil {
		t.Fatal(err)
	}
	return directory
}

func modifyCourseVersion(t *testing.T, directory string) {
	t.Helper()
	updateJSON[course.Manifest](t, filepath.Join(directory, course.ManifestFile),
		func(value *course.Manifest) { value.Version = "1.1.0" })
	updateJSON[[]course.Item](t, filepath.Join(directory, "questions", "intro.json"),
		func(value *[]course.Item) { (*value)[0].Grading.Value = "0.5" })
}

func updateJSON[T any](t *testing.T, filename string, edit func(*T)) {
	t.Helper()
	data, err := os.ReadFile(filename)
	if err != nil {
		t.Fatal(err)
	}
	var value T
	if err := json.Unmarshal(data, &value); err != nil {
		t.Fatal(err)
	}
	edit(&value)
	data, err = json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filename, data, 0644); err != nil {
		t.Fatal(err)
	}
}
