package httpapi

import (
	"database/sql"
	"errors"
	"net/http"
	"test-driven-study/internal/study"
)

const answerBodyLimit = 160 << 10

func (s *Server) examRules(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subjectID(w, r)
	if !ok {
		return
	}
	value, err := s.study.ExamRulesForUnit(r.Context(), subject)
	if err != nil {
		examError(w, err)
		return
	}
	writeJSON(w, 200, value)
}

func (s *Server) exams(w http.ResponseWriter, r *http.Request) {
	subject, ok := s.subjectID(w, r)
	if !ok {
		return
	}
	value, err := s.study.ListExams(r.Context(), subject)
	if err != nil {
		examError(w, err)
		return
	}
	writeJSON(w, 200, value)
}

func (s *Server) createExam(w http.ResponseWriter, r *http.Request) {
	var input struct {
		ID        string `json:"id"`
		SubjectID int64  `json:"subject_id"`
	}
	if !decodeBody(w, r, &input) {
		return
	}
	if !s.validStudySubject(r, input.SubjectID) {
		problem(w, 400, "科目参数无效")
		return
	}
	value, err := s.study.CreateExam(r.Context(), input.ID, input.SubjectID)
	if err != nil {
		examError(w, err)
		return
	}
	writeJSON(w, 201, value)
}

func (s *Server) exam(w http.ResponseWriter, r *http.Request) {
	value, err := s.study.GetExam(r.Context(), r.PathValue("exam"))
	if err != nil {
		examError(w, err)
		return
	}
	writeJSON(w, 200, value)
}

func (s *Server) examAnswer(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Index *int `json:"index"`
		study.AnswerInput
	}
	if !decodeBoundedBody(w, r, &input, answerBodyLimit) {
		return
	}
	if input.Index == nil {
		problem(w, 400, "题目序号不能为空")
		return
	}
	value, err := s.study.AnswerExamResponse(r.Context(), r.PathValue("exam"), *input.Index, input.AnswerInput)
	if err != nil {
		examError(w, err)
		return
	}
	writeJSON(w, 200, value)
}

func (s *Server) examMove(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Index   *int  `json:"index"`
		Flagged *bool `json:"flagged,omitempty"`
	}
	if !decodeBody(w, r, &input) {
		return
	}
	if input.Index == nil {
		problem(w, 400, "题目序号不能为空")
		return
	}
	value, err := s.study.MoveExam(r.Context(), r.PathValue("exam"), *input.Index, input.Flagged)
	if err != nil {
		examError(w, err)
		return
	}
	writeJSON(w, 200, value)
}

func (s *Server) examNavigate(w http.ResponseWriter, r *http.Request) {
	var input struct {
		From   *int `json:"from_index"`
		Target *int `json:"to_index"`
		study.AnswerInput
	}
	if !decodeBoundedBody(w, r, &input, answerBodyLimit) {
		return
	}
	if input.From == nil || input.Target == nil {
		problem(w, 400, "题目序号不能为空")
		return
	}
	value, err := s.study.NavigateExamResponse(r.Context(), r.PathValue("exam"),
		*input.From, *input.Target, input.AnswerInput)
	if err != nil {
		examError(w, err)
		return
	}
	writeJSON(w, 200, value)
}

func (s *Server) examSubmit(w http.ResponseWriter, r *http.Request) {
	var input struct{}
	if !decodeBody(w, r, &input) {
		return
	}
	value, err := s.study.FinishExam(r.Context(), r.PathValue("exam"))
	if err != nil {
		examError(w, err)
		return
	}
	writeJSON(w, 200, value)
}

func examError(w http.ResponseWriter, err error) {
	if errors.Is(err, sql.ErrNoRows) {
		problem(w, 404, "试卷不存在")
		return
	}
	if errors.Is(err, study.ErrConflict) {
		problem(w, 409, "试卷状态已变化或已有进行中的考试，请重新同步或继续原考试")
		return
	}
	if errors.Is(err, study.ErrInvalid) {
		problem(w, 400, "考试参数无效")
		return
	}
	respondError(w, err)
}
