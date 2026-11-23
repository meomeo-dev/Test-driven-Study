package httpapi

import (
	"errors"
	"log/slog"
	"net/http"
	"time"

	"test-driven-study/internal/llm"
)

// writtenFeedbackWriteTimeout exceeds the LLM request timeout so writing the
// response never hits the server's default 30s WriteTimeout prematurely.
const writtenFeedbackWriteTimeout = llm.WrittenFeedbackTimeout + 15*time.Second

func (s *Server) writtenFeedback(w http.ResponseWriter, r *http.Request) {
	if !s.hasLLM(w) {
		return
	}
	item, answer, err := s.study.WrittenFeedbackSource(
		r.Context(), r.PathValue("presentation"),
	)
	if err != nil {
		respondError(w, err)
		return
	}
	if err := http.NewResponseController(w).SetWriteDeadline(
		time.Now().Add(writtenFeedbackWriteTimeout),
	); err != nil && !errors.Is(err, http.ErrNotSupported) {
		slog.Warn("extend written feedback write deadline", "error", err)
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
