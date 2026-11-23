package course

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestScaffoldAndValidateCourse(t *testing.T) {
	parent := t.TempDir()
	directory, err := Scaffold(parent, "basic-math", "Math", "en")
	if err != nil {
		t.Fatal(err)
	}
	first, err := Load(directory)
	if err != nil {
		t.Fatal(err)
	}
	if first.Manifest.ProtocolVersion != 2 || first.Manifest.ID != "basic-math" ||
		len(first.Units["intro"].Items) != 3 {
		t.Fatalf("unexpected v2 scaffold package: %+v", first)
	}
	summary := first.ConceptSummary()
	if summary.Concepts != 1 || summary.TaggedItems != 3 ||
		summary.UntaggedItems != 0 || len(summary.SparseConcepts) != 0 {
		t.Fatalf("unexpected scaffold concept summary: %+v", summary)
	}
	tfItem := first.Units["intro"].Items[2]
	if tfItem.Type != TrueFalse || tfItem.Grading.Boolean == nil ||
		!*tfItem.Grading.Boolean || tfItem.Analysis == nil {
		t.Fatalf("expected v2 true_false item with grading.value and analysis: %+v", tfItem)
	}
	profile := first.Manifest.AIProfile
	if profile == nil || !first.IsStoredAsset(profile.PalaceTemplate) ||
		!first.IsStoredAsset(profile.PalacePlanningInstructions) ||
		!first.IsStoredAsset(profile.PalaceResearchInstructions) {
		t.Fatal("scaffold did not declare all three palace resources")
	}
	const guide = "profiles/PROMPT-AUTHORING.md"
	instructions, err := os.ReadFile(filepath.Join(directory, guide))
	if err != nil || !strings.Contains(string(instructions), "[填写：") ||
		first.IsStoredAsset(guide) {
		t.Fatalf("scaffold should provide a separate author guide with fill-ins: %v", err)
	}
	if _, err := Scaffold(parent, "basic-math", "Overwrite", "en"); !errors.Is(err, os.ErrExist) {
		t.Fatalf("scaffold existing package: %v", err)
	}
	second, err := Load(directory)
	if err != nil || second.Digest != first.Digest {
		t.Fatalf("scaffold collision altered package: %v", err)
	}
	item := first.Units["intro"].Items[0]
	for value, want := range map[string]bool{"0.25": true, "0.250": true, "0.26": false} {
		correct, err := item.Grade(Response{Value: &value})
		if err != nil || correct != want {
			t.Errorf("value %q: got %v, %v; want %v", value, correct, err, want)
		}
	}
	bad := "1/4"
	if _, err := item.Grade(Response{Value: &bad}); !errors.Is(err, ErrResponse) {
		t.Fatalf("fraction submitted as a decimal: %v", err)
	}
}

func TestRejectInvalidItemReferences(t *testing.T) {
	directory, err := Scaffold(t.TempDir(), "invalid", "Validation", "en")
	if err != nil {
		t.Fatal(err)
	}
	data := []byte(`[{"id":"1","type":"single_choice","stem":"Pick",
		"options":[{"id":"a","text":"A"},{"id":"b","text":"B"}],
		"grading":{"choice_ids":["c"]}}]`)
	if err := writeContent(directory, "questions/intro.json", data); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(directory); err == nil || !strings.Contains(err.Error(), "unknown option") {
		t.Fatalf("expected invalid answer reference, got %v", err)
	}
	data = []byte(strings.ReplaceAll(string(data), `"single_choice"`, `"unknown"`))
	if err := writeContent(directory, "questions/intro.json", data); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(directory); err == nil || !strings.Contains(err.Error(), "intro.json") {
		t.Fatalf("expected schema rejection, got %v", err)
	}
}
