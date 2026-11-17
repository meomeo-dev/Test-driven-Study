package llm

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
	DefaultModel        string   `json:"default_model"`
	ReasoningEffort     string   `json:"reasoning_effort"`
	MaxOutputTokensK    int      `json:"max_output_tokens_k"`
	ContextBudgetK      int      `json:"context_budget_k"`
	CompactThresholdK   int      `json:"compact_threshold_k"`
	CompactReserveK     int      `json:"compact_reserve_k"`
	WebSearch           string   `json:"web_search"`
	Efforts             []string `json:"efforts"`
}

type ProviderUpdate struct {
	BaseURL           string   `json:"base_url"`
	Models            []string `json:"models"`
	ProxyURL          string   `json:"proxy_url"`
	APIKey            *string  `json:"api_key,omitempty"`
	ClearKey          bool     `json:"clear_key"`
	ReuseKey          bool     `json:"reuse_key"`
	DefaultModel      string   `json:"default_model"`
	ReasoningEffort   string   `json:"reasoning_effort"`
	MaxOutputTokensK  int      `json:"max_output_tokens_k"`
	ContextBudgetK    int      `json:"context_budget_k,omitempty"`
	CompactThresholdK int      `json:"compact_threshold_k,omitempty"`
	CompactReserveK   int      `json:"compact_reserve_k,omitempty"`
	WebSearch         string   `json:"web_search,omitempty"`
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
		models = []string{"gpt-5.5"}
	}
	if !slices.Contains(models, c.DefaultModel) {
		c.DefaultModel = models[0]
	}
	if !slices.Contains(Efforts, c.ReasoningEffort) {
		c.ReasoningEffort = "default"
	}
	if c.MaxOutputTokensK < 1 || c.MaxOutputTokensK > 128 {
		c.MaxOutputTokensK = DefaultOutputTokensK
	}
	policy, _ := normalizePolicy(c.parameters())
	return ProviderSettings{BaseURL: safeProxy(c.BaseURL), Models: models, ProxyURL: safeProxy(c.ProxyURL),
		ProxyAuthConfigured: safeProxy(c.ProxyURL) != c.ProxyURL, KeyConfigured: c.APIKey != "",
		Storage: storage, WriteToken: s.settingsToken, Ready: s.provider != nil, Message: c.Message,
		DefaultModel: c.DefaultModel, ReasoningEffort: c.ReasoningEffort,
		ContextBudgetK: policy.ContextBudgetK, CompactThresholdK: policy.CompactThresholdK, CompactReserveK: policy.CompactReserveK, WebSearch: policy.WebSearch,
		MaxOutputTokensK: c.MaxOutputTokensK, Efforts: append([]string{}, Efforts...)}
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
	if !slices.Contains(c.Models, input.DefaultModel) {
		return Config{}, &SettingsError{"请选择配置列表中的默认模型"}
	}
	c.DefaultModel = input.DefaultModel
	c.ReasoningEffort = input.ReasoningEffort
	c.MaxOutputTokensK = input.MaxOutputTokensK
	policy, policyErr := normalizePolicy(Parameters{MaxOutputTokensK: input.MaxOutputTokensK, ContextBudgetK: input.ContextBudgetK,
		CompactThresholdK: input.CompactThresholdK, CompactReserveK: input.CompactReserveK, WebSearch: input.WebSearch})
	if policyErr != nil {
		return Config{}, &SettingsError{"会话预算应等于压缩阈值加预留；单次输出应为 1–128 K 且不超过预留"}
	}
	c.MaxOutputTokensK = policy.MaxOutputTokensK
	c.ContextBudgetK = policy.ContextBudgetK
	c.CompactThresholdK = policy.CompactThresholdK
	c.CompactReserveK = policy.CompactReserveK
	c.WebSearch = policy.WebSearch
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
	if !s.planning.TryLock() {
		return ProviderSettings{}, &SettingsError{"LLM 正在构思，请完成后保存设置"}
	}
	defer s.planning.Unlock()
	count, err := s.queries.CountActivePalaceJobs(ctx)
	if err != nil {
		return ProviderSettings{}, err
	}
	if count > 0 {
		return ProviderSettings{}, &SettingsError{"生成任务正在运行或排队，请完成后保存 LLM 设置"}
	}
	config, err := s.candidate(input)
	if err != nil {
		return ProviderSettings{}, err
	}
	var provider *HTTPProvider
	if config.APIKey != "" {
		provider, err = NewHTTPProvider(config)
		if err != nil {
			return ProviderSettings{}, &SettingsError{"LLM端点或代理配置无效"}
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
	message := "连接与鉴权成功，配置模型可用；尚未调用 Responses 验证参数"
	if len(available) != len(config.Models) {
		message = "连接与鉴权成功，部分模型未出现在列表中；尚未验证 Responses 参数"
	}
	return ConnectionResult{Connected: true, AvailableModels: available, Message: message}, nil
}

func settingsNonce() string { return rand.Text() }
