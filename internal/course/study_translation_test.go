package course

import (
	"fmt"
	"strings"
	"testing"
)

func TestV2StudyTranslationAlignmentAndReferences(t *testing.T) {
	schemas, err := loadSchemas()
	if err != nil {
		t.Fatal(err)
	}
	const item = `[{"id":"notice","type":"reading_comprehension","stem":"Read the notice.",
		"passage":[{"type":"text","text":"NOTICE"},{"type":"text","text":"\n"},
		{"type":"text","text":"The door is open."}],"sub_questions":[{"id":"door",
		"type":"single_choice","stem":"Is the door open?","options":[{"id":"yes","text":"Yes"},
		{"id":"no","text":"No"}],"grading":{"choice_ids":["yes"]}}]%s}]`
	tests := []struct {
		name, field, errorText string
		badShape               bool
	}{
		{name: "legacy item"},
		{name: "whitespace segment ignored", field: `,"study_translation":{"material":["通知","门开着。"],
			"sub_questions":{"door":{"stem":"门开着吗？","options":{"yes":"是","no":"否"}}}}`},
		{name: "material count", field: `,"study_translation":{"material":["通知"]}`,
			errorText: "1 translations for 2 source parts"},
		{name: "unknown sub-question", field: `,"study_translation":{"material":["通知","门开着。"],
			"sub_questions":{"other":{"stem":"门开着吗？"}}}`, errorText: "unknown sub-question"},
		{name: "unknown option", field: `,"study_translation":{"material":["通知","门开着。"],
			"sub_questions":{"door":{"options":{"other":"是"}}}}`, errorText: "unknown option"},
		{name: "blank text", field: `,"study_translation":{"material":["通知"," "]}`, badShape: true},
		{name: "empty sub-question", field: `,"study_translation":{"material":["通知","门开着。"],
			"sub_questions":{"door":{}}}`, badShape: true},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			items, err := decodeFile[[]Item]([]byte(fmt.Sprintf(item, test.field)), "items", schemas[2].items)
			if test.badShape {
				if err == nil {
					t.Fatal("invalid study translation passed the schema")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			err = items[0].validate(2)
			if test.errorText == "" && err != nil {
				t.Fatal(err)
			}
			if test.errorText != "" && (err == nil || !strings.Contains(err.Error(), test.errorText)) {
				t.Fatalf("wanted %q, got %v", test.errorText, err)
			}
		})
	}
}

func TestV2StudyTranslationListeningUsesOriginalAudioSource(t *testing.T) {
	item := Item{Prompt: Prompt{Type: Listening}, ExtendedFields: ExtendedFields{
		Listening: &ListeningAudio{Mode: "passage", VoiceFemale: "stella"},
		Passage: &RichContent{Segments: []ContentSegment{
			{Type: "text", Text: "The workshop opens at 8 a.m."},
			{Type: "text", Text: " "},
			{Type: "text", Text: "Bring your badge."},
		}},
		StudyTranslation: &StudyTranslation{Material: []string{"车间上午八点开放。", "请带上证件。"}},
	}}
	if err := item.validate(2); err != nil {
		t.Fatal(err)
	}
	lines := item.ListeningLines()
	if len(lines) != 1 || lines[0].Text != "The workshop opens at 8 a.m. Bring your badge." ||
		lines[0].TTS.Config.Voice != "stella" {
		t.Fatalf("translation changed the monologue's speech: %+v", lines)
	}

	item.Passage = nil
	item.Listening = &ListeningAudio{Mode: "recording", Src: "assets/audio/notice.mp3"}
	if err := item.validate(2); err == nil || !strings.Contains(err.Error(), "structured transcript") {
		t.Fatalf("a translated recording must include a structured transcript: %v", err)
	}
	item.Transcript = &Transcript{Lines: []TranscriptLine{
		{Speaker: "M", Text: "The workshop opens at 8 a.m."},
		{Speaker: "M", Text: "Bring your badge."},
	}}
	if err := item.validate(2); err != nil {
		t.Fatal(err)
	}
}

func TestV2StudyTranslationDisplayInAndAllQuestionTypes(t *testing.T) {
	schemas, err := loadSchemas()
	if err != nil {
		t.Fatal(err)
	}
	cases := []struct {
		name      string
		payload   string
		badShape  bool
		errorText string
	}{
		{
			name: "single_choice with stem, options, and selective display_in",
			payload: `[{"id":"sc1","type":"single_choice","stem":"Choose a greeting.",
				"options":[{"id":"a","text":"Good morning."},{"id":"b","text":"Good night."}],
				"grading":{"choice_ids":["a"]},
				"study_translation":{"display_in":["memorize","typing"],
				"stem":"选择一句问候语。","options":{"a":"早上好。","b":"晚安。"}}}]`,
		},
		{
			name: "cloze with completed passage material and palace surface",
			payload: `[{"id":"cl1","type":"cloze","stem":"Fill in the blank.",
				"passage":"Every worker {{1}} sign.","blanks":[{"index":1,
				"options":[{"id":"a","text":"must"},{"id":"b","text":"can"}],"grading":{"choice_ids":["a"]}}],
				"study_translation":{"display_in":["memorize","practice_review","exam_review","typing","palace"],
				"material":["每位工人都必须签字。"]}}]`,
		},
		{
			name: "writing with multi-segment sample_response translation",
			payload: `[{"id":"wr1","type":"writing","subtype":"short_essay","stem":"Write a note.",
				"requirements":["Mention Friday."],"sample_response":[
					{"type":"text","text":"Hi Mia,"},{"type":"text","text":"\n\n"},
					{"type":"text","text":"See you Friday."}],
				"rubric":{"task_completion":100},
				"study_translation":{"display_in":["typing"],
				"sample_response":["嗨，米娅，","星期五见。"]}}]`,
		},
		{
			name: "display_in only without translation content is rejected",
			payload: `[{"id":"sc2","type":"single_choice","stem":"Hello",
				"options":[{"id":"a","text":"Hi"},{"id":"b","text":"Bye"}],"grading":{"choice_ids":["a"]},
				"study_translation":{"display_in":["typing"]}}]`,
			errorText: "at least one translation field",
		},
		{
			name: "unknown display_in surface rejected by schema",
			payload: `[{"id":"sc3","type":"single_choice","stem":"Hello",
				"options":[{"id":"a","text":"Hi"},{"id":"b","text":"Bye"}],"grading":{"choice_ids":["a"]},
				"study_translation":{"display_in":["exam_active"],"stem":"你好"}}]`,
			badShape: true,
		},
		{
			name: "writing sample_response translation count mismatch",
			payload: `[{"id":"wr2","type":"writing","subtype":"sentence_making","stem":"Write.",
				"requirements":["One sentence."],"sample_response":"Done.",
				"rubric":{"task_completion":100},
				"study_translation":{"sample_response":["完成了。","多余一句。"]}}]`,
			errorText: "2 translations for 1 sample parts",
		},
		{
			name: "options translation forbidden on numeric",
			payload: `[{"id":"num1","type":"numeric","stem":"How many?","grading":{"value":"5","absolute_tolerance":"0"},
				"study_translation":{"options":{"a":"五"}}}]`,
			errorText: "only supported on choice",
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			items, err := decodeFile[[]Item]([]byte(tc.payload), "items", schemas[2].items)
			if tc.badShape {
				if err == nil {
					t.Fatal("invalid study translation passed the schema")
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			err = items[0].validate(2)
			if tc.errorText == "" && err != nil {
				t.Fatal(err)
			}
			if tc.errorText != "" && (err == nil || !strings.Contains(err.Error(), tc.errorText)) {
				t.Fatalf("wanted %q, got %v", tc.errorText, err)
			}
		})
	}
}
