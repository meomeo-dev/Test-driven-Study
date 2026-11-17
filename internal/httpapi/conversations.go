package httpapi

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strconv"

	"test-driven-study/internal/llm"
)

func chatError(w http.ResponseWriter, err error) {
	var failure *llm.Failure
	switch {
	case errors.Is(err, llm.ErrInvalid):
		problem(w, 400, "对话参数无效，请检查后重新提问（每次最多 2000 字）")
	case errors.Is(err, llm.ErrConflict):
		problem(w, 409, "会话已更新或正在回复，请重新打开历史对话后继续")
	case errors.As(err, &failure):
		code := 502
		if failure.Code == "conversation_limit" {
			code = 400
		}
		problem(w, code, failure.Message)
	default:
		llmError(w, err)
	}
}

func (s *Server) listConversations(w http.ResponseWriter, r *http.Request) {
	if !s.hasLLM(w) {
		return
	}
	questionID := int64(0)
	if value := r.URL.Query().Get("question_id"); value != "" {
		var err error
		questionID, err = strconv.ParseInt(value, 10, 64)
		if err != nil || questionID < 0 {
			chatError(w, llm.ErrInvalid)
			return
		}
	}
	result, err := s.llm.CourseConversations(r.Context(), r.URL.Query().Get("course"),
		questionID, r.URL.Query().Get("before"))
	if err != nil {
		chatError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, 200, result)
}

func (s *Server) createConversation(w http.ResponseWriter, r *http.Request) {
	if !s.hasLLM(w) {
		return
	}
	var input struct {
		ID         string `json:"id"`
		QuestionID int64  `json:"question_id"`
	}
	if !decodeBody(w, r, &input) {
		return
	}
	if _, err := s.study.Detail(r.Context(), input.QuestionID); err != nil {
		respondError(w, err)
		return
	}
	result, err := s.llm.CreateConversation(r.Context(), input.ID, input.QuestionID)
	if err != nil {
		chatError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, 200, result)
}

func (s *Server) getConversation(w http.ResponseWriter, r *http.Request) {
	if !s.hasLLM(w) {
		return
	}
	result, err := s.llm.Conversation(r.Context(), r.PathValue("conversation"))
	if err != nil {
		chatError(w, err)
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	writeJSON(w, 200, result)
}

func (s *Server) conversationChat(w http.ResponseWriter, r *http.Request) {
	if !s.hasLLM(w) {
		return
	}
	var input llm.ConversationTurn
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 16<<10))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&input) != nil || decoder.Decode(new(any)) != io.EOF || input.Validate() != nil {
		chatError(w, llm.ErrInvalid)
		return
	}
	id := r.PathValue("conversation")
	record, err := s.llm.Conversation(r.Context(), id)
	if err != nil {
		chatError(w, err)
		return
	}
	detail, err := s.study.Detail(r.Context(), record.QuestionID)
	if err != nil {
		respondError(w, err)
		return
	}
	evidence, err := s.questionChatEvidence(r.Context(), detail.Question)
	if err != nil {
		respondError(w, err)
		return
	}
	streamChat(w, r, func(emit func(llm.ChatEvent) error) error {
		return s.llm.ConversationChat(r.Context(), id, input, evidence, emit)
	})
}
