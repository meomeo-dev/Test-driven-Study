package httpapi_test

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"test-driven-study/internal/testsupport"

	"test-driven-study/internal/course"
	"test-driven-study/internal/httpapi"
	"test-driven-study/internal/storage"
	"test-driven-study/internal/study"
)

func TestGenericCourseRunsWithoutDrivingPackage(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	db, err := storage.Open(ctx, root, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	directory, err := course.Scaffold(filepath.Join(root, "courses"), "generic", "Generic", "en")
	if err != nil {
		t.Fatal(err)
	}
	pkg, err := course.Load(directory)
	if err != nil {
		t.Fatal(err)
	}
	pkg.Manifest.Units[0].Lessons = nil
	manifest, err := json.Marshal(pkg.Manifest)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(directory, course.ManifestFile), manifest, 0644); err != nil {
		t.Fatal(err)
	}
	if _, err := storage.InstallCourse(ctx, db, directory); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(httpapi.New(study.New(db, root), nil, root, "43188", "43187"))
	defer server.Close()
	response, payload := call(t, server, "GET", "/api/courses", "", "")
	var courses []study.CourseSummary
	if err := json.Unmarshal(payload, &courses); err != nil || response.StatusCode != 200 ||
		len(courses) != 1 || courses[0].ID != "generic" || courses[0].Legacy {
		t.Fatalf("unexpected catalog: %s / %v", payload, err)
	}
	subject := courses[0].Units[0].SubjectID
	for _, endpoint := range []string{"/api/guide", "/api/exams/rules", "/api/exams"} {
		path := fmt.Sprintf("%s?subject=%d", endpoint, subject)
		response, payload := call(t, server, "GET", path, "", "")
		if response.StatusCode != 200 {
			t.Fatalf("%s returned %d: %s", path, response.StatusCode, payload)
		}
		if endpoint == "/api/guide" && !strings.Contains(string(payload), "从背题模式") {
			t.Fatalf("question-only package lacks the shared guide default: %s", payload)
		}
	}
	for _, path := range []string{"/api/llm/info", "/api/palaces/info"} {
		response, _ := call(t, server, "GET", path, "", "")
		if response.StatusCode != 404 {
			t.Fatalf("%s should be unavailable, got %d", path, response.StatusCode)
		}
	}
}

func testServer(t *testing.T) *httptest.Server {
	t.Helper()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	db, err := storage.Open(context.Background(), root, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(httpapi.New(study.New(db, root), nil, root, "43188", "43187"))
	t.Cleanup(func() { server.Close(); db.Close() })
	return server
}

func call(t *testing.T, server *httptest.Server, method, path, body, origin string) (*http.Response, []byte) {
	t.Helper()
	request, err := http.NewRequest(method, server.URL+path, strings.NewReader(body))
	if err != nil {
		t.Fatal(err)
	}
	if body != "" {
		request.Header.Set("Content-Type", "application/json")
	}
	if origin != "" {
		request.Header.Set("Origin", origin)
	}
	response, err := server.Client().Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	payload, err := io.ReadAll(response.Body)
	if err != nil {
		t.Fatal(err)
	}
	return response, payload
}

func TestQuestionAndProgressWorkflow(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	server := testServer(t)
	response, payload := call(t, server, "GET", "/api/questions/4", "", "")
	var detail study.Detail
	if err := json.Unmarshal(payload, &detail); err != nil {
		t.Fatal(err)
	}
	if response.StatusCode != 200 || detail.Question.Answer != "2" || !detail.ImageAvailable {
		t.Fatalf("wrong original question: %s", payload)
	}
	response, _ = call(t, server, "PUT", "/api/questions/4/progress", `{"state":"review"}`, "http://127.0.0.1:43187")
	if response.StatusCode != 200 {
		t.Fatal(response.Status)
	}
	_, payload = call(t, server, "GET", "/api/study/overview?subject=1", "", "")
	var overview study.Overview
	if err := json.Unmarshal(payload, &overview); err != nil {
		t.Fatal(err)
	}
	if overview.Review != 1 || overview.Total != 1734 {
		t.Fatalf("wrong counts: %s", payload)
	}
	_, payload = call(t, server, "GET", "/api/questions?subject=1&state=review", "", "")
	var selected []map[string]any
	if err := json.Unmarshal(payload, &selected); err != nil {
		t.Fatal(err)
	}
	if len(selected) != 1 || selected[0]["question_id"] != float64(4) {
		t.Fatalf("wrong filter: %s", payload)
	}
}

func TestRequestValidationAndAPIFallback(t *testing.T) {
	server := testServer(t)
	cases := []struct {
		method, path, body, origin string
		status                     int
	}{
		{"GET", "/api/questions?subject=9", "", "", 400},
		{"GET", "/api/questions?chapter=-1", "", "", 400},
		{"GET", "/api/questions?state=unknown", "", "", 400},
		{"GET", "/api/questions/999999999", "", "", 404},
		{"GET", "/api/missing", "", "", 404},
		{"PUT", "/api/questions/4/progress", `{"state":"wrong"}`, "", 400},
		{"PUT", "/api/questions/4/progress", `{"state":"review","extra":1}`, "", 400},
		{"PUT", "/api/questions/4/progress", `{"state":"review"} {}`, "", 400},
		{"PUT", "/api/questions/4/progress", `{"state":"review"}`, "https://example.com", 403},
		{"PUT", "/api/study/cursor", `{"subject_id":99999,"question_id":4}`, "", 400},
	}
	for _, test := range cases {
		t.Run(test.path+test.body+test.origin, func(t *testing.T) {
			response, payload := call(t, server, test.method, test.path, test.body, test.origin)
			if response.StatusCode != test.status {
				t.Fatalf("got %d want %d: %s", response.StatusCode, test.status, payload)
			}
			if !strings.Contains(response.Header.Get("Content-Type"), "application/json") {
				t.Fatal("API fell through to HTML")
			}
		})
	}
}

func TestChapterZeroAndEmptyResults(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	server := testServer(t)
	_, overviewPayload := call(t, server, "GET", "/api/study/overview?subject=4", "", "")
	var overview study.Overview
	if err := json.Unmarshal(overviewPayload, &overview); err != nil {
		t.Fatal(err)
	}
	zeroCount := 0
	for _, chapter := range overview.Chapters {
		if chapter.ChapterID == 0 {
			zeroCount++
			if chapter.ChapterName != "未分类" || chapter.Total != 2 {
				t.Fatalf("incorrect unclassified chapter: %+v", chapter)
			}
		}
	}
	if zeroCount != 1 {
		t.Fatal("duplicate chapter-zero filter entries")
	}
	_, payload := call(t, server, "GET", "/api/questions?subject=4&chapter=0", "", "")
	var rows []map[string]any
	if err := json.Unmarshal(payload, &rows); err != nil {
		t.Fatal(err)
	}
	if len(rows) == 0 {
		t.Fatal("real chapter zero was treated as empty/all")
	}
	for _, row := range rows {
		if row["chapter_id"] != float64(0) {
			t.Fatal("chapter filter leaked")
		}
	}
	_, payload = call(t, server, "GET", "/api/questions?subject=1&q=no-such-driving-question", "", "")
	if strings.TrimSpace(string(payload)) != "[]" {
		t.Fatalf("empty result must be an array: %s", payload)
	}
}
