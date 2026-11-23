package httpapi

import (
	"encoding/json"
	"errors"
	"log/slog"
	"math"
	"net/http"
	"time"

	"test-driven-study/internal/llm"
	"test-driven-study/internal/study"
)

// writtenFeedbackWriteTimeout exceeds the LLM request timeout so writing the
// response never hits the server's default 30s WriteTimeout prematurely.
const writtenFeedbackWriteTimeout = llm.WrittenFeedbackTimeout + 15*time.Second

const writtenPassThresholdPct = 60

type writtenFeedbackResponse struct {
	ID             int64                       `json:"id"`
	PresentationID string                      `json:"presentation_id"`
	Criteria       []study.EvaluationCriterion `json:"criteria"`
	Summary        string                      `json:"summary"`
	Source         string                      `json:"source"`
	Passed         bool                        `json:"passed"`
	ScorePct       int                         `json:"score_pct"`
	EvaluatedAtMS  int64                       `json:"evaluated_at_ms"`
	Cached         bool                        `json:"cached"`
}

type selfCheckRequest struct {
	Passed          *bool    `json:"passed"`
	CheckedCriteria []string `json:"checked_criteria,omitempty"`
}

func (s *Server) writtenFeedback(w http.ResponseWriter, r *http.Request) {
	presentationID := r.PathValue("presentation")
	item, answer, err := s.study.WrittenFeedbackSource(r.Context(), presentationID)
	if err != nil {
		respondError(w, err)
		return
	}
	existing, err := s.study.GetLatestLLMEvaluation(r.Context(), presentationID)
	if err != nil {
		respondError(w, err)
		return
	}
	if existing != nil {
		writeJSON(w, http.StatusOK, buildWrittenFeedbackResponse(existing, true))
		return
	}
	if !s.hasLLM(w) {
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
	scorePct, passed := scoreWrittenFeedback(feedback)
	payload, err := json.Marshal(feedback)
	if err != nil {
		respondError(w, err)
		return
	}
	saved, err := s.study.RecordLLMEvaluation(
		r.Context(), presentationID, passed, scorePct, string(payload),
	)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, buildWrittenFeedbackResponse(saved, false))
}

func (s *Server) recordSelfCheck(w http.ResponseWriter, r *http.Request) {
	var input selfCheckRequest
	if !decodeBody(w, r, &input) {
		return
	}
	if input.Passed == nil {
		problem(w, http.StatusBadRequest, "请说明自评是否通过")
		return
	}
	saved, err := s.study.RecordSelfCheckEvaluation(
		r.Context(), r.PathValue("presentation"), *input.Passed, input.CheckedCriteria,
	)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, saved)
}

func (s *Server) attemptEvaluation(w http.ResponseWriter, r *http.Request) {
	eval, err := s.study.GetLatestAttemptEvaluation(
		r.Context(), r.PathValue("presentation"),
	)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"evaluation": eval})
}

func scoreWrittenFeedback(feedback llm.WrittenFeedback) (int, bool) {
	totalPoints, totalMax := 0, 0
	for _, row := range feedback.Criteria {
		if row.Points != nil {
			totalPoints += *row.Points
		}
		totalMax += row.Max
	}
	if totalMax <= 0 {
		return 0, false
	}
	pct := int(math.Round(float64(totalPoints) * 100 / float64(totalMax)))
	if pct < 0 {
		pct = 0
	}
	if pct > 100 {
		pct = 100
	}
	return pct, pct >= writtenPassThresholdPct
}

func buildWrittenFeedbackResponse(
	eval *study.AttemptEvaluation, cached bool,
) writtenFeedbackResponse {
	criteria := eval.Criteria
	if criteria == nil {
		criteria = []study.EvaluationCriterion{}
	}
	return writtenFeedbackResponse{
		ID:             eval.ID,
		PresentationID: eval.PresentationID,
		Criteria:       criteria,
		Summary:        eval.Summary,
		Source:         eval.Source,
		Passed:         eval.Passed,
		ScorePct:       eval.ScorePct,
		EvaluatedAtMS:  eval.EvaluatedAtMS,
		Cached:         cached,
	}
}
