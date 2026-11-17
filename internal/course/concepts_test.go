package course

import (
	"encoding/json"
	"io/fs"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

const conceptFixture = "../../tests/fixtures/courses/concept-graph"

// introGeometryDigest is the digest of the browser fixture before concept
// support existed. Unchanged packages must keep their digests.
const introGeometryDigest = "006fde739485e1ac0f6292a32fd24791f60343b42a61311c71b6a009c05e0551"

func TestConceptFixtureLoadsAndOldDigestsHold(t *testing.T) {
	pkg, err := Load(conceptFixture)
	if err != nil {
		t.Fatal(err)
	}
	want := ConceptSummary{Concepts: 6, Groups: 6, TaggedItems: 15, UntaggedItems: 1}
	if got := pkg.ConceptSummary(); !reflect.DeepEqual(got, want) {
		t.Fatalf("summary: got %+v, want %+v", got, want)
	}
	if tags := pkg.Units["applied"].Items[0].Concepts; !reflect.DeepEqual(tags,
		[]string{"word-problems"}) {
		t.Fatalf("item tags: %v", tags)
	}
	legacy, err := Load("../../tests/fixtures/courses/intro-geometry")
	if err != nil || legacy.Digest != introGeometryDigest {
		t.Fatalf("untouched package digest changed: %s, %v", legacy.Digest, err)
	}
	data, err := json.Marshal(legacy.Manifest)
	if err != nil || strings.Contains(string(data), "concepts") ||
		strings.Contains(string(data), "prerequisites") {
		t.Fatalf("absent concept fields must not be serialized: %s", data)
	}
}

func TestConceptSummaryWarnsAboutSparseConcepts(t *testing.T) {
	directory := copyFixture(t)
	editJSON(t, directory, "questions/applied.json", func(value any) {
		items := value.([]any)
		items[4].(map[string]any)["concepts"] = []any{"explain-aloud"}
		items[5].(map[string]any)["concepts"] = []any{"explain-aloud"}
	})
	pkg, err := Load(directory)
	if err != nil {
		t.Fatal(err)
	}
	if got := pkg.ConceptSummary().SparseConcepts; !reflect.DeepEqual(got,
		[]string{"estimation", "explain-aloud"}) {
		t.Fatalf("sparse concepts: %v", got)
	}
}

func TestRejectInvalidConceptGraphs(t *testing.T) {
	cases := []struct {
		name, file, want string
		edit             func(any)
	}{
		{"duplicate ID", "course.json", `concept "counting": duplicate ID`, func(v any) {
			concepts(v, 1)[0].(map[string]any)["id"] = "counting"
		}},
		{"unknown lesson", "course.json", `concept "estimation": unit "applied" has no lesson`,
			func(v any) { concepts(v, 1)[1].(map[string]any)["lesson"] = "missing" }},
		{"self reference", "course.json", `concept "addition": prerequisite group 1 names the concept itself`,
			func(v any) { setGroups(concepts(v, 0)[1], [][]string{{"addition"}}) }},
		{"unknown reference", "course.json", `names unknown concept "algebra"`,
			func(v any) { setGroups(concepts(v, 0)[1], [][]string{{"algebra"}}) }},
		{"containing group", "course.json", `concept "estimation": prerequisite group 2 contains group 1`,
			func(v any) {
				setGroups(concepts(v, 1)[1], [][]string{{"addition"}, {"addition", "subtraction"}})
			}},
		{"duplicate group", "course.json", `concept "estimation": prerequisite group 2 contains group 1`,
			func(v any) { setGroups(concepts(v, 1)[1], [][]string{{"addition"}, {"addition"}}) }},
		{"cycle", "course.json", `prerequisite cycle counting requires word-problems`,
			func(v any) { setGroups(concepts(v, 0)[0], [][]string{{"word-problems"}}) }},
		{"minutes", "course.json", "course.json", func(v any) {
			concepts(v, 0)[0].(map[string]any)["estimated_minutes"] = 0
		}},
		{"repeated member", "course.json", "course.json", func(v any) {
			setGroups(concepts(v, 1)[1], [][]string{{"addition", "addition"}})
		}},
		{"unknown tag", "questions/basics.json", `item "counting-1": unknown concept "geometry"`,
			func(v any) { v.([]any)[0].(map[string]any)["concepts"] = []any{"geometry"} }},
		{"cross-unit tag", "questions/basics.json",
			`item "counting-1": concept "estimation" belongs to unit "applied", not "basics"`,
			func(v any) { v.([]any)[0].(map[string]any)["concepts"] = []any{"estimation"} }},
		{"repeated tag", "questions/basics.json", "basics.json", func(v any) {
			v.([]any)[0].(map[string]any)["concepts"] = []any{"counting", "counting"}
		}},
	}
	for _, test := range cases {
		t.Run(test.name, func(t *testing.T) {
			directory := copyFixture(t)
			editJSON(t, directory, test.file, test.edit)
			if _, err := Load(directory); err == nil || !strings.Contains(err.Error(), test.want) {
				t.Fatalf("got %v, want an error containing %q", err, test.want)
			}
		})
	}
}

func concepts(manifest any, unit int) []any {
	units := manifest.(map[string]any)["units"].([]any)
	return units[unit].(map[string]any)["concepts"].([]any)
}

func setGroups(concept any, groups [][]string) {
	value := make([]any, 0, len(groups))
	for _, group := range groups {
		members := make([]any, 0, len(group))
		for _, member := range group {
			members = append(members, member)
		}
		value = append(value, map[string]any{"all_of": members})
	}
	concept.(map[string]any)["prerequisites"] = value
}

func copyFixture(t *testing.T) string {
	t.Helper()
	target := t.TempDir()
	err := filepath.WalkDir(conceptFixture, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		relative, err := filepath.Rel(conceptFixture, path)
		if err != nil || entry.IsDir() {
			if err == nil {
				err = os.MkdirAll(filepath.Join(target, relative), 0o755)
			}
			return err
		}
		data, err := os.ReadFile(path)
		if err == nil {
			err = os.WriteFile(filepath.Join(target, relative), data, 0o644)
		}
		return err
	})
	if err != nil {
		t.Fatal(err)
	}
	return target
}

func editJSON(t *testing.T, directory, name string, edit func(any)) {
	t.Helper()
	path := filepath.Join(directory, name)
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var value any
	if err := json.Unmarshal(data, &value); err != nil {
		t.Fatal(err)
	}
	edit(value)
	if data, err = json.Marshal(value); err == nil {
		err = os.WriteFile(path, data, 0o644)
	}
	if err != nil {
		t.Fatal(err)
	}
}
