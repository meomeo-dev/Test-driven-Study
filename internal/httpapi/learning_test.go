package httpapi_test

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"test-driven-study/internal/httpapi"
	"test-driven-study/internal/storage"
	"test-driven-study/internal/study"
)

func conceptServer(t *testing.T) *httptest.Server {
	t.Helper()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	db, err := storage.Open(context.Background(), root, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	for _, id := range []string{
		"concept-graph", "basic-math", "roadmap-a", "roadmap-b", "roadmap-p",
		"roadmap-mid", "roadmap-top", "roadmap-after-math",
	} {
		fixture := filepath.Join(root, "tests", "fixtures", "courses", id)
		if _, err := storage.InstallCourse(context.Background(), db, fixture); err != nil {
			t.Fatal(err)
		}
	}
	server := httptest.NewServer(httpapi.New(study.New(db, root), nil, root, "43188", "43187"))
	t.Cleanup(func() { server.Close(); db.Close() })
	return server
}

func expectProblem(t *testing.T, server *httptest.Server, method, path, body string,
	status int, message string) {
	t.Helper()
	response, payload := call(t, server, method, path, body, "")
	if response.StatusCode != status || !strings.Contains(string(payload), message) {
		t.Fatalf("%s %s: got %d %s, want %d %s", method, path, response.StatusCode, payload,
			status, message)
	}
}

func decode[T any](t *testing.T, payload []byte) T {
	t.Helper()
	var value T
	if err := json.Unmarshal(payload, &value); err != nil {
		t.Fatalf("decode %s: %v", payload, err)
	}
	return value
}

func TestLearningEndpoints(t *testing.T) {
	server := conceptServer(t)
	_, payload := call(t, server, "GET", "/api/courses", "", "")
	subjects := map[string]int64{}
	for _, summary := range decode[[]study.CourseSummary](t, payload) {
		if summary.ID == "concept-graph" && summary.ConceptCount != 6 ||
			summary.ID == "elementary-chinese" && summary.ConceptCount != 0 {
			t.Fatalf("concept count for %s: %d", summary.ID, summary.ConceptCount)
		}
		for _, unit := range summary.Units {
			subjects[summary.ID+"/"+unit.ID] = unit.SubjectID
		}
	}
	response, payload := call(t, server, "GET", "/api/courses/concept-graph/concepts", "", "")
	if graph := decode[study.ConceptGraph](t, payload); response.StatusCode != 200 ||
		len(graph.Concepts) != 6 || graph.Concepts[0].State != study.ConceptReady {
		t.Fatalf("concept graph: %d %s", response.StatusCode, payload)
	}
	response, payload = call(t, server, "PUT", "/api/courses/concept-graph/concepts/counting/known",
		`{"known":true}`, "")
	if graph := decode[study.ConceptGraph](t, payload); response.StatusCode != 200 ||
		graph.Concepts[0].State != study.ConceptKnown {
		t.Fatalf("known mark: %d %s", response.StatusCode, payload)
	}
	known := "/api/courses/concept-graph/concepts/counting/known"
	expectProblem(t, server, "PUT", known, `{}`, 400, "请说明是否标记为已会")
	expectProblem(t, server, "PUT", known, `{"known":true,"extra":1}`, 400, "")
	expectProblem(t, server, "PUT", "/api/courses/concept-graph/concepts/missing/known",
		`{"known":true}`, 404, "知识点不存在")
	expectProblem(t, server, "GET", "/api/courses/missing-course/concepts", "", 404, "课程不存在")
	expectProblem(t, server, "GET", "/api/courses/Bad_ID/concepts", "", 404, "课程不存在")
	checkLearningPathEndpoints(t, server)
	checkPracticeConceptFilter(t, server, subjects)
}

func checkLearningPathEndpoints(t *testing.T, server *httptest.Server) {
	t.Helper()
	path := "/api/courses/concept-graph/learning-path"
	_, payload := call(t, server, "GET", path, "", "")
	if string(payload) != "{\"path\":null}\n" && string(payload) != `{"path":null}` {
		t.Fatalf("empty path view: %s", payload)
	}
	response, payload := call(t, server, "POST", path,
		`{"targets":["word-problems"],"daily_minutes":20}`, "")
	created := decode[study.LearningPath](t, payload)
	if response.StatusCode != 201 || len(created.Steps) != 2 || created.KnownSteps != 0 {
		t.Fatalf("create path: %d %s", response.StatusCode, payload)
	}
	_, payload = call(t, server, "GET", path, "", "")
	if view := decode[study.LearningPathView](t, payload); view.Path == nil ||
		view.Path.ID != created.ID {
		t.Fatalf("read path: %s", payload)
	}
	targets := make([]string, 17)
	for index := range targets {
		targets[index] = fmt.Sprintf("%q", fmt.Sprintf("target-%d", index))
	}
	many := `{"targets":[` + strings.Join(targets, ",") + `],"daily_minutes":30}`
	expectProblem(t, server, "POST", path, many, 400, "学习目标最多选择 16 个知识点")
	expectProblem(t, server, "POST", path, `{"daily_minutes":5}`, 400, "每天学习时间需在 10–480 分钟之间")
	expectProblem(t, server, "POST", path, `{"targets":["missing"],"daily_minutes":30}`, 404, "知识点不存在")
	expectProblem(t, server, "POST", "/api/courses/elementary-chinese/learning-path",
		`{"daily_minutes":30}`, 400, "该课程尚未定义知识点")
}

func checkPracticeConceptFilter(t *testing.T, server *httptest.Server, subjects map[string]int64) {
	t.Helper()
	basics := subjects["concept-graph/basics"]
	for _, state := range []string{"all", "unanswered", "review"} {
		url := fmt.Sprintf("/api/practice/questions?subject=%d&concept=addition&state=%s", basics, state)
		response, payload := call(t, server, "GET", url, "", "")
		rows := decode[[]map[string]any](t, payload)
		if response.StatusCode != 200 || (state != "review" && len(rows) != 3) {
			t.Fatalf("%s filter: %d %s", state, response.StatusCode, payload)
		}
		for _, row := range rows {
			if !strings.HasPrefix(row["source_item_id"].(string), "addition-") {
				t.Fatalf("%s filter returned %v", state, row)
			}
		}
	}
	base := fmt.Sprintf("/api/practice/questions?subject=%d&concept=", basics)
	expectProblem(t, server, "GET", base+"word-problems", "", 400, "知识点不属于当前单元")
	expectProblem(t, server, "GET", base+"missing", "", 404, "知识点不存在")
	expectProblem(t, server, "GET", base+"Bad!", "", 400, "知识点参数无效")
	_, payload := call(t, server, "GET", fmt.Sprintf("/api/practice/questions?subject=%d", basics), "", "")
	rows := decode[[]map[string]any](t, payload)
	body := fmt.Sprintf(`{"id":"concept-http-presentation-0001","question_id":%v}`,
		int64(rows[0]["question_id"].(float64)))
	response, payload := call(t, server, "POST", "/api/practice/presentations", body, "")
	if response.StatusCode != 200 || strings.Contains(string(payload), "concepts") {
		t.Fatalf("learner-facing question must not carry concept tags: %d %s",
			response.StatusCode, payload)
	}
}
