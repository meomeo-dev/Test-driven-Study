package httpapi_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
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
}
