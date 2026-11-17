package httpapi

import (
	"net/http"
	"strconv"
	"strings"

	"test-driven-study/internal/study"
)

func (s *Server) subjectID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	raw := r.URL.Query().Get("subject")
	id, err := strconv.ParseInt(raw, 10, 64)
	if err != nil || !s.validStudySubject(r, id) {
		problem(w, 400, "科目参数无效")
		return 0, false
	}
	return id, true
}

func (s *Server) validStudySubject(r *http.Request, id int64) bool {
	if id <= 0 {
		return false
	}
	unit, err := s.study.WorkspaceUnit(r.Context(), id)
	course := r.URL.Query().Get("course")
	return err == nil && (course == "" || course == unit.CourseID)
}

func questionID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		problem(w, 400, "题号参数无效")
		return 0, false
	}
	return id, true
}

func (s *Server) overview(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subjectID(w, r)
	if !ok {
		return
	}
	value, err := s.study.Overview(r.Context(), subject)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, 200, value)
}

func (s *Server) questions(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subjectID(w, r)
	if !ok {
		return
	}
	filter := study.Filter{SubjectID: subject, ChapterID: -1, State: r.URL.Query().Get("state"),
		Search: strings.TrimSpace(r.URL.Query().Get("q"))}
	if filter.State == "" {
		filter.State = "all"
	}
	if filter.State != "all" && filter.State != "unlearned" && filter.State != "mastered" && filter.State != "review" {
		problem(w, 400, "学习状态无效")
		return
	}
	if raw := r.URL.Query().Get("chapter"); raw != "" {
		chapter, err := strconv.ParseInt(raw, 10, 64)
		if err != nil || chapter < 0 {
			problem(w, 400, "章节参数无效")
			return
		}
		filter.ChapterID = chapter
	}
	if len([]rune(filter.Search)) > 200 {
		problem(w, 400, "搜索内容过长")
		return
	}
	value, err := s.study.Questions(r.Context(), filter)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, 200, value)
}

func (s *Server) detail(w http.ResponseWriter, r *http.Request) {
	id, ok := questionID(w, r)
	if !ok {
		return
	}
	value, err := s.study.Detail(r.Context(), id)
	if err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, 200, value)
}

func (s *Server) progress(w http.ResponseWriter, r *http.Request) {
	id, ok := questionID(w, r)
	if !ok {
		return
	}
	var request struct {
		State string `json:"state"`
	}
	if !decodeBody(w, r, &request) {
		return
	}
	if err := s.study.SetProgress(r.Context(), id, request.State); err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, 200, map[string]string{"state": request.State})
}

func (s *Server) cursor(w http.ResponseWriter, r *http.Request) {
	var request struct {
		SubjectID  int64 `json:"subject_id"`
		QuestionID int64 `json:"question_id"`
	}
	if !decodeBody(w, r, &request) {
		return
	}
	if !s.validStudySubject(r, request.SubjectID) {
		problem(w, 400, "科目参数无效")
		return
	}
	if err := s.study.SetCursor(r.Context(), request.SubjectID, request.QuestionID); err != nil {
		respondError(w, err)
		return
	}
	writeJSON(w, 200, map[string]bool{"saved": true})
}
