package tts

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
)

type memoryCredentials struct {
	data map[string]string
}

func newMemoryCredentials() *memoryCredentials {
	return &memoryCredentials{data: make(map[string]string)}
}

func (m *memoryCredentials) Get(account string) (string, error) {
	v, ok := m.data[account]
	if !ok {
		return "", os.ErrNotExist
	}
	return v, nil
}

func (m *memoryCredentials) Set(account, value string) error {
	m.data[account] = value
	return nil
}

func (m *memoryCredentials) Delete(account string) error {
	delete(m.data, account)
	return nil
}

func TestPhraseKey(t *testing.T) {
	key1 := PhraseKey("The light doesn't work.")
	key2 := PhraseKey("  The   light   doesn't work.  ")
	if key1 != key2 {
		t.Fatalf("expected identical keys for normalized text, got %q vs %q", key1, key2)
	}
	if len(key1) != 16 {
		t.Fatalf("expected 16-hex key, got %q (len %d)", key1, len(key1))
	}
}

func TestWrapPCM24kToWAV(t *testing.T) {
	// 48000 bytes = exactly 1 second of 24kHz 16-bit mono PCM
	pcm := make([]byte, 48000)
	wav := WrapPCM24kToWAV(pcm)
	if len(wav) != 44+48000 {
		t.Fatalf("expected length %d, got %d", 44+48000, len(wav))
	}
	if string(wav[:4]) != "RIFF" {
		t.Fatalf("expected RIFF header")
	}
	if string(wav[8:12]) != "WAVE" {
		t.Fatalf("expected WAVE header")
	}
	sampleRate := binary.LittleEndian.Uint32(wav[24:28])
	if sampleRate != 24000 {
		t.Fatalf("expected sample rate 24000, got %d", sampleRate)
	}
	subchunk2Size := binary.LittleEndian.Uint32(wav[40:44])
	if subchunk2Size != 48000 {
		t.Fatalf("expected data chunk size 48000, got %d", subchunk2Size)
	}
}

func TestTTSServiceSettingsAndSave(t *testing.T) {
	tmpDir := t.TempDir()
	creds := newMemoryCredentials()
	svc := NewWithCredentials(tmpDir, tmpDir, creds)

	settings := svc.Settings()
	if settings.Ready {
		t.Fatalf("expected unready service before config")
	}
	if settings.AllowDirectHTTPS {
		t.Fatalf("expected allow_direct_https default false")
	}
	if settings.WriteToken == "" {
		t.Fatalf("expected non-empty write token")
	}

	key := "test-secret-key-123"
	if err := svc.Save(ProviderUpdate{
		BaseURL:      "https://test.api.com/v1/tools/tts",
		DefaultVoice: "tide",
		APIKey:       &key,
	}, settings.WriteToken); err == nil {
		t.Fatalf("expected remote HTTPS without proxy or opt-in to fail")
	}

	err := svc.Save(ProviderUpdate{
		BaseURL:          "https://test.api.com/v1/tools/tts",
		DefaultVoice:     "tide",
		APIKey:           &key,
		AllowDirectHTTPS: true,
	}, settings.WriteToken)
	if err != nil {
		t.Fatalf("failed to save settings: %v", err)
	}

	updated := svc.Settings()
	if !updated.Ready || !updated.KeyConfigured || !updated.AllowDirectHTTPS {
		t.Fatalf("expected ready service with allow_direct_https after save: %+v", updated)
	}
	if updated.DefaultVoice != "tide" {
		t.Fatalf("expected default voice tide, got %s", updated.DefaultVoice)
	}
}

func TestTTSServiceSynthesizeMockServer(t *testing.T) {
	// Mock server returning 480 bytes of PCM (10ms)
	pcmSample := make([]byte, 480)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer mock-key" {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(pcmSample)
	}))
	defer server.Close()

	tmpDir := t.TempDir()
	creds := newMemoryCredentials()
	svc := NewWithCredentials(tmpDir, tmpDir, creds)

	key := "mock-key"
	_ = svc.Save(ProviderUpdate{
		BaseURL:      server.URL,
		DefaultVoice: "stella",
		APIKey:       &key,
	}, svc.Settings().WriteToken)

	res, err := svc.Synthesize(context.Background(), "Hello world", "stella", false)
	if err != nil {
		t.Fatalf("synthesis failed: %v", err)
	}
	if res.Cached {
		t.Fatalf("expected first synthesis to not be cached")
	}
	if !strings.Contains(res.AudioURL, "?v=") {
		t.Fatalf("expected versioned audio URL, got %q", res.AudioURL)
	}

	filePath, err := svc.GetAudioFilePath("stella", res.Key)
	if err != nil {
		t.Fatalf("failed to get audio file path: %v", err)
	}
	fi, err := os.Stat(filePath)
	if err != nil || fi.Size() != 44+480 {
		t.Fatalf("unexpected audio file size: %v", fi.Size())
	}

	// Second call should hit cache and preserve the same versioned URL
	res2, err := svc.Synthesize(context.Background(), "Hello world", "stella", false)
	if err != nil {
		t.Fatalf("second call failed: %v", err)
	}
	if !res2.Cached {
		t.Fatalf("expected second synthesis to be cached")
	}
	if res2.AudioURL != res.AudioURL {
		t.Fatalf("expected cached URL %q to match %q", res2.AudioURL, res.AudioURL)
	}

	// Force call should bypass cache and issue a new versioned URL
	res3, err := svc.Synthesize(context.Background(), "Hello world", "stella", true)
	if err != nil {
		t.Fatalf("force call failed: %v", err)
	}
	if res3.Cached {
		t.Fatalf("expected forced call to not be cached")
	}
	if res3.AudioURL == res2.AudioURL {
		t.Fatalf("expected forced regeneration to change audio URL, still got %q", res3.AudioURL)
	}

	// Subsequent cached call should return the newly regenerated versioned URL
	res4, err := svc.Synthesize(context.Background(), "Hello world", "stella", false)
	if err != nil {
		t.Fatalf("fourth call failed: %v", err)
	}
	if !res4.Cached || res4.AudioURL != res3.AudioURL {
		t.Fatalf("expected cached call after force to return %q, got %q (cached=%v)", res3.AudioURL, res4.AudioURL, res4.Cached)
	}
}

func TestSynthesizeUsesConfiguredVoiceWhenOmitted(t *testing.T) {
	providerVoices := make(chan string, 4)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var input struct {
			Voice string `json:"voice_id"`
		}
		if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
			http.Error(w, "invalid request", http.StatusBadRequest)
			return
		}
		providerVoices <- input.Voice
		_, _ = w.Write(make([]byte, 480))
	}))
	defer server.Close()

	directory := t.TempDir()
	service := NewWithCredentials(directory, directory, newMemoryCredentials())
	key := "mock-key"
	for _, check := range []struct {
		name, defaultVoice, requested, want string
		cached                              bool
	}{
		{"default tide", "tide", "", "tide", false},
		{"explicit stella", "tide", "stella", "stella", false},
		{"changed default", "stella", "", "stella", true},
		{"explicit tide", "stella", "tide", "tide", true},
	} {
		t.Run(check.name, func(t *testing.T) {
			err := service.Save(ProviderUpdate{
				BaseURL: server.URL, DefaultVoice: check.defaultVoice, APIKey: &key,
			}, service.Settings().WriteToken)
			if err != nil {
				t.Fatal(err)
			}
			result, err := service.Synthesize(t.Context(), "雷雨", check.requested, false)
			if err != nil {
				t.Fatal(err)
			}
			if result.Voice != check.want || result.Cached != check.cached ||
				!strings.HasPrefix(result.AudioURL, "/api/audio/"+check.want+"/") {
				t.Fatalf("unexpected audio selection: %+v", result)
			}
			select {
			case voice := <-providerVoices:
				if voice != check.want || check.cached {
					t.Fatalf("unexpected upstream voice_id %q", voice)
				}
			default:
				if !check.cached {
					t.Fatal("missing upstream synthesis request")
				}
			}
		})
	}
}

func TestTTSServiceTestSendsVoiceIDPayload(t *testing.T) {
	var gotMethod, gotContentType, gotAuth string
	var gotRaw []byte
	server := httptest.NewServer(http.HandlerFunc(func(
		w http.ResponseWriter, r *http.Request,
	) {
		gotMethod = r.Method
		gotContentType = r.Header.Get("Content-Type")
		gotAuth = r.Header.Get("Authorization")
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, "read failed", http.StatusInternalServerError)
			return
		}
		gotRaw = body
		var fields map[string]any
		if err := json.Unmarshal(body, &fields); err != nil {
			http.Error(w, "invalid json", http.StatusBadRequest)
			return
		}
		if _, hasLegacy := fields["voice"]; hasLegacy {
			http.Error(w, "unexpected field: voice", http.StatusBadRequest)
			return
		}
		if fields["voice_id"] != "stella" ||
			fields["text"] != "OK" ||
			fields["format"] != "pcm" ||
			len(fields) != 3 {
			http.Error(w, "invalid payload", http.StatusBadRequest)
			return
		}
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write(make([]byte, 480))
	}))
	defer server.Close()

	dir := t.TempDir()
	svc := NewWithCredentials(dir, dir, newMemoryCredentials())
	key := "test-api-key"
	msg, err := svc.Test(t.Context(), ProviderUpdate{
		BaseURL: server.URL,
		APIKey:  &key,
	}, svc.Settings().WriteToken)
	if err != nil {
		t.Fatalf("Test() failed: %v", err)
	}
	if msg == "" {
		t.Fatal("expected non-empty success message")
	}
	if gotMethod != http.MethodPost {
		t.Fatalf("expected POST, got %q", gotMethod)
	}
	if gotContentType != "application/json" {
		t.Fatalf("expected application/json, got %q", gotContentType)
	}
	if gotAuth != "Bearer test-api-key" {
		t.Fatalf("expected Bearer auth header, got %q", gotAuth)
	}
	const wantBody = `{"text":"OK","voice_id":"stella","format":"pcm"}`
	if string(gotRaw) != wantBody {
		t.Fatalf("expected JSON body %s, got %s", wantBody, string(gotRaw))
	}
}

func TestTTSAllowDirectHTTPSInvariantsAndPersistence(t *testing.T) {
	t.Setenv("HTTPS_PROXY", "http://127.0.0.1:1")
	t.Setenv("HTTP_PROXY", "http://127.0.0.1:1")

	dir := t.TempDir()
	creds := newMemoryCredentials()
	svc := NewWithCredentials(dir, dir, creds)
	key := "tts-secret-key"

	// 1. Default AllowDirectHTTPS=false rejects empty-proxy remote HTTPS.
	remote := ProviderUpdate{
		BaseURL: "https://tts.example.invalid/v1/tools/tts",
		APIKey:  &key,
	}
	if err := svc.Save(remote, svc.Settings().WriteToken); err == nil {
		t.Fatal("Save accepted remote HTTPS without proxy or opt-in")
	}
	if _, err := svc.Test(t.Context(), remote, svc.Settings().WriteToken); err == nil {
		t.Fatal("Test accepted remote HTTPS without proxy or opt-in")
	}

	// 3. AllowDirectHTTPS=true still rejects remote plaintext HTTP; loopback ok.
	plainRemote := ProviderUpdate{
		BaseURL:          "http://tts.example.invalid/v1/tools/tts",
		APIKey:           &key,
		AllowDirectHTTPS: true,
	}
	if err := svc.Save(plainRemote, svc.Settings().WriteToken); err == nil {
		t.Fatal("Save accepted remote plaintext HTTP with AllowDirectHTTPS=true")
	}
	if _, err := svc.Test(t.Context(), plainRemote, svc.Settings().WriteToken); err == nil {
		t.Fatal("Test accepted remote plaintext HTTP with AllowDirectHTTPS=true")
	}
	for _, localURL := range []string{
		"http://127.0.0.1:1/tts",
		"http://localhost:1/tts",
		"http://[::1]:1/tts",
	} {
		if msg := validateEndpoint(localURL, "", false); msg != "" {
			t.Fatalf("loopback %s rejected: %s", localURL, msg)
		}
	}

	// 2 & 5. AllowDirectHTTPS=true persists and uses transport.Proxy == nil.
	direct := remote
	direct.AllowDirectHTTPS = true
	if err := svc.Save(direct, svc.Settings().WriteToken); err != nil {
		t.Fatalf("Save direct HTTPS failed: %v", err)
	}
	raw, err := os.ReadFile(filepath.Join(dir, "tts-provider.json"))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), `"allow_direct_https":true`) {
		t.Fatalf("tts-provider.json missing allow_direct_https: %s", raw)
	}
	client, err := svc.httpClient("")
	if err != nil {
		t.Fatal(err)
	}
	if tr, ok := client.Transport.(*http.Transport); !ok || tr.Proxy != nil {
		t.Fatal("direct HTTPS transport must keep Proxy == nil (ignore env proxy)")
	}
	reloaded := NewWithCredentials(dir, dir, creds)
	if got := reloaded.Settings(); !got.AllowDirectHTTPS || !got.Ready {
		t.Fatalf("reloaded direct HTTPS mismatch: %+v", got)
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
	if err := reloaded.Save(both, reloaded.Settings().WriteToken); err != nil {
		t.Fatalf("Save with proxy + opt-in failed: %v", err)
	}
	if _, err := reloaded.Test(t.Context(), both, reloaded.Settings().WriteToken); err == nil {
		t.Fatal("expected proxied Test to fail when proxy returns 502")
	}
	if _, err := reloaded.Synthesize(t.Context(), "Hello", "stella", true); err == nil {
		t.Fatal("expected proxied Synthesize to fail when proxy returns 502")
	}
	if hits := proxyHits.Load(); hits != 2 {
		t.Fatalf("expected 2 proxied calls (Test + Synthesize), got %d", hits)
	}
	badProxy := direct
	badProxy.ProxyURL = "ftp://127.0.0.1:8080"
	if err := reloaded.Save(badProxy, reloaded.Settings().WriteToken); err == nil {
		t.Fatal("Save accepted invalid proxy with AllowDirectHTTPS=true")
	}
	// Clearing proxy in Test without AllowDirectHTTPS must reject instead of reusing old proxy.
	if _, err := reloaded.Test(t.Context(), ProviderUpdate{
		BaseURL:          "https://tts.example.invalid/v1/tools/tts",
		ProxyURL:         "",
		AllowDirectHTTPS: false,
	}, reloaded.Settings().WriteToken); err == nil {
		t.Fatal("Test clearing proxy without AllowDirectHTTPS should fail")
	}

	// 5. Legacy tts-provider.json omitting allow_direct_https defaults to false.
	legacyDir := t.TempDir()
	legacyCreds := newMemoryCredentials()
	account := "account_0123456789abcdef0123456789abcdef"
	_ = legacyCreds.Set(account, `{"api_key":"legacy-key"}`)
	legacyNoProxy := `{"version":1,"account":"` + account + `","base_url":"https://api.deepseek.com/v1/tools/tts","default_voice":"stella","proxy_url":""}`
	if err := os.WriteFile(filepath.Join(legacyDir, "tts-provider.json"), []byte(legacyNoProxy), 0600); err != nil {
		t.Fatal(err)
	}
	legacySvc := NewWithCredentials(legacyDir, legacyDir, legacyCreds)
	if got := legacySvc.Settings(); got.AllowDirectHTTPS || got.Ready {
		t.Fatalf("legacy config without proxy should default false and unready: %+v", got)
	}
	if _, err := legacySvc.Synthesize(t.Context(), "Hello", "stella", false); err == nil {
		t.Fatal("legacy config without proxy or opt-in should reject Synthesize")
	}

	legacyWithProxy := `{"version":1,"account":"` + account + `","base_url":"https://api.deepseek.com/v1/tools/tts","default_voice":"stella","proxy_url":"http://127.0.0.1:7890"}`
	if err := os.WriteFile(filepath.Join(legacyDir, "tts-provider.json"), []byte(legacyWithProxy), 0600); err != nil {
		t.Fatal(err)
	}
	legacyProxied := NewWithCredentials(legacyDir, legacyDir, legacyCreds)
	if got := legacyProxied.Settings(); got.AllowDirectHTTPS || !got.Ready {
		t.Fatalf("legacy config with proxy should default AllowDirectHTTPS=false and Ready=true: %+v", got)
	}
}
