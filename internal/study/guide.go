package study

import (
	"context"
	"encoding/json"
	"strings"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage/storedb"
)

func (s *Service) Guide(ctx context.Context, subject int64) (course.CourseGuide, error) {
	unit, err := s.WorkspaceUnit(ctx, subject)
	if err != nil {
		return course.CourseGuide{}, err
	}
	version, err := s.queries.GetActiveCourse(ctx, unit.CourseID)
	if err != nil {
		return course.CourseGuide{}, err
	}
	var manifest course.Manifest
	if err := json.Unmarshal([]byte(version.ManifestJson), &manifest); err != nil {
		return course.CourseGuide{}, err
	}
	index, err := s.queries.ListWorkspaceUnits(ctx, unit.CourseID)
	if err != nil {
		return course.CourseGuide{}, err
	}
	keys := make(map[string]int64, len(index))
	for _, item := range index {
		keys[item.UnitID] = item.ID
	}
	guide := course.CourseGuide{
		Sources:      []course.CourseGuideSource{},
		HourNotes:    []string{},
		BookingNotes: []string{},
		TotalHours:   map[string]int{},
	}
	for _, item := range manifest.Units {
		stage, err := s.guideUnit(ctx, manifest, item, keys[item.ID])
		if err != nil {
			return course.CourseGuide{}, err
		}
		guide.Stages = append(guide.Stages, stage)
	}
	return guide, nil
}

func (s *Service) guideUnit(
	ctx context.Context, manifest course.Manifest, unit course.Unit, key int64,
) (course.CourseGuideStage, error) {
	stage := course.CourseGuideStage{
		ID:            key,
		Title:         unit.Title,
		Official:      manifest.Description,
		Format:        "本地练习与模拟考试",
		Hours:         map[string]int{},
		Refs:          []string{},
		Exam:          []string{"模拟考试从本单元题库抽题。"},
		Prerequisites: map[string][]string{"default": {"可直接开始学习。"}},
	}
	if unit.QuestionFile == "" {
		stage.Format = "按课程资料练习"
		stage.Exam = []string{}
	}
	for _, lesson := range unit.Lessons {
		markdown, err := s.queries.GetCourseLesson(ctx, storedb.GetCourseLessonParams{
			CourseID: manifest.ID, Version: manifest.Version, UnitID: unit.ID, LessonID: lesson.ID,
		})
		if err != nil {
			return stage, err
		}
		stage.Learning = append(stage.Learning, strings.TrimSpace(markdown))
	}
	if len(stage.Learning) == 0 {
		stage.Learning = []string{"从背题模式阅读题目和解析，然后在答题模式检查掌握情况。"}
	}
	return stage, nil
}
