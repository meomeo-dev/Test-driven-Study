package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"time"

	"test-driven-study/internal/llm"
	"test-driven-study/internal/study"
)

func (s *Server) chat(w http.ResponseWriter, r *http.Request) {
	if !s.hasLLM(w) {
		return
	}
	var input llm.ChatInput
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 160<<10))
	decoder.DisallowUnknownFields()
	if decoder.Decode(&input) != nil || decoder.Decode(new(any)) != io.EOF ||
		input.Validate() != nil {
		problem(w, 400, "问题或对话记录无效，请新建对话后重新提问（每次最多 2000 字）")
		return
	}
	detail, err := s.study.Detail(r.Context(), input.QuestionID)
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
		return s.llm.Chat(r.Context(), input, evidence, emit)
	})
}

func (s *Server) questionChatEvidence(ctx context.Context, question study.Question) (llm.ChatEvidence, error) {
	var evidence llm.ChatEvidence
	profile, version, err := s.study.QuestionAIProfile(ctx, question)
	if err != nil {
		return evidence, err
	}
	evidence.Instructions = profile.Assistant
	if profile.Assistant != "" {
		evidence.ProfileVersion = version
	}
	evidence.GeneralCourse = question.PackageID != ""
	transcript, err := s.study.QuestionTranscript(ctx, question)
	if err != nil {
		return evidence, err
	}
	// Question facts and transcript come from the installed package.
	source, err := json.Marshal(struct {
		study.Question
		Transcript string `json:"listening_transcript,omitempty"`
	}{Question: question, Transcript: transcript})
	if err != nil {
		return evidence, err
	}
	evidence.Source = "Current question-bank data:\n" + string(source)
	if question.ImageURL != "" {
		evidence.ResolveImages = func(ctx context.Context) ([]llm.InputImage, error) {
			image, err := s.study.ReadQuestionImage(ctx, question)
			if err != nil {
				return nil, err
			}
			return llm.DecodeQuestionImages(image)
		}
	}
	return evidence, nil
}

func streamChat(w http.ResponseWriter, r *http.Request, run func(func(llm.ChatEvent) error) error) {
	controller := http.NewResponseController(w)
	started := false
	emit := func(event llm.ChatEvent) error {
		if !started {
			w.Header().Set("Content-Type", "application/x-ndjson; charset=utf-8")
			w.Header().Set("Cache-Control", "no-store")
			w.Header().Set("X-Accel-Buffering", "no")
			// Chat has a bounded service timeout independent of the ordinary API.
			if err := controller.SetWriteDeadline(time.Now().Add(4 * time.Minute)); err != nil {
				return err
			}
			started = true
		}
		if err := json.NewEncoder(w).Encode(event); err != nil {
			return err
		}
		return controller.Flush()
	}
	err := run(emit)
	if err == nil || r.Context().Err() != nil {
		return
	}
	if !started {
		chatError(w, err)
		return
	}
	message := "回复中断，请手动重新提问"
	var failure *llm.Failure
	if errors.As(err, &failure) {
		message = failure.Message
	}
	_ = emit(llm.ChatEvent{Type: "error", Text: message})
}
