package llm

import (
	"context"
	"errors"
	"strings"
	"time"
)

type ConversationTurn struct {
	ID   string `json:"id"`
	Text string `json:"text"`
}

func (turn ConversationTurn) Validate() error {
	if !eventID.MatchString(turn.ID) || !validText(turn.Text, 2000) {
		return ErrInvalid
	}
	return nil
}

func savedChatInput(record ConversationRecord, text string) (ChatInput, error) {
	input := ChatInput{QuestionID: record.QuestionID}
	for i, message := range record.Messages {
		// Failed turns remain visible but do not become claimed model answers.
		if message.Role == "user" && i+1 < len(record.Messages) &&
			record.Messages[i+1].Status != "completed" {
			continue
		}
		if message.Status == "completed" {
			input.Messages = append(input.Messages, ChatMessage{Role: message.Role, Text: message.Text})
		}
	}
	input.Messages = append(input.Messages, ChatMessage{Role: "user", Text: text})
	if len(record.Messages) >= 48 || input.Validate() != nil {
		return ChatInput{}, &Failure{Code: "conversation_limit",
			Message: "本次对话已达到长度上限，请新建对话后继续"}
	}
	return input, nil
}

func duplicateTurn(record ConversationRecord, turn ConversationTurn, emit func(ChatEvent) error) (bool, error) {
	for i, message := range record.Messages {
		if message.ID != turn.ID {
			continue
		}
		if message.Text != turn.Text || i+1 >= len(record.Messages) {
			return true, ErrConflict
		}
		reply := record.Messages[i+1]
		if reply.Status == "completed" {
			return true, emit(ChatEvent{Type: "done", Text: reply.Text,
				Sources: reply.Sources, SearchUsed: reply.SearchUsed})
		}
		// A previously accepted request is never silently replayed, even after failure.
		return true, ErrConflict
	}
	return false, nil
}

func chatFailureMessage(err error) string {
	var failure *Failure
	if errors.As(err, &failure) {
		return failure.Message
	}
	return "回复中断，请手动重新提问"
}

func (s *Service) ConversationChat(ctx context.Context, id string, turn ConversationTurn,
	evidence ChatEvidence, emit func(ChatEvent) error) error {
	if err := turn.Validate(); err != nil {
		return err
	}
	record, err := s.Conversation(ctx, id)
	if err != nil {
		return err
	}
	if duplicate, err := duplicateTurn(record, turn, emit); duplicate {
		return err
	}
	if record.ActiveTurnID != "" {
		return ErrConflict
	}
	input, err := savedChatInput(record, turn.Text)
	if err != nil {
		return err
	}
	now := time.Now().UnixMilli()
	record.Messages = append(record.Messages,
		SavedChatMessage{ID: turn.ID, Role: "user", Text: turn.Text, Status: "completed", CreatedAtMS: now},
		SavedChatMessage{ID: turn.ID + "-reply", Role: "assistant", Status: "running",
			CreatedAtMS: now, ProfileVersion: evidence.ProfileVersion})
	if record.Title == "" {
		title := []rune(strings.TrimSpace(turn.Text))
		record.Title = string(title[:min(60, len(title))])
	}
	record.ActiveTurnID = turn.ID
	if err := s.saveConversation(ctx, &record); err != nil {
		return err
	}
	return s.streamConversation(ctx, &record, input, evidence, emit)
}

func (s *Service) streamConversation(ctx context.Context, record *ConversationRecord,
	input ChatInput, evidence ChatEvidence, emit func(ChatEvent) error) error {
	reply := &record.Messages[len(record.Messages)-1]
	lastSave := time.Time{}
	completed := false
	err := s.Chat(ctx, input, evidence, func(event ChatEvent) error {
		switch event.Type {
		case "delta":
			reply.Text += event.Text
			if time.Since(lastSave) >= 250*time.Millisecond {
				if err := s.saveConversation(ctx, record); err != nil {
					return err
				}
				lastSave = time.Now()
			}
		case "done":
			reply.Text, reply.Sources, reply.SearchUsed = event.Text, event.Sources, event.SearchUsed
			reply.Status, record.ActiveTurnID = "completed", ""
			if err := s.saveConversation(ctx, record); err != nil {
				return err
			}
			completed = true
		}
		return emit(event)
	})
	if completed {
		return err
	}
	reply.Status, reply.Error = "failed", chatFailureMessage(err)
	if ctx.Err() != nil {
		reply.Status, reply.Error = "interrupted", "回复已中断，已保留收到的内容；请手动重新提问"
	}
	record.ActiveTurnID = ""
	// Disconnecting cancels upstream work, but must not cancel the final local save.
	saveCtx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 5*time.Second)
	defer cancel()
	if saveErr := s.saveConversation(saveCtx, record); saveErr != nil {
		return saveErr
	}
	return err
}
