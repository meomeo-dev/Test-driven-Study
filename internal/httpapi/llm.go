package httpapi

import (
	"errors"
	"net/http"
	"test-driven-study/internal/llm"
)

func (s *Server) hasLLM(w http.ResponseWriter) bool {
	if s.llm != nil {
		return true
	}
	problem(w, 503, "LLM 服务未启用")
	return false
}
func llmError(w http.ResponseWriter, err error) {
	var settings *llm.SettingsError
	switch {
	case errors.As(err, &settings):
		problem(w, 400, settings.Message)
	case errors.Is(err, llm.ErrDisabled):
		problem(w, 503, "请检查独立的 LLM 配置与代理")
	case errors.Is(err, llm.ErrInvalid):
		problem(w, 400, "LLM 构思参数无效")
	case errors.Is(err, llm.ErrConflict):
		problem(w, 409, "LLM 正在构思或请求与已保存记录不同，请检查记录")
	default:
		respondError(w, err)
	}
}
func (s *Server) llmInfo(w http.ResponseWriter, r *http.Request) {
	if !s.hasLLM(w) {
		return
	}
	value := s.llm.ProviderSettings()
	writeJSON(w, 200, map[string]any{"ready": value.Ready, "models": value.Models,
		"default_model": value.DefaultModel, "reasoning_effort": value.ReasoningEffort,
		"max_output_tokens_k": value.MaxOutputTokensK, "context_budget_k": value.ContextBudgetK, "compact_threshold_k": value.CompactThresholdK, "compact_reserve_k": value.CompactReserveK, "web_search": value.WebSearch, "efforts": value.Efforts, "message": value.Message})
}
func (s *Server) llmSettings(w http.ResponseWriter, r *http.Request) {
	if !s.hasLLM(w) {
		return
	}
	writeJSON(w, 200, s.llm.ProviderSettings())
}
func (s *Server) llmSettingsInput(w http.ResponseWriter, r *http.Request) (llm.ProviderUpdate, bool) {
	if !s.hasLLM(w) {
		return llm.ProviderUpdate{}, false
	}
	if !s.llm.AuthorizeSettings(r.Header.Get("X-Settings-Token")) {
		problem(w, 403, "设置验证已失效，请重新打开 LLM 设置")
		return llm.ProviderUpdate{}, false
	}
	var input llm.ProviderUpdate
	if !decodeBody(w, r, &input) {
		return llm.ProviderUpdate{}, false
	}
	return input, true
}
func (s *Server) saveLLMSettings(w http.ResponseWriter, r *http.Request) {
	input, ok := s.llmSettingsInput(w, r)
	if !ok {
		return
	}
	value, err := s.llm.SaveProvider(r.Context(), input)
	if err != nil {
		llmError(w, err)
		return
	}
	writeJSON(w, 200, value)
}
func (s *Server) testLLMSettings(w http.ResponseWriter, r *http.Request) {
	input, ok := s.llmSettingsInput(w, r)
	if !ok {
		return
	}
	value, err := s.llm.TestProvider(r.Context(), input)
	if err != nil {
		llmError(w, err)
		return
	}
	writeJSON(w, 200, value)
}
func (s *Server) createLLMPlan(w http.ResponseWriter, r *http.Request) {
	if !s.hasLLM(w) || !s.hasPalaces(w) {
		return
	}
	var input llm.PlanInput
	if !decodeBody(w, r, &input) {
		return
	}
	source, err := s.palaces.Preview(r.Context(), input.QuestionID, input.PalaceAddress)
	if err != nil {
		palaceError(w, err)
		return
	}
	value, err := s.llm.Create(r.Context(), input, llm.PlanSource{
		Prompt: source.Prompt, ProfileVersion: source.ProfileVersion,
	})
	if err != nil {
		llmError(w, err)
		return
	}
	writeJSON(w, 202, value)
}
func (s *Server) getLLMPlan(w http.ResponseWriter, r *http.Request) {
	if !s.hasLLM(w) {
		return
	}
	value, err := s.llm.Get(r.Context(), r.PathValue("plan"))
	if err != nil {
		llmError(w, err)
		return
	}
	writeJSON(w, 200, value)
}
