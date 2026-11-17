package llm

import (
	"bufio"
	"bytes"
	"encoding/json"
	"io"
	"strings"
)

func readCompletedStream(reader io.Reader) ([]byte, error) {
	return readObservedStream(reader, nil)
}

func readObservedStream(reader io.Reader, observe func([]byte)) ([]byte, error) {
	scanner := bufio.NewScanner(io.LimitReader(reader, 64<<20))
	scanner.Buffer(make([]byte, 4096), 16<<20)
	var data bytes.Buffer
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "data:") {
			if data.Len() > 0 {
				data.WriteByte('\n')
			}
			data.WriteString(strings.TrimPrefix(strings.TrimPrefix(line, "data:"), " "))
			if data.Len() > 16<<20 {
				return nil, &Failure{Code: "invalid_response", Message: "LLM 流事件超过大小限制"}
			}
		}
		if line == "" && data.Len() > 0 {
			if observe != nil {
				observe(data.Bytes())
			}
			value, terminal, err := streamEvent(data.Bytes())
			if err != nil || terminal {
				return value, err
			}
			data.Reset()
		}
	}
	if scanner.Err() == nil && data.Len() > 0 {
		if observe != nil {
			observe(data.Bytes())
		}
		value, terminal, err := streamEvent(data.Bytes())
		if err != nil || terminal {
			return value, err
		}
	}
	// Partial deltas and opaque output_item events are not a completed response.
	// A transport failure must never start a paid compatibility fallback.
	return nil, &Failure{Code: "invalid_response", Message: "LLM 流未返回完整终态；不会重发结果不明的请求"}
}

func streamEvent(data []byte) ([]byte, bool, error) {
	if string(data) == "[DONE]" {
		return nil, false, nil
	}
	var event struct {
		Type     string          `json:"type"`
		Response json.RawMessage `json:"response"`
	}
	if json.Unmarshal(data, &event) != nil {
		return nil, false, &Failure{Code: "invalid_response", Message: "LLM 流事件格式无效"}
	}
	switch event.Type {
	case "response.completed", "response.incomplete", "response.failed":
		if len(event.Response) == 0 || string(event.Response) == "null" {
			return nil, false, &Failure{Code: "invalid_response", Message: "LLM 流终态缺少完整响应"}
		}
		return event.Response, true, nil
	case "error":
		return nil, false, &Failure{Code: "provider_error", Message: "LLM 流返回错误，未继续构思"}
	default:
		return nil, false, nil
	}
}
