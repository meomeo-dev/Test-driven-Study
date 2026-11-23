package tts

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"golang.org/x/sync/singleflight"
)

var keyHexRegex = regexp.MustCompile(`^[a-f0-9]{16}$`)

type Config struct {
	BaseURL          string
	DefaultVoice     string
	ProxyURL         string
	AllowDirectHTTPS bool
	APIKey           string
	Message          string
}

type ProviderSettings struct {
	BaseURL             string   `json:"base_url"`
	Voices              []string `json:"voices"`
	DefaultVoice        string   `json:"default_voice"`
	ProxyURL            string   `json:"proxy_url"`
	ProxyAuthConfigured bool     `json:"proxy_auth_configured"`
	AllowDirectHTTPS    bool     `json:"allow_direct_https"`
	KeyConfigured       bool     `json:"key_configured"`
	Storage             string   `json:"storage"`
	WriteToken          string   `json:"write_token"`
	Ready               bool     `json:"ready"`
	Message             string   `json:"message"`
}

type ProviderUpdate struct {
	BaseURL          string  `json:"base_url"`
	DefaultVoice     string  `json:"default_voice"`
	APIKey           *string `json:"api_key,omitempty"`
	ClearKey         bool    `json:"clear_key"`
	ProxyURL         string  `json:"proxy_url"`
	AllowDirectHTTPS bool    `json:"allow_direct_https"`
}

type SynthesizeResult struct {
	Key        string `json:"key"`
	Voice      string `json:"voice"`
	AudioURL   string `json:"audio_url"`
	Cached     bool   `json:"cached"`
	DurationMS int    `json:"duration_ms"`
}

type Service struct {
	mu                sync.RWMutex
	root              string
	dataDir           string
	audioDir          string
	settingsFile      string
	settingsToken     string
	credentialAccount string
	credentials       CredentialStore
	config            Config
	sf                singleflight.Group
}

func generateToken() string {
	b := make([]byte, 16)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}

func New(root, dataDir string) *Service {
	return NewWithCredentials(root, dataDir, systemCredentials{})
}

func NewWithCredentials(root, dataDir string, creds CredentialStore) *Service {
	s := &Service{
		root:          root,
		dataDir:       dataDir,
		audioDir:      filepath.Join(dataDir, "audio"),
		settingsFile:  filepath.Join(dataDir, "tts-provider.json"),
		settingsToken: generateToken(),
		credentials:   creds,
		config: Config{
			BaseURL:      "https://api.deepseek.com/v1/tools/tts",
			DefaultVoice: "stella",
		},
	}
	_ = os.MkdirAll(filepath.Join(s.audioDir, "stella"), 0755)
	_ = os.MkdirAll(filepath.Join(s.audioDir, "tide"), 0755)
	s.loadSavedProvider()
	return s
}

func (s *Service) AuthorizeSettings(token string) bool {
	return subtle.ConstantTimeCompare([]byte(token), []byte(s.settingsToken)) == 1
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

func loopback(host string) bool {
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func validateEndpoint(baseURL, proxyURL string, allowDirectHTTPS bool) string {
	if len(baseURL) > 1024 || len(proxyURL) > 1024 {
		return "TTS 接口或代理地址无效"
	}
	u, err := url.Parse(baseURL)
	if err != nil || u.Hostname() == "" || u.User != nil ||
		u.RawQuery != "" || u.Fragment != "" {
		return "TTS 端点地址无效"
	}
	if u.Scheme != "https" && !(u.Scheme == "http" && loopback(u.Hostname())) {
		return "远程 TTS 端点必须使用 HTTPS"
	}
	if proxyURL == "" && !loopback(u.Hostname()) && !allowDirectHTTPS {
		return "请为远程 TTS 配置显式代理，或手动勾选允许直连 HTTPS"
	}
	if proxyURL != "" {
		p, err := url.Parse(proxyURL)
		if err != nil || p.Hostname() == "" || p.RawQuery != "" ||
			p.Fragment != "" || (p.Scheme != "http" && p.Scheme != "https" &&
			p.Scheme != "socks5" && p.Scheme != "socks5h") {
			return "TTS 代理地址无效"
		}
	}
	return ""
}

func (s *Service) Settings() ProviderSettings {
	s.mu.RLock()
	defer s.mu.RUnlock()

	c := s.config
	storage := "environment"
	if s.credentialAccount != "" {
		storage = "system_keyring"
	}

	base := c.BaseURL
	if base == "" {
		base = "https://api.deepseek.com/v1/tools/tts"
	}
	voice := c.DefaultVoice
	if voice != "tide" {
		voice = "stella"
	}
	msg := c.Message
	validationMsg := validateEndpoint(base, c.ProxyURL, c.AllowDirectHTTPS)
	if c.APIKey != "" && msg == "" {
		msg = validationMsg
	}
	ready := c.APIKey != "" && msg == "" && validationMsg == ""

	return ProviderSettings{
		BaseURL:             safeProxy(base),
		Voices:              []string{"stella", "tide"},
		DefaultVoice:        voice,
		ProxyURL:            safeProxy(c.ProxyURL),
		ProxyAuthConfigured: safeProxy(c.ProxyURL) != c.ProxyURL,
		AllowDirectHTTPS:    c.AllowDirectHTTPS,
		KeyConfigured:       c.APIKey != "",
		Storage:             storage,
		WriteToken:          s.settingsToken,
		Ready:               ready,
		Message:             msg,
	}
}

func (s *Service) Save(update ProviderUpdate, token string) error {
	if !s.AuthorizeSettings(token) {
		return errors.New("会话已过期，请刷新页面重试")
	}

	s.mu.Lock()
	defer s.mu.Unlock()

	base := strings.TrimRight(strings.TrimSpace(update.BaseURL), "/")
	if base == "" {
		base = "https://api.deepseek.com/v1/tools/tts"
	}
	voice := update.DefaultVoice
	if voice != "tide" {
		voice = "stella"
	}
	proxy := strings.TrimSpace(update.ProxyURL)
	// A redacted proxy URL round-trips without discarding existing credentials.
	if proxy == safeProxy(s.config.ProxyURL) {
		proxy = s.config.ProxyURL
	}

	account := s.credentialAccount
	if account == "" {
		var err error
		account, err = generateAccount()
		if err != nil {
			return fmt.Errorf("生成凭据账户失败: %w", err)
		}
	}

	apiKey := s.config.APIKey
	if update.ClearKey {
		_ = s.credentials.Delete(account)
		_ = os.Remove(s.settingsFile)
		s.credentialAccount = ""
		s.config = Config{
			BaseURL:          base,
			DefaultVoice:     voice,
			ProxyURL:         proxy,
			AllowDirectHTTPS: update.AllowDirectHTTPS,
		}
		s.settingsToken = generateToken()
		return nil
	}

	if update.APIKey != nil && strings.TrimSpace(*update.APIKey) != "" {
		apiKey = strings.TrimSpace(*update.APIKey)
	}

	if apiKey == "" {
		return errors.New("API Key 不能为空")
	}
	if msg := validateEndpoint(base, proxy, update.AllowDirectHTTPS); msg != "" {
		return errors.New(msg)
	}

	secretJSON, err := json.Marshal(secretPayload{APIKey: apiKey})
	if err != nil {
		return err
	}
	if err := s.credentials.Set(account, string(secretJSON)); err != nil {
		return fmt.Errorf("无法写入系统凭据存储（Keyring）: %w", err)
	}

	marker := savedProvider{
		Version:          1,
		Account:          account,
		BaseURL:          base,
		DefaultVoice:     voice,
		ProxyURL:         proxy,
		AllowDirectHTTPS: update.AllowDirectHTTPS,
	}
	markerJSON, err := json.Marshal(marker)
	if err != nil {
		return err
	}
	if err := os.WriteFile(s.settingsFile, markerJSON, 0600); err != nil {
		return fmt.Errorf("保存设置文件失败: %w", err)
	}

	s.credentialAccount = account
	s.config = Config{
		BaseURL:          base,
		DefaultVoice:     voice,
		ProxyURL:         proxy,
		AllowDirectHTTPS: update.AllowDirectHTTPS,
		APIKey:           apiKey,
	}
	s.settingsToken = generateToken()
	return nil
}

func (s *Service) httpClient(proxyURL string) (*http.Client, error) {
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	transport.DialContext = (&net.Dialer{Timeout: 15 * time.Second}).DialContext
	transport.TLSHandshakeTimeout = 15 * time.Second

	if proxyURL != "" {
		proxy, err := url.Parse(proxyURL)
		if err != nil {
			return nil, errors.New("TTS 代理地址无效")
		}
		transport.Proxy = http.ProxyURL(proxy)
	}

	return &http.Client{
		Transport: transport,
		Timeout:   30 * time.Second,
	}, nil
}

type ttsRequest struct {
	Text    string `json:"text"`
	VoiceID string `json:"voice_id"`
	Format  string `json:"format"`
}

func (s *Service) Test(ctx context.Context, update ProviderUpdate, token string) (string, error) {
	if !s.AuthorizeSettings(token) {
		return "", errors.New("会话已过期，请刷新页面重试")
	}

	s.mu.RLock()
	apiKey := s.config.APIKey
	savedProxy := s.config.ProxyURL
	proxy := savedProxy
	baseURL := s.config.BaseURL
	allowDirect := s.config.AllowDirectHTTPS
	s.mu.RUnlock()

	if base := strings.TrimRight(strings.TrimSpace(update.BaseURL), "/"); base != "" {
		baseURL = base
		proxy = strings.TrimSpace(update.ProxyURL)
		if proxy == safeProxy(savedProxy) {
			proxy = savedProxy
		}
		allowDirect = update.AllowDirectHTTPS
	} else {
		if p := strings.TrimSpace(update.ProxyURL); p != "" {
			proxy = p
		}
		if update.AllowDirectHTTPS {
			allowDirect = true
		}
	}
	if update.APIKey != nil && strings.TrimSpace(*update.APIKey) != "" {
		apiKey = strings.TrimSpace(*update.APIKey)
	}

	if apiKey == "" {
		return "", errors.New("API Key 尚未配置，请输入有效密钥后测试")
	}
	if msg := validateEndpoint(baseURL, proxy, allowDirect); msg != "" {
		return "", errors.New(msg)
	}

	client, err := s.httpClient(proxy)
	if err != nil {
		return "", err
	}
	reqBody, err := json.Marshal(ttsRequest{
		Text:    "OK",
		VoiceID: "stella",
		Format:  "pcm",
	})
	if err != nil {
		return "", fmt.Errorf("构建请求失败: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, baseURL, bytes.NewReader(reqBody))
	if err != nil {
		return "", fmt.Errorf("构建请求失败: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("TTS 服务连接失败（请检查代理或网络）: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusUnauthorized || resp.StatusCode == http.StatusForbidden {
		return "", errors.New("认证失败：API Key 无效或未授权 TTS 权限")
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return "", fmt.Errorf("DeepSeek TTS 接口返回异常 (状态码 %d): %s", resp.StatusCode, string(body))
	}

	return "连接成功：DeepSeek TTS 语音合成接口响应正常", nil
}

func (s *Service) GetAudioFilePath(voice, key string) (string, error) {
	if voice != "stella" && voice != "tide" {
		return "", errors.New("无效的音色")
	}
	if !keyHexRegex.MatchString(key) {
		return "", errors.New("无效的音频文件标识")
	}

	path := filepath.Join(s.audioDir, voice, key+".wav")
	cleanAudioDir := filepath.Clean(s.audioDir)
	cleanPath := filepath.Clean(path)
	if !strings.HasPrefix(cleanPath, cleanAudioDir+string(filepath.Separator)) {
		return "", errors.New("非法的文件路径")
	}

	if _, err := os.Stat(cleanPath); err != nil {
		return "", os.ErrNotExist
	}
	return cleanPath, nil
}

type synthOutcome struct {
	durationMs int
	version    int64
}

func audioURL(voice, key string, version int64) string {
	base := fmt.Sprintf("/api/audio/%s/%s.wav", voice, key)
	if version > 0 {
		return fmt.Sprintf("%s?v=%d", base, version)
	}
	return base
}

func (s *Service) Synthesize(ctx context.Context, text, voice string, force bool) (*SynthesizeResult, error) {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil, errors.New("发音文本不能为空")
	}
	if len(text) > 10000 {
		return nil, errors.New("发音文本长度不能超过 10,000 字符")
	}

	s.mu.RLock()
	config := s.config
	s.mu.RUnlock()

	if voice != "stella" && voice != "tide" {
		voice = config.DefaultVoice
		if voice != "tide" {
			voice = "stella"
		}
	}

	key := PhraseKey(text)
	audioPath := filepath.Join(s.audioDir, voice, key+".wav")

	if !force {
		if fi, err := os.Stat(audioPath); err == nil && fi.Size() > 44 {
			// Estimate duration from 24kHz 16-bit mono PCM (48,000 bytes/sec)
			pcmBytes := fi.Size() - 44
			durationMs := int((pcmBytes * 1000) / 48000)
			return &SynthesizeResult{
				Key:        key,
				Voice:      voice,
				AudioURL:   audioURL(voice, key, fi.ModTime().UnixNano()),
				Cached:     true,
				DurationMS: durationMs,
			}, nil
		}
	}

	if config.APIKey == "" {
		return nil, errors.New("TTS 服务尚未配置 API Key，请在「服务设置」中配置")
	}
	if msg := validateEndpoint(
		config.BaseURL, config.ProxyURL, config.AllowDirectHTTPS,
	); msg != "" {
		return nil, errors.New(msg)
	}

	sfKey := fmt.Sprintf("%s:%s:%t", voice, key, force)
	val, err, _ := s.sf.Do(sfKey, func() (any, error) {
		if !force {
			if fi, err := os.Stat(audioPath); err == nil && fi.Size() > 44 {
				pcmBytes := fi.Size() - 44
				return synthOutcome{
					durationMs: int((pcmBytes * 1000) / 48000),
					version:    fi.ModTime().UnixNano(),
				}, nil
			}
		}

		var prevMod int64
		if fi, err := os.Stat(audioPath); err == nil {
			prevMod = fi.ModTime().UnixNano()
		}

		client, err := s.httpClient(config.ProxyURL)
		if err != nil {
			return synthOutcome{}, err
		}
		reqPayload, err := json.Marshal(ttsRequest{
			Text:    text,
			VoiceID: voice,
			Format:  "pcm",
		})
		if err != nil {
			return synthOutcome{}, err
		}

		req, err := http.NewRequestWithContext(ctx, http.MethodPost, config.BaseURL, bytes.NewReader(reqPayload))
		if err != nil {
			return synthOutcome{}, err
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("Authorization", "Bearer "+config.APIKey)

		resp, err := client.Do(req)
		if err != nil {
			return synthOutcome{}, fmt.Errorf("请求 DeepSeek TTS 失败: %w", err)
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(io.LimitReader(resp.Body, 1024))
			return synthOutcome{}, fmt.Errorf("DeepSeek TTS 接口错误 (状态码 %d): %s", resp.StatusCode, string(body))
		}

		pcmData, err := io.ReadAll(io.LimitReader(resp.Body, 20*1024*1024))
		if err != nil {
			return synthOutcome{}, fmt.Errorf("读取音频数据流失败: %w", err)
		}
		if len(pcmData) == 0 {
			return synthOutcome{}, errors.New("TTS 接口返回了空音频数据")
		}

		wavBytes := WrapPCM24kToWAV(pcmData)

		voiceDir := filepath.Join(s.audioDir, voice)
		_ = os.MkdirAll(voiceDir, 0755)

		tmpPath := filepath.Join(voiceDir, fmt.Sprintf(".tmp_%s_%d.wav", key, time.Now().UnixNano()))
		if err := os.WriteFile(tmpPath, wavBytes, 0644); err != nil {
			return synthOutcome{}, fmt.Errorf("写入临时音频缓存失败: %w", err)
		}
		if err := os.Rename(tmpPath, audioPath); err != nil {
			_ = os.Remove(tmpPath)
			return synthOutcome{}, fmt.Errorf("保存音频缓存失败: %w", err)
		}

		version := time.Now().UnixNano()
		if fi, err := os.Stat(audioPath); err == nil {
			version = fi.ModTime().UnixNano()
		}
		// Ensure forced regeneration advances the version even within the same clock tick.
		if prevMod > 0 && version <= prevMod {
			bumped := time.Unix(0, prevMod+int64(time.Millisecond))
			if err := os.Chtimes(audioPath, bumped, bumped); err == nil {
				version = bumped.UnixNano()
			} else {
				version = prevMod + int64(time.Millisecond)
			}
		}

		durationMs := int((int64(len(pcmData)) * 1000) / 48000)
		return synthOutcome{
			durationMs: durationMs,
			version:    version,
		}, nil
	})

	if err != nil {
		return nil, err
	}

	outcome := val.(synthOutcome)
	return &SynthesizeResult{
		Key:        key,
		Voice:      voice,
		AudioURL:   audioURL(voice, key, outcome.version),
		Cached:     false,
		DurationMS: outcome.durationMs,
	}, nil
}
