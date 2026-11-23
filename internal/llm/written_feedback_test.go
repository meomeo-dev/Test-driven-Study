package llm

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"slices"
	"testing"

	"test-driven-study/internal/course"
)

func TestEvaluateWrittenSendsStrictJSONSchemaAndParsesResult(t *testing.T) {
	cases := []struct {
		name           string
		item           course.Item
		answer         course.ExtendedResponse
		expectedRubric map[string]int
	}{
		{
			name: "writing custom rubric",
			item: course.Item{
				Prompt:         course.Prompt{ID: "w-1", Type: course.Writing},
				ExtendedFields: course.ExtendedFields{Rubric: map[string]int{"task": 50, "language": 50}},
			},
			answer: course.ExtendedResponse{
				Text: ptrString("The delivery has been moved to Friday."),
			},
			expectedRubric: map[string]int{"task": 50, "language": 50},
		},
		{
			name: "translation default rubric",
			item: course.Item{
				Prompt: course.Prompt{ID: "t-1", Type: course.Translation},
			},
			answer: course.ExtendedResponse{
				Translation: ptrString("交付已改期至周五。"),
			},
			expectedRubric: map[string]int{"meaning": 60, "terminology": 25, "fluency": 15},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var captured map[string]any
			server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if r.URL.Path != "/responses" ||
					r.Header.Get("Authorization") != "Bearer private-llm-test-key" {
					t.Errorf("unexpected route or auth: %s", r.URL.Path)
				}
				if err := json.NewDecoder(r.Body).Decode(&captured); err != nil {
					t.Errorf("decode request: %v", err)
				}
				criteria := make([]map[string]any, 0, len(tc.expectedRubric))
				for name, weight := range tc.expectedRubric {
					criteria = append(criteria, map[string]any{
						"name":       name,
						"points":     weight - 5,
						"max_points": weight,
						"comment":    "结构清楚，可进一步打磨细节。",
					})
				}
				text, _ := json.Marshal(map[string]any{
					"criteria": criteria,
					"summary":  "整体符合题目要求。",
				})
				_ = json.NewEncoder(w).Encode(map[string]any{
					"status": "completed",
					"output": []any{map[string]any{
						"type":   "message",
						"role":   "assistant",
						"status": "completed",
						"content": []any{map[string]string{
							"type": "output_text",
							"text": string(text),
						}},
					}},
				})
			}))
			defer server.Close()

			service, err := New(context.Background(), testOptions(t, server.URL))
			if err != nil {
				t.Fatal(err)
			}
			defer service.Close()

			feedback, err := service.EvaluateWritten(context.Background(), tc.item, tc.answer)
			if err != nil {
				t.Fatalf("EvaluateWritten failed: %v", err)
			}
			assertStrictWrittenFeedbackRequest(t, captured, tc.expectedRubric)
			if feedback.Summary != "整体符合题目要求。" ||
				len(feedback.Criteria) != len(tc.expectedRubric) {
				t.Fatalf("unexpected feedback: %+v", feedback)
			}
			for _, row := range feedback.Criteria {
				weight := tc.expectedRubric[row.Name]
				if row.Max != weight || row.Points == nil || *row.Points != weight-5 {
					t.Fatalf("unexpected criterion row: %+v", row)
				}
			}
		})
	}
}

func assertStrictWrittenFeedbackRequest(
	t *testing.T, body map[string]any, expectedRubric map[string]int,
) {
	t.Helper()
	if body["store"] != false || body["stream"] != false ||
		body["max_output_tokens"] != float64(4096) {
		t.Fatalf("unexpected store/stream/token parameters: %+v", body)
	}
	input, ok := body["input"].(string)
	if !ok {
		t.Fatalf("expected string input evidence, got %T", body["input"])
	}
	var evidence struct {
		Rubric map[string]int `json:"rubric"`
	}
	if err := json.Unmarshal([]byte(input), &evidence); err != nil {
		t.Fatalf("invalid input evidence JSON: %v", err)
	}
	if len(evidence.Rubric) != len(expectedRubric) {
		t.Fatalf("rubric mismatch: got %+v want %+v", evidence.Rubric, expectedRubric)
	}

	textObj, ok := body["text"].(map[string]any)
	if !ok {
		t.Fatalf("missing text object: %+v", body)
	}
	format, ok := textObj["format"].(map[string]any)
	if !ok {
		t.Fatalf("missing text.format object: %+v", textObj)
	}
	if format["type"] != "json_schema" || format["name"] != "written_feedback" ||
		format["strict"] != true {
		t.Fatalf("expected strict written_feedback json_schema, got %+v", format)
	}
	schema, ok := format["schema"].(map[string]any)
	if !ok || schema["type"] != "object" || schema["additionalProperties"] != false {
		t.Fatalf("root schema must be strict object: %+v", schema)
	}
	assertRequiredFields(t, schema["required"], []string{"criteria", "summary"})

	props := schema["properties"].(map[string]any)
	summary := props["summary"].(map[string]any)
	if summary["type"] != "string" {
		t.Fatalf("summary schema must be string: %+v", summary)
	}
	criteria := props["criteria"].(map[string]any)
	if criteria["type"] != "array" {
		t.Fatalf("criteria schema must be array: %+v", criteria)
	}
	itemSchema := criteria["items"].(map[string]any)
	if itemSchema["type"] != "object" || itemSchema["additionalProperties"] != false {
		t.Fatalf("criterion schema must be strict object: %+v", itemSchema)
	}
	assertRequiredFields(
		t, itemSchema["required"], []string{"name", "points", "max_points", "comment"},
	)
	itemProps := itemSchema["properties"].(map[string]any)
	wantTypes := map[string]string{
		"name":       "string",
		"points":     "integer",
		"max_points": "integer",
		"comment":    "string",
	}
	for field, wantType := range wantTypes {
		prop, ok := itemProps[field].(map[string]any)
		if !ok || prop["type"] != wantType {
			t.Fatalf("criterion.%s: got %+v want type %s", field, prop, wantType)
		}
	}
}

func assertRequiredFields(t *testing.T, raw any, want []string) {
	t.Helper()
	list, ok := raw.([]any)
	if !ok || len(list) != len(want) {
		t.Fatalf("required fields: got %+v want %+v", raw, want)
	}
	got := make([]string, len(list))
	for i, v := range list {
		got[i], _ = v.(string)
	}
	for _, field := range want {
		if !slices.Contains(got, field) {
			t.Fatalf("missing required field %q in %+v", field, got)
		}
	}
}

func TestEvaluateWrittenGuardsAndValidation(t *testing.T) {
	disabledOptions := testOptions(t, "http://127.0.0.1:1/v1")
	disabledOptions.Config = Config{Message: "disabled"}
	disabled, err := New(context.Background(), disabledOptions)
	if err != nil {
		t.Fatal(err)
	}
	defer disabled.Close()
	if _, err := disabled.EvaluateWritten(
		context.Background(),
		course.Item{
			Prompt:         course.Prompt{Type: course.Writing},
			ExtendedFields: course.ExtendedFields{Rubric: map[string]int{"task": 100}},
		},
		course.ExtendedResponse{Text: ptrString("hello")},
	); !errors.Is(err, ErrDisabled) {
		t.Fatalf("expected ErrDisabled, got %v", err)
	}

	ready, err := New(context.Background(), testOptions(t, "http://127.0.0.1:1/v1"))
	if err != nil {
		t.Fatal(err)
	}
	defer ready.Close()
	if _, err := ready.EvaluateWritten(
		context.Background(),
		course.Item{Prompt: course.Prompt{Type: course.Writing}},
		course.ExtendedResponse{Text: ptrString("hello")},
	); !errors.Is(err, ErrInvalid) {
		t.Fatalf("expected ErrInvalid for empty rubric, got %v", err)
	}

	rubric := map[string]int{"task": 50, "language": 50}
	wrap := func(text string) []byte {
		data, _ := json.Marshal(map[string]any{
			"status": "completed",
			"output": []any{map[string]any{
				"type":   "message",
				"role":   "assistant",
				"status": "completed",
				"content": []any{map[string]string{
					"type": "output_text",
					"text": text,
				}},
			}},
		})
		return data
	}
	invalidCases := []struct {
		name string
		raw  []byte
	}{
		{"unknown field", wrap(`{"criteria":[{"name":"task","points":50,"max_points":50,"comment":"ok"},{"name":"language","points":50,"max_points":50,"comment":"ok"}],"summary":"ok","extra":1}`)},
		{"missing criterion", wrap(`{"criteria":[{"name":"task","points":50,"max_points":50,"comment":"ok"}],"summary":"ok"}`)},
		{"duplicate criterion", wrap(`{"criteria":[{"name":"task","points":50,"max_points":50,"comment":"ok"},{"name":"task","points":50,"max_points":50,"comment":"ok"}],"summary":"ok"}`)},
		{"points exceed weight", wrap(`{"criteria":[{"name":"task","points":51,"max_points":50,"comment":"ok"},{"name":"language","points":50,"max_points":50,"comment":"ok"}],"summary":"ok"}`)},
		{"negative points", wrap(`{"criteria":[{"name":"task","points":-1,"max_points":50,"comment":"ok"},{"name":"language","points":50,"max_points":50,"comment":"ok"}],"summary":"ok"}`)},
		{"missing points", wrap(`{"criteria":[{"name":"task","max_points":50,"comment":"ok"},{"name":"language","points":50,"max_points":50,"comment":"ok"}],"summary":"ok"}`)},
		{"wrong max_points", wrap(`{"criteria":[{"name":"task","points":50,"max_points":40,"comment":"ok"},{"name":"language","points":50,"max_points":50,"comment":"ok"}],"summary":"ok"}`)},
		{"blank comment", wrap(`{"criteria":[{"name":"task","points":50,"max_points":50,"comment":"   "},{"name":"language","points":50,"max_points":50,"comment":"ok"}],"summary":"ok"}`)},
		{"blank summary", wrap(`{"criteria":[{"name":"task","points":50,"max_points":50,"comment":"ok"},{"name":"language","points":50,"max_points":50,"comment":"ok"}],"summary":""}`)},
		{"incomplete response", []byte(`{"status":"incomplete","output":[]}`)},
		{"error response", []byte(`{"status":"completed","error":{"message":"bad"},"output":[]}`)},
	}
	for _, tc := range invalidCases {
		t.Run(tc.name, func(t *testing.T) {
			if _, err := parseWrittenFeedback(tc.raw, rubric); err == nil {
				t.Fatalf("expected error for %s", tc.name)
			}
		})
	}
}

func ptrString(v string) *string { return &v }
