package httpapi_test

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"slices"
	"testing"

	"test-driven-study/internal/course"
	"test-driven-study/internal/httpapi"
	"test-driven-study/internal/storage"
	"test-driven-study/internal/study"
)

func courseLifecycleServer(t *testing.T) (*httptest.Server, *study.Service) {
	t.Helper()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	db, err := storage.Open(context.Background(), root, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	svc := study.New(db, root)
	server := httptest.NewServer(httpapi.New(svc, nil, root, "43188", "43187"))
	t.Cleanup(func() { server.Close(); db.Close() })
	return server, svc
}

func makeCourseZipBytes(t *testing.T, id, version, title, lesson string) []byte {
	t.Helper()
	parent := t.TempDir()
	dir, err := course.Scaffold(parent, id, title, "zh-CN")
	if err != nil {
		t.Fatal(err)
	}
	manifestPath := filepath.Join(dir, course.ManifestFile)
	raw, err := os.ReadFile(manifestPath)
	if err != nil {
		t.Fatal(err)
	}
	var manifest course.Manifest
	if err := json.Unmarshal(raw, &manifest); err != nil {
		t.Fatal(err)
	}
	manifest.ID = id
	manifest.Version = version
	manifest.Title = title
	updated, err := json.Marshal(manifest)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(manifestPath, updated, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(dir, "lessons", "intro.md"), []byte(lesson), 0o644,
	); err != nil {
		t.Fatal(err)
	}
	outPath := filepath.Join(parent, id+"-"+version+".zip")
	if err := course.PackZip(dir, outPath); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(outPath)
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func uploadCourseMultipart(
	t *testing.T, server *httptest.Server, field, filename string,
	data []byte, origin string,
) (*http.Response, []byte) {
	t.Helper()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	if field != "" {
		part, err := writer.CreateFormFile(field, filename)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := part.Write(data); err != nil {
			t.Fatal(err)
		}
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	req, err := http.NewRequest(http.MethodPost, server.URL+"/api/courses/install", &body)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	if origin != "" {
		req.Header.Set("Origin", origin)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	payload, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	return resp, payload
}

func TestCoursePackageUploadLifecycleAndHistoryPreservation(t *testing.T) {
	server, svc := courseLifecycleServer(t)

	// 1. GET /api/courses/packages lists bundled courses with required schema fields.
	resp, payload := call(t, server, "GET", "/api/courses/packages", "", "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("GET packages: %d %s", resp.StatusCode, payload)
	}
	var pkgResp struct {
		Packages []storage.InstalledCoursePackage `json:"packages"`
	}
	if err := json.Unmarshal(payload, &pkgResp); err != nil || len(pkgResp.Packages) == 0 {
		t.Fatalf("invalid packages payload: %s (%v)", payload, err)
	}

	// 2. Upload v1.0.0 .zip -> 200 and activates immediately.
	v1Zip := makeCourseZipBytes(t, "http-zip-course", "1.0.0", "HTTP Zip V1", "# V1\n")
	resp, payload = uploadCourseMultipart(t, server, "file", "http-zip-course.zip", v1Zip, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("POST install v1: %d %s", resp.StatusCode, payload)
	}
	var installOut struct {
		CourseID string                           `json:"course_id"`
		Version  string                           `json:"version"`
		Title    string                           `json:"title"`
		Active   bool                             `json:"active"`
		Packages []storage.InstalledCoursePackage `json:"packages"`
	}
	if err := json.Unmarshal(payload, &installOut); err != nil ||
		installOut.CourseID != "http-zip-course" || installOut.Version != "1.0.0" ||
		!installOut.Active || len(installOut.Packages) == 0 {
		t.Fatalf("unexpected install response: %s (%v)", payload, err)
	}

	// Record learner memorization progress and a practice attempt on v1.0.0.
	courses, err := svc.Courses(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	idx := slices.IndexFunc(courses, func(c study.CourseSummary) bool { return c.ID == "http-zip-course" })
	if idx < 0 || len(courses[idx].Units) != 1 {
		t.Fatalf("installed zip course missing from active catalog: %+v", courses)
	}
	subjectID := courses[idx].Units[0].SubjectID
	questions, err := svc.PracticeQuestions(context.Background(), study.Filter{
		SubjectID: subjectID, ChapterID: -1, State: "all",
	})
	if err != nil || len(questions) == 0 {
		t.Fatalf("expected practice questions for installed course: %+v / %v", questions, err)
	}
	qID := questions[0].QuestionID
	if err := svc.SetProgress(context.Background(), qID, "mastered"); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.OpenPresentation(context.Background(), "http-zip-attempt-0001", qID); err != nil {
		t.Fatal(err)
	}
	val := "0.25"
	if _, err := svc.SubmitResponse(context.Background(), "http-zip-attempt-0001", study.AnswerInput{Numeric: &val}); err != nil {
		t.Fatal(err)
	}

	// 3. Upgrade to v1.1.0, then switch back to v1.0.0 via /activate.
	v2Zip := makeCourseZipBytes(t, "http-zip-course", "1.1.0", "HTTP Zip V2", "# V2\n")
	resp, payload = uploadCourseMultipart(t, server, "file", "http-zip-course-v2.zip", v2Zip, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("POST install v2: %d %s", resp.StatusCode, payload)
	}
	resp, payload = call(t, server, "POST", "/api/courses/http-zip-course/versions/1.0.0/activate", `{}`, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("activate 1.0.0: %d %s", resp.StatusCode, payload)
	}

	// 4. Deactivate -> active:false, absent from GET /api/courses, present in GET /api/courses/packages.
	resp, payload = call(t, server, "POST", "/api/courses/http-zip-course/deactivate", `{}`, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("deactivate: %d %s", resp.StatusCode, payload)
	}
	_, activeRaw := call(t, server, "GET", "/api/courses", "", "")
	var activeList []study.CourseSummary
	if err := json.Unmarshal(activeRaw, &activeList); err != nil {
		t.Fatal(err)
	}
	if slices.ContainsFunc(activeList, func(c study.CourseSummary) bool { return c.ID == "http-zip-course" }) {
		t.Fatal("deactivated course still in GET /api/courses")
	}
	_, pkgRaw := call(t, server, "GET", "/api/courses/packages", "", "")
	if err := json.Unmarshal(pkgRaw, &pkgResp); err != nil {
		t.Fatal(err)
	}
	pIdx := slices.IndexFunc(pkgResp.Packages, func(p storage.InstalledCoursePackage) bool {
		return p.CourseID == "http-zip-course"
	})
	if pIdx < 0 || pkgResp.Packages[pIdx].Active || pkgResp.Packages[pIdx].ActiveVersion != "" {
		t.Fatalf("expected inactive package summary: %+v", pkgResp.Packages)
	}

	// 5. Reactivate v1.1.0 -> exact question_id and learner progress/attempts preserved.
	resp, payload = call(t, server, "POST", "/api/courses/http-zip-course/versions/1.1.0/activate", `{}`, "")
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("reactivate 1.1.0: %d %s", resp.StatusCode, payload)
	}
	detail, err := svc.Detail(context.Background(), qID)
	if err != nil || detail.State != "mastered" || detail.Question.PackageVersion != "1.1.0" {
		t.Fatalf("learner progress lost after HTTP reactivate: %+v / %v", detail, err)
	}
	analysis, err := svc.Analysis(context.Background(), subjectID, 30)
	if err != nil || analysis.Overall.Attempts != 1 || analysis.Overall.Correct != 1 {
		t.Fatalf("attempts lost after HTTP reactivate: %+v / %v", analysis, err)
	}

	// 6. Conflict (409), not found (404), invalid course ID (400).
	conflictZip := makeCourseZipBytes(t, "http-zip-course", "1.0.0", "HTTP Zip Tampered", "# Tampered\n")
	resp, _ = uploadCourseMultipart(t, server, "file", "conflict.zip", conflictZip, "")
	if resp.StatusCode != http.StatusConflict {
		t.Fatalf("expected 409 for modified same version, got %d", resp.StatusCode)
	}
	resp, _ = call(t, server, "POST", "/api/courses/http-zip-course/versions/9.9.9/activate", `{}`, "")
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 for missing version, got %d", resp.StatusCode)
	}
	resp, _ = call(t, server, "POST", "/api/courses/missing-course/deactivate", `{}`, "")
	if resp.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 for missing course, got %d", resp.StatusCode)
	}
	resp, _ = call(t, server, "POST", "/api/courses/Bad_ID/deactivate", `{}`, "")
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for invalid course ID, got %d", resp.StatusCode)
	}
}

func makeRawZip(t *testing.T, build func(*zip.Writer)) []byte {
	t.Helper()
	var buf bytes.Buffer
	zw := zip.NewWriter(&buf)
	build(zw)
	if err := zw.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestCourseInstallRejectsUnsafeArchivesAndOversize(t *testing.T) {
	server, _ := courseLifecycleServer(t)

	// 1. Zip-slip entry -> 400.
	zipSlip := makeRawZip(t, func(zw *zip.Writer) {
		w, _ := zw.Create("../escape.txt")
		_, _ = w.Write([]byte("evil"))
	})
	resp, _ := uploadCourseMultipart(t, server, "file", "slip.zip", zipSlip, "")
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("zip-slip expected 400, got %d", resp.StatusCode)
	}

	// 2. Symlink entry -> 400.
	symlinkZip := makeRawZip(t, func(zw *zip.Writer) {
		hdr := &zip.FileHeader{Name: "course.json", Method: zip.Store}
		hdr.SetMode(os.ModeSymlink | 0o777)
		w, _ := zw.CreateHeader(hdr)
		_, _ = w.Write([]byte("/etc/passwd"))
	})
	resp, _ = uploadCourseMultipart(t, server, "file", "symlink.zip", symlinkZip, "")
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("symlink expected 400, got %d", resp.StatusCode)
	}

	// 3. Non-.zip filename, missing file field, corrupt bytes -> 400.
	resp, _ = uploadCourseMultipart(t, server, "file", "course.tar", []byte("not-zip"), "")
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("non-zip extension expected 400, got %d", resp.StatusCode)
	}
	resp, _ = uploadCourseMultipart(t, server, "", "", nil, "")
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("missing file field expected 400, got %d", resp.StatusCode)
	}
	resp, _ = uploadCourseMultipart(t, server, "file", "corrupt.zip", []byte("not-a-zip"), "")
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("corrupt zip expected 400, got %d", resp.StatusCode)
	}

	// 4. Oversize uncompressed file (> 24 MiB, compresses tiny with deflate) -> 413.
	oversizeZip := makeRawZip(t, func(zw *zip.Writer) {
		hdr := &zip.FileHeader{Name: "big.bin", Method: zip.Deflate}
		hdr.SetMode(0o644)
		w, _ := zw.CreateHeader(hdr)
		chunk := bytes.Repeat([]byte("A"), 1<<20)
		for range 25 {
			_, _ = w.Write(chunk)
		}
	})
	resp, _ = uploadCourseMultipart(t, server, "file", "bomb.zip", oversizeZip, "")
	if resp.StatusCode != http.StatusRequestEntityTooLarge {
		t.Fatalf("oversize archive expected 413, got %d", resp.StatusCode)
	}
}

func TestCourseMutationLocalOnlySecurity(t *testing.T) {
	server, _ := courseLifecycleServer(t)
	v1Zip := makeCourseZipBytes(t, "sec-zip-course", "1.0.0", "Sec Zip", "# Sec\n")

	// 1. Disallowed Origin rejected with 403 on install, activate, and deactivate.
	resp, _ := uploadCourseMultipart(t, server, "file", "sec.zip", v1Zip, "https://evil.example")
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("install cross-origin expected 403, got %d", resp.StatusCode)
	}
	resp, _ = call(t, server, "POST", "/api/courses/golden-course-template/deactivate", `{}`, "https://evil.example")
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("deactivate cross-origin expected 403, got %d", resp.StatusCode)
	}
	resp, _ = call(t, server, "POST", "/api/courses/golden-course-template/versions/1.4.0/activate", `{}`, "https://evil.example")
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("activate cross-origin expected 403, got %d", resp.StatusCode)
	}

	// 2. Non-multipart Content-Type on /api/courses/install rejected with 415.
	resp, _ = call(t, server, "POST", "/api/courses/install", `{}`, "")
	if resp.StatusCode != http.StatusUnsupportedMediaType {
		t.Fatalf("JSON to /api/courses/install expected 415, got %d", resp.StatusCode)
	}

	// 3. Multipart Content-Type on OTHER mutations still rejected with 415.
	req, _ := http.NewRequest(
		http.MethodPost, server.URL+"/api/courses/golden-course-template/deactivate",
		bytes.NewBufferString("--boundary--"),
	)
	req.Header.Set("Content-Type", "multipart/form-data; boundary=boundary")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusUnsupportedMediaType {
		t.Fatalf("multipart to non-install endpoint expected 415, got %d", resp.StatusCode)
	}

	// 4. Non-loopback Host rejected with 403.
	reqHost, _ := http.NewRequest(http.MethodGet, server.URL+"/api/courses/packages", nil)
	reqHost.Host = "evil.example:43188"
	resp, err = http.DefaultClient.Do(reqHost)
	if err != nil {
		t.Fatal(err)
	}
	resp.Body.Close()
	if resp.StatusCode != http.StatusForbidden {
		t.Fatalf("non-loopback Host expected 403, got %d", resp.StatusCode)
	}
}
