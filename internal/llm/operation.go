package llm

import "errors"

func requestOperation(path string) string {
	switch path {
	case "/responses/input_tokens":
		return "input_count"
	case "/responses/compact":
		return "compaction"
	default:
		return "response"
	}
}

func identifyOperation(err error, operation string) error {
	var failure *Failure
	if !errors.As(err, &failure) {
		return err
	}
	result := *failure
	result.Operation = operation
	if result.Code == "unsupported_request" {
		labels := map[string]string{"response": "生成请求", "input_count": "输入计数请求",
			"compaction": "独立压缩请求", "compaction_v2": "Responses V2 压缩请求"}
		result.Message = "LLM " + labels[operation] + "被端点拒绝，请检查该请求的参数"
		if result.Parameter != "" {
			result.Message += "（参数：" + result.Parameter + "）"
		}
	}
	return &result
}
