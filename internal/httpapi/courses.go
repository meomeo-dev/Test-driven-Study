package httpapi

import (
	"net/http"
)

func (s *Server) courses(w http.ResponseWriter, r *http.Request) {
	value, err := s.study.Courses(r.Context())
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, value)
}

func (s *Server) guide(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subjectID(w, r)
	if !ok {
		return
	}
	value, err := s.study.Guide(r.Context(), subject)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, value)
}
