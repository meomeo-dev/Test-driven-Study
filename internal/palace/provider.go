package palace

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"io"
	"mime/multipart"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const maxImageBytes = 32 << 20
const maxResponseBytes = 48 << 20

type HTTPProvider struct {
	config Config
	client *http.Client
}

func NewHTTPProvider(c Config) (*HTTPProvider, error) {
	if validateConfig(c) != "" {
		return nil, ErrDisabled
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.Proxy = nil
	transport.DialContext = (&net.Dialer{Timeout: 20 * time.Second}).DialContext
	transport.TLSHandshakeTimeout = 20 * time.Second
	if c.ProxyURL != "" {
		proxy, err := url.Parse(c.ProxyURL)
		if err != nil {
			return nil, ErrDisabled
		}
		transport.Proxy = http.ProxyURL(proxy)
	}
	return &HTTPProvider{config: c, client: &http.Client{Transport: transport,
		Timeout: 10 * time.Minute, CheckRedirect: func(*http.Request, []*http.Request) error {
			return http.ErrUseLastResponse
		}}}, nil
}

func (p *HTTPProvider) Generate(ctx context.Context, input ProviderInput) (ProviderOutput, error) {
	body, contentType, route, err := imageRequest(input)
	if err != nil {
		return ProviderOutput{}, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, p.config.BaseURL+route, body)
	if err != nil {
		return ProviderOutput{}, &Failure{"configuration", "生图端点地址无效"}
	}
	request.Header.Set("Authorization", "Bearer "+p.config.APIKey)
	request.Header.Set("Content-Type", contentType)
	response, err := p.client.Do(request)
	if err != nil {
		if ctx.Err() != nil {
			return ProviderOutput{}, ctx.Err()
		}
		if p.config.ProxyURL == "" && p.config.AllowDirectHTTPS {
			return ProviderOutput{}, &Failure{"connection_failed", "无法直连生图服务，请检查网络或稍后重试"}
		}
		return ProviderOutput{}, &Failure{"connection_failed", "无法通过代理连接生图服务，请检查代理或稍后重试"}
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return ProviderOutput{}, providerResponseFailure(response.StatusCode, response.Body)
	}
	payload, err := readBounded(response.Body, maxResponseBytes)
	if err != nil {
		return ProviderOutput{}, err
	}
	var result struct {
		Data []struct {
			Base64 string `json:"b64_json"`
			URL    string `json:"url"`
		} `json:"data"`
		Usage Usage `json:"usage"`
	}
	if json.Unmarshal(payload, &result) != nil || len(result.Data) != 1 {
		return ProviderOutput{}, &Failure{"invalid_response", "生图服务未返回一张有效图片"}
	}
	item := result.Data[0]
	var data []byte
	if item.Base64 != "" {
		data, err = base64.StdEncoding.Strict().DecodeString(item.Base64)
	} else if item.URL != "" {
		data, err = p.download(ctx, item.URL)
	} else {
		err = &Failure{"invalid_response", "生图服务没有返回图片内容"}
	}
	if err != nil {
		return ProviderOutput{}, &Failure{"invalid_image", "未能读取模型返回的图片内容"}
	}
	if len(data) == 0 || len(data) > maxImageBytes {
		return ProviderOutput{}, &Failure{"invalid_image", "返回图片为空或超过本地大小限制"}
	}
	return ProviderOutput{Bytes: data, Usage: result.Usage}, nil
}

func imageRequest(input ProviderInput) (io.Reader, string, string, error) {
	fields := map[string]string{"model": input.Model, "prompt": input.Prompt,
		"size": input.Size, "quality": input.Quality, "output_format": "png"}
	if len(input.Reference) == 0 {
		payload, err := json.Marshal(struct {
			Model   string `json:"model"`
			Prompt  string `json:"prompt"`
			Size    string `json:"size"`
			Quality string `json:"quality"`
			Format  string `json:"output_format"`
			N       int    `json:"n"`
		}{input.Model, input.Prompt, input.Size, input.Quality, "png", 1})
		return bytes.NewReader(payload), "application/json", "/images/generations", err
	}
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for key, value := range fields {
		if err := writer.WriteField(key, value); err != nil {
			return nil, "", "", err
		}
	}
	if err := writer.WriteField("n", "1"); err != nil {
		return nil, "", "", err
	}
	part, err := writer.CreateFormFile("image[]", input.ReferenceName)
	if err != nil {
		return nil, "", "", err
	}
	if _, err := part.Write(input.Reference); err != nil {
		return nil, "", "", err
	}
	if err := writer.Close(); err != nil {
		return nil, "", "", err
	}
	return &body, writer.FormDataContentType(), "/images/edits", nil
}

func readBounded(reader io.Reader, limit int64) ([]byte, error) {
	data, err := io.ReadAll(io.LimitReader(reader, limit+1))
	if err != nil || int64(len(data)) > limit {
		return nil, &Failure{"response_too_large", "图片响应中断或超过大小限制"}
	}
	return data, nil
}

func (p *HTTPProvider) download(ctx context.Context, raw string) ([]byte, error) {
	u, err := url.Parse(raw)
	if err != nil || u.Hostname() == "" || u.User != nil {
		return nil, ErrInvalid
	}
	base, _ := url.Parse(p.config.BaseURL)
	local := loopback(u.Hostname()) && loopback(base.Hostname()) && u.Host == base.Host
	if !local {
		if u.Scheme != "https" || (p.config.ProxyURL == "" && !p.config.AllowDirectHTTPS) {
			return nil, ErrInvalid
		}
		ip := net.ParseIP(u.Hostname())
		if loopback(u.Hostname()) || (ip != nil && (ip.IsPrivate() || ip.IsLinkLocalUnicast() || ip.IsUnspecified())) || strings.HasSuffix(u.Hostname(), ".local") {
			return nil, ErrInvalid
		}
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, raw, nil)
	if err != nil {
		return nil, ErrInvalid
	}
	// Download requests deliberately have no provider Authorization header.
	response, err := p.client.Do(request)
	if err != nil {
		if p.config.ProxyURL == "" && p.config.AllowDirectHTTPS {
			return nil, &Failure{"download_failed", "无法直连下载生成图片"}
		}
		return nil, &Failure{"download_failed", "无法通过代理下载生成图片"}
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return nil, providerFailure(response.StatusCode)
	}
	return readBounded(response.Body, maxImageBytes)
}

func providerResponseFailure(status int, body io.Reader) error {
	if status == http.StatusForbidden && body != nil {
		if data, err := readBounded(body, 64<<10); err == nil && isQuotaExceededBody(data) {
			return providerFailure(http.StatusPaymentRequired)
		}
	}
	return providerFailure(status)
}

func isQuotaExceededBody(data []byte) bool {
	var payload struct {
		Code    string `json:"code"`
		Type    string `json:"type"`
		Message string `json:"message"`
		Error   struct {
			Code    string `json:"code"`
			Type    string `json:"type"`
			Message string `json:"message"`
		} `json:"error"`
	}
	if json.Unmarshal(data, &payload) != nil {
		return false
	}
	for _, token := range []string{payload.Code, payload.Type, payload.Error.Code, payload.Error.Type} {
		switch strings.ToLower(strings.TrimSpace(token)) {
		case "insufficient_balance", "insufficient_quota", "billing_hard_limit_reached",
			"quota_exceeded", "insufficient_credit", "insufficient_credits":
			return true
		}
	}
	for _, msg := range []string{payload.Message, payload.Error.Message} {
		lower := strings.ToLower(msg)
		if strings.Contains(lower, "insufficient account balance") ||
			strings.Contains(lower, "insufficient balance") ||
			strings.Contains(lower, "insufficient quota") ||
			strings.Contains(lower, "exceeded your current quota") ||
			strings.Contains(msg, "余额不足") {
			return true
		}
	}
	return false
}

func providerFailure(status int) error {
	switch status {
	case 400, 422:
		return &Failure{"unsupported_request", "模型不支持当前参数或参考图，请调整尺寸、模型或参考图设置"}
	case 401, 403:
		return &Failure{"authentication", "生图鉴权或权限不足，请检查本地配置"}
	case 402:
		return &Failure{"quota", "生图服务额度不足"}
	case 429:
		return &Failure{"rate_limited", "生图服务限流或额度不足，请稍后手动重试"}
	default:
		return &Failure{"provider_error", "生图服务暂时不可用，请稍后手动重试"}
	}
}
