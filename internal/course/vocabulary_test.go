package course

import (
	"bytes"
	"os"
	"strings"
	"testing"
)

const vocabularyTestFile = "assets/vocabulary/english.json"

const vocabularyTestEntry = `{"id":"hand-over","unit_id":"intro","term":"hand over",
	"meaning":"交接","category":"word_group","question_ids":["1"],
	"example":"Hand over the checklist.","example_translation":"交接检查表。"}`

func TestVocabularyAssetIsVersioned(t *testing.T) {
	directory, manifest := writeVocabularyTestCourse(t)
	older, err := Load(directory)
	if err != nil {
		t.Fatal(err)
	}
	if older.Manifest.VocabularyFile != "" {
		t.Fatal("a package without a word list should keep the field empty")
	}

	manifest.VocabularyFile = vocabularyTestFile
	data := []byte("[" + vocabularyTestEntry + "]")
	if err := writeJSON(directory, ManifestFile, manifest); err != nil {
		t.Fatal(err)
	}
	if err := writeContent(directory, vocabularyTestFile, data); err != nil {
		t.Fatal(err)
	}
	pkg, err := Load(directory)
	if err != nil {
		t.Fatal(err)
	}
	root, err := os.OpenRoot(directory)
	if err != nil {
		t.Fatal(err)
	}
	defer root.Close()
	stored, err := pkg.ReadAsset(root, vocabularyTestFile)
	if err != nil || !bytes.Equal(stored, data) {
		t.Fatalf("read vocabulary asset: %s, %v", stored, err)
	}

	updated := bytes.Replace(data, []byte("交接检查表。"), []byte("转交检查表。"), 1)
	if err := writeContent(directory, vocabularyTestFile, updated); err != nil {
		t.Fatal(err)
	}
	revised, err := Load(directory)
	if err != nil {
		t.Fatal(err)
	}
	if revised.Digest == pkg.Digest {
		t.Fatal("vocabulary edits must change the package digest")
	}
}

func TestRejectInvalidVocabulary(t *testing.T) {
	directory, manifest := writeVocabularyTestCourse(t)
	for _, test := range []struct {
		name string
		path string
		data string
		want string
	}{
		{"path", "assets/english.json", "", "invalid vocabulary asset path"},
		{"traversal", "assets/vocabulary/../english.json", "", "invalid vocabulary asset path"},
		{"empty", vocabularyTestFile, "[]", vocabularyTestFile},
		{"duplicate ID", vocabularyTestFile, "[" + vocabularyTestEntry + "," +
			vocabularyTestEntry + "]", "duplicate vocabulary ID"},
		{"foreign unit", vocabularyTestFile, vocabularyWith(`"intro"`, `"unknown"`),
			"references unknown unit"},
		{"foreign question", vocabularyTestFile, vocabularyWith(`["1"]`, `["2"]`),
			"outside unit"},
		{"missing question", vocabularyTestFile, vocabularyWith(`["1"]`, `["3"]`),
			"outside unit"},
		{"invalid category", vocabularyTestFile, vocabularyWith(`"word_group"`, `"verb"`),
			vocabularyTestFile},
		{"unpaired example", vocabularyTestFile,
			vocabularyWith(`,"example_translation":"交接检查表。"`, ""), vocabularyTestFile},
		{"invalid term_tts voice", vocabularyTestFile,
			vocabularyWith(`"meaning":"交接"`, `"meaning":"交接","term_tts":{"voice":"invalid"}`),
			vocabularyTestFile},
		{"unpaired example_tts", vocabularyTestFile,
			`[{"id":"hand-over","unit_id":"intro","term":"hand over","meaning":"交接",` +
				`"category":"word_group","example_tts":{"voice":"stella"}}]`,
			vocabularyTestFile},
		{"invalid pos", vocabularyTestFile,
			vocabularyWith(`"meaning":"交接"`, `"meaning":"交接","pos":"verb"`),
			vocabularyTestFile},
		{"blank grammar_note", vocabularyTestFile,
			vocabularyWith(`"meaning":"交接"`, `"meaning":"交接","grammar_note":"   "`),
			vocabularyTestFile},
		{"overlong grammar_note", vocabularyTestFile,
			vocabularyWith(`"meaning":"交接"`,
				`"meaning":"交接","grammar_note":"`+strings.Repeat("a", 121)+`"`),
			vocabularyTestFile},
		{"unknown property", vocabularyTestFile,
			vocabularyWith(`"meaning":"交接"`, `"meaning":"交接","extra_field":"nope"`),
			vocabularyTestFile},
	} {
		t.Run(test.name, func(t *testing.T) {
			manifest.VocabularyFile = test.path
			if err := writeJSON(directory, ManifestFile, manifest); err != nil {
				t.Fatal(err)
			}
			if test.data != "" {
				if err := writeContent(directory, test.path, []byte(test.data)); err != nil {
					t.Fatal(err)
				}
			}
			if _, err := Load(directory); err == nil || !strings.Contains(err.Error(), test.want) {
				t.Fatalf("wanted %q, got %v", test.want, err)
			}
		})
	}
}

func vocabularyWith(old, updated string) string {
	return "[" + strings.Replace(vocabularyTestEntry, old, updated, 1) + "]"
}

func TestVocabularyOptionalTTSAndGrammar(t *testing.T) {
	directory, manifest := writeVocabularyTestCourse(t)
	manifest.VocabularyFile = vocabularyTestFile
	if err := writeJSON(directory, ManifestFile, manifest); err != nil {
		t.Fatal(err)
	}
	entry := `[{"id":"hand-over","unit_id":"intro","term":"hand over",` +
		`"meaning":"交接","category":"word_group","pos":"v",` +
		`"grammar_note":"` + strings.Repeat("a", 120) + `",` +
		`"question_ids":["1"],` +
		`"term_tts":{"voice":"stella","text":"hand over","speed":0.9},` +
		`"example":"Hand over the checklist.",` +
		`"example_translation":"交接检查表。",` +
		`"example_tts":{"voice":"tide","text":"Hand over the checklist."}}]`
	if err := writeContent(directory, vocabularyTestFile, []byte(entry)); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(directory); err != nil {
		t.Fatalf("expected valid optional TTS and grammar fields, got %v", err)
	}
}

func writeVocabularyTestCourse(t *testing.T) (string, Manifest) {
	t.Helper()
	directory := t.TempDir()
	manifest := Manifest{ProtocolVersion: 2, ID: "english-demo", Version: "1.0.0",
		Title: "English", Language: "zh-CN", Units: []Unit{
			{ID: "intro", Title: "Intro", QuestionFile: "questions/intro.json"},
			{ID: "tools", Title: "Tools", QuestionFile: "questions/tools.json"},
		}}
	if err := writeJSON(directory, ManifestFile, manifest); err != nil {
		t.Fatal(err)
	}
	const exercise = `[{"id":"1","type":"true_false","stem":"A handover needs a checklist.",
		"analysis":"Confirm the handover with the checklist.","grading":{"value":true}}]`
	if err := writeContent(directory, manifest.Units[0].QuestionFile, []byte(exercise)); err != nil {
		t.Fatal(err)
	}
	second := strings.Replace(exercise, `"id":"1"`, `"id":"2"`, 1)
	if err := writeContent(directory, manifest.Units[1].QuestionFile, []byte(second)); err != nil {
		t.Fatal(err)
	}
	return directory, manifest
}
