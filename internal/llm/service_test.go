package llm

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"

	"test-driven-study/internal/testsupport"
	"time"

	"test-driven-study/internal/palace"
	"test-driven-study/internal/storage"
	"test-driven-study/internal/study"
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

func testOptions(t *testing.T, base string) Options {
	t.Helper()
	root, _ := filepath.Abs("../..")
	directory := t.TempDir()
	db, err := storage.Open(context.Background(), root, directory)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return Options{DB: db, DataDirectory: directory, Config: testConfig(base), Credentials: memoryStore()}
}
func updateInput(s *Service) ProviderUpdate {
	v := s.ProviderSettings()
	return ProviderUpdate{BaseURL: v.BaseURL, Models: v.Models, ProxyURL: v.ProxyURL,
		AllowDirectHTTPS: v.AllowDirectHTTPS,
		DefaultModel:     v.DefaultModel, ReasoningEffort: v.ReasoningEffort, MaxOutputTokensK: v.MaxOutputTokensK}
}
func TestIndependentSettingsRetentionFailureAndRestart(t *testing.T) {
	options := testOptions(t, "http://127.0.0.1:1/v1")
	s, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	input := updateInput(s)
	input.ReasoningEffort = "high"
	input.MaxOutputTokensK = 32
	view, err := s.SaveProvider(context.Background(), input)
	if err != nil || !view.Ready || view.Storage != "system_keyring" || view.MaxOutputTokensK != 32 {
		t.Fatal("save failed", err)
	}
	if credentialService != "test-driven-study.llm-provider" || !strings.HasPrefix(s.credentialAccount, "llm-") {
		t.Fatal("shared credential namespace")
	}
	bytes, _ := os.ReadFile(s.settingsFile)
	public, _ := json.Marshal(view)
	if strings.Contains(string(bytes)+string(public), options.Config.APIKey) {
		t.Fatal("key leaked")
	}
	info, _ := os.Stat(s.settingsFile)
	if info.Mode().Perm() != 0600 {
		t.Fatal("public settings index")
	}
	s.Close()
	resumed, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	defer resumed.Close()
	if resumed.ProviderSettings().ReasoningEffort != "high" || resumed.config.APIKey != options.Config.APIKey {
		t.Fatal("settings did not survive restart")
	}
	before := resumed.config
	bad := updateInput(resumed)
	bad.BaseURL = "https://other.example.test/v1"
	bad.ProxyURL = "http://127.0.0.1:7890"
	if _, err := resumed.SaveProvider(context.Background(), bad); err == nil {
		t.Fatal("key silently reused at changed origin")
	}
	store := options.Credentials.(*memoryCredentials)
	store.fail = true
	if _, err := resumed.SaveProvider(context.Background(), updateInput(resumed)); err == nil || resumed.config.APIKey != before.APIKey {
		t.Fatal("failed native save replaced active config")
	}
	store.fail = false
	clear := updateInput(resumed)
	clear.ClearKey = true
	if value, err := resumed.SaveProvider(context.Background(), clear); err != nil || value.Ready || value.KeyConfigured {
		t.Fatal("clear failed", err)
	}
}
func TestPlanIdempotencyAndQuestionBoundImagePrompt(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	var calls atomic.Int32
	gate := make(chan struct{})
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		<-gate
		json.NewEncoder(w).Encode(responseJSON(t, testPlan()))
	}))
	defer server.Close()
	options := testOptions(t, server.URL)
	s, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	root, _ := filepath.Abs("../..")
	images, err := palace.New(context.Background(), palace.Options{DB: options.DB, Study: study.New(options.DB, root),
		Root: root, DataDirectory: options.DataDirectory, Config: palace.Config{Message: "disabled"}, ResolvePlan: s.Resolve})
	if err != nil {
		t.Fatal(err)
	}
	defer images.Close()
	preview, err := images.Preview(context.Background(), 4, "hall")
	if err != nil {
		t.Fatal(err)
	}
	input := PlanInput{ID: "e1cdd9b6-3473-4e5b-9b2e-7e5af80ea250", QuestionID: 4, PalaceAddress: "hall",
		Parameters: Parameters{Model: "fixture-reasoner", ReasoningEffort: "medium", MaxOutputTokensK: 16}}
	record, err := s.Create(context.Background(), input, PlanSource{Prompt: preview.Prompt})
	if err != nil || record.Status != "running" {
		t.Fatal("create failed", err)
	}
	if _, err := s.SaveProvider(context.Background(), updateInput(s)); err == nil {
		t.Fatal("settings changed during request")
	}
	if _, err := s.Create(context.Background(), input, PlanSource{Prompt: preview.Prompt}); err != nil {
		t.Fatal("duplicate request failed", err)
	}
	changed := input
	changed.MaxOutputTokensK = 8
	if _, err := s.Create(context.Background(), changed, PlanSource{Prompt: preview.Prompt}); !errors.Is(err, ErrConflict) {
		t.Fatal("conflicting request accepted")
	}
	if _, err := s.Resolve(context.Background(), input.ID, 4, "hall", ""); err == nil {
		t.Fatal("running plan adopted")
	}
	close(gate)
	deadline := time.Now().Add(5 * time.Second)
	for time.Now().Before(deadline) {
		record, err = s.Get(context.Background(), input.ID)
		if record.Status != "running" {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if err != nil || record.Status != "succeeded" || calls.Load() != 1 {
		t.Fatal("generation failed or duplicated", err)
	}
	if _, err := s.Create(context.Background(), input, PlanSource{Prompt: preview.Prompt}); err != nil || calls.Load() != 1 {
		t.Fatal("completed request replayed")
	}
	if _, err := s.Resolve(context.Background(), input.ID, 6, "hall", ""); err == nil {
		t.Fatal("cross-question plan adopted")
	}
	if _, err := s.Resolve(context.Background(), input.ID, 4, "other", ""); err == nil {
		t.Fatal("wrong-address plan adopted")
	}
	if _, err := s.Resolve(context.Background(), input.ID, 4, "hall", preview.Prompt+" revised"); !errors.Is(err, ErrInvalid) {
		t.Fatalf("adopted a plan for a different prompt: %v", err)
	}
	augmented, err := images.PreviewWithPlan(context.Background(), 4, "hall", input.ID)
	if err != nil || !strings.HasPrefix(augmented.Prompt, preview.Prompt) || !strings.Contains(augmented.Prompt, record.Plan.ImagePrompt) {
		t.Fatal("canonical prompt replaced or scene missing", err)
	}
	var attempts int
	options.DB.QueryRow("SELECT count(*) FROM answer_attempts").Scan(&attempts)
	if attempts != 0 {
		t.Fatal("planning contaminated learning results")
	}
}

func TestRestartInterruptsRunningPlanWithoutReplay(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	options := testOptions(t, "http://127.0.0.1:1/v1")
	now := time.Now().UTC().UnixMilli()
	record := PlanRecord{PlanInput: PlanInput{ID: "b3985430-43bf-449b-b148-d77393529025", QuestionID: 4,
		Parameters: Parameters{Model: "fixture-reasoner", ReasoningEffort: "medium", MaxOutputTokensK: 16}}, Status: "running", CreatedAtMS: now, UpdatedAtMS: now, SourcePrompt: "source"}
	data, _ := json.Marshal(record)
	_, err := options.DB.Exec("INSERT INTO llm_plans(id,question_id,status,record_json) VALUES(?,4,'running',?)", record.ID, string(data))
	if err != nil {
		t.Fatal(err)
	}
	s, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	recovered, err := s.Get(context.Background(), record.ID)
	if err != nil || recovered.Status != "interrupted" || recovered.Error == nil {
		t.Fatal("in-flight request was not recovered", err)
	}
	if _, err := s.Resolve(context.Background(), record.ID, 4, "", ""); err == nil {
		t.Fatal("interrupted plan adopted")
	}
}

func TestMissingSavedCredentialDoesNotReactivateEnvironmentKey(t *testing.T) {
	options := testOptions(t, "http://127.0.0.1:1/v1")
	s, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := s.SaveProvider(context.Background(), updateInput(s)); err != nil {
		t.Fatal(err)
	}
	account := s.credentialAccount
	s.Close()
	options.Credentials.Delete(account)
	resumed, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	defer resumed.Close()
	if resumed.ProviderSettings().Ready || resumed.ProviderSettings().KeyConfigured {
		t.Fatal("missing saved key fell back to environment")
	}
}

func TestConnectionTestOnlyReadsModels(t *testing.T) {
	var calls atomic.Int32
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, request *http.Request) {
		calls.Add(1)
		if request.Method != "GET" || request.URL.Path != "/models" || request.Header.Get("Authorization") != "Bearer private-llm-test-key" {
			t.Error("connection test performed an unexpected request")
		}
		w.Write([]byte(`{"data":[{"id":"fixture-reasoner"}]}`))
	}))
	defer server.Close()
	options := testOptions(t, server.URL)
	s, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	result, err := s.TestProvider(context.Background(), updateInput(s))
	if err != nil || !result.Connected || calls.Load() != 1 || s.credentialAccount != "" {
		t.Fatal("connection test saved or inferred", err)
	}
}
