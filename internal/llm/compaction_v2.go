package llm

import (
	"context"
	"encoding/json"
)

func (p *HTTPProvider) compactV2(ctx context.Context, params Parameters,
	history []json.RawMessage, original json.RawMessage) ([]json.RawMessage, Usage, error) {
	input := append([]json.RawMessage(nil), history...)
	input = append(input, rawValue(map[string]string{"type": "compaction_trigger"}))
	body := map[string]any{"model": params.Model, "input": input,
		"instructions": compactionInstructions, "tool_choice": "auto",
		"stream": true, "store": false, "max_output_tokens": params.MaxOutputTokensK * 1024,
		"include": []string{"reasoning.encrypted_content"}}
	if params.ReasoningEffort != "default" {
		body["reasoning"] = map[string]string{"effort": params.ReasoningEffort}
	}
	data, err := p.postJSON(ctx, "/responses", body)
	if err != nil {
		return nil, Usage{}, identifyOperation(err, "compaction_v2")
	}
	var result responseEnvelope
	if json.Unmarshal(data, &result) != nil || result.Status != "completed" ||
		(len(result.Error) > 0 && string(result.Error) != "null") {
		return nil, result.Usage, &Failure{Code: "invalid_compaction",
			Operation: "compaction_v2", Message: "Responses V2 压缩未完整结束，原会话未被替换"}
	}
	window, err := v2Window(result.Output, original)
	return window, result.Usage, err
}

func v2Window(output []json.RawMessage, original json.RawMessage) ([]json.RawMessage, error) {
	var compacted json.RawMessage
	count := 0
	for _, raw := range output {
		var item struct {
			Type      string `json:"type"`
			Encrypted string `json:"encrypted_content"`
		}
		if json.Unmarshal(raw, &item) != nil {
			return nil, ErrInvalid
		}
		if item.Type == "compaction" {
			count++
			if item.Encrypted != "" {
				compacted = raw
			}
		}
	}
	if count != 1 || len(compacted) == 0 {
		return nil, &Failure{Code: "invalid_compaction", Operation: "compaction_v2",
			Message: "Responses V2 未返回唯一完整的加密压缩项，原会话未被替换"}
	}
	// V2 differs from standalone /compact: retain our original question/images
	// and only its opaque item. Do not install assistant output or the trigger.
	window := []json.RawMessage{}
	if len(original) > 0 {
		window = append(window, original)
	}
	return append(window, compacted), nil
}
