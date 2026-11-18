package tts

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"os"
	"strings"

	"github.com/zalando/go-keyring"
)

const credentialService = "test-driven-study.tts-provider"

// CredentialStore abstracts OS keyring operations for test isolation and portability.
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
	Version      int    `json:"version"`
	Account      string `json:"account"`
	BaseURL      string `json:"base_url"`
	DefaultVoice string `json:"default_voice"`
	ProxyURL     string `json:"proxy_url"`
}

type secretPayload struct {
	APIKey string `json:"api_key"`
}

func generateAccount() (string, error) {
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	return "account_" + hex.EncodeToString(bytes), nil
}

func validAccount(account string) bool {
	if !strings.HasPrefix(account, "account_") || len(account) != 40 {
		return false
	}
	for _, r := range account[8:] {
		if (r < '0' || r > '9') && (r < 'a' || r > 'f') {
			return false
		}
	}
	return true
}

func (s *Service) loadSavedProvider() {
	payload, err := os.ReadFile(s.settingsFile)
	if os.IsNotExist(err) {
		s.loadEnvConfig()
		return
	}
	var marker savedProvider
	if err != nil || len(payload) > 4096 || json.Unmarshal(payload, &marker) != nil ||
		marker.Version != 1 || !validAccount(marker.Account) {
		s.config.Message = "无法读取已保存的 TTS 设置，请重新配置"
		return
	}

	s.credentialAccount = marker.Account
	s.config.BaseURL = marker.BaseURL
	s.config.DefaultVoice = marker.DefaultVoice
	s.config.ProxyURL = marker.ProxyURL
	s.config.Message = "无法读取系统凭据，请解锁钥匙串或重新输入密钥保存"

	rawSecret, err := s.credentials.Get(marker.Account)
	if err != nil || len(rawSecret) > 2048 {
		return
	}

	var secret secretPayload
	if err := json.Unmarshal([]byte(rawSecret), &secret); err == nil && secret.APIKey != "" {
		s.config.APIKey = secret.APIKey
		s.config.Message = ""
	}
}

func (s *Service) loadEnvConfig() {
	if key := strings.TrimSpace(os.Getenv("STUDY_TTS_API_KEY")); key != "" {
		s.config.APIKey = key
	} else if key := strings.TrimSpace(os.Getenv("DEEPSEEK_API_KEY")); key != "" {
		s.config.APIKey = key
	}
	if base := strings.TrimSpace(os.Getenv("STUDY_TTS_BASE_URL")); base != "" {
		s.config.BaseURL = base
	}
	if voice := strings.TrimSpace(os.Getenv("STUDY_TTS_DEFAULT_VOICE")); voice == "tide" {
		s.config.DefaultVoice = "tide"
	}
	if proxy := strings.TrimSpace(os.Getenv("STUDY_TTS_PROXY_URL")); proxy != "" {
		s.config.ProxyURL = proxy
	}
}
