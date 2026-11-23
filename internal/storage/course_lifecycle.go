package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage/storedb"
	"test-driven-study/internal/study"
)

type InstalledCourseVersion struct {
	Version         string `json:"version"`
	ProtocolVersion int    `json:"protocol_version"`
	Digest          string `json:"digest"`
	InstalledAtMS   int64  `json:"installed_at_ms"`
	Active          bool   `json:"active"`
}

type InstalledCoursePackage struct {
	CourseID      string                   `json:"course_id"`
	Title         string                   `json:"title"`
	ActiveVersion string                   `json:"active_version"`
	Active        bool                     `json:"active"`
	Versions      []InstalledCourseVersion `json:"versions"`
}

func installedAtMetadataKey(courseID, version string) string {
	return "course_installed_at:" + courseID + "@" + version
}

// ListInstalledPackages returns all installed course packages (both active and
// deactivated) with their installed versions ordered newest-first.
func ListInstalledPackages(
	ctx context.Context, db *sql.DB,
) ([]InstalledCoursePackage, error) {
	rows, err := storedb.New(db).ListInstalledCourseVersions(ctx)
	if err != nil {
		return nil, err
	}
	packages := make([]InstalledCoursePackage, 0)
	byID := make(map[string]int)
	for _, row := range rows {
		var manifest course.Manifest
		if err := json.Unmarshal([]byte(row.ManifestJson), &manifest); err != nil {
			return nil, err
		}
		protocol := manifest.ProtocolVersion
		if protocol <= 0 {
			protocol = 1
		}
		active := row.Active == 1
		idx, exists := byID[row.CourseID]
		if !exists {
			idx = len(packages)
			byID[row.CourseID] = idx
			packages = append(packages, InstalledCoursePackage{
				CourseID: row.CourseID,
				Title:    manifest.Title,
				Versions: []InstalledCourseVersion{},
			})
		}
		if active {
			packages[idx].Active = true
			packages[idx].ActiveVersion = row.Version
			packages[idx].Title = manifest.Title
		}
		packages[idx].Versions = append(packages[idx].Versions, InstalledCourseVersion{
			Version:         row.Version,
			ProtocolVersion: protocol,
			Digest:          row.Digest,
			InstalledAtMS:   row.InstalledAtMs,
			Active:          active,
		})
	}
	return packages, nil
}

// ActivateCourseVersion activates a previously installed course version (for
// version switch, rollback, or reactivation) and reprojects the workspace while
// preserving question_keys and all learner history.
func ActivateCourseVersion(
	ctx context.Context, db *sql.DB, courseID, version string,
) error {
	if !course.ValidID(courseID) || strings.TrimSpace(version) == "" {
		return fmt.Errorf("invalid course version %q@%q: %w",
			courseID, version, study.ErrInvalid)
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	queries := storedb.New(tx)
	row, err := queries.GetCourseVersion(ctx, storedb.GetCourseVersionParams{
		CourseID: courseID, Version: version,
	})
	if errors.Is(err, sql.ErrNoRows) {
		return fmt.Errorf("course version %s@%s not found: %w",
			courseID, version, sql.ErrNoRows)
	}
	if err != nil {
		return err
	}
	var manifest course.Manifest
	if err := json.Unmarshal([]byte(row.ManifestJson), &manifest); err != nil {
		return err
	}
	if err := checkRoadmapCycles(ctx, queries, manifest); err != nil {
		return courseConflictError{err}
	}
	if err := queries.ActivateCourseVersion(ctx, storedb.ActivateCourseVersionParams{
		CourseID: courseID, Version: version,
	}); err != nil {
		return err
	}
	if err := projectWorkspace(ctx, tx, row); err != nil {
		return err
	}
	return tx.Commit()
}

// DeactivateCourse removes a course from active_courses and hides its projected
// workspace units/questions without deleting course_versions, question_keys, or
// any learner history.
func DeactivateCourse(ctx context.Context, db *sql.DB, courseID string) error {
	if !course.ValidID(courseID) {
		return fmt.Errorf("invalid course ID %q: %w", courseID, study.ErrInvalid)
	}
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	queries := storedb.New(tx)
	count, err := queries.CountCourseVersions(ctx, courseID)
	if err != nil {
		return err
	}
	if count == 0 {
		return fmt.Errorf("course %s not found: %w", courseID, sql.ErrNoRows)
	}
	if err := queries.DeleteCourseCursors(ctx, courseID); err != nil {
		return err
	}
	if _, err := queries.DeactivateCourse(ctx, courseID); err != nil {
		return err
	}
	if err := deactivateWorkspace(ctx, tx, courseID); err != nil {
		return err
	}
	return tx.Commit()
}

// RollbackCourse activates the specified version or, when version is empty, the
// most recently installed non-active version of courseID.
func RollbackCourse(
	ctx context.Context, db *sql.DB, courseID, version string,
) (string, error) {
	if !course.ValidID(courseID) {
		return "", fmt.Errorf("invalid course ID %q: %w", courseID, study.ErrInvalid)
	}
	target := strings.TrimSpace(version)
	if target == "" {
		rows, err := storedb.New(db).ListCourseVersionsByCourse(ctx, courseID)
		if err != nil {
			return "", err
		}
		if len(rows) == 0 {
			return "", fmt.Errorf("course %s not found: %w", courseID, sql.ErrNoRows)
		}
		for _, row := range rows {
			if row.Active == 0 {
				target = row.Version
				break
			}
		}
		if target == "" {
			return "", fmt.Errorf("no previous version available to roll back %s: %w",
				courseID, study.ErrInvalid)
		}
	}
	if err := ActivateCourseVersion(ctx, db, courseID, target); err != nil {
		return "", err
	}
	return target, nil
}
