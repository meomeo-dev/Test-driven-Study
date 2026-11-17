package llm

import (
	"context"
	"encoding/json"
	"fmt"

	"test-driven-study/internal/tasktrace"
)

func traceRequest(ctx context.Context, path string, body any) (context.Context, *tasktrace.Span, any) {
	kind, label := "validation", "上下文计数"
	if path == "/responses/compact" {
		kind, label = "compaction", "会话压缩"
	}
	if path == "/responses" {
		kind, label = "llm", "模型请求"
		if object, ok := body.(map[string]any); ok && tasktrace.Enabled(ctx) {
			if input, ok := object["input"].([]json.RawMessage); ok && len(input) > 0 && len(input[len(input)-1]) < 128 {
				var tail struct {
					Type string `json:"type"`
				}
				if json.Unmarshal(input[len(input)-1], &tail) == nil && tail.Type == "compaction_trigger" {
					kind, label = "compaction", "会话压缩（Codex V2）"
				}
			}
			clone := make(map[string]any, len(object))
			for key, value := range object {
				clone[key] = value
			}
			clone["stream"] = true
			if model, ok := clone["model"].(string); ok {
				label += " · " + model
			}
			body = clone
		}
	}
	ctx, span := tasktrace.Begin(ctx, kind, label)
	return ctx, span, body
}
func responseOutcome(ctx context.Context, data []byte, err error) string {
	if ctx.Err() != nil {
		return "canceled"
	}
	if err != nil {
		return "failed"
	}
	var response struct {
		Status string `json:"status"`
	}
	json.Unmarshal(data, &response)
	if response.Status == "failed" || response.Status == "incomplete" {
		return response.Status
	}
	return "completed"
}
func traceUsage(ctx context.Context, data []byte) {
	var value struct {
		Usage Usage `json:"usage"`
	}
	if json.Unmarshal(data, &value) == nil && value.Usage.TotalTokens > 0 {
		tasktrace.Note(ctx, "usage", "本次请求返回用量", fmt.Sprintf("输入 %d · 输出 %d · 合计 %d tokens",
			value.Usage.InputTokens, value.Usage.OutputTokens, value.Usage.TotalTokens))
	}
}
