package storage

import (
	"context"
	"database/sql"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"test-driven-study/internal/testsupport"

	"github.com/pressly/goose/v3"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage/storedb"
	"test-driven-study/internal/study"
)

func TestCourseMigrationPreservesLegacySession(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	ctx := context.Background()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	directory := t.TempDir()
	old, err := sql.Open("sqlite", filepath.Join(directory, "study.sqlite"))
	if err != nil {
		t.Fatal(err)
	}
	defer old.Close()
	migrationFS, err := fs.Sub(migrations, "migrations")
	if err != nil {
		t.Fatal(err)
	}
	provider, err := goose.NewProvider(goose.DialectSQLite3, old, migrationFS)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := provider.UpTo(ctx, 8); err != nil {
		t.Fatal(err)
	}
	source := filepath.Join(root, "courses", "driving-theory", "source", "question_bank.json")
	if err := importQuestions(ctx, old, source); err != nil {
		t.Fatal(err)
	}
	service := study.New(old, root)
	if err := service.SetProgress(ctx, 4, "mastered"); err != nil {
		t.Fatal(err)
	}
	const practiceID = "legacy-presentation-1"
	if _, err := service.OpenPresentation(ctx, practiceID, 4); err != nil {
		t.Fatal(err)
	}
	const examID = "a6000000-0000-4000-8000-000000000009"
	exam, err := service.CreateExam(ctx, examID, 1)
	if err != nil {
		t.Fatal(err)
	}
	if err := old.Close(); err != nil {
		t.Fatal(err)
	}
	db, err := Open(ctx, root, directory)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	service = study.New(db, root)
	attempt, err := service.SubmitAnswer(ctx, practiceID, []int64{2})
	if err != nil || !attempt.Attempt.Correct {
		t.Fatalf("old practice could not submit: %+v / %v", attempt, err)
	}
	saved, err := service.GetExam(ctx, examID)
	if err != nil || saved.DeadlineAtMS != exam.DeadlineAtMS ||
		saved.Items[0].Detail.Question.QuestionID != exam.Items[0].Detail.Question.QuestionID {
		t.Fatalf("old paper changed: %v", err)
	}
	var violations int
	if err := db.QueryRow("SELECT count(*) FROM pragma_foreign_key_check").Scan(&violations); err != nil ||
		violations != 0 {
		t.Fatalf("migration broke foreign keys: %d / %v", violations, err)
	}
	queries := storedb.New(db)
	active, err := queries.GetActiveCourse(ctx, "driving-theory")
	if err != nil {
		t.Fatal(err)
	}
	row, err := queries.GetCourseItem(ctx, storedb.GetCourseItemParams{
		CourseID: active.CourseID, Version: active.Version, ItemID: "4",
	})
	if err != nil || !row.LegacyQuestionID.Valid || row.LegacyQuestionID.Int64 != 4 {
		t.Fatalf("legacy item identity not preserved: %+v / %v", row, err)
	}
}

func TestInstallCourseIsAtomicAndCourseScoped(t *testing.T) {
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
	parent := t.TempDir()
	for _, id := range []string{"course-one", "course-two"} {
		directory, err := course.Scaffold(parent, id, id, "en")
		if err != nil {
			t.Fatal(err)
		}
		for i := 0; i < 2; i++ {
			if _, err := InstallCourse(ctx, db, directory); err != nil {
				t.Fatal(err)
			}
		}
	}
	path := filepath.Join(parent, "course-one", "lessons", "intro.md")
	if err := os.WriteFile(path, []byte("Changed content.\n"), 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := InstallCourse(ctx, db, filepath.Join(parent, "course-one")); err == nil ||
		!strings.Contains(err.Error(), "different content") {
		t.Fatalf("expected same-version rejection: %v", err)
	}
	queries := storedb.New(db)
	for _, id := range []string{"course-one", "course-two"} {
		row, err := queries.GetCourseItem(ctx, storedb.GetCourseItemParams{
			CourseID: id, Version: "1.0.0", ItemID: "1",
		})
		if err != nil || row.CourseID != id || row.LegacyQuestionID.Valid {
			t.Fatalf("overlapping item identity was not scoped: %+v / %v", row, err)
		}
	}
	lesson, err := queries.GetCourseLesson(ctx, storedb.GetCourseLessonParams{
		CourseID: "course-one", Version: "1.0.0", UnitID: "intro", LessonID: "intro",
	})
	if err != nil || strings.Contains(lesson, "Changed") {
		t.Fatalf("rejected install changed the active lesson: %v", err)
	}
}
