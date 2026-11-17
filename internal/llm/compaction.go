package llm

import (
	"context"
	"encoding/json"
)

const compactionInstructions = "Compact the supplied memory palace conversation. Preserve " +
	"the original item, images, teaching requirements, retrieved evidence and unresolved gaps."

func (p *HTTPProvider) nativeCompact(ctx context.Context, params Parameters, history []json.RawMessage) ([]json.RawMessage, Usage, error) {
	data, err := p.postJSON(ctx, "/responses/compact", map[string]any{
		"model": params.Model, "input": history, "instructions": compactionInstructions})
	if err != nil {
		return nil, Usage{}, err
	}
	var result struct {
		Output []json.RawMessage `json:"output"`
		Usage  Usage             `json:"usage"`
	}
	if json.Unmarshal(data, &result) != nil || len(result.Output) == 0 {
		return nil, Usage{}, &Failure{Code: "invalid_compaction", Message: "压缩接口未返回完整会话窗口，未继续构思"}
	}
	compacted := false
	for _, raw := range result.Output {
		var item struct {
			Type      string `json:"type"`
			Encrypted string `json:"encrypted_content"`
		}
		if json.Unmarshal(raw, &item) != nil {
			return nil, result.Usage, ErrInvalid
		}
		if item.Type == "compaction" && item.Encrypted != "" {
			compacted = true
		}
	}
	if !compacted {
		return nil, result.Usage, &Failure{Code: "invalid_compaction", Message: "端点没有返回可继续使用的加密压缩状态"}
	}
	// Standalone compaction output is a complete replacement window. Keeping only
	// its opaque item loses retained messages and can discard the original images.
	return result.Output, result.Usage, nil
}

func (p *HTTPProvider) countInput(ctx context.Context, body map[string]any) (int64, error) {
	request := map[string]any{}
	for _, name := range []string{"model", "input", "instructions", "tools", "tool_choice", "text", "reasoning"} {
		if value, ok := body[name]; ok {
			request[name] = value
		}
	}
	data, err := p.postJSON(ctx, "/responses/input_tokens", request)
	if err != nil {
		return 0, err
	}
	var result struct {
		InputTokens int64 `json:"input_tokens"`
	}
	if json.Unmarshal(data, &result) != nil || result.InputTokens < 1 {
		return 0, &Failure{Code: "invalid_token_count", Message: "计数接口未返回有效输入 token 数"}
	}
	return result.InputTokens, nil
}
