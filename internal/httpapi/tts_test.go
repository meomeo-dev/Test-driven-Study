package httpapi_test

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"
	"test-driven-study/internal/httpapi"
	"test-driven-study/internal/study"
	"test-driven-study/internal/tts"
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
	if settings.Ready {
		t.Fatalf("expected unready before configuring key")
	}

	// 2. PUT /api/tts/settings without valid token should fail with 403
	key := "mock-api-key"
	saveBody, _ := json.Marshal(tts.ProviderUpdate{
		BaseURL:      "https://api.deepseek.com/v1/tools/tts",
		DefaultVoice: "tide",
		APIKey:       &key,
	})
	req, _ := http.NewRequest(http.MethodPut, server.URL+"/api/tts/settings", bytes.NewReader(saveBody))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Settings-Token", "invalid-token")
	resp2, err := http.DefaultClient.Do(req)
	if err != nil || resp2.StatusCode != http.StatusForbidden {
		t.Fatalf("expected 403 for invalid token, got %v / %d", err, resp2.StatusCode)
	}
	resp2.Body.Close()

	// 3. PUT /api/tts/settings with valid token should succeed
	reqOk, _ := http.NewRequest(http.MethodPut, server.URL+"/api/tts/settings", bytes.NewReader(saveBody))
	reqOk.Header.Set("Content-Type", "application/json")
	reqOk.Header.Set("X-Settings-Token", settings.WriteToken)
	resp3, err := http.DefaultClient.Do(reqOk)
	if err != nil || resp3.StatusCode != http.StatusOK {
		t.Fatalf("expected 200 for valid token, got %v / %d", err, resp3.StatusCode)
	}
	var updatedSettings tts.ProviderSettings
	_ = json.NewDecoder(resp3.Body).Decode(&updatedSettings)
	resp3.Body.Close()

	if !updatedSettings.Ready || !updatedSettings.KeyConfigured {
		t.Fatalf("expected ready service after save")
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
}
