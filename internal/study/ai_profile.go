package study

import (
	"context"
	"encoding/json"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage/storedb"
)

func (s *Service) QuestionAIProfile(ctx context.Context, q Question) (course.AIProfile,
	*course.AIProfileVersion, error) {
	var version storedb.CourseVersion
	var err error
	if q.PackageID == "" {
		return course.AIProfile{}, nil, nil
	}
	version, err = s.queries.GetCourseVersion(ctx, storedb.GetCourseVersionParams{
		CourseID: q.PackageID, Version: q.PackageVersion,
	})
	if err != nil {
		return course.AIProfile{}, nil, err
	}
	profile, err := s.loadAIProfile(ctx, version)
	if err != nil {
		return course.AIProfile{}, nil, err
	}
	return profile, &course.AIProfileVersion{
		CourseID: version.CourseID, CourseVersion: version.Version,
	}, nil
}

func (s *Service) PalacePrompts(ctx context.Context,
	ref course.AIProfileVersion) (course.PalacePrompts, error) {
	version, err := s.queries.GetCourseVersion(ctx, storedb.GetCourseVersionParams{
		CourseID: ref.CourseID, Version: ref.CourseVersion,
	})
	if err != nil {
		return course.PalacePrompts{}, err
	}
	profile, err := s.loadAIProfile(ctx, version)
	return profile.Prompts, err
}

func (s *Service) loadAIProfile(ctx context.Context,
	version storedb.CourseVersion) (course.AIProfile, error) {
	var manifest course.Manifest
	if err := json.Unmarshal([]byte(version.ManifestJson), &manifest); err != nil {
		return course.AIProfile{}, err
	}
	return course.LoadAIProfile(manifest.AIProfile, func(path string) ([]byte, error) {
		return s.queries.GetCourseAsset(ctx, storedb.GetCourseAssetParams{
			CourseID: version.CourseID, Version: version.Version, Path: path,
		})
	})
}
