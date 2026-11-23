package palace

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"image"
	"image/png"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
)

func testPNG(t *testing.T) []byte {
	t.Helper()
	var out bytes.Buffer
	if err := png.Encode(&out, image.NewRGBA(image.Rect(0, 0, 16, 24))); err != nil {
		t.Fatal(err)
	}
	return out.Bytes()
}

func testConfig(base string) Config {
	return Config{BaseURL: base, APIKey: "test-key-never-public", Models: []string{"gpt-image-2"}, DefaultModel: "gpt-image-2"}
}

func TestProviderJSONMultipartAndLocalDownload(t *testing.T) {
	data := testPNG(t)
	var posts, downloads atomic.Int32
	var server *httptest.Server
	server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/result.png" {
			downloads.Add(1)
			if r.Header.Get("Authorization") != "" {
				t.Error("download leaked provider credentials")
			}
			w.Write(data)
			return
		}
		posts.Add(1)
		if r.Header.Get("Authorization") != "Bearer test-key-never-public" {
			t.Error("missing authorization")
		}
		switch r.URL.Path {
		case "/v1/images/generations":
			var body map[string]any
			if json.NewDecoder(r.Body).Decode(&body) != nil {
				t.Error("invalid JSON")
			}
			if body["model"] != "gpt-image-2" || body["n"] != float64(1) || body["output_format"] != "png" || body["response_format"] != nil || body["input_fidelity"] != nil {
				t.Errorf("unexpected image parameters: %v", body)
			}
			if body["resolution"] != nil || body["aspect_ratio"] != nil {
				t.Error("application presets leaked into unsupported upstream fields")
			}
			json.NewEncoder(w).Encode(map[string]any{"data": []any{map[string]string{"b64_json": base64.StdEncoding.EncodeToString(data)}}, "usage": Usage{TotalTokens: 25}})
		case "/v1/images/edits":
			if err := r.ParseMultipartForm(1 << 20); err != nil {
				t.Error(err)
				return
			}
			defer r.MultipartForm.RemoveAll()
			file, header, err := r.FormFile("image[]")
			if err != nil {
				t.Error(err)
				return
			}
			defer file.Close()
			content, _ := io.ReadAll(file)
			if !bytes.Equal(content, data) || header.Filename != "original.png" || r.FormValue("prompt") != "complete prompt" || r.FormValue("n") != "1" {
				t.Error("reference input was not preserved")
			}
			json.NewEncoder(w).Encode(map[string]any{"data": []any{map[string]string{"url": server.URL + "/result.png"}}})
		default:
			t.Error("unexpected route")
			w.WriteHeader(404)
		}
	}))
	defer server.Close()
	provider, err := NewHTTPProvider(testConfig(server.URL + "/v1"))
	if err != nil {
		t.Fatal(err)
	}
	input := ProviderInput{Model: "gpt-image-2", Prompt: "complete prompt", Size: "1152x2048", Quality: "medium"}
	result, err := provider.Generate(context.Background(), input)
	if err != nil || !bytes.Equal(result.Bytes, data) || result.Usage.TotalTokens != 25 {
		t.Fatalf("base64 generation failed: %v", err)
	}
	input.Reference, input.ReferenceName = data, "original.png"
	result, err = provider.Generate(context.Background(), input)
	if err != nil || !bytes.Equal(result.Bytes, data) {
		t.Fatalf("reference edit failed: %v", err)
	}
	if posts.Load() != 2 || downloads.Load() != 1 {
		t.Fatal("unexpected request count")
	}
}

func TestProviderFailureHasNoRetryOrSecretLeak(t *testing.T) {
	var requests atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requests.Add(1)
		w.WriteHeader(502)
		io.WriteString(w, "test-key-never-public private upstream trace")
	}))
	defer server.Close()
	provider, _ := NewHTTPProvider(testConfig(server.URL + "/v1"))
	_, err := provider.Generate(context.Background(), ProviderInput{Model: "gpt-image-2", Prompt: "test"})
	if err == nil || strings.Contains(err.Error(), "test-key") || strings.Contains(err.Error(), "upstream trace") || requests.Load() != 1 {
		t.Fatalf("unsafe failure: %v, requests %d", err, requests.Load())
	}
}

func TestProxyRequiredAndFailClosed(t *testing.T) {
	c := testConfig("https://images.example.invalid/v1")
	if _, err := NewHTTPProvider(c); err == nil {
		t.Fatal("remote provider accepted without proxy")
	}
	var connections atomic.Int32
	proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "CONNECT" {
			t.Error("expected HTTPS tunnel")
		}
		connections.Add(1)
		w.WriteHeader(502)
	}))
	defer proxy.Close()
	c.ProxyURL = proxy.URL
	provider, err := NewHTTPProvider(c)
	if err != nil {
		t.Fatal(err)
	}
	_, err = provider.Generate(context.Background(), ProviderInput{Prompt: "test"})
	if err == nil || connections.Load() != 1 {
		t.Fatal("proxy failure was not terminal")
	}
	for _, raw := range []string{"http://example.org/image.png", "https://127.0.0.1/image.png", "https://192.168.1.1/x", "https://user:password@example.org/x", "file:///etc/passwd"} {
		if _, err := provider.download(context.Background(), raw); err == nil {
			t.Fatalf("unsafe result URL accepted: %s", raw)
		}
	}
}

func TestInvalidImagesAndRedirects(t *testing.T) {
	if _, err := readBounded(strings.NewReader("oversized"), 3); err == nil {
		t.Fatal("oversized response accepted")
	}
	for _, data := range [][]byte{nil, []byte("<html>error</html>"), testPNG(t)[:25]} {
		if _, err := imageMetadata(data); err == nil {
			t.Fatal("corrupt image accepted")
		}
	}
	var destination atomic.Int32
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/redirect" {
			destination.Add(1)
		}
		http.Redirect(w, r, "/redirect", 307)
	}))
	defer server.Close()
	p, _ := NewHTTPProvider(testConfig(server.URL + "/v1"))
	if _, err := p.Generate(context.Background(), ProviderInput{}); err == nil || destination.Load() != 0 {
		t.Fatal("provider redirect followed")
	}
	if _, err := p.download(context.Background(), server.URL+"/image.png"); err == nil || destination.Load() != 0 {
		t.Fatal("download redirect followed")
	}
}

func TestAllowDirectHTTPSInvariants(t *testing.T) {
	t.Setenv("HTTPS_PROXY", "http://127.0.0.1:1")
	t.Setenv("HTTP_PROXY", "http://127.0.0.1:1")

	// 1. Default AllowDirectHTTPS=false rejects empty-proxy remote HTTPS.
	remote := testConfig("https://images.example.invalid/v1")
	if validateConfig(remote) == "" {
		t.Fatal("remote HTTPS without proxy should fail by default")
	}
	if _, err := NewHTTPProvider(remote); err == nil {
		t.Fatal("NewHTTPProvider accepted remote HTTPS without proxy or opt-in")
	}

	// 2. AllowDirectHTTPS=true + empty proxy allows remote HTTPS with Proxy=nil.
	direct := remote
	direct.AllowDirectHTTPS = true
	if msg := validateConfig(direct); msg != "" {
		t.Fatalf("direct HTTPS opt-in rejected: %s", msg)
	}
	provider, err := NewHTTPProvider(direct)
	if err != nil {
		t.Fatalf("NewHTTPProvider direct HTTPS failed: %v", err)
	}
	transport, ok := provider.client.Transport.(*http.Transport)
	if !ok || transport.Proxy != nil {
		t.Fatal("direct HTTPS transport must keep Proxy == nil (ignore env proxy)")
	}
	for _, raw := range []string{
		"http://example.org/image.png",
		"https://127.0.0.1/image.png",
		"https://192.168.1.1/x.png",
		"https://user:password@example.org/x.png",
		"file:///etc/passwd",
	} {
		if _, err := provider.download(context.Background(), raw); err == nil {
			t.Fatalf("unsafe download URL accepted with direct HTTPS: %s", raw)
		}
	}

	// 3. AllowDirectHTTPS=true still rejects remote plaintext HTTP; loopback ok.
	plainRemote := testConfig("http://images.example.invalid/v1")
	plainRemote.AllowDirectHTTPS = true
	if validateConfig(plainRemote) == "" {
		t.Fatal("remote plaintext HTTP accepted with AllowDirectHTTPS=true")
	}
	if _, err := NewHTTPProvider(plainRemote); err == nil {
		t.Fatal("NewHTTPProvider accepted remote plaintext HTTP")
	}
	for _, localURL := range []string{
		"http://127.0.0.1:1/v1",
		"http://localhost:1/v1",
		"http://[::1]:1/v1",
	} {
		if msg := validateConfig(testConfig(localURL)); msg != "" {
			t.Fatalf("loopback %s rejected: %s", localURL, msg)
		}
	}

	// 4. AllowDirectHTTPS=true + ProxyURL always uses proxy with no direct fallback.
	var proxyHits atomic.Int32
	proxy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodConnect {
			t.Errorf("expected CONNECT tunnel, got %s", r.Method)
		}
		proxyHits.Add(1)
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer proxy.Close()
	both := direct
	both.ProxyURL = proxy.URL
	proxied, err := NewHTTPProvider(both)
	if err != nil {
		t.Fatalf("NewHTTPProvider with proxy + opt-in failed: %v", err)
	}
	if _, err := proxied.Generate(context.Background(), ProviderInput{Prompt: "test"}); err == nil || proxyHits.Load() != 1 {
		t.Fatalf("expected single proxied attempt failing closed, err=%v hits=%d", err, proxyHits.Load())
	}
	badProxy := direct
	badProxy.ProxyURL = "ftp://127.0.0.1:8080"
	if validateConfig(badProxy) == "" {
		t.Fatal("invalid proxy accepted with AllowDirectHTTPS=true")
	}

	// Env config with AllowDirectHTTPS=true must not inherit HTTPS_PROXY.
	cfgFile := filepath.Join(t.TempDir(), ".env.gpt-image2")
	envData := "GPT_IMAGE2_1_BASE_URL=https://images.example.invalid/v1\n" +
		"GPT_IMAGE2_1_API_KEY=test-key\n" +
		"GPT_IMAGE2_1_MODELS=gpt-image-2\n" +
		"GPT_IMAGE2_1_ALLOW_DIRECT_HTTPS=true\n"
	if err := os.WriteFile(cfgFile, []byte(envData), 0600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("STUDY_IMAGE_CONFIG_FILE", cfgFile)
	loaded := LoadConfig(t.TempDir())
	if !loaded.AllowDirectHTTPS || loaded.ProxyURL != "" || loaded.Message != "" {
		t.Fatalf("LoadConfig direct HTTPS failed: %+v", loaded)
	}
}
