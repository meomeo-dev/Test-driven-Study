package study

import (
	"fmt"
	"math/rand/v2"
	"reflect"
	"slices"
	"testing"
)

func concept(id string, minutes int, groups ...[]string) PlanConcept {
	return PlanConcept{ID: id, Minutes: minutes, Groups: groups}
}

func stepIDs(steps []PlanStep) []string {
	ids := make([]string, 0, len(steps))
	for _, step := range steps {
		ids = append(ids, step.ConceptID)
	}
	return ids
}

// The design example: machine learning needs linear algebra and statistics;
// the project needs deep learning and PyTorch.
func aiCurriculum() []PlanConcept {
	return []PlanConcept{
		concept("linear-algebra", 60), concept("statistics", 60), concept("python", 30),
		concept("machine-learning", 90, []string{"linear-algebra", "statistics"}),
		concept("pytorch", 40, []string{"python"}),
		concept("deep-learning", 90, []string{"machine-learning"}),
		concept("project", 120, []string{"deep-learning", "pytorch"}),
	}
}

func TestPlanPathOrdersAndGroupsAndSkipsSatisfied(t *testing.T) {
	steps, err := PlanPath(aiCurriculum(), nil, nil)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{"linear-algebra", "statistics", "python", "machine-learning", "pytorch",
		"deep-learning", "project"}
	if got := stepIDs(steps); !reflect.DeepEqual(got, want) {
		t.Fatalf("order: got %v, want %v", got, want)
	}
	if !reflect.DeepEqual(steps[3].Group, []string{"linear-algebra", "statistics"}) {
		t.Fatalf("machine learning group: %v", steps[3].Group)
	}
	satisfied := map[string]bool{"linear-algebra": true, "statistics": true}
	steps, err = PlanPath(aiCurriculum(), satisfied, []string{"deep-learning"})
	if err != nil || !reflect.DeepEqual(stepIDs(steps), []string{"machine-learning", "deep-learning"}) {
		t.Fatalf("targeted plan with satisfied prerequisites: %v, %v", stepIDs(steps), err)
	}
	steps, err = PlanPath(aiCurriculum(), map[string]bool{"project": true}, []string{"project"})
	if err != nil || len(steps) != 0 {
		t.Fatalf("satisfied target should need no steps: %v, %v", steps, err)
	}
}

func TestPlanPathChoosesAlternatives(t *testing.T) {
	// eligible(course) = (python AND statistics) OR preparatory
	graph := []PlanConcept{
		concept("python", 30), concept("statistics", 30), concept("preparatory", 45),
		concept("course", 60, []string{"python", "statistics"}, []string{"preparatory"}),
	}
	steps, err := PlanPath(graph, nil, []string{"course"})
	if err != nil || !reflect.DeepEqual(stepIDs(steps), []string{"preparatory", "course"}) {
		t.Fatalf("smaller closure should win: %v, %v", stepIDs(steps), err)
	}
	steps, err = PlanPath(graph, map[string]bool{"python": true, "statistics": true}, []string{"course"})
	if err != nil || !reflect.DeepEqual(stepIDs(steps), []string{"course"}) ||
		!reflect.DeepEqual(steps[0].Group, []string{"python", "statistics"}) {
		t.Fatalf("a satisfied group should be chosen: %+v, %v", steps, err)
	}
	tie := []PlanConcept{concept("a", 20), concept("b", 10), concept("c", 5, []string{"a"}, []string{"b"})}
	steps, _ = PlanPath(tie, nil, []string{"c"})
	if !reflect.DeepEqual(stepIDs(steps), []string{"b", "c"}) {
		t.Fatalf("equal sizes should prefer fewer minutes: %v", stepIDs(steps))
	}
	tie[1].Minutes = 20
	steps, _ = PlanPath(tie, nil, []string{"c"})
	if !reflect.DeepEqual(stepIDs(steps), []string{"a", "c"}) {
		t.Fatalf("full ties should keep author order: %v", stepIDs(steps))
	}
}

// M can use C or A. A is in the plan anyway because N needs it, so the
// cheaper-looking alternative C must be pruned.
func TestPlanPathPrunesRedundantAlternatives(t *testing.T) {
	graph := []PlanConcept{
		concept("c", 10), concept("a1", 10), concept("a2", 10, []string{"a1"}),
		concept("a", 10, []string{"a2"}),
		concept("m", 10, []string{"a"}, []string{"c"}), concept("n", 10, []string{"a"}),
		concept("t", 10, []string{"m", "n"}),
	}
	steps, err := PlanPath(graph, nil, []string{"t"})
	if err != nil {
		t.Fatal(err)
	}
	if got := stepIDs(steps); slices.Contains(got, "c") || len(got) != 6 {
		t.Fatalf("redundant alternative kept: %v", got)
	}
	if !reflect.DeepEqual(steps[slices.Index(stepIDs(steps), "m")].Group, []string{"a"}) {
		t.Fatalf("m should switch to group a: %+v", steps)
	}
}

func TestPlanPathRejectsInvalidGraphs(t *testing.T) {
	cycle := []PlanConcept{concept("a", 1, []string{"b"}), concept("b", 1, []string{"a"})}
	if _, err := PlanPath(cycle, nil, nil); err == nil {
		t.Fatal("cycle accepted")
	}
	if _, err := PlanPath(aiCurriculum(), nil, []string{"missing"}); err == nil {
		t.Fatal("unknown target accepted")
	}
}

// Generated DAGs: every step follows its chosen group, each group member is
// planned or satisfied, targets are covered, and repeated runs agree.
func TestPlanPathStepsAreValidOnGeneratedGraphs(t *testing.T) {
	random := rand.New(rand.NewPCG(47, 2026))
	for round := range 300 {
		graph, satisfied := generatedGraph(random, 3+random.IntN(14))
		targets := []string{graph[random.IntN(len(graph))].ID}
		steps, err := PlanPath(graph, satisfied, targets)
		if err != nil {
			t.Fatalf("round %d: %v", round, err)
		}
		again, _ := PlanPath(graph, satisfied, targets)
		if !reflect.DeepEqual(steps, again) {
			t.Fatalf("round %d: nondeterministic plan", round)
		}
		checkSteps(t, round, graph, satisfied, targets, steps)
	}
}

func generatedGraph(random *rand.Rand, size int) ([]PlanConcept, map[string]bool) {
	graph := make([]PlanConcept, size)
	satisfied := make(map[string]bool)
	for position := range size {
		id := fmt.Sprintf("k%02d", position)
		graph[position] = PlanConcept{ID: id, Minutes: 5 + random.IntN(40)}
		for range random.IntN(3) {
			if position == 0 {
				break
			}
			var group []string
			for _, member := range random.Perm(position)[:1+random.IntN(min(3, position))] {
				group = append(group, graph[member].ID)
			}
			graph[position].Groups = append(graph[position].Groups, group)
		}
		satisfied[id] = random.IntN(5) == 0
	}
	return graph, satisfied
}

func checkSteps(t *testing.T, round int, graph []PlanConcept, satisfied map[string]bool,
	targets []string, steps []PlanStep) {
	t.Helper()
	done := make(map[string]bool)
	for id, value := range satisfied {
		done[id] = value
	}
	for _, step := range steps {
		if satisfied[step.ConceptID] || done[step.ConceptID] {
			t.Fatalf("round %d: %s planned twice or although satisfied", round, step.ConceptID)
		}
		for _, member := range step.Group {
			if !done[member] {
				t.Fatalf("round %d: %s precedes its prerequisite %s", round, step.ConceptID, member)
			}
		}
		if step.Group == nil && len(graph[slices.IndexFunc(graph, func(c PlanConcept) bool {
			return c.ID == step.ConceptID
		})].Groups) > 0 {
			t.Fatalf("round %d: %s has prerequisites but no chosen group", round, step.ConceptID)
		}
		done[step.ConceptID] = true
	}
	for _, target := range targets {
		if !done[target] {
			t.Fatalf("round %d: target %s not reached", round, target)
		}
	}
}

// The documented outcome table for concept mastery.
func TestConceptMasteryOutcomes(t *testing.T) {
	cases := []struct {
		items, attempted, correct int
		mastered                  bool
	}{
		{4, 3, 3, true}, {4, 4, 3, true}, {4, 4, 4, true}, {4, 2, 2, false}, {4, 3, 2, false},
		{8, 4, 3, true}, {8, 5, 3, false}, {1, 1, 1, true}, {2, 2, 1, false}, {2, 2, 2, true},
		{0, 0, 0, false},
	}
	for _, test := range cases {
		evidence := conceptEvidence{items: test.items, attempted: test.attempted, correct: test.correct}
		if got := evidence.mastered(); got != test.mastered {
			t.Errorf("%+v: mastered=%v, want %v", test, got, test.mastered)
		}
	}
	known := conceptEvidence{items: 4, attempted: 1, correct: 0}
	if conceptState(known, true, true) != ConceptLearning ||
		conceptState(conceptEvidence{items: 4}, true, false) != ConceptKnown {
		t.Fatal("a wrong latest answer must override a known mark, and only then")
	}
}
