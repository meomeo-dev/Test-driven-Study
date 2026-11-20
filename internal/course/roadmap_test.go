package course

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

// fixtureRelations is the README-backed relation set under
// tests/fixtures/courses/ matching docs/features/course-roadmap/README.md rules.
var fixtureRelations = map[string]Roadmap{
	"roadmap-after-math": {Note: "小数和百分数可先练项目内的《基础数学》。",
		Prerequisites: []CoursePrerequisite{{AllOf: []string{"basic-math"},
			Strength: StrengthRecommended}}},
	"roadmap-b": {Note: "建议与工程并联样例同步练习。",
		ParallelWith: []string{"roadmap-p"}},
	"roadmap-mid": {Note: "先学 C 样例与电路样例。",
		Prerequisites: []CoursePrerequisite{{AllOf: []string{"roadmap-a",
			"roadmap-b"}, Strength: StrengthRequired}}},
	"roadmap-p": {Note: "建议与电路样例同步练习。",
		ParallelWith: []string{"roadmap-b"}},
	"roadmap-top": {Note: "建议先完成电路样例与单片机样例。",
		Prerequisites: []CoursePrerequisite{{AllOf: []string{"roadmap-b",
			"roadmap-mid"}, Strength: StrengthRecommended}}},
}

func TestBundledRoadmapsMatchReadmeEvidence(t *testing.T) {
	bundledEntries, err := os.ReadDir("../../courses")
	if err != nil {
		t.Fatal(err)
	}
	var bundled []Manifest
	for _, entry := range bundledEntries {
		directory := filepath.Join("../../courses", entry.Name())
		if _, err := os.Stat(filepath.Join(directory, ManifestFile)); err != nil {
			continue
		}
		pkg, err := Load(directory)
		if err != nil {
			t.Fatalf("%s: %v", entry.Name(), err)
		}
		bundled = append(bundled, pkg.Manifest)
		if pkg.Manifest.Roadmap != nil {
			t.Fatalf("unexpected bundled roadmap on %s: %+v", pkg.Manifest.ID, pkg.Manifest.Roadmap)
		}
	}
	for _, manifest := range bundled {
		if err := CheckRoadmapCycles(manifest, bundled); err != nil {
			t.Fatalf("bundled courses: %v", err)
		}
	}

	entries, err := os.ReadDir("../../tests/fixtures/courses")
	if err != nil {
		t.Fatal(err)
	}
	found := map[string]Roadmap{}
	var active []Manifest
	for _, entry := range entries {
		directory := filepath.Join("../../tests/fixtures/courses", entry.Name())
		if _, err := os.Stat(filepath.Join(directory, ManifestFile)); err != nil {
			continue
		}
		pkg, err := Load(directory)
		if err != nil {
			t.Fatalf("%s: %v", entry.Name(), err)
		}
		active = append(active, pkg.Manifest)
		if pkg.Manifest.Roadmap == nil {
			continue
		}
		found[pkg.Manifest.ID] = *pkg.Manifest.Roadmap
		// The note must quote the README's 学习起点 section verbatim.
		readme, err := os.ReadFile(filepath.Join(directory, "README.md"))
		if err != nil {
			t.Fatal(err)
		}
		start := strings.Index(string(readme), "## 学习起点")
		end := strings.Index(string(readme), "## 学完能做什么")
		if start < 0 || end < start ||
			!strings.Contains(string(readme)[start:end], pkg.Manifest.Roadmap.Note) {
			t.Errorf("%s: note %q is not in the README 学习起点 section",
				pkg.Manifest.ID, pkg.Manifest.Roadmap.Note)
		}
	}
	if !reflect.DeepEqual(found, fixtureRelations) {
		t.Fatalf("fixture relations differ from expected:\n got %+v\nwant %+v",
			found, fixtureRelations)
	}
	for _, manifest := range active {
		if err := CheckRoadmapCycles(manifest, active); err != nil {
			t.Fatalf("fixture courses: %v", err)
		}
	}
}

func TestAbsentRoadmapIsNotSerialized(t *testing.T) {
	pkg, err := Load("../../tests/fixtures/courses/intro-geometry")
	if err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(pkg.Manifest)
	if err != nil || strings.Contains(string(data), "roadmap") {
		t.Fatalf("absent roadmap must not be serialized: %s, %v", data, err)
	}
}

func TestRejectInvalidRoadmaps(t *testing.T) {
	group := func(strength string, members ...string) map[string]any {
		list := make([]any, 0, len(members))
		for _, member := range members {
			list = append(list, member)
		}
		return map[string]any{"all_of": list, "strength": strength}
	}
	cases := []struct {
		name, want string
		roadmap    map[string]any
	}{
		{"self reference", "roadmap: prerequisite group 1 names the course itself",
			map[string]any{"note": "先学。", "prerequisites": []any{
				group("required", "concept-graph")}}},
		{"containing group", "roadmap: prerequisite group 2 contains group 1",
			map[string]any{"note": "先学。", "prerequisites": []any{
				group("required", "basic-math"), group("recommended", "basic-math", "ielts")}}},
		{"parallel self", "roadmap: parallel_with names the course itself",
			map[string]any{"note": "并行。", "parallel_with": []any{"concept-graph"}}},
		{"parallel and prerequisite",
			`roadmap: course "basic-math" is both parallel and in prerequisite group 1`,
			map[string]any{"note": "先学。", "parallel_with": []any{"basic-math"},
				"prerequisites": []any{group("required", "basic-math")}}},
		{"unknown strength", "course.json", map[string]any{"note": "先学。",
			"prerequisites": []any{group("optional", "basic-math")}}},
		{"missing note", "course.json", map[string]any{
			"prerequisites": []any{group("required", "basic-math")}}},
		{"note only", "course.json", map[string]any{"note": "先学。"}},
		{"repeated member", "course.json", map[string]any{"note": "先学。",
			"prerequisites": []any{group("required", "basic-math", "basic-math")}}},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			directory := copyFixture(t)
			editJSON(t, directory, ManifestFile, func(value any) {
				value.(map[string]any)["roadmap"] = test.roadmap
			})
			if _, err := Load(directory); err == nil || !strings.Contains(err.Error(), test.want) {
				t.Fatalf("got %v, want an error containing %q", err, test.want)
			}
		})
	}
}

func TestCheckRoadmapCycles(t *testing.T) {
	requires := func(id string, members ...string) Manifest {
		manifest := Manifest{ID: id}
		if len(members) > 0 {
			manifest.Roadmap = &Roadmap{Note: "先学。", Prerequisites: []CoursePrerequisite{
				{AllOf: members, Strength: StrengthRequired}}}
		}
		return manifest
	}
	active := []Manifest{requires("a", "b"), requires("b", "c", "not-installed"), requires("c")}
	err := CheckRoadmapCycles(requires("c", "a"), active)
	if err == nil || err.Error() !=
		`course "c": roadmap prerequisite cycle c requires a requires b requires c` {
		t.Fatalf("cycle: %v", err)
	}
	// The candidate replaces the active version with the same ID.
	if err := CheckRoadmapCycles(requires("b", "c"), active); err != nil {
		t.Fatalf("replacement version: %v", err)
	}
	if err := CheckRoadmapCycles(requires("a"), []Manifest{requires("a", "a2"),
		requires("a2", "a")}); err != nil {
		t.Fatalf("the candidate's new version removes the cycle: %v", err)
	}
	parallel := Manifest{ID: "c", Roadmap: &Roadmap{Note: "并行。", ParallelWith: []string{"a"}}}
	if err := CheckRoadmapCycles(parallel, active); err != nil {
		t.Fatalf("parallel relations order nothing: %v", err)
	}
	if err := CheckRoadmapCycles(requires("d", "not-installed"), active); err != nil {
		t.Fatalf("missing courses do not take part: %v", err)
	}
}
