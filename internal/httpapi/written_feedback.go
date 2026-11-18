package httpapi

import (
	"errors"
	"net/http"

	"test-driven-study/internal/llm"
)

func (s *Server) writtenFeedback(w http.ResponseWriter, r *http.Request) {
	if !s.hasLLM(w) {
		return
	}
	item, answer, err := s.study.WrittenFeedbackSource(r.Context(), r.PathValue("presentation"))
	if err != nil {
		respondError(w, err)
		return
	}
	feedback, err := s.llm.EvaluateWritten(r.Context(), item, answer)
	if err != nil {
		if errors.Is(err, llm.ErrDisabled) {
			llmError(w, err)
			return
		}
		problem(w, http.StatusBadGateway, "本次 AI 批改未完成，已保存的作答不受影响")
		return
	}
	writeJSON(w, http.StatusOK, feedback)
}
