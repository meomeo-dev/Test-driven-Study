package httpapi_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"test-driven-study/internal/httpapi"
	"test-driven-study/internal/storage"
	"test-driven-study/internal/study"
)

func TestFrontendRoutesServeIndexHTML(t *testing.T) {
	ctx := context.Background()
	root := t.TempDir()
	distDir := filepath.Join(root, "dist")
	assetsDir := filepath.Join(distDir, "assets")
	if err := os.MkdirAll(assetsDir, 0o755); err != nil {
		t.Fatal(err)
	}
	indexHTML := "<!doctype html><title>spa-shell</title>"
	assetJS := "console.log('bundle');"
	if err := os.WriteFile(
		filepath.Join(distDir, "index.html"), []byte(indexHTML), 0o644,
	); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(
		filepath.Join(assetsDir, "app.js"), []byte(assetJS), 0o644,
	); err != nil {
		t.Fatal(err)
	}
	db, err := storage.Open(ctx, root, t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	server := httptest.NewServer(
		httpapi.New(study.New(db, root), nil, root, "43188", "43187"),
	)
	defer server.Close()

	spaRoutes := []string{
		"/",
		"/memorize",
		"/practice",
		"/analysis",
		"/palace",
		"/guide",
		"/exam",
		"/learning",
		"/learning?subject=1&course=beginner-english",
		"/courses",
		"/courses/beginner-english",
		"/courses/beginner-english/unit-1",
	}
	for _, route := range spaRoutes {
		for _, method := range []string{http.MethodGet, http.MethodHead} {
			res, body := call(t, server, method, route, "", "")
			if res.StatusCode != http.StatusOK {
				t.Fatalf("%s %s: got %d, want 200 (%s)", method, route, res.StatusCode, body)
			}
			if method == http.MethodGet && string(body) != indexHTML {
				t.Fatalf("GET %s: got %q, want %q", route, string(body), indexHTML)
			}
		}
	}

	res, body := call(t, server, http.MethodGet, "/assets/app.js", "", "")
	if res.StatusCode != http.StatusOK || string(body) != assetJS {
		t.Fatalf("GET /assets/app.js: got %d %q", res.StatusCode, string(body))
	}
	for _, missing := range []string{"/assets/missing.js", "/nonexistent"} {
		res, body := call(t, server, http.MethodGet, missing, "", "")
		if res.StatusCode != http.StatusNotFound || strings.Contains(string(body), "spa-shell") {
			t.Fatalf("GET %s: got %d %q, want 404 without SPA fallback",
				missing, res.StatusCode, string(body))
		}
	}
	res, _ = call(t, server, http.MethodPost, "/learning", "{}", "")
	if res.StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("POST /learning: got %d, want 405", res.StatusCode)
	}
}
