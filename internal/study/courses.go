package study

import (
	"context"
	"database/sql"
	"encoding/json"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage/storedb"
)

type CourseSummary struct {
	ID             string              `json:"id"`
	Version        string              `json:"version"`
	Title          string              `json:"title"`
	Language       string              `json:"language"`
	Description    string              `json:"description,omitempty"`
	Logo           string              `json:"logo,omitempty"`
	VocabularyFile string              `json:"vocabulary_file,omitempty"`
	Legacy         bool                `json:"legacy"`
	Units          []CourseUnitSummary `json:"units"`
	// ConceptCount lets the workspace offer learning paths only for courses
	// that declare a concept graph.
	ConceptCount int `json:"concept_count"`
}

type CourseUnitSummary struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	HasPractice bool   `json:"has_practice"`
	SubjectID   int64  `json:"subject_id"`
}

func (s *Service) Courses(ctx context.Context) ([]CourseSummary, error) {
	rows, err := s.queries.ListActiveCourses(ctx)
	if err != nil {
		return nil, err
	}
	result := make([]CourseSummary, 0, len(rows))
	for _, row := range rows {
		var manifest course.Manifest
		if err := json.Unmarshal([]byte(row.ManifestJson), &manifest); err != nil {
			return nil, err
		}
		value := CourseSummary{ID: manifest.ID, Version: manifest.Version, Title: manifest.Title,
			Language: manifest.Language, Description: manifest.Description, Logo: manifest.Logo,
			VocabularyFile: manifest.VocabularyFile, Legacy: false,
			Units: make([]CourseUnitSummary, 0, len(manifest.Units)),
		}
		index, err := s.queries.ListWorkspaceUnits(ctx, manifest.ID)
		if err != nil {
			return nil, err
		}
		unitIDs := make(map[string]int64, len(index))
		for _, row := range index {
			unitIDs[row.UnitID] = row.ID
		}
		for _, unit := range manifest.Units {
			value.Units = append(value.Units, CourseUnitSummary{ID: unit.ID, Title: unit.Title,
				HasPractice: unit.QuestionFile != "", SubjectID: unitIDs[unit.ID]})
			value.ConceptCount += len(unit.Concepts)
		}
		result = append(result, value)
	}
	return result, nil
}

func (s *Service) CourseAsset(ctx context.Context, id, version, filename string) ([]byte, error) {
	if !course.IsAssetPath(filename) {
		return nil, sql.ErrNoRows
	}
	return s.queries.GetCourseAsset(ctx, storedb.GetCourseAssetParams{
		CourseID: id, Version: version, Path: filename,
	})
}

func (s *Service) QuestionTranscript(ctx context.Context, q Question) (string, error) {
	h, ok := TypeHandlerFor(q.QuestionType)
	if !ok || h.TranscriptText == nil {
		return "", nil
	}
	return h.TranscriptText(ctx, s, q)
}
