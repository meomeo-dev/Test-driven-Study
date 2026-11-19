package course

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestItemKindRegistryCoversAllQuestionTypes(t *testing.T) {
	all := AllQuestionTypes()
	if len(all) != 9 {
		t.Fatalf("expected 9 canonical question types, got %d", len(all))
	}
	if len(itemKinds) != len(all) {
		t.Fatalf("itemKinds registry size %d != AllQuestionTypes size %d", len(itemKinds), len(all))
	}
	for _, qt := range all {
		kind, ok := ItemKindFor(qt)
		if !ok {
			t.Fatalf("missing ItemKind for %q", qt)
		}
		if kind.Type != qt || kind.Validate == nil {
			t.Fatalf("incomplete ItemKind for %q: %+v", qt, kind)
		}
		if kind.MediaCapable != qt.IsMediaCapable() {
			t.Fatalf("MediaCapable mismatch for %q: %v vs %v", qt, kind.MediaCapable, qt.IsMediaCapable())
		}
	}
}

func TestQuestionTypeJSONAndLegacyMapping(t *testing.T) {
	for i, want := range AllQuestionTypes() {
		code := i + 1
		var got QuestionType
		rawInt, _ := json.Marshal(code)
		if err := json.Unmarshal(rawInt, &got); err != nil || got != want {
			t.Fatalf("legacy code %d: got %q, %v; want %q", code, got, err, want)
		}
		rawStr, err := json.Marshal(got)
		if err != nil || string(rawStr) != `"`+string(want)+`"` {
			t.Fatalf("marshal %q: got %s, %v", want, rawStr, err)
		}
		var roundTrip QuestionType
		if err := json.Unmarshal(rawStr, &roundTrip); err != nil || roundTrip != want {
			t.Fatalf("round-trip %q: got %q, %v", want, roundTrip, err)
		}
	}
	for _, invalid := range []string{`0`, `10`, `-1`, `"unknown"`, `""`, `true`} {
		var qt QuestionType
		if err := json.Unmarshal([]byte(invalid), &qt); err == nil {
			t.Fatalf("invalid question type %s accepted as %q", invalid, qt)
		}
	}
	var quota ExamTypeQuota
	if err := json.Unmarshal([]byte(`{"question_type":2,"name":"多选题","count":10}`), &quota); err != nil {
		t.Fatal(err)
	}
	if quota.QuestionType != MultipleChoice {
		t.Fatalf("quota QuestionType got %q, want %q", quota.QuestionType, MultipleChoice)
	}
}

func TestListeningLinesStrictPerTypeIsolation(t *testing.T) {
	passage := &RichContent{Text: "Every worker {{1}} sign."}
	for _, qt := range []QuestionType{Cloze, Reading, Writing, Translation} {
		item := Item{
			Prompt: Prompt{
				Type:       qt,
				Transcript: &Transcript{Lines: []TranscriptLine{{Speaker: "W", Text: "Leaked"}}},
			},
			ExtendedFields: ExtendedFields{Passage: passage},
		}
		if lines := item.ListeningLines(); len(lines) != 0 {
			t.Fatalf("non-media type %q returned listening lines: %+v", qt, lines)
		}
	}
	for _, qt := range []QuestionType{SingleChoice, MultipleChoice, TrueFalse, Numeric} {
		withoutTranscript := Item{
			Prompt:         Prompt{Type: qt},
			ExtendedFields: ExtendedFields{Passage: passage},
		}
		if lines := withoutTranscript.ListeningLines(); len(lines) != 0 {
			t.Fatalf("objective type %q synthesized lines from passage: %+v", qt, lines)
		}
		withTranscript := Item{
			Prompt: Prompt{
				Type:       qt,
				Transcript: &Transcript{Lines: []TranscriptLine{{Speaker: "W", Text: "Hello"}}},
			},
		}
		if lines := withTranscript.ListeningLines(); len(lines) != 1 || lines[0].Text != "Hello" {
			t.Fatalf("objective type %q lost explicit transcript: %+v", qt, lines)
		}
	}
	listeningPassage := Item{
		Prompt: Prompt{Type: Listening},
		ExtendedFields: ExtendedFields{
			Passage:   &RichContent{Text: "Notice text."},
			Listening: &ListeningAudio{Mode: "passage", VoiceFemale: "stella"},
		},
	}
	lines := listeningPassage.ListeningLines()
	if len(lines) != 1 || lines[0].Text != "Notice text." || lines[0].TTS.Config.Voice != "stella" {
		t.Fatalf("listening passage mode failed: %+v", lines)
	}
}

func TestV2TightenedListeningModes(t *testing.T) {
	versions, err := loadSchemas()
	if err != nil {
		t.Fatal(err)
	}
	invalid := []string{
		`{"id":"l1","type":"listening","stem":"Listen","audio":{"mode":"dialogue","voice_male":"tide"},"transcript":[{"speaker":"M","text":"Hi"}],"passage":"forbidden","sub_questions":[{"id":"q1","type":"true_false","stem":"T?","analysis":"A","grading":{"value":true}}]}`,
		`{"id":"l2","type":"listening","stem":"Listen","audio":{"mode":"recording","src":"assets/a.mp3"},"passage":"forbidden","sub_questions":[{"id":"q1","type":"true_false","stem":"T?","analysis":"A","grading":{"value":true}}]}`,
		`{"id":"l3","type":"listening","stem":"Listen","audio":{"mode":"passage","voice_female":"stella"},"passage":"Spoken text","transcript":[{"speaker":"W","text":"forbidden"}],"sub_questions":[{"id":"q1","type":"true_false","stem":"T?","analysis":"A","grading":{"value":true}}]}`,
	}
	for _, raw := range invalid {
		if _, err := decodeFile[[]Item]([]byte("["+raw+"]"), "items.json", versions[2].items); err == nil {
			t.Fatalf("schema accepted forbidden listening combination: %s", raw)
		}
	}
	items := []Item{
		{
			Prompt: Prompt{Type: Listening, Transcript: &Transcript{Lines: []TranscriptLine{{Speaker: "M", Text: "Hi"}}}},
			ExtendedFields: ExtendedFields{
				Listening: &ListeningAudio{Mode: "dialogue"},
				Passage:   &RichContent{Text: "forbidden"},
			},
		},
		{
			Prompt: Prompt{Type: Listening},
			ExtendedFields: ExtendedFields{
				Listening: &ListeningAudio{Mode: "recording", Src: "assets/a.mp3"},
				Passage:   &RichContent{Text: "forbidden"},
			},
		},
		{
			Prompt: Prompt{Type: Listening, Transcript: &Transcript{Lines: []TranscriptLine{{Speaker: "W", Text: "forbidden"}}}},
			ExtendedFields: ExtendedFields{
				Listening: &ListeningAudio{Mode: "passage"},
				Passage:   &RichContent{Text: "Spoken"},
			},
		},
	}
	for _, item := range items {
		if err := item.validate(2); err == nil || !strings.Contains(err.Error(), "forbids") {
			t.Fatalf("validateComposite accepted invalid mode fields (%s): %v", item.Listening.Mode, err)
		}
	}
}

func TestAllBundledCoursesLoad(t *testing.T) {
	entries, err := os.ReadDir("../../courses")
	if err != nil {
		t.Fatal(err)
	}
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		dir := filepath.Join("../../courses", entry.Name())
		if _, err := os.Stat(filepath.Join(dir, ManifestFile)); err != nil {
			continue
		}
		if _, err := Load(dir); err != nil {
			t.Fatalf("course %s failed Load: %v", entry.Name(), err)
		}
	}
}
