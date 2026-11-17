package study

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"slices"
	"time"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage/storedb"
)

// Course states on the roadmap. They are advisory: every state can open the
// course. See docs/features/course-roadmap/README.md.
const (
	CourseCompleted  = "completed"
	CourseInProgress = "in_progress"
	CourseReady      = "ready"
	CourseWaiting    = "waiting"
)

type CourseRoadmap struct {
	Courses []RoadmapCourse `json:"courses"`
}

type RoadmapGroup struct {
	AllOf    []string `json:"all_of"`
	Strength string   `json:"strength"`
}

type RoadmapCourse struct {
	ID      string `json:"id"`
	Title   string `json:"title"`
	Version string `json:"version"`
	// Note quotes the README sentence that states the course's relations.
	Note          string         `json:"note,omitempty"`
	Prerequisites []RoadmapGroup `json:"prerequisites"`
	// ParallelWith is symmetric: it lists courses this course declares and
	// courses that declare this one.
	ParallelWith []string `json:"parallel_with"`
	// Missing lists referenced courses that are not installed.
	Missing           []string `json:"missing"`
	ConceptCount      int      `json:"concept_count"`
	SatisfiedConcepts int      `json:"satisfied_concepts"`
	// MarkedCompleted reports the stored mark; it decides completion only for
	// a course without concepts.
	MarkedCompleted  bool   `json:"marked_completed"`
	Completed        bool   `json:"completed"`
	PrerequisitesMet bool   `json:"prerequisites_met"`
	State            string `json:"state"`
}

// roadmapGraph is the active courses' relations with live completion, in
// catalog order (course ID).
type roadmapGraph struct {
	manifests []course.Manifest
	courses   []RoadmapCourse
	// groups holds each course's prerequisite groups without missing courses.
	groups map[string][][]string
}

func (s *Service) Roadmap(ctx context.Context) (CourseRoadmap, error) {
	loaded, err := s.loadRoadmap(ctx, s.queries)
	return CourseRoadmap{Courses: loaded.courses}, err
}

// SetCourseCompleted sets or clears the completion mark of a course without
// concepts. A course with concepts completes through its concept states.
func (s *Service) SetCourseCompleted(
	ctx context.Context, courseID string, completed bool,
) (CourseRoadmap, error) {
	loaded, err := s.loadRoadmap(ctx, s.queries)
	if err != nil {
		return CourseRoadmap{}, err
	}
	status, exists := loaded.course(courseID)
	if !exists {
		return CourseRoadmap{}, notFound("课程不存在")
	}
	if status.ConceptCount > 0 {
		return CourseRoadmap{}, invalid("该课程按知识点进度判断是否学完")
	}
	if completed {
		err = s.queries.MarkCourseCompleted(ctx, storedb.MarkCourseCompletedParams{
			CourseID: courseID, MarkedAtMs: time.Now().UTC().UnixMilli(),
		})
	} else {
		err = s.queries.ClearCourseCompleted(ctx, courseID)
	}
	if err != nil {
		return CourseRoadmap{}, err
	}
	return s.Roadmap(ctx)
}

func (s *Service) loadRoadmap(ctx context.Context, q *storedb.Queries) (roadmapGraph, error) {
	rows, err := q.ListActiveCourses(ctx)
	if err != nil {
		return roadmapGraph{}, err
	}
	loaded := roadmapGraph{courses: []RoadmapCourse{}, groups: map[string][][]string{}}
	for _, row := range rows {
		var manifest course.Manifest
		if err := json.Unmarshal([]byte(row.ManifestJson), &manifest); err != nil {
			return roadmapGraph{}, err
		}
		loaded.manifests = append(loaded.manifests, manifest)
	}
	marks, err := q.ListCourseMarks(ctx)
	if err != nil {
		return roadmapGraph{}, err
	}
	completion := make(map[string]RoadmapCourse, len(loaded.manifests))
	for _, manifest := range loaded.manifests {
		status, err := courseCompletion(ctx, q, manifest, slices.Contains(marks, manifest.ID))
		if err != nil {
			return roadmapGraph{}, err
		}
		completion[manifest.ID] = status
	}
	loaded.relate(completion)
	return loaded, nil
}

// courseCompletion decides completion from the course's concepts when it has
// any, otherwise from the learner's mark. It also reports concept progress.
func courseCompletion(ctx context.Context, q *storedb.Queries, manifest course.Manifest,
	marked bool) (RoadmapCourse, error) {
	status := RoadmapCourse{ID: manifest.ID, Title: manifest.Title, Version: manifest.Version,
		MarkedCompleted: marked}
	for _, unit := range manifest.Units {
		status.ConceptCount += len(unit.Concepts)
	}
	if status.ConceptCount == 0 {
		status.Completed = marked
		if marked {
			status.State = CourseCompleted
		}
		return status, nil
	}
	graph, err := loadCourseGraph(ctx, q, manifest.ID)
	if err != nil {
		return RoadmapCourse{}, err
	}
	started := false
	for _, concept := range graph.graph.Concepts {
		if conceptSatisfied(concept.State) {
			status.SatisfiedConcepts++
		}
		if concept.State == ConceptLearning || conceptSatisfied(concept.State) {
			started = true
		}
	}
	status.Completed = status.SatisfiedConcepts == status.ConceptCount
	switch {
	case status.Completed:
		status.State = CourseCompleted
	case started:
		status.State = CourseInProgress
	}
	return status, nil
}

// relate adds each course's prerequisites, parallel and missing courses and
// readiness. Completion must be known for every course first.
func (g *roadmapGraph) relate(completion map[string]RoadmapCourse) {
	satisfied := make(map[string]bool, len(completion))
	for id, status := range completion {
		satisfied[id] = status.Completed
	}
	for _, manifest := range g.manifests {
		status := completion[manifest.ID]
		var installed [][]string
		status.Prerequisites, installed, status.Missing = prerequisiteGroups(manifest, completion)
		if manifest.Roadmap != nil {
			status.Note = manifest.Roadmap.Note
		}
		status.ParallelWith, status.Missing = g.parallel(manifest, completion, status.Missing)
		g.groups[manifest.ID] = installed
		// A group whose members are all missing is empty and therefore met.
		status.PrerequisitesMet = groupsSatisfied(installed, satisfied)
		if status.State == "" {
			status.State = CourseWaiting
			if status.PrerequisitesMet {
				status.State = CourseReady
			}
		}
		g.courses = append(g.courses, status)
	}
}

// prerequisiteGroups returns the declared groups, the same groups without
// courses that are not installed, and those missing courses in first-use order.
func prerequisiteGroups(manifest course.Manifest, completion map[string]RoadmapCourse) (
	declared []RoadmapGroup, installed [][]string, missing []string) {
	declared, missing = []RoadmapGroup{}, []string{}
	if manifest.Roadmap == nil {
		return declared, nil, missing
	}
	for _, group := range manifest.Roadmap.Prerequisites {
		declared = append(declared, RoadmapGroup{AllOf: slices.Clone(group.AllOf),
			Strength: group.Strength})
		present := []string{}
		for _, member := range group.AllOf {
			if _, exists := completion[member]; exists {
				present = append(present, member)
			} else if !slices.Contains(missing, member) {
				missing = append(missing, member)
			}
		}
		installed = append(installed, present)
	}
	return declared, installed, missing
}

// parallel lists the installed courses declared parallel by or with the
// course, and appends declared parallel courses that are not installed to
// missing.
func (g *roadmapGraph) parallel(manifest course.Manifest,
	completion map[string]RoadmapCourse, missing []string) ([]string, []string) {
	result := []string{}
	if manifest.Roadmap != nil {
		for _, id := range manifest.Roadmap.ParallelWith {
			if _, exists := completion[id]; !exists {
				if !slices.Contains(missing, id) {
					missing = append(missing, id)
				}
				continue
			}
			result = append(result, id)
		}
	}
	for _, other := range g.manifests {
		if other.Roadmap != nil && slices.Contains(other.Roadmap.ParallelWith, manifest.ID) &&
			!slices.Contains(result, other.ID) {
			result = append(result, other.ID)
		}
	}
	return result, missing
}

func (g roadmapGraph) course(id string) (RoadmapCourse, bool) {
	index := slices.IndexFunc(g.courses, func(c RoadmapCourse) bool { return c.ID == id })
	if index < 0 {
		return RoadmapCourse{}, false
	}
	return g.courses[index], true
}

// planInput lists courses in catalog order with zero minutes, because
// packages declare no study time, and groups without missing courses.
func (g roadmapGraph) planInput() ([]PlanConcept, map[string]bool) {
	nodes := make([]PlanConcept, 0, len(g.courses))
	satisfied := make(map[string]bool, len(g.courses))
	for _, status := range g.courses {
		nodes = append(nodes, PlanConcept{ID: status.ID, Groups: g.groups[status.ID]})
		satisfied[status.ID] = status.Completed
	}
	return nodes, satisfied
}

// strength returns the strength of the course's first declared group whose
// installed members equal the planned group, or "" for no group.
func (g roadmapGraph) strength(id string, planned []string) string {
	status, _ := g.course(id)
	for index, members := range g.groups[id] {
		if slices.Equal(members, planned) {
			return status.Prerequisites[index].Strength
		}
	}
	return ""
}

// digest hashes the active course IDs with their prerequisite groups and
// strengths. Content, notes and parallel courses do not affect it.
func (g roadmapGraph) digest() (string, error) {
	type canonical struct {
		ID     string         `json:"id"`
		Groups []RoadmapGroup `json:"groups"`
	}
	list := make([]canonical, 0, len(g.courses))
	for _, status := range g.courses {
		list = append(list, canonical{ID: status.ID, Groups: status.Prerequisites})
	}
	data, err := json.Marshal(list)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:]), nil
}
