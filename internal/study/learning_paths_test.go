package study_test

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"path/filepath"
	"reflect"
	"testing"

	"test-driven-study/internal/storage"
	"test-driven-study/internal/storage/storedb"
	"test-driven-study/internal/study"
)

const conceptCourse = "concept-graph"

type conceptHarness struct {
	t        *testing.T
	service  *study.Service
	db       *sql.DB
	root     string
	data     string
	sequence int
}

func newConceptHarness(t *testing.T) *conceptHarness {
	t.Helper()
	service, db, root, data := practiceDB(t)
	for _, id := range []string{
		conceptCourse, "basic-math", "roadmap-a", "roadmap-b", "roadmap-p",
		"roadmap-mid", "roadmap-top", "roadmap-after-math",
	} {
		fixture := filepath.Join(root, "tests", "fixtures", "courses", id)
		if _, err := storage.InstallCourse(context.Background(), db, fixture); err != nil {
			t.Fatal(err)
		}
	}
	return &conceptHarness{t: t, service: service, db: db, root: root, data: data}
}

// answer submits a numeric response to a fixture item through practice.
func (h *conceptHarness) answer(item, value string) {
	h.t.Helper()
	ctx := context.Background()
	question, err := storedb.New(h.db).GetWorkspaceQuestionID(ctx,
		storedb.GetWorkspaceQuestionIDParams{CourseID: conceptCourse, ItemID: item})
	if err != nil {
		h.t.Fatal(err)
	}
	h.sequence++
	id := fmt.Sprintf("concept-presentation-%04d", h.sequence)
	if _, err := h.service.OpenPresentation(ctx, id, question); err != nil {
		h.t.Fatal(err)
	}
	if _, err := h.service.SubmitResponse(ctx, id, study.AnswerInput{Numeric: &value}); err != nil {
		h.t.Fatal(err)
	}
}

func (h *conceptHarness) states() map[string]study.ConceptStatus {
	h.t.Helper()
	graph, err := h.service.Concepts(context.Background(), conceptCourse)
	if err != nil {
		h.t.Fatal(err)
	}
	result := make(map[string]study.ConceptStatus)
	for _, concept := range graph.Concepts {
		result[concept.ID] = concept
	}
	return result
}

func (h *conceptHarness) expectState(id, state string, unlocked bool) {
	h.t.Helper()
	if got := h.states()[id]; got.State != state || got.Unlocked != unlocked {
		h.t.Fatalf("%s: got %s unlocked=%v, want %s unlocked=%v (%+v)",
			id, got.State, got.Unlocked, state, unlocked, got)
	}
}

func TestConceptStatesFollowEvidenceAndMarks(t *testing.T) {
	h := newConceptHarness(t)
	initial := h.states()
	if initial["counting"].ItemCount != 3 || initial["explain-aloud"].ItemCount != 0 ||
		initial["counting"].RequiredCorrect != 3 || initial["counting"].SubjectID == 0 {
		t.Fatalf("unexpected evidence: %+v", initial["counting"])
	}
	h.expectState("counting", study.ConceptReady, true)
	h.expectState("addition", study.ConceptLocked, false)
	h.answer("counting-1", "3")
	h.answer("counting-2", "4")
	h.expectState("counting", study.ConceptLearning, true)
	h.answer("counting-3", "2")
	h.expectState("counting", study.ConceptMastered, true)
	h.expectState("addition", study.ConceptReady, true)
	h.answer("counting-1", "9")
	h.expectState("counting", study.ConceptLearning, true)
	h.expectState("addition", study.ConceptLocked, false)

	ctx := context.Background()
	if _, err := h.service.SetConceptKnown(ctx, conceptCourse, "word-problems", true); err != nil {
		t.Fatal(err)
	}
	h.expectState("word-problems", study.ConceptKnown, false)
	h.expectState("explain-aloud", study.ConceptReady, true)
	h.answer("word-problems-1", "4")
	if got := h.states()["word-problems"]; got.State != study.ConceptLearning || !got.Known {
		t.Fatalf("a wrong answer should override the mark: %+v", got)
	}
	h.expectState("explain-aloud", study.ConceptLocked, false)
	if _, err := h.service.SetConceptKnown(ctx, conceptCourse, "word-problems", false); err != nil {
		t.Fatal(err)
	}
	if h.states()["word-problems"].Known {
		t.Fatal("cleared mark is still reported")
	}
	_, err := h.service.SetConceptKnown(ctx, conceptCourse, "missing", true)
	if !errors.Is(err, study.ErrNotFound) || err.Error() != "知识点不存在" {
		t.Fatalf("unknown concept: %v", err)
	}
	if _, err := h.service.Concepts(ctx, "missing-course"); !errors.Is(err, study.ErrNotFound) {
		t.Fatalf("unknown course: %v", err)
	}
}

func stepIDs(path *study.LearningPath) []string {
	ids := make([]string, 0, len(path.Steps))
	for _, step := range path.Steps {
		ids = append(ids, step.ConceptID)
	}
	return ids
}

func TestLearningPathLifecycle(t *testing.T) {
	h := newConceptHarness(t)
	ctx := context.Background()
	whole, err := h.service.CreateLearningPath(ctx, conceptCourse,
		study.LearningPathRequest{DailyMinutes: 30})
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"counting", "addition", "subtraction", "word-problems", "estimation",
		"explain-aloud"}
	if got := stepIDs(&whole); !reflect.DeepEqual(got, want) || whole.TotalMinutes != 100 ||
		whole.EstimatedDays != 4 || whole.NextConcept != "counting" || whole.Completed {
		t.Fatalf("whole-course path: %v %+v", got, whole)
	}
	if !reflect.DeepEqual(whole.Steps[3].Group, []string{"addition"}) {
		t.Fatalf("tied alternatives should keep author order: %v", whole.Steps[3].Group)
	}
	path, err := h.service.CreateLearningPath(ctx, conceptCourse,
		study.LearningPathRequest{Targets: []string{"word-problems"}, DailyMinutes: 20})
	if err != nil || !reflect.DeepEqual(stepIDs(&path), []string{"counting", "addition",
		"word-problems"}) {
		t.Fatalf("targeted path: %v, %v", stepIDs(&path), err)
	}
	var archived int
	h.db.QueryRow("SELECT count(*) FROM learning_paths WHERE archived_at_ms IS NOT NULL").
		Scan(&archived)
	if archived != 1 {
		t.Fatalf("replanning should archive one path, got %d", archived)
	}
	for _, item := range []string{"counting-1", "counting-2", "counting-3"} {
		h.answer(item, map[string]string{"counting-1": "3", "counting-2": "4", "counting-3": "2"}[item])
	}
	view := h.readPath()
	if view.MasteredSteps != 1 || view.NextConcept != "addition" || view.ReplanSuggested ||
		view.Stale || view.RemainingMinutes != 45 || view.EstimatedDays != 3 {
		t.Fatalf("progress after mastering counting: %+v", view)
	}
	if _, err := h.service.SetConceptKnown(ctx, conceptCourse, "subtraction", true); err != nil {
		t.Fatal(err)
	}
	if view = h.readPath(); !view.ReplanSuggested {
		t.Fatalf("a satisfied alternative should suggest replanning: %+v", view)
	}
	h.expectPathSurvivesRestartAndFlagsChanges(view)
}

func (h *conceptHarness) readPath() *study.LearningPath {
	h.t.Helper()
	view, err := h.service.LearningPath(context.Background(), conceptCourse)
	if err != nil || view.Path == nil {
		h.t.Fatalf("read path: %+v, %v", view, err)
	}
	return view.Path
}

func (h *conceptHarness) expectPathSurvivesRestartAndFlagsChanges(before *study.LearningPath) {
	h.t.Helper()
	h.db.Close()
	db, err := storage.Open(context.Background(), h.root, h.data)
	if err != nil {
		h.t.Fatal(err)
	}
	h.t.Cleanup(func() { db.Close() })
	h.db, h.service = db, study.New(db, h.root)
	if after := h.readPath(); after.ID != before.ID || !reflect.DeepEqual(after.Steps, before.Steps) {
		h.t.Fatalf("path changed across restart: %+v / %+v", before, after)
	}
	_, err = db.Exec(`UPDATE learning_paths SET graph_digest = 'old',
		steps_json = json_insert(steps_json, '$[#]', json('{"concept_id":"removed",
		"title":"旧知识点","unit_id":"basics","estimated_minutes":50,"group":[]}'))
		WHERE archived_at_ms IS NULL`)
	if err != nil {
		h.t.Fatal(err)
	}
	after := h.readPath()
	last := after.Steps[len(after.Steps)-1]
	if !after.Stale || !last.Missing || last.State != "missing" ||
		after.RemainingMinutes != before.RemainingMinutes {
		h.t.Fatalf("changed graph should mark the path stale and skip missing steps: %+v", after)
	}
}

func TestLearningPathRejectsInvalidRequests(t *testing.T) {
	h := newConceptHarness(t)
	ctx := context.Background()
	many := make([]string, 17)
	for index := range many {
		many[index] = fmt.Sprintf("target-%d", index)
	}
	cases := []struct {
		course  string
		request study.LearningPathRequest
		kind    error
		message string
	}{
		{conceptCourse, study.LearningPathRequest{Targets: many, DailyMinutes: 30},
			study.ErrInvalid, "学习目标最多选择 16 个知识点"},
		{conceptCourse, study.LearningPathRequest{DailyMinutes: 5},
			study.ErrInvalid, "每天学习时间需在 10–480 分钟之间"},
		{conceptCourse, study.LearningPathRequest{Targets: []string{"addition", "addition"},
			DailyMinutes: 30}, study.ErrInvalid, "学习目标包含重复的知识点"},
		{conceptCourse, study.LearningPathRequest{Targets: []string{"missing"}, DailyMinutes: 30},
			study.ErrNotFound, "知识点不存在"},
		{"missing-course", study.LearningPathRequest{DailyMinutes: 30},
			study.ErrNotFound, "课程不存在"},
		{"elementary-chinese", study.LearningPathRequest{DailyMinutes: 30},
			study.ErrInvalid, "该课程尚未定义知识点"},
	}
	for _, test := range cases {
		_, err := h.service.CreateLearningPath(ctx, test.course, test.request)
		if !errors.Is(err, test.kind) || err.Error() != test.message {
			t.Errorf("%s %+v: got %v, want %s", test.course, test.request, err, test.message)
		}
	}
	if view, err := h.service.LearningPath(ctx, "elementary-chinese"); err != nil || view.Path != nil {
		t.Fatalf("course without concepts: %+v, %v", view, err)
	}
}
