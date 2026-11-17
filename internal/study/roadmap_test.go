package study_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"reflect"
	"testing"

	"test-driven-study/internal/storage"
	"test-driven-study/internal/study"
)

func (h *conceptHarness) roadmapCourse(id string) study.RoadmapCourse {
	h.t.Helper()
	roadmap, err := h.service.Roadmap(context.Background())
	if err != nil {
		h.t.Fatal(err)
	}
	for _, value := range roadmap.Courses {
		if value.ID == id {
			return value
		}
	}
	h.t.Fatalf("course %s is not on the roadmap", id)
	return study.RoadmapCourse{}
}

func (h *conceptHarness) markCompleted(id string, completed bool) {
	h.t.Helper()
	if _, err := h.service.SetCourseCompleted(context.Background(), id, completed); err != nil {
		h.t.Fatal(err)
	}
}

// completeCourse sets or clears completion through the course's own source:
// every concept marked known for a course with concepts, the course mark
// otherwise.
func (h *conceptHarness) completeCourse(id string, completed bool) {
	h.t.Helper()
	ctx := context.Background()
	graph, err := h.service.Concepts(ctx, id)
	if err != nil {
		h.t.Fatal(err)
	}
	if len(graph.Concepts) == 0 {
		h.markCompleted(id, completed)
		return
	}
	for _, concept := range graph.Concepts {
		if _, err := h.service.SetConceptKnown(ctx, id, concept.ID, completed); err != nil {
			h.t.Fatal(err)
		}
	}
}

func (h *conceptHarness) expectCourse(id, state string, met bool) study.RoadmapCourse {
	h.t.Helper()
	value := h.roadmapCourse(id)
	if value.State != state || value.PrerequisitesMet != met {
		h.t.Fatalf("%s: got %s met=%v, want %s met=%v", id, value.State,
			value.PrerequisitesMet, state, met)
	}
	return value
}

// installProbe installs a copy of the Python course under another ID with the
// given version and roadmap.
func (h *conceptHarness) installProbe(version string, roadmap map[string]any) {
	h.t.Helper()
	target := filepath.Join(h.t.TempDir(), "roadmap-probe")
	source := filepath.Join(h.root, "courses", "python-programming")
	if err := os.CopyFS(target, os.DirFS(source)); err != nil {
		h.t.Fatal(err)
	}
	filename := filepath.Join(target, "course.json")
	data, err := os.ReadFile(filename)
	var manifest map[string]any
	if err == nil {
		err = json.Unmarshal(data, &manifest)
	}
	if err != nil {
		h.t.Fatal(err)
	}
	manifest["course_id"], manifest["title"] = "roadmap-probe", "路线探针"
	manifest["version"], manifest["roadmap"] = version, roadmap
	if data, err = json.Marshal(manifest); err == nil {
		err = os.WriteFile(filename, data, 0o644)
	}
	if err == nil {
		_, err = storage.InstallCourse(context.Background(), h.db, target)
	}
	if err != nil {
		h.t.Fatal(err)
	}
}

func TestRoadmapStatesFollowCompletion(t *testing.T) {
	h := newConceptHarness(t)
	ctx := context.Background()
	embedded := h.expectCourse("embedded-mcu", study.CourseWaiting, false)
	want := []study.RoadmapGroup{{AllOf: []string{"circuit-fundamentals", "c-programming"},
		Strength: "required"}}
	if !reflect.DeepEqual(embedded.Prerequisites, want) || embedded.Note == "" {
		t.Fatalf("embedded-mcu relations: %+v", embedded)
	}
	h.expectCourse("circuit-fundamentals", study.CourseReady, true)
	h.completeCourse("circuit-fundamentals", true)
	h.expectCourse("embedded-mcu", study.CourseWaiting, false)
	h.completeCourse("c-programming", true)
	h.expectCourse("embedded-mcu", study.CourseReady, true)
	if value := h.expectCourse("c-programming", study.CourseCompleted, true); value.MarkedCompleted {
		t.Fatalf("a concept course reports a mark: %+v", value)
	}
	h.completeCourse("c-programming", false)
	h.expectCourse("embedded-mcu", study.CourseWaiting, false)
	// Recommended groups decide readiness the same way.
	h.expectCourse("pcb-design", study.CourseWaiting, false)
	h.completeCourse("embedded-mcu", true)
	h.expectCourse("pcb-design", study.CourseReady, true)
	// A course without concepts completes through its mark.
	h.markCompleted("basic-math", true)
	if value := h.expectCourse("basic-math", study.CourseCompleted, true); !value.MarkedCompleted {
		t.Fatalf("mark not reported: %+v", value)
	}

	for id, partner := range map[string]string{"probability-statistics": "engineering-calculus",
		"engineering-calculus": "probability-statistics", "cad-fdm-printing": "tolerances-metrology",
		"tolerances-metrology": "cad-fdm-printing"} {
		if value := h.roadmapCourse(id); !reflect.DeepEqual(value.ParallelWith, []string{partner}) {
			t.Fatalf("%s parallel: %v", id, value.ParallelWith)
		}
	}

	// A course with concepts completes through its concept states only.
	h.expectCourse(conceptCourse, study.CourseReady, true)
	_, err := h.service.SetCourseCompleted(ctx, conceptCourse, true)
	if !errors.Is(err, study.ErrInvalid) || err.Error() != "该课程按知识点进度判断是否学完" {
		t.Fatalf("concept course mark: %v", err)
	}
	_, err = h.service.SetCourseCompleted(ctx, "missing-course", true)
	if !errors.Is(err, study.ErrNotFound) || err.Error() != "课程不存在" {
		t.Fatalf("unknown course: %v", err)
	}
	graph, err := h.service.Concepts(ctx, conceptCourse)
	if err != nil {
		t.Fatal(err)
	}
	for index, concept := range graph.Concepts {
		if _, err := h.service.SetConceptKnown(ctx, conceptCourse, concept.ID, true); err != nil {
			t.Fatal(err)
		}
		state := study.CourseInProgress
		if index == len(graph.Concepts)-1 {
			state = study.CourseCompleted
		}
		if value := h.expectCourse(conceptCourse, state, true); value.SatisfiedConcepts != index+1 ||
			value.ConceptCount != len(graph.Concepts) {
			t.Fatalf("concept progress: %+v", value)
		}
	}
}

func TestRoadmapReportsMissingCourses(t *testing.T) {
	h := newConceptHarness(t)
	h.installProbe("1.0.0", map[string]any{"note": "先学 Python 与传感器。",
		"prerequisites": []any{map[string]any{"all_of": []any{"python-programming",
			"sensor-basics"}, "strength": "required"}},
		"parallel_with": []any{"lab-safety", "linear-algebra"}})
	probe := h.expectCourse("roadmap-probe", study.CourseWaiting, false)
	if !reflect.DeepEqual(probe.Missing, []string{"sensor-basics", "lab-safety"}) ||
		!reflect.DeepEqual(probe.ParallelWith, []string{"linear-algebra"}) {
		t.Fatalf("missing courses: %+v", probe)
	}
	// A missing course cannot be completed here, so readiness ignores it.
	h.completeCourse("python-programming", true)
	h.expectCourse("roadmap-probe", study.CourseReady, true)
	h.completeCourse("python-programming", false)
	h.installProbe("1.0.1", map[string]any{"note": "先学传感器。", "prerequisites": []any{
		map[string]any{"all_of": []any{"sensor-basics"}, "strength": "required"}}})
	h.expectCourse("roadmap-probe", study.CourseReady, true)
	path, err := h.service.CreateRoadmapPath(context.Background(),
		study.RoadmapPathRequest{Targets: []string{"roadmap-probe"}})
	if err != nil || len(path.Steps) != 1 || len(path.Steps[0].Group) != 0 ||
		path.Steps[0].Strength != "required" || path.NextCourse != "roadmap-probe" {
		t.Fatalf("route with a missing prerequisite: %+v, %v", path, err)
	}
}

func roadmapStepIDs(path *study.RoadmapPath) []string {
	ids := make([]string, 0, len(path.Steps))
	for _, step := range path.Steps {
		ids = append(ids, step.CourseID)
	}
	return ids
}

func (h *conceptHarness) readRoadmapPath() *study.RoadmapPath {
	h.t.Helper()
	view, err := h.service.RoadmapPath(context.Background())
	if err != nil || view.Path == nil {
		h.t.Fatalf("read route: %+v, %v", view, err)
	}
	return view.Path
}

func TestRoadmapPathLifecycle(t *testing.T) {
	h := newConceptHarness(t)
	ctx := context.Background()
	if view, err := h.service.RoadmapPath(ctx); err != nil || view.Path != nil {
		t.Fatalf("no route yet: %+v, %v", view, err)
	}
	created, err := h.service.CreateRoadmapPath(ctx,
		study.RoadmapPathRequest{Targets: []string{"pcb-design"}})
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"c-programming", "circuit-fundamentals", "embedded-mcu", "pcb-design"}
	last := created.Steps[3]
	if got := roadmapStepIDs(&created); !reflect.DeepEqual(got, want) ||
		created.Steps[2].Strength != "required" || last.Strength != "recommended" ||
		!reflect.DeepEqual(last.Group, []string{"circuit-fundamentals", "embedded-mcu"}) ||
		created.NextCourse != "c-programming" || created.RemainingSteps != 4 {
		t.Fatalf("route: %+v", created)
	}
	// Completing a later course out of order makes a shorter route available.
	h.completeCourse("embedded-mcu", true)
	path := h.readRoadmapPath()
	if path.CompletedSteps != 1 || !path.Steps[2].Done || path.NextCourse != "c-programming" ||
		!path.ReplanSuggested || path.Stale {
		t.Fatalf("replan suggestion: %+v", path)
	}
	h.expectRoadmapSurvivesRestart(path)
	replanned, err := h.service.CreateRoadmapPath(ctx,
		study.RoadmapPathRequest{Targets: []string{"pcb-design"}})
	if err != nil || !reflect.DeepEqual(roadmapStepIDs(&replanned),
		[]string{"circuit-fundamentals", "pcb-design"}) || replanned.ID == path.ID {
		t.Fatalf("replanned route: %+v, %v", replanned, err)
	}
	var archived int
	err = h.db.QueryRow(`SELECT COUNT(*) FROM course_roadmaps
		WHERE archived_at_ms IS NOT NULL`).Scan(&archived)
	if err != nil || archived != 1 {
		t.Fatalf("archived routes: %d, %v", archived, err)
	}
	h.completeCourse("circuit-fundamentals", true)
	if path = h.readRoadmapPath(); path.CompletedSteps != 1 || path.NextCourse != "pcb-design" ||
		path.ReplanSuggested {
		t.Fatalf("progress: %+v", path)
	}
	h.completeCourse("pcb-design", true)
	if path = h.readRoadmapPath(); !path.Completed || path.RemainingSteps != 0 ||
		path.NextCourse != "" {
		t.Fatalf("completed route: %+v", path)
	}
	h.installProbe("1.0.0", map[string]any{"note": "并行。",
		"parallel_with": []any{"pcb-design"}})
	if path = h.readRoadmapPath(); !path.Stale {
		t.Fatalf("a newly installed course changes the relation digest: %+v", path)
	}
}

func (h *conceptHarness) expectRoadmapSurvivesRestart(before *study.RoadmapPath) {
	h.t.Helper()
	h.db.Close()
	db, err := storage.Open(context.Background(), h.root, h.data)
	if err != nil {
		h.t.Fatal(err)
	}
	h.t.Cleanup(func() { db.Close() })
	h.db, h.service = db, study.New(db, h.root)
	if after := h.readRoadmapPath(); after.ID != before.ID ||
		!reflect.DeepEqual(after.Steps, before.Steps) {
		h.t.Fatalf("route changed across restart: %+v / %+v", before, after)
	}
	_, err = db.Exec(`UPDATE course_roadmaps SET steps_json = json_insert(steps_json, '$[#]',
		json('{"course_id":"retired-course","title":"旧课程","group":[]}'))
		WHERE archived_at_ms IS NULL`)
	if err != nil {
		h.t.Fatal(err)
	}
	after := h.readRoadmapPath()
	removed := after.Steps[len(after.Steps)-1]
	if !removed.Missing || removed.State != "missing" ||
		after.RemainingSteps != before.RemainingSteps {
		h.t.Fatalf("a course that is no longer installed is excluded: %+v", after)
	}
}

func TestRoadmapPathRejectsInvalidRequests(t *testing.T) {
	h := newConceptHarness(t)
	ctx := context.Background()
	many := make([]string, 17)
	for index := range many {
		many[index] = fmt.Sprintf("course-%d", index)
	}
	cases := []struct {
		targets []string
		kind    error
		message string
	}{
		{many, study.ErrInvalid, "学习目标最多选择 16 门课程"},
		{[]string{"pcb-design", "pcb-design"}, study.ErrInvalid, "学习目标包含重复的课程"},
		{[]string{"missing-course"}, study.ErrNotFound, "课程不存在"},
	}
	for _, test := range cases {
		_, err := h.service.CreateRoadmapPath(ctx, study.RoadmapPathRequest{Targets: test.targets})
		if !errors.Is(err, test.kind) || err.Error() != test.message {
			t.Errorf("%v: got %v, want %s", test.targets, err, test.message)
		}
	}
	all, err := h.service.CreateRoadmapPath(ctx, study.RoadmapPathRequest{})
	roadmap, readErr := h.service.Roadmap(ctx)
	if err != nil || readErr != nil || len(all.Steps) != len(roadmap.Courses) ||
		len(all.Targets) != 0 {
		t.Fatalf("whole roadmap: %d steps for %d courses, %v %v", len(all.Steps),
			len(roadmap.Courses), err, readErr)
	}
}
