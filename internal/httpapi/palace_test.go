package httpapi_test

import (
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/png"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"test-driven-study/internal/testsupport"
	"time"

	"test-driven-study/internal/httpapi"
	"test-driven-study/internal/palace"
	"test-driven-study/internal/storage"
	"test-driven-study/internal/study"
)

type localImages struct{ data []byte }

func (p localImages) Generate(context.Context, palace.ProviderInput) (palace.ProviderOutput, error) {
	return palace.ProviderOutput{Bytes: p.data}, nil
}

func TestPalaceHTTPContract(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	root, _ := filepath.Abs("../..")
	directory := t.TempDir()
	db, err := storage.Open(context.Background(), root, directory)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var encoded bytes.Buffer
	png.Encode(&encoded, image.NewRGBA(image.Rect(0, 0, 16, 24)))
	studyService := study.New(db, root)
	palaces, err := palace.New(context.Background(), palace.Options{DB: db, Study: studyService, Root: root,
		DataDirectory: directory, Config: palace.Config{Models: []string{"gpt-image-2"}, DefaultModel: "gpt-image-2", APIKey: "never-serve-this-key", BaseURL: "https://private.example.invalid/v1"}, Provider: localImages{encoded.Bytes()}})
	if err != nil {
		t.Fatal(err)
	}
	defer palaces.Close()
	server := httptest.NewServer(httpapi.New(studyService, palaces, root, "43188", "43187"))
	defer server.Close()
	response, payload := call(t, server, "GET", "/api/palaces/info", "", "")
	if response.StatusCode != 200 || strings.Contains(string(payload), "never-serve-this-key") || strings.Contains(string(payload), "private.example") {
		t.Fatal("unsafe info endpoint")
	}
	_, payload = call(t, server, "POST", "/api/palaces/preview", `{"question_id":4,"palace_address":"test hall"}`, "")
	var preview palace.Preview
	if json.Unmarshal(payload, &preview) != nil || !strings.Contains(preview.Prompt, "test hall") {
		t.Fatal("prompt preview missing")
	}
	const id = "40000000-0000-4000-8000-000000000001"
	const body = `{"id":"` + id + `","question_id":4,"model":"gpt-image-2","quality":"low","size":"1152x2048","palace_address":"test hall","use_reference":true}`
	response, _ = call(t, server, "POST", "/api/palaces/jobs", body, "")
	if response.StatusCode != 202 {
		t.Fatal("job not accepted", response.StatusCode)
	}
	var job palace.Job
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		_, payload = call(t, server, "GET", "/api/palaces/jobs/"+id, "", "")
		json.Unmarshal(payload, &job)
		if job.Status == "succeeded" {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if job.Status != "succeeded" {
		t.Fatalf("job incomplete: %s", payload)
	}
	response, payload = call(t, server, "GET", "/api/palaces/coverage?subject=1", "", "")
	if response.StatusCode != 200 || !strings.Contains(string(payload), id) {
		t.Fatal("coverage omitted successful image")
	}
	response, payload = call(t, server, "GET", "/api/palaces/jobs/"+id+"/image?download=1", "", "")
	if response.StatusCode != 200 || response.Header.Get("Content-Type") != "image/png" || !strings.Contains(response.Header.Get("Content-Disposition"), "attachment;") || !bytes.Equal(payload, encoded.Bytes()) {
		t.Fatal("saved image download differs")
	}
	response, payload = call(t, server, "GET", "/api/tasks?scope=all", "", "")
	var page palace.TaskPage
	if response.StatusCode != 200 || json.Unmarshal(payload, &page) != nil || len(page.Tasks) != 1 ||
		page.Tasks[0].ID != id || strings.Contains(string(payload), "snapshot") ||
		strings.Contains(string(payload), "never-serve-this-key") {
		t.Fatal("unsafe or incomplete global task summary")
	}
	response, payload = call(t, server, "GET", "/api/tasks/"+id+"/events", "", "")
	var events []palace.TaskEvent
	if response.StatusCode != 200 || json.Unmarshal(payload, &events) != nil || len(events) != 3 ||
		events[0].ToState != "queued" || events[2].ToState != "succeeded" {
		t.Fatal("lifecycle events unavailable", string(payload))
	}
	for _, test := range []struct {
		method, path, body string
		status             int
	}{
		{"POST", "/api/palaces/jobs", strings.Replace(body, "test hall", "changed", 1), 409},
		{"POST", "/api/palaces/jobs", strings.Replace(body, "1152x2048", "999x999", 1), 400},
		{"POST", "/api/palaces/preview", `{"question_id":0}`, 400},
		{"POST", "/api/palaces/preview", `{"question_id":4,"key":"forbidden"}`, 400},
		{"POST", "/api/palaces/jobs/" + id + "/cancel", `{"unknown":true}`, 400},
		{"POST", "/api/palaces/jobs/" + id + "/pause", `{}`, 409},
		{"POST", "/api/palaces/jobs/" + id + "/resume", `{}`, 409},
		{"POST", "/api/palaces/jobs/" + id + "/pause", `{"unknown":true}`, 400},
		{"POST", "/api/palaces/jobs/" + id + "/retry", `{"id":"invalid"}`, 400},
		{"POST", "/api/palaces/jobs/" + id + "/retry-image", `{"id":"invalid"}`, 400},
		{"POST", "/api/palaces/jobs/" + id + "/retry-image", `{"id":"40000000-0000-4000-8000-000000000003","prompt":"forbidden"}`, 400},
		{"POST", "/api/palaces/jobs/" + id + "/unknown", `{}`, 404},
		{"GET", "/api/tasks?scope=invalid", "", 400},
		{"GET", "/api/tasks?before=invalid", "", 400},
		{"GET", "/api/tasks/not-a-uuid/events", "", 400},
		{"GET", "/api/palaces/jobs?subject=9", "", 400},
		{"GET", "/api/palaces/jobs?question=-1", "", 400},
		{"GET", "/api/palaces/jobs/not-a-uuid", "", 400},
		{"GET", "/api/palaces/jobs/40000000-0000-4000-8000-000000000002/image", "", 404},
	} {
		response, payload = call(t, server, test.method, test.path, test.body, "")
		if response.StatusCode != test.status {
			t.Errorf("%s: got %d want %d: %s", test.path, response.StatusCode, test.status, payload)
		}
	}
	response, payload = call(t, server, "POST", "/api/palaces/jobs/"+id+"/retry-image",
		`{"id":"40000000-0000-4000-8000-000000000003","quality":"high"}`, "")
	var retried palace.Job
	if !job.CanRetryImage || !page.Tasks[0].CanRetryImage || response.StatusCode != 202 ||
		json.Unmarshal(payload, &retried) != nil || retried.Snapshot.RetryOf != id ||
		retried.Snapshot.Prompt != job.Snapshot.Prompt || retried.Snapshot.Settings.Quality != "high" {
		t.Fatal("image-only HTTP contract failed", response.StatusCode, string(payload))
	}
}
