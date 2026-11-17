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
	"test-driven-study/internal/palace"
	"test-driven-study/internal/storage"
	"test-driven-study/internal/study"
)

type testCredentials map[string]string

func (s testCredentials) Get(key string) (string, error) { return s[key], nil }
func (s testCredentials) Set(key, value string) error    { s[key] = value; return nil }
func (s testCredentials) Delete(key string) error        { delete(s, key); return nil }

func TestProviderSettingsCSRFAndMaskedReadContract(t *testing.T) {
	root, _ := filepath.Abs("../..")
	directory := t.TempDir()
	db, err := storage.Open(context.Background(), root, directory)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	studyService := study.New(db, root)
	palaces, err := palace.New(context.Background(), palace.Options{DB: db, Study: studyService, Root: root,
		DataDirectory: directory, Config: palace.Config{Message: "unconfigured"}, Credentials: testCredentials{}})
	if err != nil {
		t.Fatal(err)
	}
	defer palaces.Close()
	server := httptest.NewServer(httpapi.New(studyService, palaces, root, "43188", "43187"))
	defer server.Close()
	response, payload := call(t, server, "GET", "/api/palaces/settings", "", "")
	if response.Header.Get("Cache-Control") != "no-store" {
		t.Fatal("settings response can be cached")
	}
	var settings palace.ProviderSettings
	if json.Unmarshal(payload, &settings) != nil || settings.WriteToken == "" {
		t.Fatal("missing settings token")
	}
	body := `{"base_url":"http://127.0.0.1:1/v1","models":["gpt-image-2"],"proxy_url":"","api_key":"do-not-return-this-key","clear_key":false,"reuse_key":false}`
	response, _ = call(t, server, "PUT", "/api/palaces/settings", body, "")
	if response.StatusCode != 403 {
		t.Fatal("unprotected settings write")
	}
	send := func(origin, body string) (int, []byte) {
		req, _ := http.NewRequest("PUT", server.URL+"/api/palaces/settings", strings.NewReader(body))
		req.Header.Set("X-Settings-Token", settings.WriteToken)
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Origin", origin)
		res, err := server.Client().Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		payload, _ := io.ReadAll(res.Body)
		return res.StatusCode, payload
	}
	if status, _ := send("https://foreign.example", body); status != 403 {
		t.Fatal("cross-origin settings accepted")
	}
	status, payload := send("http://127.0.0.1:43187", body)
	if status != 200 || strings.Contains(string(payload), "do-not-return-this-key") {
		t.Fatalf("settings save failed or leaked key: %d %s", status, payload)
	}
	_, payload = call(t, server, "GET", "/api/palaces/settings", "", "")
	if strings.Contains(string(payload), "do-not-return-this-key") || !strings.Contains(string(payload), `"key_configured":true`) {
		t.Fatal("saved key was not masked")
	}
	if status, _ := send("http://127.0.0.1:43187", strings.Replace(body, `"models":`, `"unknown":1,"models":`, 1)); status != 400 {
		t.Fatal("unknown settings field accepted")
	}
}
