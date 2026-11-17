package httpapi_test

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"image"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"

	"test-driven-study/internal/testsupport"
	"time"

	"test-driven-study/internal/httpapi"
	"test-driven-study/internal/palace"
	"test-driven-study/internal/storage"
	"test-driven-study/internal/study"
)

type traceImageProvider struct {
	calls            atomic.Int32
	started, release chan struct{}
	data             []byte
}

func (p *traceImageProvider) Generate(ctx context.Context, _ palace.ProviderInput) (palace.ProviderOutput, error) {
	p.calls.Add(1)
	close(p.started)
	select {
	case <-p.release:
		return palace.ProviderOutput{Bytes: p.data}, nil
	case <-ctx.Done():
		return palace.ProviderOutput{}, ctx.Err()
	}
}

func TestTraceDeliveryResumesReadsWithoutRestartingOrCancelingGeneration(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	root, _ := filepath.Abs("../..")
	directory := t.TempDir()
	db, err := storage.Open(context.Background(), root, directory)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	var imageBytes bytes.Buffer
	png.Encode(&imageBytes, image.NewRGBA(image.Rect(0, 0, 16, 16)))
	provider := &traceImageProvider{started: make(chan struct{}), release: make(chan struct{}), data: imageBytes.Bytes()}
	studyService := study.New(db, root)
	service, err := palace.New(context.Background(), palace.Options{DB: db, Study: studyService, Root: root,
		DataDirectory: directory, Provider: provider, Config: palace.Config{Models: []string{"gpt-image-2"}, DefaultModel: "gpt-image-2"}})
	if err != nil {
		t.Fatal(err)
	}
	defer service.Close()
	server := httptest.NewServer(httpapi.New(studyService, service, root, "43188", "43187"))
	defer server.Close()
	const id = "40000000-0000-4000-8000-000000000091"
	response, payload := call(t, server, "POST", "/api/palaces/jobs", `{"id":"`+id+`","question_id":4}`, "")
	if response.StatusCode != 202 {
		t.Fatal(string(payload))
	}
	select {
	case <-provider.started:
	case <-time.After(3 * time.Second):
		t.Fatal("image did not start")
	}
	_, payload = call(t, server, "GET", "/api/palaces/jobs/"+id+"/trace?after=0", "", "")
	var page palace.TracePage
	if json.Unmarshal(payload, &page) != nil || len(page.Events) < 2 {
		t.Fatal("missing observed spans", string(payload))
	}
	stream, err := http.Get(server.URL + "/api/palaces/jobs/" + id + "/trace/stream?after=0")
	if err != nil {
		t.Fatal(err)
	}
	scanner := bufio.NewScanner(stream.Body)
	for scanner.Scan() {
		if strings.HasPrefix(scanner.Text(), "id: ") {
			break
		}
	}
	stream.Body.Close()
	if provider.calls.Load() != 1 {
		t.Fatal("trace read restarted generation")
	}
	request, _ := http.NewRequest("GET", server.URL+"/api/palaces/jobs/"+id+"/trace/stream?after=0", nil)
	request.Header.Set("Last-Event-ID", strconv.FormatInt(page.Cursor, 10))
	resumed, err := http.DefaultClient.Do(request)
	if err != nil {
		t.Fatal(err)
	}
	defer resumed.Body.Close()
	close(provider.release)
	tail, err := io.ReadAll(resumed.Body)
	if err != nil || !strings.Contains(string(tail), "event: settled") {
		t.Fatal("stream did not settle", err)
	}
	for _, line := range strings.Split(string(tail), "\n") {
		if !strings.HasPrefix(line, "id: ") {
			continue
		}
		cursor, err := strconv.ParseInt(strings.TrimPrefix(line, "id: "), 10, 64)
		if err != nil || cursor <= page.Cursor {
			t.Fatal("replayed trace event", line)
		}
	}
	job, err := service.Get(context.Background(), id)
	if err != nil || job.Status != "succeeded" || provider.calls.Load() != 1 {
		t.Fatal("trace disconnect controlled the job", job, err)
	}
	response, _ = call(t, server, "GET", "/api/palaces/jobs/"+id+"/trace?after=-1", "", "")
	if response.StatusCode != 400 {
		t.Fatal("invalid trace cursor accepted")
	}
}
