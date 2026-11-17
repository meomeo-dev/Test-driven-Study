package httpapi_test

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"test-driven-study/internal/httpapi"
	"test-driven-study/internal/llm"
	"test-driven-study/internal/palace"
	"test-driven-study/internal/storage"
	"test-driven-study/internal/study"
)

func TestLLMSettingsIndependentWriteTokenAndSecretMasking(t *testing.T) {
	ctx := context.Background()
	root, _ := filepath.Abs("../..")
	directory := t.TempDir()
	db, err := storage.Open(ctx, root, directory)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	studyService := study.New(db, root)
	images, err := palace.New(ctx, palace.Options{DB: db, Study: studyService, Root: root,
		DataDirectory: directory, Config: palace.Config{Message: "disabled"}, Credentials: testCredentials{}})
	if err != nil {
		t.Fatal(err)
	}
	defer images.Close()
	planner, err := llm.New(ctx, llm.Options{DB: db, DataDirectory: directory, Config: llm.Config{Message: "disabled"}, Credentials: testCredentials{}})
	if err != nil {
		t.Fatal(err)
	}
	defer planner.Close()
	server := httptest.NewServer(httpapi.New(studyService, images, root, "43188", "43187", planner))
	defer server.Close()
	_, data := call(t, server, "GET", "/api/llm/settings", "", "")
	var state llm.ProviderSettings
	json.Unmarshal(data, &state)
	body := `{"base_url":"http://127.0.0.1:1/v1","models":["fixture"],"proxy_url":"","api_key":"llm-secret-only","clear_key":false,"reuse_key":false,"default_model":"fixture","reasoning_effort":"high","max_output_tokens_k":32}`
	send := func(token, origin string) (int, string) {
		req, _ := http.NewRequest("PUT", server.URL+"/api/llm/settings", strings.NewReader(body))
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", origin)
		req.Header.Set("X-Settings-Token", token)
		res, err := server.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		bytes, _ := io.ReadAll(res.Body)
		return res.StatusCode, string(bytes)
	}
	if code, _ := send(images.ProviderSettings().WriteToken, "http://127.0.0.1:43187"); code != 403 {
		t.Fatal("image settings token authorized LLM write")
	}
	if code, _ := send(state.WriteToken, "https://foreign.example"); code != 403 {
		t.Fatal("foreign origin authorized")
	}
	if code, body := send(state.WriteToken, "http://127.0.0.1:43187"); code != 200 || strings.Contains(body, "llm-secret-only") {
		t.Fatal("LLM save failed or leaked key")
	}
	bad := body
	body = strings.Replace(body, `"max_output_tokens_k":32`, `"max_output_tokens_k":129`, 1)
	if code, _ := send(state.WriteToken, "http://127.0.0.1:43187"); code != 400 {
		t.Fatal("out-of-range token budget accepted")
	}
	body = bad
	body = strings.Replace(body, `"reasoning_effort":"high"`, `"reasoning_effort":"invented"`, 1)
	if code, _ := send(state.WriteToken, "http://127.0.0.1:43187"); code != 400 {
		t.Fatal("invalid effort accepted")
	}
	body = bad
	if images.ProviderSettings().KeyConfigured {
		t.Fatal("LLM save altered image credentials")
	}
	missing, _ := call(t, server, "GET", "/api/llm/plans/7f7f3646-0789-46a4-86b7-bf1d979e6cb2", "", "")
	if missing.StatusCode != 404 {
		t.Fatal("missing plan did not return 404")
	}
	res, data := call(t, server, "GET", "/api/llm/info", "", "")
	if res.Header.Get("Cache-Control") != "no-store" || strings.Contains(string(data), "llm-secret-only") || strings.Contains(string(data), "base_url") {
		t.Fatal("LLM info leaked configuration")
	}
}
