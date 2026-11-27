package palace

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"

	"test-driven-study/internal/testsupport"
)

type memoryCredentials struct {
	mutex sync.Mutex
	data  map[string]string
	fail  bool
}

func (m *memoryCredentials) Get(id string) (string, error) {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	if m.fail {
		return "", errors.New("secret backend unavailable")
	}
	value, ok := m.data[id]
	if !ok {
		return "", errors.New("missing item")
	}
	return value, nil
}
func (m *memoryCredentials) Set(id, value string) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	if m.fail {
		return errors.New("never log test-secret-backend")
	}
	m.data[id] = value
	return nil
}
func (m *memoryCredentials) Delete(id string) error {
	m.mutex.Lock()
	defer m.mutex.Unlock()
	delete(m.data, id)
	return nil
}
func memoryStore() *memoryCredentials { return &memoryCredentials{data: map[string]string{}} }
func settingsInput(s *Service) ProviderUpdate {
	value := s.ProviderSettings()
	return ProviderUpdate{
		BaseURL:          value.BaseURL,
		Models:           value.Models,
		ProxyURL:         value.ProxyURL,
		AllowDirectHTTPS: value.AllowDirectHTTPS,
	}
}

func TestKeyringSettingsRetainReplaceClearAndRestart(t *testing.T) {
	options := testOptions(t, nil)
	store := memoryStore()
	options.Credentials = store
	s, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	input := settingsInput(s)
	saved, err := s.SaveProvider(context.Background(), input)
	if err != nil {
		t.Fatal(err)
	}
	if !saved.Ready || !saved.KeyConfigured || saved.Storage != "system_keyring" {
		t.Fatal("key was not retained")
	}
	if s.AuthorizeSettings("") || !s.AuthorizeSettings(saved.WriteToken) {
		t.Fatal("unsafe write-token validation")
	}
	metadata, _ := os.ReadFile(s.settingsFile)
	view, _ := json.Marshal(saved)
	if strings.Contains(string(metadata), options.Config.APIKey) || strings.Contains(string(view), options.Config.APIKey) || strings.Contains(string(view), "api_key") {
		t.Fatal("saved/read settings leaked key")
	}
	info, _ := os.Stat(s.settingsFile)
	if info.Mode().Perm() != 0600 {
		t.Fatal("settings index permissions are not private")
	}
	s.Close()
	reloaded, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	defer reloaded.Close()
	if reloaded.config.APIKey != options.Config.APIKey || !reloaded.Info().Ready {
		t.Fatal("saved key was not restored")
	}
	replacement := "replacement-secret"
	input.APIKey = &replacement
	if _, err := reloaded.SaveProvider(context.Background(), input); err != nil {
		t.Fatal(err)
	}
	if reloaded.config.APIKey != replacement || len(store.data) != 1 {
		t.Fatal("replacement left old active credentials")
	}
	input.APIKey = nil
	input.ClearKey = true
	saved, err = reloaded.SaveProvider(context.Background(), input)
	if err != nil || saved.Ready || saved.KeyConfigured || reloaded.config.APIKey != "" {
		t.Fatal("explicit removal did not disable provider")
	}
}

func TestSettingsFailureAndOriginBoundKeyReuse(t *testing.T) {
	options := testOptions(t, nil)
	store := memoryStore()
	options.Credentials = store
	s := newService(t, options)
	input := settingsInput(s)
	input.BaseURL = "https://new.example.invalid/v1"
	input.ProxyURL = "http://127.0.0.1:1"
	if _, err := s.SaveProvider(context.Background(), input); err == nil {
		t.Fatal("old key reused at new origin without consent")
	}
	input.ReuseKey = true
	store.fail = true
	if _, err := s.SaveProvider(context.Background(), input); err == nil || strings.Contains(err.Error(), "test-secret-backend") {
		t.Fatal("unsafe keyring failure")
	}
	if s.config.BaseURL != options.Config.BaseURL {
		t.Fatal("failed save changed active configuration")
	}
	store.fail = false
	if _, err := s.SaveProvider(context.Background(), input); err != nil {
		t.Fatal(err)
	}
	store.fail = true
	// A missing/locked keyring never falls back to the earlier dotenv key.
	s.Close()
	reloaded := newService(t, options)
	if reloaded.config.APIKey != "" || reloaded.config.Message == "" || reloaded.Info().Ready {
		t.Fatal("locked keyring fell back to plaintext")
	}
}

func TestActiveJobsBlockProviderChanges(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	options := testOptions(t, providerFunc(func(ctx context.Context, _ ProviderInput) (ProviderOutput, error) {
		<-ctx.Done()
		return ProviderOutput{}, ctx.Err()
	}))
	options.Credentials = memoryStore()
	s := newService(t, options)
	input := CreateInput{ID: "60000000-0000-4000-8000-000000000001", QuestionID: 4}
	if _, err := s.Create(context.Background(), input); err != nil {
		t.Fatal(err)
	}
	if _, err := s.SaveProvider(context.Background(), settingsInput(s)); err == nil {
		t.Fatal("changed provider while paid job was active")
	}
}

func TestConnectionCheckUsesReadOnlyModelsRoute(t *testing.T) {
	calls := 0
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		if r.Method != "GET" || r.URL.Path != "/v1/models" || r.Header.Get("Authorization") != "Bearer test-key-never-public" {
			t.Error("unsafe connection check")
		}
		json.NewEncoder(w).Encode(map[string]any{"data": []any{map[string]string{"id": "gpt-image-2"}}})
	}))
	defer server.Close()
	options := testOptions(t, nil)
	options.Config = testConfig(server.URL + "/v1")
	options.Credentials = memoryStore()
	s := newService(t, options)
	result, err := s.TestProvider(context.Background(), settingsInput(s))
	if err != nil || !result.Connected || len(result.AvailableModels) != 1 || calls != 1 {
		t.Fatal("model-list test failed")
	}
	if _, err := os.Stat(s.settingsFile); !os.IsNotExist(err) {
		t.Fatal("connection test persisted settings")
	}
}

func TestProxyCredentialsStayOutOfReadMetadata(t *testing.T) {
	options := testOptions(t, nil)
	options.Config.ProxyURL = "http://user:proxy-secret@127.0.0.1:18890"
	options.Credentials = memoryStore()
	s := newService(t, options)
	view := s.ProviderSettings()
	body, _ := json.Marshal(view)
	if strings.Contains(string(body), "proxy-secret") || !view.ProxyAuthConfigured {
		t.Fatal("proxy credentials leaked")
	}
	candidate, err := s.candidate(settingsInput(s))
	if err != nil || candidate.ProxyURL != options.Config.ProxyURL {
		t.Fatal("redacted proxy round-trip lost authentication")
	}
}

func TestAllowDirectHTTPSPersistenceAndLegacyDefault(t *testing.T) {
	options := testOptions(t, nil)
	store := memoryStore()
	options.Credentials = store
	s, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	if s.ProviderSettings().AllowDirectHTTPS {
		t.Fatal("expected AllowDirectHTTPS default false")
	}

	// Remote HTTPS without proxy must fail when AllowDirectHTTPS is false.
	input := settingsInput(s)
	input.BaseURL = "https://images.example.invalid/v1"
	input.ProxyURL = ""
	input.ReuseKey = true
	if _, err := s.SaveProvider(context.Background(), input); err == nil {
		t.Fatal("saved remote HTTPS without proxy or opt-in")
	}
	if _, err := s.TestProvider(context.Background(), input); err == nil {
		t.Fatal("tested remote HTTPS without proxy or opt-in")
	}

	// Remote plaintext HTTP must fail even when AllowDirectHTTPS is true.
	plain := input
	plain.BaseURL = "http://images.example.invalid/v1"
	plain.AllowDirectHTTPS = true
	if _, err := s.SaveProvider(context.Background(), plain); err == nil {
		t.Fatal("saved remote plaintext HTTP with AllowDirectHTTPS=true")
	}

	// Opting in allows saving and persists allow_direct_https in image-provider.json.
	input.AllowDirectHTTPS = true
	saved, err := s.SaveProvider(context.Background(), input)
	if err != nil {
		t.Fatalf("SaveProvider direct HTTPS failed: %v", err)
	}
	if !saved.AllowDirectHTTPS || !saved.Ready {
		t.Fatalf("expected direct HTTPS ready, got %+v", saved)
	}
	raw, err := os.ReadFile(s.settingsFile)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(raw), `"allow_direct_https": true`) {
		t.Fatalf("image-provider.json missing allow_direct_https: %s", raw)
	}
	s.Close()

	reloaded, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	if view := reloaded.ProviderSettings(); !view.AllowDirectHTTPS || !view.Ready {
		reloaded.Close()
		t.Fatalf("reloaded direct HTTPS mismatch: %+v", view)
	}
	account := reloaded.credentialAccount
	reloaded.Close()

	// Legacy files omitting allow_direct_https default to false and reject empty proxy.
	legacyMarker := `{"version":1,"account":"` + account + `","base_url":"https://images.example.invalid/v1","models":["gpt-image-2"],"proxy_url":""}`
	if err := os.WriteFile(s.settingsFile, []byte(legacyMarker), 0600); err != nil {
		t.Fatal(err)
	}
	legacySecret := `{"BaseURL":"https://images.example.invalid/v1","APIKey":"test-key","ProxyURL":"","Models":["gpt-image-2"],"DefaultModel":"gpt-image-2"}`
	if err := store.Set(account, legacySecret); err != nil {
		t.Fatal(err)
	}
	legacy, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	defer legacy.Close()
	if view := legacy.ProviderSettings(); view.AllowDirectHTTPS || view.Ready {
		t.Fatalf("legacy settings without allow_direct_https should default false & unready: %+v", view)
	}
}

func TestProviderTestClassifiesForbiddenInsufficientBalanceAsQuota(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusForbidden)
		w.Write([]byte(`{"code":"INSUFFICIENT_BALANCE","message":"Insufficient account balance"}`))
	}))
	defer server.Close()
	options := testOptions(t, nil)
	options.Config = testConfig(server.URL + "/v1")
	options.Credentials = memoryStore()
	s := newService(t, options)
	_, err := s.TestProvider(context.Background(), settingsInput(s))
	if err == nil || !strings.Contains(err.Error(), "额度不足") {
		t.Fatalf("expected quota message, got %v", err)
	}
}
