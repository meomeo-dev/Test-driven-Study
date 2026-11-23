package llm

import (
	"context"
	"encoding/json"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestConfigUsesOnlyIndependentBootstrapAndValidatesBudget(t *testing.T) {
	root := t.TempDir()
	filename := filepath.Join(root, ".env.gpt")
	os.WriteFile(filename, []byte("GPT_1_BASE_URL = 'http://127.0.0.1:1/v1'\nGPT_1_API_KEY = 'llm-only'\nGPT_1_MODELS = \"a, b\"\n"), 0600)
	for _, key := range []string{"GPT_1_DEFAULT_MODEL", "GPT_1_BASE_URL", "GPT_1_API_KEY", "GPT_1_MODELS", "GPT_1_PROXY_URL", "GPT_1_ALLOW_DIRECT_HTTPS", "GPT_1_REASONING_EFFORT", "GPT_1_MAX_OUTPUT_TOKENS_K", "STUDY_LLM_CONFIG_FILE", "HTTPS_PROXY"} {
		t.Setenv(key, "")
	}
	t.Setenv("STUDY_LLM_CONFIG_FILE", filename)
	// Environment overrides file values, including deliberately empty values.
	if LoadConfig(root).Message == "" {
		t.Fatal("empty environment did not override file")
	}
	for _, key := range []string{"GPT_1_BASE_URL", "GPT_1_API_KEY", "GPT_1_MODELS"} {
		os.Unsetenv(key)
	}
	config := LoadConfig(root)
	if config.Message != "" || config.APIKey != "llm-only" || len(config.Models) != 2 {
		t.Fatal("bootstrap parse failed")
	}
	t.Setenv("GPT_1_MAX_OUTPUT_TOKENS_K", "1.5")
	if LoadConfig(root).Message == "" {
		t.Fatal("fractional K accepted")
	}
}

func TestDefaultModelAndOutputParametersAreValidated(t *testing.T) {
	config := testConfig("http://127.0.0.1:1/v1")
	config.DefaultModel = "not-configured"
	if validateConfig(config) == "" {
		t.Fatal("unknown default model accepted")
	}
	config.DefaultModel = config.Models[0]
	config.MaxOutputTokensK = 129
	if validateConfig(config) == "" {
		t.Fatal("invalid token ceiling accepted")
	}
	config.MaxOutputTokensK = 16
	config.ReasoningEffort = "invented"
	if validateConfig(config) == "" {
		t.Fatal("invalid reasoning effort accepted")
	}
}

func TestAllowDirectHTTPSPolicyAndTransportInvariants(t *testing.T) {
	t.Setenv("HTTPS_PROXY", "http://127.0.0.1:9999")
	t.Setenv("HTTP_PROXY", "http://127.0.0.1:9999")

	// Invariant 1: default AllowDirectHTTPS=false + empty proxy + remote HTTPS rejects.
	remoteHTTPS := testConfig("https://remote.example.test/v1")
	if validateConfig(remoteHTTPS) == "" {
		t.Fatal("remote HTTPS without proxy or opt-in was accepted")
	}
	if _, err := NewHTTPProvider(remoteHTTPS); err == nil {
		t.Fatal("NewHTTPProvider accepted remote HTTPS without proxy or opt-in")
	}

	// Invariant 2: AllowDirectHTTPS=true + empty proxy + remote HTTPS uses nil Proxy (no env proxy).
	directHTTPS := remoteHTTPS
	directHTTPS.AllowDirectHTTPS = true
	if msg := validateConfig(directHTTPS); msg != "" {
		t.Fatalf("remote HTTPS with explicit AllowDirectHTTPS rejected: %s", msg)
	}
	directProvider, err := NewHTTPProvider(directHTTPS)
	if err != nil {
		t.Fatalf("NewHTTPProvider rejected explicit AllowDirectHTTPS: %v", err)
	}
	transport, ok := directProvider.client.Transport.(*http.Transport)
	if !ok || transport.Proxy != nil {
		t.Fatalf("direct HTTPS transport must keep Proxy=nil and ignore env proxy")
	}

	// Invariant 3: AllowDirectHTTPS=true + remote plaintext HTTP still rejects; loopback stays allowed.
	remoteHTTP := testConfig("http://remote.example.test/v1")
	remoteHTTP.AllowDirectHTTPS = true
	if validateConfig(remoteHTTP) == "" {
		t.Fatal("remote plaintext HTTP accepted with AllowDirectHTTPS=true")
	}
	if _, err := NewHTTPProvider(remoteHTTP); err == nil {
		t.Fatal("NewHTTPProvider accepted remote plaintext HTTP")
	}
	for _, localURL := range []string{
		"http://127.0.0.1:1/v1",
		"http://localhost:1/v1",
		"http://[::1]:1/v1",
	} {
		localCfg := testConfig(localURL)
		if msg := validateConfig(localCfg); msg != "" {
			t.Fatalf("loopback %s rejected: %s", localURL, msg)
		}
	}

	// Invariant 4: AllowDirectHTTPS=true + non-empty ProxyURL must still use configured proxy.
	proxied := remoteHTTPS
	proxied.AllowDirectHTTPS = true
	proxied.ProxyURL = "http://127.0.0.1:7890"
	proxiedProvider, err := NewHTTPProvider(proxied)
	if err != nil {
		t.Fatalf("proxied config with AllowDirectHTTPS=true rejected: %v", err)
	}
	proxiedTransport := proxiedProvider.client.Transport.(*http.Transport)
	if proxiedTransport.Proxy == nil {
		t.Fatal("proxied transport dropped configured proxy when AllowDirectHTTPS=true")
	}
	probeReq, _ := http.NewRequest(http.MethodGet, "https://remote.example.test/v1/models", nil)
	resolved, err := proxiedTransport.Proxy(probeReq)
	if err != nil || resolved == nil || resolved.String() != "http://127.0.0.1:7890" {
		t.Fatalf("unexpected resolved proxy: %v %v", resolved, err)
	}

	// Configured proxy is never bypassed even when AllowDirectHTTPS=true and proxy fails.
	proxyHits := 0
	failingProxy := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		proxyHits++
		w.WriteHeader(http.StatusBadGateway)
	}))
	defer failingProxy.Close()
	strictProxyCfg := testConfig("http://127.0.0.1:1/v1")
	strictProxyCfg.AllowDirectHTTPS = true
	strictProxyCfg.ProxyURL = failingProxy.URL
	strictProvider, err := NewHTTPProvider(strictProxyCfg)
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := strictProvider.Generate(
		context.Background(),
		Parameters{Model: "fixture-reasoner", ReasoningEffort: "low", MaxOutputTokensK: 4},
		"source",
	); err == nil || proxyHits != 1 {
		t.Fatalf("expected single proxy failure without direct fallback: hits=%d err=%v",
			proxyHits, err)
	}
}

func TestAllowDirectHTTPSPersistenceAndLegacyDefault(t *testing.T) {
	options := testOptions(t, "http://127.0.0.1:1/v1")
	s, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	if s.ProviderSettings().AllowDirectHTTPS {
		t.Fatal("expected AllowDirectHTTPS to default to false")
	}

	// Saving remote HTTPS without proxy and without AllowDirectHTTPS must fail.
	input := updateInput(s)
	input.BaseURL = "https://remote.example.test/v1"
	input.ProxyURL = ""
	input.ReuseKey = true
	input.AllowDirectHTTPS = false
	if _, err := s.SaveProvider(context.Background(), input); err == nil {
		t.Fatal("remote HTTPS save succeeded without proxy or AllowDirectHTTPS")
	}

	// Saving remote HTTPS with explicit AllowDirectHTTPS=true persists across restart.
	input.AllowDirectHTTPS = true
	saved, err := s.SaveProvider(context.Background(), input)
	if err != nil || !saved.Ready || !saved.AllowDirectHTTPS {
		t.Fatalf("direct HTTPS save failed: %+v %v", saved, err)
	}
	rawIndex, err := os.ReadFile(s.settingsFile)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(string(rawIndex), `"allow_direct_https": true`) {
		t.Fatalf("llm-provider.json missing persisted allow_direct_https: %s", rawIndex)
	}
	settingsFile := s.settingsFile
	account := s.credentialAccount
	s.Close()

	restarted, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	view := restarted.ProviderSettings()
	if !view.Ready || !view.AllowDirectHTTPS {
		t.Fatalf("AllowDirectHTTPS did not survive restart: %+v", view)
	}
	restarted.Close()

	// Legacy files omitting allow_direct_https must default to false (rejecting remote direct).
	legacyIndex, _ := json.Marshal(map[string]any{
		"version":             1,
		"account":             account,
		"base_url":            "https://remote.example.test/v1",
		"models":              []string{"fixture-reasoner"},
		"default_model":       "fixture-reasoner",
		"proxy_url":           "",
		"reasoning_effort":    "medium",
		"max_output_tokens_k": 16,
	})
	if err := os.WriteFile(settingsFile, legacyIndex, 0o600); err != nil {
		t.Fatal(err)
	}
	legacySecret, _ := json.Marshal(map[string]any{
		"BaseURL":          "https://remote.example.test/v1",
		"APIKey":           options.Config.APIKey,
		"ProxyURL":         "",
		"Models":           []string{"fixture-reasoner"},
		"DefaultModel":     "fixture-reasoner",
		"ReasoningEffort":  "medium",
		"MaxOutputTokensK": 16,
	})
	if err := options.Credentials.Set(account, string(legacySecret)); err != nil {
		t.Fatal(err)
	}
	legacyService, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	defer legacyService.Close()
	legacyView := legacyService.ProviderSettings()
	if legacyView.AllowDirectHTTPS || legacyView.Ready {
		t.Fatalf("legacy config without allow_direct_https must default false and stay unready: %+v",
			legacyView)
	}
}
