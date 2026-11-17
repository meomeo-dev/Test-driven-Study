package httpapi

import (
	"net/http"

	"test-driven-study/internal/course"
	"test-driven-study/internal/study"
)

func (s *Server) registerLearningRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/courses/{course}/concepts", s.concepts)
	mux.HandleFunc("PUT /api/courses/{course}/concepts/{concept}/known", s.conceptKnown)
	mux.HandleFunc("GET /api/courses/{course}/learning-path", s.learningPath)
	mux.HandleFunc("POST /api/courses/{course}/learning-path", s.createLearningPath)
}

// courseParam rejects IDs that no installed course can have before the
// service is asked, using the same message as a missing course.
func courseParam(w http.ResponseWriter, r *http.Request) (string, bool) {
	id := r.PathValue("course")
	if !course.ValidID(id) {
		problem(w, 404, "课程不存在")
		return "", false
	}
	return id, true
}

func (s *Server) concepts(w http.ResponseWriter, r *http.Request) {
	id, ok := courseParam(w, r)
	if !ok {
		return
	}
	value, err := s.study.Concepts(r.Context(), id)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, value)
}

func (s *Server) conceptKnown(w http.ResponseWriter, r *http.Request) {
	id, ok := courseParam(w, r)
	if !ok {
		return
	}
	concept := r.PathValue("concept")
	if !course.ValidID(concept) {
		problem(w, 404, "知识点不存在")
		return
	}
	var input struct {
		Known *bool `json:"known"`
	}
	if !decodeBody(w, r, &input) {
		return
	}
	if input.Known == nil {
		problem(w, 400, "请说明是否标记为已会")
		return
	}
	value, err := s.study.SetConceptKnown(r.Context(), id, concept, *input.Known)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, value)
}

func (s *Server) learningPath(w http.ResponseWriter, r *http.Request) {
	id, ok := courseParam(w, r)
	if !ok {
		return
	}
	value, err := s.study.LearningPath(r.Context(), id)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, value)
}

func (s *Server) createLearningPath(w http.ResponseWriter, r *http.Request) {
	id, ok := courseParam(w, r)
	if !ok {
		return
	}
	var input study.LearningPathRequest
	if !decodeBody(w, r, &input) {
		return
	}
	value, err := s.study.CreateLearningPath(r.Context(), id, input)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, value)
}
