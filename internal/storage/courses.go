package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"time"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage/storedb"
	"test-driven-study/internal/study"
)

type courseConflictError struct{ err error }

func (e courseConflictError) Error() string   { return e.err.Error() }
func (e courseConflictError) Unwrap() []error { return []error{study.ErrConflict, e.err} }

func seedCourses(ctx context.Context, db *sql.DB, root string) error {
	names := []string{}
	data, err := os.ReadFile(filepath.Join(root, "courses", "defaults.json"))
	if err == nil {
		if err := json.Unmarshal(data, &names); err != nil {
			return fmt.Errorf("read default course list: %w", err)
		}
	} else if !errors.Is(err, os.ErrNotExist) {
		return err
	}
	for _, name := range names {
		if !course.ValidID(name) {
			return fmt.Errorf("invalid default course ID %q", name)
		}
		directory := filepath.Join(root, "courses", name)
		if err := seedCourse(ctx, db, directory, name); err != nil {
			return fmt.Errorf("initialize course %q: %w", name, err)
		}
	}
	return nil
}

func seedCourse(ctx context.Context, db *sql.DB, directory, id string) error {
	if _, err := os.Stat(filepath.Join(directory, course.ManifestFile)); err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return nil
		}
		return err
	}
	count, err := storedb.New(db).CountCourseVersions(ctx, id)
	if err != nil || count > 0 {
		return err
	}
	_, err = installCourse(ctx, db, directory, id)
	return err
}

func InstallCourse(ctx context.Context, db *sql.DB, pathOrZip string) (course.Manifest, error) {
	return installCourse(ctx, db, pathOrZip, "")
}

// InstallCourseZip validates and extracts a local .zip archive strictly outside
// any SQLite transaction, then installs and activates it atomically.
func InstallCourseZip(ctx context.Context, db *sql.DB, data []byte) (course.Manifest, error) {
	pkg, err := course.LoadZipBytes(data)
	if err != nil {
		if errors.Is(err, course.ErrArchiveTooLarge) || errors.Is(err, course.ErrInvalidArchive) {
			return course.Manifest{}, err
		}
		return course.Manifest{}, fmt.Errorf("%w: %v", course.ErrInvalidArchive, err)
	}
	return installLoadedPackage(ctx, db, *pkg, "")
}

func installCourse(
	ctx context.Context, db *sql.DB, pathOrZip, expectedID string,
) (course.Manifest, error) {
	pkg, err := course.LoadPath(pathOrZip)
	if err != nil {
		return course.Manifest{}, err
	}
	return installLoadedPackage(ctx, db, *pkg, expectedID)
}

func installLoadedPackage(
	ctx context.Context, db *sql.DB, pkg course.Package, expectedID string,
) (course.Manifest, error) {
	manifest := pkg.Manifest
	if expectedID != "" && manifest.ID != expectedID {
		return course.Manifest{}, fmt.Errorf("manifest course ID %q differs from %q",
			manifest.ID, expectedID)
	}
	encoded, err := json.Marshal(manifest)
	if err != nil {
		return course.Manifest{}, err
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return course.Manifest{}, err
	}
	defer tx.Rollback()
	queries := storedb.New(tx)
	inserted, err := queries.InsertCourseVersion(ctx, storedb.InsertCourseVersionParams{
		CourseID: manifest.ID, Version: manifest.Version, Digest: pkg.Digest,
		ManifestJson: string(encoded),
	})
	if err != nil {
		return course.Manifest{}, err
	}
	if inserted == 0 {
		existing, err := queries.GetCourseVersion(ctx, storedb.GetCourseVersionParams{
			CourseID: manifest.ID, Version: manifest.Version,
		})
		if err != nil {
			return course.Manifest{}, err
		}
		if existing.Digest != pkg.Digest {
			return course.Manifest{}, courseConflictError{fmt.Errorf(
				"%s@%s has different content; use a new version",
				manifest.ID, manifest.Version,
			)}
		}
	} else {
		if err := insertCourseContent(ctx, queries, pkg); err != nil {
			return course.Manifest{}, err
		}
		if err := queries.SetImportMetadata(ctx, storedb.SetImportMetadataParams{
			Key:   installedAtMetadataKey(manifest.ID, manifest.Version),
			Value: strconv.FormatInt(time.Now().UTC().UnixMilli(), 10),
		}); err != nil {
			return course.Manifest{}, err
		}
	}
	if err := checkRoadmapCycles(ctx, queries, manifest); err != nil {
		return course.Manifest{}, courseConflictError{err}
	}
	if err := queries.ActivateCourseVersion(ctx, storedb.ActivateCourseVersionParams{
		CourseID: manifest.ID, Version: manifest.Version,
	}); err != nil {
		return course.Manifest{}, err
	}
	if err := projectWorkspace(ctx, tx, storedb.CourseVersion{
		CourseID: manifest.ID, Version: manifest.Version, ManifestJson: string(encoded),
	}); err != nil {
		return course.Manifest{}, err
	}
	return manifest, tx.Commit()
}

// checkRoadmapCycles refuses to activate a version whose course
// prerequisites form a cycle with the other active courses. The caller's
// transaction then rolls back, so the previous version stays active.
func checkRoadmapCycles(
	ctx context.Context, queries *storedb.Queries, candidate course.Manifest,
) error {
	rows, err := queries.ListActiveCourses(ctx)
	if err != nil {
		return err
	}
	active := make([]course.Manifest, 0, len(rows))
	for _, row := range rows {
		var manifest course.Manifest
		if err := json.Unmarshal([]byte(row.ManifestJson), &manifest); err != nil {
			return err
		}
		active = append(active, manifest)
	}
	return course.CheckRoadmapCycles(candidate, active)
}

func insertCourseContent(
	ctx context.Context, queries *storedb.Queries, pkg course.Package,
) error {
	id, version := pkg.Manifest.ID, pkg.Manifest.Version
	for _, unit := range pkg.Manifest.Units {
		content := pkg.Units[unit.ID]
		for index, item := range content.Items {
			payload, err := json.Marshal(item)
			if err != nil {
				return err
			}
			legacyID, err := legacyItemID(id, item.ID)
			if err != nil {
				return err
			}
			if err := queries.InsertCourseItem(ctx, storedb.InsertCourseItemParams{
				CourseID: id, Version: version, UnitID: unit.ID, ItemID: item.ID,
				Position: int64(index), PayloadJson: string(payload), LegacyQuestionID: legacyID,
			}); err != nil {
				return err
			}
		}
		for _, lesson := range unit.Lessons {
			if err := queries.InsertCourseLesson(ctx, storedb.InsertCourseLessonParams{
				CourseID: id, Version: version, UnitID: unit.ID, LessonID: lesson.ID,
				Markdown: content.Lessons[lesson.ID],
			}); err != nil {
				return err
			}
		}
	}
	return insertCourseAssets(ctx, queries, pkg)
}

func legacyItemID(courseID, itemID string) (sql.NullInt64, error) {
	return sql.NullInt64{}, nil
}

func insertCourseAssets(
	ctx context.Context, queries *storedb.Queries, pkg course.Package,
) error {
	for _, filename := range pkg.Files {
		if !pkg.IsStoredAsset(filename) {
			continue
		}
		data, err := pkg.AssetData(filename)
		if err != nil {
			return err
		}
		if err := queries.InsertCourseAsset(ctx, storedb.InsertCourseAssetParams{
			CourseID: pkg.Manifest.ID, Version: pkg.Manifest.Version, Path: filename, Content: data,
		}); err != nil {
			return err
		}
	}
	return nil
}
