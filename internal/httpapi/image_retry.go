package httpapi

import (
	"net/http"

	"test-driven-study/internal/palace"
)

func (s *Server) palaceImageRetry(w http.ResponseWriter, r *http.Request) {
	if !s.hasPalaces(w) {
		return
	}
	var input palace.ImageRetryInput
	if !decodeBody(w, r, &input) {
		return
	}
	job, err := s.palaces.CreateImageRetry(r.Context(), r.PathValue("job"), input)
	if err != nil {
		palaceError(w, err)
		return
	}
	writeJSON(w, 202, job)
}
