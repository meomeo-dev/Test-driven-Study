package httpapi

import (
	"net/http"
	"strconv"

	"test-driven-study/internal/course"
	"test-driven-study/internal/study"
)

func (s *Server) practiceOverview(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subjectID(w, r)
	if !ok {
		return
	}
	value, err := s.study.PracticeOverview(r.Context(), subject)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, 200, value)
}

func (s *Server) practiceQuestions(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subjectID(w, r)
	if !ok {
		return
	}
	f := study.Filter{SubjectID: subject, ChapterID: -1,
		Search: r.URL.Query().Get("q"), State: r.URL.Query().Get("state")}
	if f.State == "" {
		f.State = "all"
	}
	if f.State != "all" && f.State != "unanswered" && f.State != "correct" && f.State != "incorrect" && f.State != "review" {
		problem(w, 400, "答题状态无效")
		return
	}
	if raw := r.URL.Query().Get("chapter"); raw != "" {
		id, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || id < 0 {
			problem(w, 400, "章节参数无效")
			return
		}
		f.ChapterID = id
	}
	if len([]rune(f.Search)) > 200 {
		problem(w, 400, "搜索内容过长")
		return
	}
	if f.Concept = r.URL.Query().Get("concept"); f.Concept != "" && !course.ValidID(f.Concept) {
		problem(w, 400, "知识点参数无效")
		return
	}
	value, err := s.study.PracticeQuestions(r.Context(), f)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, 200, value)
}

func (s *Server) openPresentation(w http.ResponseWriter, r *http.Request) {
	var input struct {
		ID         string `json:"id"`
		QuestionID int64  `json:"question_id"`
	}
	if !decodeBody(w, r, &input) {
		return
	}
	value, err := s.study.OpenPresentation(r.Context(), input.ID, input.QuestionID)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, 200, value)
}

func (s *Server) answer(w http.ResponseWriter, r *http.Request) {
	var input study.AnswerInput
	if !decodeBoundedBody(w, r, &input, answerBodyLimit) {
		return
	}
	value, err := s.study.SubmitResponse(r.Context(), r.PathValue("presentation"), input)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, 200, value)
}

func (s *Server) exposure(w http.ResponseWriter, r *http.Request) {
	var input struct {
		ID         string `json:"id"`
		QuestionID int64  `json:"question_id"`
	}
	if !decodeBody(w, r, &input) {
		return
	}
	if err := s.study.RecordExposure(r.Context(), input.ID, input.QuestionID); err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, 200, map[string]bool{"saved": true})
}

func (s *Server) practiceCursor(w http.ResponseWriter, r *http.Request) {
	var input struct {
		SubjectID  int64 `json:"subject_id"`
		QuestionID int64 `json:"question_id"`
	}
	if !decodeBody(w, r, &input) {
		return
	}
	if !s.validStudySubject(r, input.SubjectID) {
		problem(w, 400, "科目参数无效")
		return
	}
	if err := s.study.SetPracticeCursor(r.Context(), input.SubjectID, input.QuestionID); err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, 200, map[string]bool{"saved": true})
}

func (s *Server) analysis(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subjectID(w, r)
	if !ok {
		return
	}
	days := 30
	if raw := r.URL.Query().Get("days"); raw != "" {
		value, err := strconv.Atoi(raw)
		if err != nil {
			problem(w, 400, "时间窗口无效")
			return
		}
		days = value
	}
	value, err := s.study.Analysis(r.Context(), subject, days)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, 200, value)
}

func (s *Server) reviewBook(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subjectID(w, r)
	if !ok {
		return
	}
	value, err := s.study.ReviewBook(r.Context(), subject)
	if err != nil {
		respondError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, 200, value)
}
