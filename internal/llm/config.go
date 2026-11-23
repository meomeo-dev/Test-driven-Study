package llm

import (
	"bufio"
	"fmt"
	"net"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
)

type Config struct {
	BaseURL, APIKey, ProxyURL                          string
	AllowDirectHTTPS                                   bool `json:"allow_direct_https"`
	Models                                             []string
	DefaultModel, Message                              string
	ReasoningEffort                                    string
	MaxOutputTokensK                                   int
	ContextBudgetK, CompactThresholdK, CompactReserveK int
	WebSearch                                          string
}

func parseBoolEnv(raw string) bool {
	return strings.EqualFold(raw, "true") || raw == "1"
}

func LoadConfig(root string) Config {
	filename := os.Getenv("STUDY_LLM_CONFIG_FILE")
	if filename == "" {
		filename = filepath.Join(root, ".env.gpt")
	}
	values, err := readConfig(filename)
	if err != nil && !os.IsNotExist(err) {
		return Config{Message: "无法读取本地LLM配置"}
	}
	get := func(name string) string {
		if value, ok := os.LookupEnv(name); ok {
			return strings.TrimSpace(value)
		}
		return strings.TrimSpace(values[name])
	}
	c := Config{
		BaseURL:          strings.TrimRight(get("GPT_1_BASE_URL"), "/"),
		APIKey:           get("GPT_1_API_KEY"),
		ProxyURL:         get("GPT_1_PROXY_URL"),
		AllowDirectHTTPS: parseBoolEnv(get("GPT_1_ALLOW_DIRECT_HTTPS")),
		Models:           []string{},
	}
	if c.ProxyURL == "" && !c.AllowDirectHTTPS {
		c.ProxyURL = get("HTTPS_PROXY")
	}
	for _, model := range strings.Split(get("GPT_1_MODELS"), ",") {
		if model = strings.TrimSpace(model); model != "" && len(model) <= 100 && !slices.Contains(c.Models, model) {
			c.Models = append(c.Models, model)
		}
	}
	if len(c.Models) > 0 {
		c.DefaultModel = c.Models[0]
	}
	if configured := get("GPT_1_DEFAULT_MODEL"); configured != "" {
		c.DefaultModel = configured
	}
	c.ReasoningEffort = get("GPT_1_REASONING_EFFORT")
	if c.ReasoningEffort == "" {
		c.ReasoningEffort = "medium"
	}
	c.MaxOutputTokensK = DefaultOutputTokensK
	if raw := get("GPT_1_MAX_OUTPUT_TOKENS_K"); raw != "" {
		var err error
		c.MaxOutputTokensK, err = strconv.Atoi(raw)
		if err != nil {
			return Config{Message: "LLM 输出 token 上限必须为整数 K"}
		}
	}
	c.ContextBudgetK = DefaultContextBudgetK
	c.CompactThresholdK = DefaultCompactThresholdK
	c.CompactReserveK = DefaultCompactReserveK
	c.WebSearch = get("GPT_1_WEB_SEARCH")
	if c.WebSearch == "" {
		c.WebSearch = "required"
	}
	for name, target := range map[string]*int{"GPT_1_CONTEXT_BUDGET_K": &c.ContextBudgetK, "GPT_1_COMPACT_THRESHOLD_K": &c.CompactThresholdK, "GPT_1_COMPACT_RESERVE_K": &c.CompactReserveK} {
		if raw := get(name); raw != "" {
			value, err := strconv.Atoi(raw)
			if err != nil {
				return Config{Message: "LLM 会话预算必须为整数 K"}
			}
			*target = value
		}
	}
	if get("GPT_1_MAX_OUTPUT_TOKENS_K") == "" {
		c.MaxOutputTokensK = min(128, c.CompactReserveK)
	}
	c.Message = validateConfig(c)
	return c
}

func readConfig(filename string) (map[string]string, error) {
	file, err := os.Open(filename)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	values := map[string]string{}
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(strings.TrimPrefix(scanner.Text(), "export "))
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			return nil, fmt.Errorf("invalid configuration line")
		}
		value = strings.TrimSpace(value)
		if strings.HasPrefix(value, "\"") {
			value, err = strconv.Unquote(value)
			if err != nil {
				return nil, fmt.Errorf("invalid configuration value")
			}
		} else if strings.HasPrefix(value, "'") && strings.HasSuffix(value, "'") {
			value = strings.Trim(value, "'")
		}
		values[strings.TrimSpace(key)] = value
	}
	return values, scanner.Err()
}

func loopback(host string) bool {
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func validateConfig(c Config) string {
	if !slices.Contains(Efforts, c.ReasoningEffort) {
		return "LLM 思考强度无效"
	}
	if _, err := normalizePolicy(c.parameters()); err != nil {
		return "LLM 预算无效：会话预算必须等于压缩阈值加预留，单次输出不能超过预留"
	}
	if c.BaseURL == "" || c.APIKey == "" || len(c.Models) == 0 {
		return "请配置本地LLM端点、密钥和模型"
	}
	if !slices.Contains(c.Models, c.DefaultModel) || len(c.Models) > 16 {
		return "LLM 默认模型必须在模型列表中（最多16个）"
	}
	if len(c.APIKey) > 1024 || strings.ContainsAny(c.APIKey, "\r\n\x00") {
		return "LLM API Key 格式或长度无效"
	}
	u, err := url.Parse(c.BaseURL)
	if err != nil || u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return "LLM端点地址无效"
	}
	if u.Scheme != "https" && !(u.Scheme == "http" && loopback(u.Hostname())) {
		return "远程LLM端点必须使用 HTTPS"
	}
	if c.ProxyURL == "" && !loopback(u.Hostname()) &&
		!(c.AllowDirectHTTPS && u.Scheme == "https") {
		return "请为远程LLM配置显式代理，或手动勾选允许直连 HTTPS"
	}
	if c.ProxyURL != "" {
		p, err := url.Parse(c.ProxyURL)
		if err != nil || p.Hostname() == "" || p.RawQuery != "" || p.Fragment != "" || (p.Scheme != "http" && p.Scheme != "https" && p.Scheme != "socks5" && p.Scheme != "socks5h") {
			return "LLM代理地址无效"
		}
	}
	return ""
}

// The provider decides which efforts its selected model supports.
var Efforts = []string{"default", "none", "minimal", "low", "medium", "high", "xhigh", "max"}

func (c Config) parameters() Parameters {
	return Parameters{Model: c.DefaultModel, ReasoningEffort: c.ReasoningEffort, MaxOutputTokensK: c.MaxOutputTokensK,
		ContextBudgetK: c.ContextBudgetK, CompactThresholdK: c.CompactThresholdK, CompactReserveK: c.CompactReserveK, WebSearch: c.WebSearch}
}
