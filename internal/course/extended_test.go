package course

import (
	"encoding/json"
	"errors"
	"path/filepath"
	"strings"
	"testing"
)

const sampleV2Path = "../../courses/golden-course-template"

func TestV2ValidatesNewItemsAndRetainsV1(t *testing.T) {
	pkg, err := Load(sampleV2Path)
	if err != nil {
		t.Fatal(err)
	}
	if len(pkg.Manifest.Units) != 1 || pkg.Manifest.Units[0].ID != "extended-practice" {
		t.Fatal("the demo course must contain only the extended-practice unit")
	}
	items := pkg.Units["extended-practice"].Items
	if pkg.Manifest.ProtocolVersion != 2 || len(items) != 15 {
		t.Fatalf("unexpected demo unit: version %d, %d items", pkg.Manifest.ProtocolVersion, len(items))
	}
	checkDemoCoverage(t, items)
	checkDemoAuthoring(t, items)
	versions, err := loadSchemas()
	if err != nil {
		t.Fatal(err)
	}
	encoded, err := json.Marshal(items)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := decodeFile[[]Item](encoded, "round-trip", versions[2].items); err != nil {
		t.Fatalf("serialized course items no longer match the v2 contract: %v", err)
	}
	extended := []byte(`[{"id":"example","type":"translation","stem":"Translate","direction":"en_to_zh",
		"source_text":"Hello","reference_translation":"你好"}]`)
	if _, err := decodeFile[[]Item](extended, "questions.json", versions[1].items); err == nil {
		t.Fatal("v1 should not silently accept a v2 question")
	}
	if _, err := Load(filepath.Join("..", "..", "courses", "basic-math")); err != nil {
		t.Fatalf("v1 course no longer loads: %v", err)
	}
}

func checkDemoCoverage(t *testing.T, items []Item) {
	t.Helper()
	demonstrated := make(map[string]bool)
	for _, item := range items {
		demonstrated[string(item.Type)] = true
		switch item.Type {
		case Writing:
			demonstrated[string(Writing)+":"+item.Subtype] = true
		case Translation:
			demonstrated[string(Translation)+":"+item.Direction] = true
		case Listening:
			if item.Listening != nil {
				demonstrated[string(Listening)+":"+item.Listening.Mode] = true
			}
		case Reading:
			if len(item.ListeningLines()) > 0 {
				t.Errorf("%s: a reading passage must not project as a listening transcript", item.ID)
			}
			for _, sub := range item.SubQuestions {
				demonstrated[string(Reading)+":"+string(sub.Type)] = true
			}
		}
	}
	for _, kind := range []string{
		string(SingleChoice), string(MultipleChoice), string(TrueFalse), string(Numeric), string(Cloze),
		string(Listening) + ":dialogue", string(Listening) + ":passage", string(Listening) + ":recording",
		string(Reading) + ":" + string(Numeric), string(Reading) + ":" + string(MultipleChoice), string(Reading) + ":" + string(SingleChoice),
		string(Writing) + ":sentence_making", string(Writing) + ":short_essay", string(Writing) + ":full_essay",
		string(Translation) + ":en_to_zh", string(Translation) + ":zh_to_en",
	} {
		if !demonstrated[kind] {
			t.Errorf("missing demo for %s", kind)
		}
	}
}

func checkDemoAuthoring(t *testing.T, items []Item) {
	t.Helper()
	banned := []string{"是 a", "是 b", "是 c", "是 d", "a 和 c"}
	for _, item := range items {
		if strings.TrimSpace(item.Chapter) == "" {
			t.Errorf("%s: missing chapter", item.ID)
		}
		if item.Explanation != "" {
			t.Errorf("%s: use analysis instead of legacy explanation", item.ID)
		}
		if item.Analysis == nil || strings.TrimSpace(item.Analysis.String()) == "" {
			t.Errorf("%s: missing parent analysis", item.ID)
		} else {
			for _, label := range banned {
				if strings.Contains(item.Analysis.String(), label) {
					t.Errorf("%s: analysis contains hardcoded option label %q", item.ID, label)
				}
			}
		}
		if item.ID == "sue1-extended-reading-single-choice" && len(item.SubQuestions) != 2 {
			t.Errorf("%s: want 2 sub-questions, got %d", item.ID, len(item.SubQuestions))
		}
		for _, sub := range item.SubQuestions {
			if sub.Explanation != "" || sub.Analysis == nil || strings.TrimSpace(sub.Analysis.String()) == "" {
				t.Errorf("%s/%s: sub-question must use non-empty analysis", item.ID, sub.ID)
			}
		}
	}
}

func TestV2RejectsInvalidQuestionDefinitions(t *testing.T) {
	pkg, err := Load(sampleV2Path)
	if err != nil {
		t.Fatal(err)
	}
	items := pkg.Units["extended-practice"].Items
	cloze := items[0]
	original := cloze.Blanks[0].Options[1].TTS
	cloze.Blanks[0].Options[1].TTS = nil
	if err := cloze.validate(2); err == nil || !strings.Contains(err.Error(), "option TTS") {
		t.Fatalf("mixed TTS accepted: %v", err)
	}
	cloze.Blanks[0].Options[1].TTS = original
	cloze.Passage = &RichContent{Text: "Choose {{1}}, then {{1}} again."}
	if err := cloze.validate(2); err == nil {
		t.Fatal("duplicate placeholder accepted")
	}
	cloze = items[0]
	cloze.PassageTTS = &TTSConfig{Voice: "stella"}
	if err := cloze.validate(2); err == nil {
		t.Fatal("cloze passage_tts without spoken text accepted")
	}
	listening := items[1]
	listening.SubQuestions[1].ID = listening.SubQuestions[0].ID
	if err := listening.validate(2); err == nil || !strings.Contains(err.Error(), "duplicate") {
		t.Fatalf("duplicate sub-question accepted: %v", err)
	}
	versions, _ := loadSchemas()
	for _, invalid := range []string{
		`{"id":"tf","type":"true_false","stem":"True?","grading":{"value":false}}`,
		`{"id":"tf","type":"true_false","stem":"True?","analysis":"No","grading":{"boolean":false}}`,
		`{"id":"t","type":"translation","stem":"Translate","direction":"en_to_zh",
		  "source_text":"Hello","reference_translation":"你好","grading":{"choice_ids":["a"]}}`,
	} {
		if _, err := decodeFile[[]Item]([]byte("["+invalid+"]"), "items", versions[2].items); err == nil {
			t.Errorf("v2 accepted invalid question: %s", invalid)
		}
	}
}

func TestV2EvaluationUsesAuthoredIDsAndServerWordCount(t *testing.T) {
	pkg, err := Load(sampleV2Path)
	if err != nil {
		t.Fatal(err)
	}
	items := pkg.Units["extended-practice"].Items
	for _, item := range items {
		if response := item.ExpectedResponse(); response.HasAnswer() {
			_, score, err := item.Evaluate(response)
			if err != nil || score != 1 {
				t.Errorf("%s: authored answer got %g, %v; want full credit", item.ID, score, err)
			}
		}
	}
	cases := []struct {
		name     string
		index    int
		response string
		score    float64
		invalid  bool
	}{
		{"cloze partial", 0, `{"blanks":{"1":["must"]}}`, 0.5, false},
		{"cloze unknown index", 0, `{"blanks":{"9":["must"]}}`, 0, true},
		{"cloze unknown option", 0, `{"blanks":{"1":["start"]}}`, 0, true},
		{"listening false", 1, `{"sub_answers":{"location":["second"],"checklist":false}}`, 1, false},
		{"listening invalid null", 1, `{"sub_answers":{"checklist":null}}`, 0, true},
		{"reading exact set and decimal", 2, `{"sub_answers":{"opening":"8.0","visitors":["badge","sign"]}}`, 1, false},
		{"reading partial multiple choice", 2, `{"sub_answers":{"opening":"8","visitors":["badge"]}}`, 0.5, false},
		{"writing partial", 3, `{"text":"The delivery has finally arrived."}`, 0.5, false},
		{"writing ignores supplied word count", 3, `{"text":"Delivery Friday","word_count":86}`, 0, false},
		{"writing rejects a second form", 3, `{"text":"Delivery Friday","translation":"test"}`, 0, true},
		{"translation accepts authored variant", 4, `{"translation":"请将已签名的清单放在前台！"}`, 1, false},
		{"translation checks term coverage", 4, `{"translation":"签名 清单 前台"}`, 0.5, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var input ExtendedResponse
			if err := json.Unmarshal([]byte(tc.response), &input); err != nil {
				t.Fatal(err)
			}
			output, score, err := items[tc.index].Evaluate(input)
			if tc.invalid {
				if !errors.Is(err, ErrResponse) {
					t.Fatalf("invalid response accepted: %v", err)
				}
				return
			}
			if err != nil || score != tc.score {
				t.Fatalf("got %g, %v; want %g", score, err, tc.score)
			}
			if input.WordCount != nil && (output.WordCount == nil || *output.WordCount != 2) {
				t.Fatalf("server did not compute the word count: %+v", output)
			}
		})
	}
}
