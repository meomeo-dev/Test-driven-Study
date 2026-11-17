package httpapi_test

import (
	"encoding/json"
	"testing"

	"test-driven-study/internal/study"
)

func TestRoadmapEndpoints(t *testing.T) {
	server := conceptServer(t)
	response, payload := call(t, server, "GET", "/api/roadmap", "", "")
	roadmap := decode[study.CourseRoadmap](t, payload)
	states := map[string]string{}
	for _, value := range roadmap.Courses {
		states[value.ID] = value.State
	}
	if response.StatusCode != 200 || states["embedded-mcu"] != study.CourseWaiting ||
		states["circuit-fundamentals"] != study.CourseReady || len(states) != len(roadmap.Courses) {
		t.Fatalf("roadmap: %d %s", response.StatusCode, payload)
	}

	completed := "/api/courses/basic-math/completed"
	response, payload = call(t, server, "PUT", completed, `{"completed":true}`, "")
	if response.StatusCode != 200 {
		t.Fatalf("mark: %d %s", response.StatusCode, payload)
	}
	for _, value := range decode[study.CourseRoadmap](t, payload).Courses {
		if value.ID == "basic-math" && (!value.Completed || !value.MarkedCompleted) {
			t.Fatalf("mark not applied: %+v", value)
		}
	}
	expectProblem(t, server, "PUT", completed, `{}`, 400, "请说明是否标记为已学完")
	expectProblem(t, server, "PUT", completed, `{"completed":"yes"}`, 400, "请求内容无效")
	for _, course := range []string{"concept-graph", "circuit-fundamentals"} {
		expectProblem(t, server, "PUT", "/api/courses/"+course+"/completed",
			`{"completed":true}`, 400, "该课程按知识点进度判断是否学完")
	}
	expectProblem(t, server, "PUT", "/api/courses/missing-course/completed",
		`{"completed":true}`, 404, "课程不存在")
	expectProblem(t, server, "PUT", "/api/courses/Not_A_Course/completed",
		`{"completed":true}`, 404, "课程不存在")

	response, payload = call(t, server, "GET", "/api/roadmap/path", "", "")
	if response.StatusCode != 200 || string(payload) != "{\"path\":null}\n" {
		t.Fatalf("empty route: %d %q", response.StatusCode, payload)
	}
	many, err := json.Marshal(map[string]any{"targets": make([]string, 17)})
	if err != nil {
		t.Fatal(err)
	}
	expectProblem(t, server, "POST", "/api/roadmap/path", string(many), 400,
		"学习目标最多选择 16 门课程")
	expectProblem(t, server, "POST", "/api/roadmap/path",
		`{"targets":["pcb-design","pcb-design"]}`, 400, "学习目标包含重复的课程")
	expectProblem(t, server, "POST", "/api/roadmap/path", `{"targets":["missing-course"]}`,
		404, "课程不存在")
	expectProblem(t, server, "POST", "/api/roadmap/path", `{"daily_minutes":30}`, 400,
		"请求内容无效")
	response, payload = call(t, server, "POST", "/api/roadmap/path",
		`{"targets":["embedded-mcu"]}`, "")
	created := decode[study.RoadmapPath](t, payload)
	if response.StatusCode != 201 || len(created.Steps) != 3 || created.CompletedSteps != 0 ||
		created.NextCourse != "c-programming" {
		t.Fatalf("create route: %d %s", response.StatusCode, payload)
	}
	_, payload = call(t, server, "GET", "/api/roadmap/path", "", "")
	if view := decode[study.RoadmapPathView](t, payload); view.Path == nil ||
		view.Path.ID != created.ID {
		t.Fatalf("read route: %s", payload)
	}
}
