package httpapi

import "net/http"

func (s *Server) conversationCoverage(w http.ResponseWriter, r *http.Request) {
	if !s.hasLLM(w) {
		return
	}
	subject, ok := s.subjectID(w, r)
	if !ok {
		return
	}
	values, err := s.llm.ConversationCoverage(r.Context(), subject)
	if err != nil {
		chatError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, http.StatusOK, values)
}
