package httpapi

import (
	"net/http"

	"test-driven-study/internal/palace"
)

func (s *Server) tasks(w http.ResponseWriter, r *http.Request) {
	if !s.hasPalaces(w) {
		return
	}
	params := r.URL.Query()
	page, err := s.palaces.CourseTasks(r.Context(), params.Get("course"), params.Get("scope"),
		params.Get("before"))
	if err != nil {
		palaceError(w, err)
		return
	}
	writeJSON(w, 200, page)
}

func (s *Server) taskEvents(w http.ResponseWriter, r *http.Request) {
	if !s.hasPalaces(w) {
		return
	}
	events, err := s.palaces.Events(r.Context(), r.PathValue("job"))
	if err != nil {
		palaceError(w, err)
		return
	}
	writeJSON(w, 200, events)
}

func (s *Server) palaceControl(w http.ResponseWriter, r *http.Request) {
	if !s.hasPalaces(w) {
		return
	}
	var input struct{}
	if !decodeBody(w, r, &input) {
		return
	}
	var job palace.Job
	var err error
	if r.PathValue("action") == "pause" {
		job, err = s.palaces.Pause(r.Context(), r.PathValue("job"))
	} else if r.PathValue("action") == "resume" {
		job, err = s.palaces.Resume(r.Context(), r.PathValue("job"))
	} else {
		problem(w, 404, "任务操作不存在")
		return
	}
	if err != nil {
		palaceError(w, err)
		return
	}
	writeJSON(w, 200, job)
}

func (s *Server) palaceRetry(w http.ResponseWriter, r *http.Request) {
	if !s.hasPalaces(w) {
		return
	}
	var input struct {
		ID string `json:"id"`
	}
	if !decodeBody(w, r, &input) {
		return
	}
	job, err := s.palaces.Retry(r.Context(), r.PathValue("job"), input.ID)
	if err != nil {
		palaceError(w, err)
		return
	}
	writeJSON(w, 202, job)
}
