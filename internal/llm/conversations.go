package llm

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage/storedb"
)

type SavedChatMessage struct {
	ID             string                   `json:"id"`
	Role           string                   `json:"role"`
	Text           string                   `json:"text"`
	Status         string                   `json:"status"`
	Sources        []Source                 `json:"sources,omitempty"`
	SearchUsed     bool                     `json:"search_used"`
	Error          string                   `json:"error,omitempty"`
	CreatedAtMS    int64                    `json:"created_at_ms"`
	ProfileVersion *course.AIProfileVersion `json:"ai_profile_version,omitempty"`
}

type ConversationRecord struct {
	ID           string             `json:"id"`
	QuestionID   int64              `json:"question_id"`
	Title        string             `json:"title"`
	Messages     []SavedChatMessage `json:"messages"`
	ActiveTurnID string             `json:"active_turn_id"`
	Revision     int64              `json:"revision"`
	CreatedAtMS  int64              `json:"created_at_ms"`
	UpdatedAtMS  int64              `json:"updated_at_ms"`
}

type ConversationPage struct {
	Items      []storedb.ListConversationsRow `json:"items"`
	NextCursor string                         `json:"next_cursor"`
}

func (s *Service) CreateConversation(ctx context.Context, id string, questionID int64) (ConversationRecord, error) {
	if !eventID.MatchString(id) || questionID <= 0 {
		return ConversationRecord{}, ErrInvalid
	}
	now := time.Now().UnixMilli()
	err := s.queries.CreateConversation(ctx, storedb.CreateConversationParams{
		ID: id, QuestionID: questionID, CreatedAtMs: now, UpdatedAtMs: now})
	if err != nil {
		return ConversationRecord{}, err
	}
	record, err := s.Conversation(ctx, id)
	if err == nil && record.QuestionID != questionID {
		return ConversationRecord{}, ErrConflict
	}
	return record, err
}

func conversationRecord(row storedb.ChatConversation) (ConversationRecord, error) {
	record := ConversationRecord{ID: row.ID, QuestionID: row.QuestionID, Title: row.Title,
		ActiveTurnID: row.ActiveTurnID, Revision: row.Revision,
		CreatedAtMS: row.CreatedAtMs, UpdatedAtMS: row.UpdatedAtMs}
	err := json.Unmarshal([]byte(row.MessagesJson), &record.Messages)
	return record, err
}

func (s *Service) Conversation(ctx context.Context, id string) (ConversationRecord, error) {
	if !eventID.MatchString(id) {
		return ConversationRecord{}, ErrInvalid
	}
	row, err := s.queries.GetConversation(ctx, id)
	if err != nil {
		return ConversationRecord{}, err
	}
	return conversationRecord(row)
}

func (s *Service) Conversations(ctx context.Context, questionID int64, cursor string) (ConversationPage, error) {
	return s.CourseConversations(ctx, "", questionID, cursor)
}

func (s *Service) CourseConversations(
	ctx context.Context, courseID string, questionID int64, cursor string,
) (ConversationPage, error) {
	params := storedb.ListConversationsParams{QuestionID: questionID, CourseID: courseID}
	if questionID < 0 {
		return ConversationPage{}, ErrInvalid
	}
	if cursor != "" {
		parts := strings.Split(cursor, ":")
		if len(parts) != 2 || !eventID.MatchString(parts[1]) {
			return ConversationPage{}, ErrInvalid
		}
		var err error
		params.BeforeTime, err = strconv.ParseInt(parts[0], 10, 64)
		if err != nil || params.BeforeTime <= 0 {
			return ConversationPage{}, ErrInvalid
		}
		params.BeforeID = parts[1]
	}
	items, err := s.queries.ListConversations(ctx, params)
	if err != nil {
		return ConversationPage{}, err
	}
	page := ConversationPage{Items: items}
	if len(items) > 50 {
		page.Items = items[:50]
		last := page.Items[49]
		page.NextCursor = strconv.FormatInt(last.UpdatedAtMs, 10) + ":" + last.ID
	}
	return page, nil
}

// Revision comparison reserves turns and prevents stale writers from overwriting messages.
func (s *Service) saveConversation(ctx context.Context, record *ConversationRecord) error {
	payload, err := json.Marshal(record.Messages)
	if err != nil {
		return err
	}
	now := time.Now().UnixMilli()
	count, err := s.queries.SaveConversation(ctx, storedb.SaveConversationParams{
		Title: record.Title, MessagesJson: string(payload), MessageCount: int64(len(record.Messages)),
		ActiveTurnID: record.ActiveTurnID, UpdatedAtMs: now, ID: record.ID, Revision: record.Revision})
	if err != nil {
		return err
	}
	if count != 1 {
		return ErrConflict
	}
	record.Revision++
	record.UpdatedAtMS = now
	return nil
}

func (s *Service) interruptConversations(ctx context.Context) error {
	rows, err := s.queries.ListActiveConversations(ctx)
	if err != nil {
		return err
	}
	for _, row := range rows {
		record, err := conversationRecord(row)
		if err != nil {
			return err
		}
		for i := range record.Messages {
			message := &record.Messages[i]
			if message.Status == "running" {
				message.Status, message.Error = "interrupted", "服务已重启，回复已中断；请手动重新提问"
			}
		}
		record.ActiveTurnID = ""
		if err := s.saveConversation(ctx, &record); err != nil {
			return err
		}
	}
	return nil
}
