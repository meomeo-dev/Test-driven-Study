package httpapi

import (
	"net/http"

	"test-driven-study/internal/study"
)

func (s *Server) registerRoadmapRoutes(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/roadmap", s.roadmap)
	mux.HandleFunc("PUT /api/courses/{course}/completed", s.courseCompleted)
	mux.HandleFunc("GET /api/roadmap/path", s.roadmapPath)
	mux.HandleFunc("POST /api/roadmap/path", s.createRoadmapPath)
}

func (s *Server) roadmap(w http.ResponseWriter, r *http.Request) {
	value, err := s.study.Roadmap(r.Context())
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, value)
}

func (s *Server) courseCompleted(w http.ResponseWriter, r *http.Request) {
	id, ok := courseParam(w, r)
	if !ok {
		return
	}
	var input struct {
		Completed *bool `json:"completed"`
	}
	if !decodeBody(w, r, &input) {
		return
	}
	if input.Completed == nil {
		problem(w, 400, "请说明是否标记为已学完")
		return
	}
	value, err := s.study.SetCourseCompleted(r.Context(), id, *input.Completed)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, value)
}

func (s *Server) roadmapPath(w http.ResponseWriter, r *http.Request) {
	value, err := s.study.RoadmapPath(r.Context())
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, value)
}

func (s *Server) createRoadmapPath(w http.ResponseWriter, r *http.Request) {
	var input study.RoadmapPathRequest
	if !decodeBody(w, r, &input) {
		return
	}
	value, err := s.study.CreateRoadmapPath(r.Context(), input)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, value)
}
