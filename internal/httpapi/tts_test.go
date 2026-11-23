package httpapi_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"test-driven-study/internal/httpapi"
	"test-driven-study/internal/study"
	"test-driven-study/internal/tts"
	"testing"
)

type mockMemoryCreds struct {
	data map[string]string
}

func (m *mockMemoryCreds) Get(account string) (string, error) {
	v, ok := m.data[account]
	if !ok {
		return "", os.ErrNotExist
	}
	return v, nil
}
func (m *mockMemoryCreds) Set(account, value string) error {
	m.data[account] = value
	return nil
}
func (m *mockMemoryCreds) Delete(account string) error {
	delete(m.data, account)
	return nil
}

func TestTTSRoutes(t *testing.T) {
	tmpDir := t.TempDir()
	creds := &mockMemoryCreds{data: make(map[string]string)}
	ttsService := tts.NewWithCredentials(tmpDir, tmpDir, creds)
	handler := httpapi.New(study.New(nil, tmpDir), nil, tmpDir, "43188", "43187", ttsService)
	server := httptest.NewServer(handler)
	defer server.Close()

	// 1. GET /api/tts/settings
	resp, err := http.Get(server.URL + "/api/tts/settings")
	if err != nil {
		t.Fatalf("GET settings failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}
	var settings tts.ProviderSettings
	if err := json.NewDecoder(resp.Body).Decode(&settings); err != nil {
		t.Fatalf("failed to decode settings: %v", err)
	}
	if settings.Ready || settings.AllowDirectHTTPS {
		t.Fatalf("expected unready and allow_direct_https=false before configuring")
	}

	// 2. PUT /api/tts/settings without valid token should fail with 403
	key := "mock-api-key"
	saveNoDirectBody, _ := json.Marshal(tts.ProviderUpdate{
		BaseURL:      "https://api.deepseek.com/v1/tools/tts",
		DefaultVoice: "tide",
		APIKey:       &key,
	})
	req, _ := http.NewRequest(http.MethodPut, server.URL+"/api/tts/settings", bytes.NewReader(saveNoDirectBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Settings-Token", "invalid-token")
	resp2, err := http.DefaultClient.Do(req)
	if err != nil || resp2.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for invalid token, got %v / %d", err, resp2.StatusCode)
	}
	resp2.Body.Close()

	// 2b. Remote HTTPS without proxy or allow_direct_https must fail with 400 on save & test
	reqBlocked, _ := http.NewRequest(http.MethodPut, server.URL+"/api/tts/settings", bytes.NewReader(saveNoDirectBody))
	reqBlocked.Header.Set("Content-Type", "application/json")
	reqBlocked.Header.Set("X-Settings-Token", settings.WriteToken)
	respBlocked, err := http.DefaultClient.Do(reqBlocked)
	if err != nil || respBlocked.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for remote HTTPS without proxy/opt-in, got %v / %d",
			err, respBlocked.StatusCode)
	}
	respBlocked.Body.Close()

	reqTestBlocked, _ := http.NewRequest(http.MethodPost, server.URL+"/api/tts/settings/test", bytes.NewReader(saveNoDirectBody))
	reqTestBlocked.Header.Set("Content-Type", "application/json")
	reqTestBlocked.Header.Set("X-Settings-Token", settings.WriteToken)
	respTestBlocked, err := http.DefaultClient.Do(reqTestBlocked)
	if err != nil || respTestBlocked.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for test remote HTTPS without proxy/opt-in, got %v / %d",
			err, respTestBlocked.StatusCode)
	}
	respTestBlocked.Body.Close()

	// 2c. Remote plaintext HTTP must still fail with 400 even when allow_direct_https=true
	plainHTTPBody, _ := json.Marshal(tts.ProviderUpdate{
		BaseURL:          "http://api.deepseek.com/v1/tools/tts",
		DefaultVoice:     "tide",
		AllowDirectHTTPS: true,
		APIKey:           &key,
	})
	reqPlainHTTP, _ := http.NewRequest(http.MethodPut, server.URL+"/api/tts/settings", bytes.NewReader(plainHTTPBody))
	reqPlainHTTP.Header.Set("Content-Type", "application/json")
	reqPlainHTTP.Header.Set("X-Settings-Token", settings.WriteToken)
	respPlainHTTP, err := http.DefaultClient.Do(reqPlainHTTP)
	if err != nil || respPlainHTTP.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for remote plaintext HTTP, got %v / %d",
			err, respPlainHTTP.StatusCode)
	}
	respPlainHTTP.Body.Close()

	// 2d. Unknown JSON fields must fail with 400
	reqUnknown, _ := http.NewRequest(http.MethodPut, server.URL+"/api/tts/settings",
		strings.NewReader(`{"base_url":"http://127.0.0.1:1/tts","default_voice":"stella","unknown":1}`))
	reqUnknown.Header.Set("Content-Type", "application/json")
	reqUnknown.Header.Set("X-Settings-Token", settings.WriteToken)
	respUnknown, err := http.DefaultClient.Do(reqUnknown)
	if err != nil || respUnknown.StatusCode != http.StatusBadRequest {
		t.Fatalf("expected 400 for unknown field, got %v / %d", err, respUnknown.StatusCode)
	}
	respUnknown.Body.Close()

	// 3. PUT /api/tts/settings with valid token and allow_direct_https=true should succeed
	saveBody, _ := json.Marshal(tts.ProviderUpdate{
		BaseURL:          "https://api.deepseek.com/v1/tools/tts",
		DefaultVoice:     "tide",
		AllowDirectHTTPS: true,
		APIKey:           &key,
	})
	reqOk, _ := http.NewRequest(http.MethodPut, server.URL+"/api/tts/settings", bytes.NewReader(saveBody))
	reqOk.Header.Set("Content-Type", "application/json")
	reqOk.Header.Set("X-Settings-Token", settings.WriteToken)
	resp3, err := http.DefaultClient.Do(reqOk)
	if err != nil || resp3.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for valid token with allow_direct_https, got %v / %d", err, resp3.StatusCode)
	}
	var updatedSettings tts.ProviderSettings
	_ = json.NewDecoder(resp3.Body).Decode(&updatedSettings)
	resp3.Body.Close()

	if !updatedSettings.Ready || !updatedSettings.KeyConfigured || !updatedSettings.AllowDirectHTTPS {
		t.Fatalf("expected ready service with allow_direct_https=true after save: %+v", updatedSettings)
	}
	if updatedSettings.DefaultVoice != "tide" {
		t.Fatalf("expected default voice tide, got %s", updatedSettings.DefaultVoice)
	}

	// 4. GET /api/audio/stella/nonexistent.wav should return 400 or 404
	respAudio, err := http.Get(server.URL + "/api/audio/stella/0123456789abcdef.wav")
	if err != nil {
		t.Fatalf("audio request failed: %v", err)
	}
	respAudio.Body.Close()
	if respAudio.StatusCode != http.StatusNotFound {
		t.Fatalf("expected 404 for nonexistent audio, got %d", respAudio.StatusCode)
	}

	// 5. Force re-synthesis updates audio content, changes audio_url, and adjusts Cache-Control
	callCount := 0
	mockTTS := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		w.WriteHeader(http.StatusOK)
		if callCount == 1 {
			_, _ = w.Write([]byte("PCM_V1_DATA_1234"))
		} else {
			_, _ = w.Write([]byte("PCM_V2_DATA_5678"))
		}
	}))
	defer mockTTS.Close()

	saveMock, _ := json.Marshal(tts.ProviderUpdate{
		BaseURL:      mockTTS.URL,
		DefaultVoice: "stella",
		APIKey:       &key,
	})
	reqMock, _ := http.NewRequest(http.MethodPut, server.URL+"/api/tts/settings", bytes.NewReader(saveMock))
	reqMock.Header.Set("Content-Type", "application/json")
	reqMock.Header.Set("X-Settings-Token", updatedSettings.WriteToken)
	respMockSave, err := http.DefaultClient.Do(reqMock)
	if err != nil || respMockSave.StatusCode != http.StatusOK {
		t.Fatalf("failed to update TTS provider to mock server: %v / %d", err, respMockSave.StatusCode)
	}
	respMockSave.Body.Close()

	synth := func(force bool) tts.SynthesizeResult {
		body, _ := json.Marshal(map[string]any{
			"text":  "Cache bust test",
			"voice": "stella",
			"force": force,
		})
		r, err := http.Post(server.URL+"/api/tts/synthesize", "application/json", bytes.NewReader(body))
		if err != nil || r.StatusCode != http.StatusOK {
			t.Fatalf("POST /api/tts/synthesize failed: %v / %d", err, r.StatusCode)
		}
		defer r.Body.Close()
		var out tts.SynthesizeResult
		if err := json.NewDecoder(r.Body).Decode(&out); err != nil {
			t.Fatalf("decode synthesize result failed: %v", err)
		}
		return out
	}

	first := synth(false)
	respV1, err := http.Get(server.URL + first.AudioURL)
	if err != nil || respV1.StatusCode != http.StatusOK {
		t.Fatalf("GET versioned v1 audio failed: %v / %d", err, respV1.StatusCode)
	}
	v1Bytes, _ := io.ReadAll(respV1.Body)
	respV1.Body.Close()
	if cc := respV1.Header.Get("Cache-Control"); cc != "public, max-age=31536000, immutable" {
		t.Fatalf("expected immutable cache control for versioned URL, got %q", cc)
	}
	if !bytes.Contains(v1Bytes, []byte("PCM_V1_DATA_1234")) {
		t.Fatalf("expected v1 PCM payload in WAV")
	}

	unversionedURL := strings.Split(first.AudioURL, "?")[0]
	respNoVer, err := http.Get(server.URL + unversionedURL)
	if err != nil || respNoVer.StatusCode != http.StatusOK {
		t.Fatalf("GET unversioned audio failed: %v / %d", err, respNoVer.StatusCode)
	}
	respNoVer.Body.Close()
	if cc := respNoVer.Header.Get("Cache-Control"); cc != "no-cache" {
		t.Fatalf("expected no-cache for unversioned URL, got %q", cc)
	}

	second := synth(true)
	if second.AudioURL == first.AudioURL {
		t.Fatalf("expected forced synthesis to return a new audio_url, still got %q", second.AudioURL)
	}
	respV2, err := http.Get(server.URL + second.AudioURL)
	if err != nil || respV2.StatusCode != http.StatusOK {
		t.Fatalf("GET versioned v2 audio failed: %v / %d", err, respV2.StatusCode)
	}
	v2Bytes, _ := io.ReadAll(respV2.Body)
	respV2.Body.Close()
	if !bytes.Contains(v2Bytes, []byte("PCM_V2_DATA_5678")) {
		t.Fatalf("expected v2 PCM payload in WAV after force regeneration")
	}

	// 6. Empty or whitespace-only text must fail with 400 Bad Request
	for _, blank := range []string{"", "   \t\n "} {
		body, _ := json.Marshal(map[string]any{"text": blank})
		r, err := http.Post(server.URL+"/api/tts/synthesize", "application/json", bytes.NewReader(body))
		if err != nil {
			t.Fatalf("POST /api/tts/synthesize failed: %v", err)
		}
		r.Body.Close()
		if r.StatusCode != http.StatusBadRequest {
			t.Fatalf("expected 400 for blank text %q, got %d", blank, r.StatusCode)
		}
	}
}
