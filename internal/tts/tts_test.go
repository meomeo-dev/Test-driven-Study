package tts

import (
	"context"
	"encoding/binary"
	"net/http"
	"net/http/httptest"
	"os"
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
	if settings.WriteToken == "" {
		t.Fatalf("expected non-empty write token")
	}

	key := "test-secret-key-123"
	err := svc.Save(ProviderUpdate{
		BaseURL:      "https://test.api.com/v1/tools/tts",
		DefaultVoice: "tide",
		APIKey:       &key,
	}, settings.WriteToken)
	if err != nil {
		t.Fatalf("failed to save settings: %v", err)
	}

	updated := svc.Settings()
	if !updated.Ready || !updated.KeyConfigured {
		t.Fatalf("expected ready service after save")
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

	filePath, err := svc.GetAudioFilePath("stella", res.Key)
	if err != nil {
		t.Fatalf("failed to get audio file path: %v", err)
	}
	fi, err := os.Stat(filePath)
	if err != nil || fi.Size() != 44+480 {
		t.Fatalf("unexpected audio file size: %v", fi.Size())
	}

	// Second call should hit cache
	res2, err := svc.Synthesize(context.Background(), "Hello world", "stella", false)
	if err != nil {
		t.Fatalf("second call failed: %v", err)
	}
	if !res2.Cached {
		t.Fatalf("expected second synthesis to be cached")
	}

	// Force call should bypass cache
	res3, err := svc.Synthesize(context.Background(), "Hello world", "stella", true)
	if err != nil {
		t.Fatalf("force call failed: %v", err)
	}
	if res3.Cached {
		t.Fatalf("expected forced call to not be cached")
	}
}
