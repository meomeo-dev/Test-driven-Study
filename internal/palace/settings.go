package palace

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"time"
)

type SettingsError struct{ Message string }

func (e *SettingsError) Error() string { return e.Message }

type ProviderSettings struct {
	BaseURL             string   `json:"base_url"`
	Models              []string `json:"models"`
	ProxyURL            string   `json:"proxy_url"`
	ProxyAuthConfigured bool     `json:"proxy_auth_configured"`
	KeyConfigured       bool     `json:"key_configured"`
	Storage             string   `json:"storage"`
	WriteToken          string   `json:"write_token"`
	Ready               bool     `json:"ready"`
	Message             string   `json:"message"`
}

type ProviderUpdate struct {
	BaseURL  string   `json:"base_url"`
	Models   []string `json:"models"`
	ProxyURL string   `json:"proxy_url"`
	APIKey   *string  `json:"api_key,omitempty"`
	ClearKey bool     `json:"clear_key"`
	ReuseKey bool     `json:"reuse_key"`
}

type ConnectionResult struct {
	Connected       bool     `json:"connected"`
	AvailableModels []string `json:"available_models"`
	Message         string   `json:"message"`
}

func safeProxy(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	parsed.User = nil
	parsed.RawQuery = ""
	parsed.Fragment = ""
	return parsed.String()
}

func (s *Service) ProviderSettings() ProviderSettings {
	s.configuration.RLock()
	defer s.configuration.RUnlock()
	c := s.config
	storage := "environment"
	if s.credentialAccount != "" {
		storage = "system_keyring"
	}
	models := append([]string{}, c.Models...)
	if c.BaseURL == "" {
		c.BaseURL = "https://api.openai.com/v1"
	}
	if len(models) == 0 {
		models = []string{"gpt-image-2"}
	}
	return ProviderSettings{BaseURL: safeProxy(c.BaseURL), Models: models, ProxyURL: safeProxy(c.ProxyURL),
		ProxyAuthConfigured: safeProxy(c.ProxyURL) != c.ProxyURL, KeyConfigured: c.APIKey != "",
		Storage: storage, WriteToken: s.settingsToken, Ready: s.provider != nil, Message: c.Message}
}

func (s *Service) AuthorizeSettings(token string) bool {
	return subtle.ConstantTimeCompare([]byte(token), []byte(s.settingsToken)) == 1
}

func normalizedModels(values []string) ([]string, error) {
	if len(values) == 0 || len(values) > 16 {
		return nil, &SettingsError{"请配置 1 至 16 个模型名称"}
	}
	result := []string{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || len(value) > 100 || strings.ContainsAny(value, "\r\n\x00 ,\t") {
			return nil, &SettingsError{"模型名称无效"}
		}
		if !slices.Contains(result, value) {
			result = append(result, value)
		}
	}
	return result, nil
}

func (s *Service) candidate(input ProviderUpdate) (Config, error) {
	s.configuration.RLock()
	c := s.config
	s.configuration.RUnlock()
	oldURL, _ := url.Parse(c.BaseURL)
	oldProxy := c.ProxyURL
	c.BaseURL = strings.TrimRight(strings.TrimSpace(input.BaseURL), "/")
	target, _ := url.Parse(c.BaseURL)
	if len(c.BaseURL) > 1024 || len(input.ProxyURL) > 1024 || target == nil {
		return Config{}, &SettingsError{"接口或代理地址无效"}
	}
	var err error
	c.Models, err = normalizedModels(input.Models)
	if err != nil {
		return Config{}, err
	}
	c.DefaultModel = c.Models[0]
	if slices.Contains(c.Models, "gpt-image-2") {
		c.DefaultModel = "gpt-image-2"
	}
	c.ProxyURL = strings.TrimSpace(input.ProxyURL)
	// A redacted proxy URL round-trips without discarding existing credentials.
	if c.ProxyURL == safeProxy(oldProxy) {
		c.ProxyURL = oldProxy
	}
	if input.ClearKey && input.APIKey != nil && strings.TrimSpace(*input.APIKey) != "" {
		return Config{}, &SettingsError{"不能同时清除和替换密钥"}
	}
	if input.ClearKey {
		c.APIKey = ""
	} else if input.APIKey != nil && strings.TrimSpace(*input.APIKey) != "" {
		c.APIKey = strings.TrimSpace(*input.APIKey)
	} else if c.APIKey != "" && oldURL != nil &&
		(!strings.EqualFold(oldURL.Scheme, target.Scheme) || !strings.EqualFold(oldURL.Host, target.Host)) && !input.ReuseKey {
		return Config{}, &SettingsError{"接口域名已改变，请重新输入密钥或明确选择复用已保存密钥"}
	}
	if len(c.APIKey) > 1024 || strings.ContainsAny(c.APIKey, "\r\n\x00") {
		return Config{}, &SettingsError{"API Key 格式或长度无效"}
	}
	if c.APIKey == "" && !input.ClearKey {
		return Config{}, &SettingsError{"请输入 API Key"}
	}
	// A deliberate key removal still validates the endpoint and proxy settings.
	probe := c
	if probe.APIKey == "" {
		probe.APIKey = "validation-only"
	}
	if message := validateConfig(probe); message != "" {
		return Config{}, &SettingsError{message}
	}
	c.Message = validateConfig(c)
	return c, nil
}

func (s *Service) SaveProvider(ctx context.Context, input ProviderUpdate) (ProviderSettings, error) {
	s.creation.Lock()
	defer s.creation.Unlock()
	count, err := s.queries.CountActivePalaceJobs(ctx)
	if err != nil {
		return ProviderSettings{}, err
	}
	if count > 0 {
		return ProviderSettings{}, &SettingsError{"有正在生成或排队的任务，请完成或取消后保存设置"}
	}
	config, err := s.candidate(input)
	if err != nil {
		return ProviderSettings{}, err
	}
	var provider ImageProvider
	if config.APIKey != "" {
		provider, err = NewHTTPProvider(config)
		if err != nil {
			return ProviderSettings{}, &SettingsError{"生图端点或代理配置无效"}
		}
	}
	s.configuration.Lock()
	err = s.persistProvider(config)
	if err == nil {
		s.config = config
		s.provider = provider
	}
	s.configuration.Unlock()
	if err != nil {
		return ProviderSettings{}, err
	}
	return s.ProviderSettings(), nil
}

func (s *Service) TestProvider(ctx context.Context, input ProviderUpdate) (ConnectionResult, error) {
	config, err := s.candidate(input)
	if err != nil {
		return ConnectionResult{}, err
	}
	if config.APIKey == "" {
		return ConnectionResult{}, &SettingsError{"请输入有效密钥后测试连接"}
	}
	provider, err := NewHTTPProvider(config)
	if err != nil {
		return ConnectionResult{}, ErrDisabled
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, config.BaseURL+"/models", nil)
	if err != nil {
		return ConnectionResult{}, ErrInvalid
	}
	request.Header.Set("Authorization", "Bearer "+config.APIKey)
	response, err := provider.client.Do(request)
	if err != nil {
		return ConnectionResult{}, &SettingsError{"无法通过配置的代理连接服务，请检查地址和代理"}
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		var failure *Failure
		if errors.As(providerFailure(response.StatusCode), &failure) {
			return ConnectionResult{}, &SettingsError{failure.Message}
		}
	}
	data, err := readBounded(response.Body, 1<<20)
	if err != nil {
		return ConnectionResult{}, &SettingsError{"模型列表响应无效"}
	}
	var result struct {
		Data []struct {
			ID string `json:"id"`
		} `json:"data"`
	}
	if json.Unmarshal(data, &result) != nil {
		return ConnectionResult{}, &SettingsError{"服务未返回兼容的模型列表，仍可直接保存设置"}
	}
	available := []string{}
	for _, model := range config.Models {
		if slices.ContainsFunc(result.Data, func(value struct {
			ID string `json:"id"`
		}) bool {
			return value.ID == model
		}) {
			available = append(available, model)
		}
	}
	message := "连接与鉴权成功，配置模型可用"
	if len(available) != len(config.Models) {
		message = "连接与鉴权成功，部分配置模型未出现在模型列表中"
	}
	return ConnectionResult{Connected: true, AvailableModels: available, Message: message}, nil
}

func settingsNonce() string { return rand.Text() }
