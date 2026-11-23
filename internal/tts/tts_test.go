package tts

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
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
