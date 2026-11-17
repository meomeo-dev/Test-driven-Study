package httpapi_test

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"test-driven-study/internal/testsupport"

	"test-driven-study/internal/study"
)

func TestExamHTTPPrivacyInputsAndSubmission(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	server := testServer(t)
	id := "b6000000-0000-4000-8000-000000000001"
	response, payload := call(t, server, "POST", "/api/exams", fmt.Sprintf(`{"id":%q,"subject_id":1}`, id), "")
	if response.StatusCode != 201 {
		t.Fatal("exam not created", string(payload))
	}
	for _, field := range []string{`"answer":`, `"analysis":`, `"skill":`, `"correct":`, `"review":`, `"score":`} {
		if strings.Contains(string(payload), field) {
			t.Fatal("unsubmitted paper leak", field)
		}
	}
	var exam study.ExamSession
	if err := json.Unmarshal(payload, &exam); err != nil {
		t.Fatal(err)
	}
	endpoint := "/api/exams/" + id
	for _, test := range []struct{ method, path, body string }{
		{"POST", endpoint + "/answer", `{"index":-1,"selected":[1]}`},
		{"POST", endpoint + "/answer", `{"index":100,"selected":[1]}`},
		{"POST", endpoint + "/answer", `{"selected":[1]}`},
		{"POST", endpoint + "/answer", `{"index":0,"selected":[]}`},
		{"POST", endpoint + "/answer", `{"index":0,"selected":[1,1]}`},
		{"POST", endpoint + "/answer", `{"index":0,"selected":[1],"score":100}`},
		{"POST", endpoint + "/answer", `{"index":0,"selected":[1],"answered_at_ms":1}`},
		{"POST", endpoint + "/navigate", `{"to_index":1,"selected":[]}`},
		{"POST", endpoint + "/navigate", `{"from_index":0,"to_index":1}`},
		{"POST", endpoint + "/navigate", `{"from_index":0,"to_index":1,"selected":null}`},
		{"POST", endpoint + "/navigate", `{"from_index":0,"to_index":100,"selected":[1]}`},
		{"PUT", endpoint + "/cursor", `{}`},
		{"PUT", endpoint + "/cursor", `{"index":1,"deadline_at_ms":9999999999999}`},
		{"POST", endpoint + "/submit", `{"score":100}`},
		{"GET", "/api/exams?subject=2", ""},
		{"POST", "/api/exams", `{"id":"bad-id","subject_id":1}`},
	} {
		r, _ := call(t, server, test.method, test.path, test.body, "")
		if r.StatusCode != 400 {
			t.Error("invalid exam input accepted", test.path, test.body, r.StatusCode)
		}
	}
	selected := exam.Items[0].Detail.Question.Items[0].Sign
	response, payload = call(t, server, "POST", endpoint+"/answer", fmt.Sprintf(`{"index":0,"selected":[%d]}`, selected), "")
	if response.StatusCode != 200 {
		t.Fatal("answer commitment failed")
	}
	if err := json.Unmarshal(payload, &exam); err != nil || exam.Items[0].Correct == nil ||
		exam.Items[0].Review == nil || exam.Items[1].Review != nil || exam.Items[1].Correct != nil || exam.Score != nil {
		t.Fatal("incorrect committed/unanswered feedback boundary", err)
	}
	for range 2 {
		response, payload = call(t, server, "POST", endpoint+"/submit", `{}`, "")
		if response.StatusCode != 200 || !strings.Contains(string(payload), `"review":`) || !strings.Contains(string(payload), `"score":`) {
			t.Fatal("final result missing")
		}
	}
	response, payload = call(t, server, "GET", "/api/exams?subject=1", "", "")
	if response.StatusCode != 200 || !strings.Contains(string(payload), id) || strings.Contains(string(payload), "paper_json") {
		t.Fatal("unsafe history")
	}
}
