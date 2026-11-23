package palace

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
	BaseURL, APIKey, ProxyURL string
	AllowDirectHTTPS          bool `json:"allow_direct_https"`
	Models                    []string
	DefaultModel, Message     string
}

func parseBoolEnv(raw string) bool {
	return strings.EqualFold(raw, "true") || raw == "1"
}

func LoadConfig(root string) Config {
	filename := os.Getenv("STUDY_IMAGE_CONFIG_FILE")
	if filename == "" {
		filename = filepath.Join(root, ".env.gpt-image2")
	}
	values, err := readConfig(filename)
	if err != nil && !os.IsNotExist(err) {
		return Config{Message: "无法读取本地生图配置"}
	}
	get := func(name string) string {
		if value, ok := os.LookupEnv(name); ok {
			return strings.TrimSpace(value)
		}
		return strings.TrimSpace(values[name])
	}
	c := Config{
		BaseURL:          strings.TrimRight(get("GPT_IMAGE2_1_BASE_URL"), "/"),
		APIKey:           get("GPT_IMAGE2_1_API_KEY"),
		ProxyURL:         get("GPT_IMAGE2_1_PROXY_URL"),
		AllowDirectHTTPS: parseBoolEnv(get("GPT_IMAGE2_1_ALLOW_DIRECT_HTTPS")),
		Models:           []string{},
	}
	if c.ProxyURL == "" && !c.AllowDirectHTTPS {
		c.ProxyURL = get("HTTPS_PROXY")
	}
	for _, model := range strings.Split(get("GPT_IMAGE2_1_MODELS"), ",") {
		if model = strings.TrimSpace(model); model != "" && len(model) <= 100 && !slices.Contains(c.Models, model) {
			c.Models = append(c.Models, model)
		}
	}
	if len(c.Models) > 0 {
		c.DefaultModel = c.Models[0]
	}
	if slices.Contains(c.Models, "gpt-image-2") {
		c.DefaultModel = "gpt-image-2"
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
	if c.BaseURL == "" || c.APIKey == "" || len(c.Models) == 0 {
		return "请配置本地生图端点、密钥和模型"
	}
	u, err := url.Parse(c.BaseURL)
	if err != nil || u.Hostname() == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" {
		return "生图端点地址无效"
	}
	if u.Scheme != "https" && !(u.Scheme == "http" && loopback(u.Hostname())) {
		return "远程生图端点必须使用 HTTPS"
	}
	if c.ProxyURL == "" && !loopback(u.Hostname()) && !c.AllowDirectHTTPS {
		return "请为远程生图配置显式代理，或手动勾选允许直连 HTTPS"
	}
	if c.ProxyURL != "" {
		p, err := url.Parse(c.ProxyURL)
		if err != nil || p.Hostname() == "" || p.RawQuery != "" || p.Fragment != "" || (p.Scheme != "http" && p.Scheme != "https" && p.Scheme != "socks5" && p.Scheme != "socks5h") {
			return "生图代理地址无效"
		}
	}
	return ""
}
