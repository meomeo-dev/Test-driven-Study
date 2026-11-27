package llm

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/json"
	"io"
	"log/slog"
	"mime"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"test-driven-study/internal/tasktrace"
)

//go:embed plan-schema.json
var planSchemaShape json.RawMessage

var planSchema = boundPlanSchema(planSchemaShape)

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
	return &HTTPProvider{config: c, client: &http.Client{Transport: transport, Timeout: 15 * time.Minute,
		CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}, nil
}

func (p *HTTPProvider) Generate(ctx context.Context, params Parameters, source string) (Plan, Usage, error) {
	return p.GenerateSession(ctx, params, source, nil, nil)
}
func (p *HTTPProvider) postJSON(ctx context.Context, path string, body any) (result []byte, err error) {
	return p.postObservedJSON(ctx, path, body, nil)
}

func (p *HTTPProvider) postObservedJSON(ctx context.Context, path string, body any,
	observe func([]byte)) (result []byte, err error) {
	defer func() { err = identifyOperation(err, requestOperation(path)) }()
	ctx, span, body := traceRequest(ctx, path, body)
	defer func() { span.End(responseOutcome(ctx, result, err), "") }()
	payload, err := json.Marshal(body)
	if err != nil || len(payload) > 64<<20 {
		return nil, &Failure{Code: "request_too_large", Message: "构思请求超过本地大小限制"}
	}
	request, err := http.NewRequestWithContext(ctx, "POST", p.config.BaseURL+path, bytes.NewReader(payload))
	if err != nil {
		return nil, ErrInvalid
	}
	request.Header.Set("Authorization", "Bearer "+p.config.APIKey)
	request.Header.Set("Content-Type", "application/json")
	if object, ok := body.(map[string]any); ok && object["stream"] == true {
		request.Header.Set("Accept", "text/event-stream")
	}
	response, err := p.client.Do(request)
	if err != nil {
		return nil, &Failure{Code: "connection_failed", Message: "LLM 连接中断；为避免重复付费，不会重发结果不明的请求"}
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		data, readErr := readBounded(response.Body, 64<<10)
		failure := providerFailureForBody(response.StatusCode, data)
		if typed, ok := failure.(*Failure); ok {
			typed.HTTPStatus = response.StatusCode
		}
		var diagnostic struct {
			Error struct {
				Param   string `json:"param"`
				Message string `json:"message"`
			} `json:"error"`
		}
		if readErr == nil && json.Unmarshal(data, &diagnostic) == nil {
			parameter := diagnostic.Error.Param
			if parameter == "" {
				for _, name := range []string{"context_management", "tool_choice", "web_search", "allowed_domains", "input_image", "json_schema", "max_output_tokens", "stream"} {
					if strings.Contains(diagnostic.Error.Message, name) {
						parameter = name
						break
					}
				}
			}
			if strings.Contains(diagnostic.Error.Message, "required tool choice has no available tool") {
				parameter = "tool_choice"
			}
			// Return only a known root parameter. Nested provider-supplied labels
			// can contain arbitrary private text and must not reach the browser.
			safeParameter := ""
			for _, prefix := range []string{"context_management", "tools", "tool_choice", "include", "input", "text", "reasoning", "max_output_tokens", "model", "web_search", "allowed_domains", "input_image", "json_schema", "stream"} {
				if parameter == prefix || strings.HasPrefix(parameter, prefix+".") || strings.HasPrefix(parameter, prefix+"[") {
					safeParameter = prefix
					break
				}
			}
			if safeParameter != "" {
				if typed, ok := failure.(*Failure); ok {
					typed.Parameter = safeParameter
					typed.Message += "（参数：" + safeParameter + "）"
				}
			}
			if typed, ok := failure.(*Failure); ok && typed.Code == "unsupported_request" &&
				rejectsPlanBounds(safeParameter, diagnostic.Error.Message) {
				typed.Code = "unsupported_schema_constraints"
				typed.Message = "LLM 端点拒绝了构思结构中的长度约束"
			}
		}
		logProviderRejection(path, body, response, data, failure)
		return nil, failure
	}
	if strings.HasPrefix(response.Header.Get("Content-Type"), "text/event-stream") {
		observer := newStreamTrace(ctx)
		result, err = readObservedStream(response.Body, func(data []byte) {
			observer.observe(data)
			if observe != nil {
				observe(data)
			}
		})
		if err == nil {
			observer.final(result, "stream")
			traceUsage(ctx, result)
		}
		observer.close(responseOutcome(ctx, result, err))
		return result, err
	}
	result, err = readBounded(response.Body, 16<<20)
	if err == nil && path == "/responses" && tasktrace.Enabled(ctx) {
		tasktrace.Note(ctx, "transport", "整轮响应", "本轮未返回流事件；以下内容在响应完成时收到，不代表逐项执行耗时。")
		observer := newStreamTrace(ctx)
		observer.final(result, "response")
		observer.close(responseOutcome(ctx, result, err))
		traceUsage(ctx, result)
	}
	return result, err
}

func rejectsPlanBounds(parameter, message string) bool {
	message = strings.ToLower(message)
	if parameter != "text" && parameter != "json_schema" &&
		!strings.Contains(message, "schema") {
		return false
	}
	return (strings.Contains(message, "pattern") || strings.Contains(message, "maxitems") ||
		strings.Contains(message, "minitems")) &&
		(strings.Contains(message, "not supported") || strings.Contains(message, "unsupported") ||
			strings.Contains(message, "not permitted") || strings.Contains(message, "not allowed"))
}
func readBounded(reader io.Reader, limit int64) ([]byte, error) {
	data, err := io.ReadAll(io.LimitReader(reader, limit+1))
	if err != nil || int64(len(data)) > limit {
		return nil, &Failure{Code: "invalid_response", Message: "LLM 响应中断或超过大小限制"}
	}
	return data, nil
}

func validText(text string, max int) bool {
	return strings.TrimSpace(text) != "" && len([]rune(text)) <= max && !strings.ContainsRune(text, '\x00')
}

func safeLogToken(raw string, max int) string {
	raw = strings.TrimSpace(raw)
	if raw == "" || len(raw) > max {
		return ""
	}
	for _, r := range raw {
		if !((r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') ||
			(r >= '0' && r <= '9') || r == '_' || r == '-' || r == '.' || r == '/') {
			return ""
		}
	}
	return raw
}

func requestShapeMeta(body any) (format string, hasTools bool, inputItems int) {
	object, ok := body.(map[string]any)
	if !ok {
		return "", false, 0
	}
	if tools, ok := object["tools"].([]any); ok && len(tools) > 0 {
		hasTools = true
	}
	if input, ok := object["input"].([]json.RawMessage); ok {
		inputItems = len(input)
	}
	if textMap, ok := object["text"].(map[string]any); ok {
		switch fmtObj := textMap["format"].(type) {
		case map[string]any:
			if t, ok := fmtObj["type"].(string); ok {
				format = safeLogToken(t, 32)
			}
		case map[string]string:
			format = safeLogToken(fmtObj["type"], 32)
		}
	}
	return format, hasTools, inputItems
}

func logProviderRejection(path string, body any, response *http.Response, data []byte, failure error) {
	mediaType, _, _ := mime.ParseMediaType(response.Header.Get("Content-Type"))
	var payload struct {
		Code  string `json:"code"`
		Type  string `json:"type"`
		Error struct {
			Code string `json:"code"`
			Type string `json:"type"`
		} `json:"error"`
	}
	_ = json.Unmarshal(data, &payload)
	code := safeLogToken(payload.Code, 64)
	if code == "" {
		code = safeLogToken(payload.Error.Code, 64)
	}
	errType := safeLogToken(payload.Type, 64)
	if errType == "" {
		errType = safeLogToken(payload.Error.Type, 64)
	}
	failureCode, param := "", ""
	if typed, ok := failure.(*Failure); ok {
		failureCode, param = typed.Code, typed.Parameter
	}
	reqFormat, hasTools, inputItems := requestShapeMeta(body)
	slog.Warn("llm upstream rejected request",
		"path", path, "status", response.StatusCode,
		"content_type", safeLogToken(mediaType, 64),
		"server", safeLogToken(response.Header.Get("Server"), 48),
		"upstream_code", code, "upstream_type", errType,
		"failure_code", failureCode, "param", param,
		"body_bytes", len(data), "request_format", reqFormat,
		"has_tools", hasTools, "input_items", inputItems)
}

func providerFailureForBody(status int, data []byte) error {
	if status == http.StatusForbidden && isQuotaExceededBody(data) {
		return providerFailure(http.StatusPaymentRequired)
	}
	return providerFailure(status)
}

func isQuotaExceededBody(data []byte) bool {
	if len(data) == 0 {
		return false
	}
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
		return &Failure{Code: "unsupported_request", Message: "LLM 端点拒绝了这次请求，请检查请求参数"}
	case 401, 403:
		return &Failure{Code: "authentication", Message: "LLM 鉴权或权限不足，请检查独立的 LLM 配置"}
	case 402:
		return &Failure{Code: "quota", Message: "LLM 服务额度不足"}
	case 429:
		return &Failure{Code: "rate_limited", Message: "LLM 服务限流或额度不足，请稍后手动重试"}
	default:
		return &Failure{Code: "provider_error", Message: "LLM 服务暂时不可用，不会自动重试"}
	}
}
