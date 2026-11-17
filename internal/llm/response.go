package llm

import (
	"encoding/json"
	"io"
	"strings"
)

type responseEnvelope struct {
	Status     string          `json:"status"`
	Error      json.RawMessage `json:"error"`
	Incomplete struct {
		Reason string `json:"reason"`
	} `json:"incomplete_details"`
	Usage  Usage             `json:"usage"`
	Output []json.RawMessage `json:"output"`
}

type responseMessage struct {
	Type    string `json:"type"`
	Role    string `json:"role"`
	Status  string `json:"status"`
	Content []struct {
		Type string `json:"type"`
		Text string `json:"text"`
	} `json:"content"`
}

func parseResponse(data []byte) (Plan, Usage, error) {
	var response responseEnvelope
	if json.Unmarshal(data, &response) != nil {
		return Plan{}, Usage{}, &Failure{Code: "invalid_response", Message: "LLM 未返回有效的 Responses 响应"}
	}
	usage := response.Usage
	if len(response.Error) > 0 && string(response.Error) != "null" {
		return Plan{}, usage, &Failure{Code: "provider_error", Message: "LLM 返回错误，请检查模型和参数"}
	}
	if response.Status != "completed" {
		message := "LLM 构思未完成，部分输出不会用于生图"
		if response.Incomplete.Reason == "max_output_tokens" {
			message = "本轮输出预算已用完（含思考 token），需要压缩会话后继续构思"
		}
		return Plan{}, usage, &Failure{Code: "incomplete", Message: message}
	}
	text, err := completedText(response.Output)
	if err != nil {
		return Plan{}, usage, err
	}
	var plan Plan
	decoder := json.NewDecoder(strings.NewReader(text))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&plan) != nil || decoder.Decode(new(any)) != io.EOF || plan.Research == nil {
		return Plan{}, usage, &Failure{Code: "invalid_plan", Message: "构思须返回一个含 research 的完整 JSON 对象"}
	}
	if issue := planViolation(plan); issue != "" {
		return Plan{}, usage, &Failure{Code: "invalid_plan", Message: issue}
	}
	return plan, usage, nil
}

func completedText(output []json.RawMessage) (string, error) {
	var text strings.Builder
	for _, raw := range output {
		var item responseMessage
		if json.Unmarshal(raw, &item) != nil {
			return "", ErrInvalid
		}
		if item.Type != "message" {
			continue
		}
		if item.Role != "assistant" || item.Status != "completed" {
			return "", &Failure{Code: "invalid_response", Message: "LLM 消息尚未完成"}
		}
		for _, content := range item.Content {
			if content.Type == "refusal" {
				return "", &Failure{Code: "refused", Message: "LLM 拒绝了本次构思请求"}
			}
			if content.Type != "output_text" {
				return "", &Failure{Code: "invalid_response", Message: "LLM 消息包含非文本内容，无法提取构思"}
			}
			if content.Type == "output_text" {
				if text.Len()+len(content.Text) > 64000 {
					return "", &Failure{Code: "invalid_plan", Message: "LLM 构思正文超过大小限制"}
				}
				text.WriteString(content.Text)
			}
		}
	}
	return text.String(), nil
}
