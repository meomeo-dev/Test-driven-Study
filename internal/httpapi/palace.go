package httpapi

import (
	"errors"
	"net/http"
	"strconv"

	"test-driven-study/internal/palace"
)

func (s *Server) hasPalaces(w http.ResponseWriter) bool {
	if s.palaces != nil {
		return true
	}
	problem(w, 503, "记忆宫殿服务未启用")
	return false
}

func palaceError(w http.ResponseWriter, err error) {
	var failure *palace.Failure
	if errors.As(err, &failure) {
		problem(w, 400, failure.Message)
		return
	}
	switch {
	case errors.Is(err, palace.ErrDisabled):
		problem(w, 503, "请检查本地生图配置与代理")
	case errors.Is(err, palace.ErrInvalid):
		problem(w, 400, "题目或生图参数无效")
	case errors.Is(err, palace.ErrConflict):
		problem(w, 409, "请求已存在或队列已满，请检查生成记录")
	default:
		respondError(w, err)
	}
}

func (s *Server) palaceInfo(w http.ResponseWriter, r *http.Request) {
	if !s.hasPalaces(w) {
		return
	}
	writeJSON(w, 200, s.palaces.Info())
}

func (s *Server) palaceCoverage(w http.ResponseWriter, r *http.Request) {
	if !s.hasPalaces(w) {
		return
	}
	subject, ok := s.subjectID(w, r)
	if !ok {
		return
	}
	values, err := s.palaces.Coverage(r.Context(), subject)
	if err != nil {
		palaceError(w, err)
		return
	}
	writeJSON(w, 200, values)
}

func (s *Server) palacePreview(w http.ResponseWriter, r *http.Request) {
	if !s.hasPalaces(w) {
		return
	}
	var input struct {
		QuestionID    int64  `json:"question_id"`
		PalaceAddress string `json:"palace_address"`
		PlanID        string `json:"plan_id,omitempty"`
	}
	if !decodeBody(w, r, &input) {
		return
	}
	if input.QuestionID <= 0 {
		palaceError(w, palace.ErrInvalid)
		return
	}
	value, err := s.palaces.PreviewWithPlan(r.Context(), input.QuestionID, input.PalaceAddress, input.PlanID)
	if err != nil {
		palaceError(w, err)
		return
	}
	writeJSON(w, 200, value)
}

func (s *Server) palaceList(w http.ResponseWriter, r *http.Request) {
	if !s.hasPalaces(w) {
		return
	}
	subject, ok := s.subjectID(w, r)
	if !ok {
		return
	}
	var question int64
	if raw := r.URL.Query().Get("question"); raw != "" {
		value, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || value <= 0 {
			palaceError(w, palace.ErrInvalid)
			return
		}
		question = value
	}
	jobs, err := s.palaces.List(r.Context(), subject, question)
	if err != nil {
		palaceError(w, err)
		return
	}
	writeJSON(w, 200, jobs)
}

func (s *Server) palaceCreate(w http.ResponseWriter, r *http.Request) {
	if !s.hasPalaces(w) {
		return
	}
	var input palace.CreateInput
	if !decodeBody(w, r, &input) {
		return
	}
	job, err := s.palaces.Create(r.Context(), input)
	if err != nil {
		palaceError(w, err)
		return
	}
	writeJSON(w, 202, job)
}

func (s *Server) palaceGet(w http.ResponseWriter, r *http.Request) {
	if !s.hasPalaces(w) {
		return
	}
	job, err := s.palaces.Get(r.Context(), r.PathValue("job"))
	if err != nil {
		palaceError(w, err)
		return
	}
	writeJSON(w, 200, job)
}

func (s *Server) palaceCancel(w http.ResponseWriter, r *http.Request) {
	if !s.hasPalaces(w) {
		return
	}
	var input struct{}
	if !decodeBody(w, r, &input) {
		return
	}
	job, err := s.palaces.Cancel(r.Context(), r.PathValue("job"))
	if err != nil {
		palaceError(w, err)
		return
	}
	writeJSON(w, 200, job)
}

func (s *Server) palaceImage(w http.ResponseWriter, r *http.Request) {
	if !s.hasPalaces(w) {
		return
	}
	filename, metadata, err := s.palaces.ImageFile(r.Context(), r.PathValue("job"))
	if err != nil {
		palaceError(w, err)
		return
	}
	w.Header().Set("Content-Type", metadata.ContentType)
	w.Header().Set("Cache-Control", "private, max-age=86400, immutable")
	if r.URL.Query().Get("download") == "1" {
		w.Header().Set("Content-Disposition", `attachment; filename="`+metadata.Filename+`"`)
	}
	http.ServeFile(w, r, filename)
}
