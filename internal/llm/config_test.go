package llm

import (
	"os"
	"path/filepath"
	"testing"
)

func TestConfigUsesOnlyIndependentBootstrapAndValidatesBudget(t *testing.T) {
	root := t.TempDir()
	filename := filepath.Join(root, ".env.gpt")
	os.WriteFile(filename, []byte("GPT_1_BASE_URL = 'http://127.0.0.1:1/v1'\nGPT_1_API_KEY = 'llm-only'\nGPT_1_MODELS = \"a, b\"\n"), 0600)
	for _, key := range []string{"GPT_1_DEFAULT_MODEL", "GPT_1_BASE_URL", "GPT_1_API_KEY", "GPT_1_MODELS", "GPT_1_PROXY_URL", "GPT_1_REASONING_EFFORT", "GPT_1_MAX_OUTPUT_TOKENS_K", "STUDY_LLM_CONFIG_FILE", "HTTPS_PROXY"} {
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
