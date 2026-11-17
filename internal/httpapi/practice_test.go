package httpapi_test

import (
	"encoding/json"
	"fmt"
	"strings"
	"testing"

	"test-driven-study/internal/study"
	"test-driven-study/internal/testsupport"
)

func TestPracticeHTTPGradingBoundaryAndAnalysis(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	server := testServer(t)
	id := "http-presentation-test-00001"
	response, payload := call(t, server, "POST", "/api/practice/presentations",
		fmt.Sprintf(`{"id":%q,"question_id":4}`, id), "")
	if response.StatusCode != 200 {
		t.Fatal(string(payload))
	}
	for _, field := range []string{`"answer":`, `"analysis":`, `"skill":`} {
		if strings.Contains(string(payload), field) {
			t.Fatal("pre-answer leak", field)
		}
	}
	response, _ = call(t, server, "POST", "/api/practice/presentations",
		fmt.Sprintf(`{"id":%q,"question_id":6}`, id), "")
	if response.StatusCode != 409 {
		t.Fatal("reused presentation for another question")
	}
	endpoint := "/api/practice/presentations/" + id + "/answer"
	for _, body := range []string{`{"selected":[]}`, `{"selected":[9]}`, `{"selected":[2,2]}`, `{"selected":[2],"correct":true}`, `{"selected":[2],"answered_at_ms":1}`} {
		response, _ = call(t, server, "POST", endpoint, body, "")
		if response.StatusCode != 400 {
			t.Fatal("invalid grading input accepted", body, response.StatusCode)
		}
	}
	response, payload = call(t, server, "POST", endpoint, `{"selected":[2]}`, "")
	var result study.AttemptResult
	if err := json.Unmarshal(payload, &result); err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != 200 || !result.Attempt.Correct || result.Detail.Question.Analysis == "" {
		t.Fatal(string(payload))
	}
	response, payload = call(t, server, "GET", "/api/analysis?subject=1&days=30", "", "")
	var report study.Analysis
	if err := json.Unmarshal(payload, &report); err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != 200 || report.Overall.Attempts != 1 || report.RecentAccuracy == nil || *report.RecentAccuracy != 100 {
		t.Fatal("attempt not connected to analysis", string(payload))
	}
	response, _ = call(t, server, "GET", "/api/analysis?subject=1&days=-7", "", "")
	if response.StatusCode != 400 {
		t.Fatal("invalid window accepted")
	}
	response, payload = call(t, server, "GET", "/api/practice/overview?subject=1", "", "")
	if response.StatusCode != 200 || !strings.Contains(string(payload), `"correct":1`) {
		t.Fatal(string(payload))
	}
	response, payload = call(t, server, "GET", "/api/practice/questions?subject=1&state=incorrect", "", "")
	if response.StatusCode != 200 || string(payload) != "[]\n" {
		t.Fatal("wrong latest-state filter", string(payload))
	}
}
