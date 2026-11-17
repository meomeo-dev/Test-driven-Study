package llm

import (
	"crypto/rand"
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/zalando/go-keyring"
)

const credentialService = "test-driven-study.llm-provider"

// CredentialStore keeps the platform-specific API outside provider/job logic.
type CredentialStore interface {
	Get(account string) (string, error)
	Set(account, value string) error
	Delete(account string) error
}

type systemCredentials struct{}

func (systemCredentials) Get(account string) (string, error) {
	return keyring.Get(credentialService, account)
}
func (systemCredentials) Set(account, value string) error {
	return keyring.Set(credentialService, account, value)
}
func (systemCredentials) Delete(account string) error {
	return keyring.Delete(credentialService, account)
}

type savedProvider struct {
	DefaultModel      string   `json:"default_model"`
	Version           int      `json:"version"`
	Account           string   `json:"account"`
	BaseURL           string   `json:"base_url"`
	Models            []string `json:"models"`
	ProxyURL          string   `json:"proxy_url"`
	ReasoningEffort   string   `json:"reasoning_effort"`
	MaxOutputTokensK  int      `json:"max_output_tokens_k"`
	ContextBudgetK    int      `json:"context_budget_k"`
	CompactThresholdK int      `json:"compact_threshold_k"`
	CompactReserveK   int      `json:"compact_reserve_k"`
	WebSearch         string   `json:"web_search"`
}

func (s *Service) loadSavedProvider() {
	payload, err := os.ReadFile(s.settingsFile)
	if os.IsNotExist(err) {
		return
	}
	var marker savedProvider
	if err != nil || len(payload) > 8192 || json.Unmarshal(payload, &marker) != nil || marker.Version != 1 || !validAccount(marker.Account) {
		s.config = Config{Message: "无法读取已保存的LLM设置，请重新配置"}
		return
	}
	s.credentialAccount = marker.Account
	s.config = Config{BaseURL: marker.BaseURL, Models: marker.Models, ProxyURL: marker.ProxyURL, DefaultModel: marker.DefaultModel,
		ReasoningEffort: marker.ReasoningEffort, MaxOutputTokensK: marker.MaxOutputTokensK,
		ContextBudgetK: marker.ContextBudgetK, CompactThresholdK: marker.CompactThresholdK, CompactReserveK: marker.CompactReserveK, WebSearch: marker.WebSearch,
		Message: "无法读取系统凭据，请解锁钥匙串或重新输入密钥保存"}
	value, err := s.credentials.Get(marker.Account)
	var config Config
	if err != nil || len(value) > 2300 || json.Unmarshal([]byte(value), &config) != nil {
		return
	}
	config.Message = validateConfig(config)
	s.config = config
}

func validAccount(value string) bool {
	if !strings.HasPrefix(value, "llm-") || len(value) < len("llm-")+26 || len(value) > 80 {
		return false
	}
	for _, value := range strings.TrimPrefix(value, "llm-") {
		if (value < 'A' || value > 'Z') && (value < '2' || value > '7') {
			return false
		}
	}
	return true
}

func (s *Service) persistProvider(config Config) error {
	payload, err := json.Marshal(config)
	if err != nil || len(payload) > 2300 {
		return &SettingsError{"配置内容超过系统凭据存储的长度限制"}
	}
	account := "llm-" + rand.Text()
	if err := s.credentials.Set(account, string(payload)); err != nil {
		return &SettingsError{"无法保存到系统凭据存储，请检查钥匙串是否已解锁或允许访问"}
	}
	// Verify the saved item before publishing its reference. Failed writes never
	// replace the last active account; a temporary orphan can safely be removed.
	stored, err := s.credentials.Get(account)
	if err != nil || stored != string(payload) {
		s.credentials.Delete(account)
		return &SettingsError{"未能验证系统凭据保存结果，原设置保持不变"}
	}
	marker := savedProvider{DefaultModel: config.DefaultModel, Version: 1, Account: account, BaseURL: config.BaseURL,
		Models: config.Models, ProxyURL: safeProxy(config.ProxyURL),
		ReasoningEffort: config.ReasoningEffort, MaxOutputTokensK: config.MaxOutputTokensK, ContextBudgetK: config.ContextBudgetK, CompactThresholdK: config.CompactThresholdK, CompactReserveK: config.CompactReserveK, WebSearch: config.WebSearch}
	data, _ := json.MarshalIndent(marker, "", "  ")
	if err := atomicSettingsFile(s.settingsFile, append(data, '\n')); err != nil {
		s.credentials.Delete(account)
		return &SettingsError{"无法保存LLM设置索引，原设置保持不变"}
	}
	previous := s.credentialAccount
	s.credentialAccount = account
	if previous != "" {
		if err := s.credentials.Delete(previous); err != nil {
			slog.Warn("previous llm-provider credential could not be removed")
		}
	}
	return nil
}

func atomicSettingsFile(filename string, data []byte) error {
	file, err := os.CreateTemp(filepath.Dir(filename), ".provider-*")
	if err != nil {
		return err
	}
	defer os.Remove(file.Name())
	if _, err = file.Write(data); err != nil {
		file.Close()
		return err
	}
	if err = file.Sync(); err != nil {
		file.Close()
		return err
	}
	if err = file.Close(); err != nil {
		return err
	}
	return os.Rename(file.Name(), filename)
}
