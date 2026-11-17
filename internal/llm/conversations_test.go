package llm

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sync/atomic"
	"testing"

	"test-driven-study/internal/testsupport"
	"time"

	"test-driven-study/internal/course"
)

const conversationID = "11000000-0000-4000-8000-000000000001"
const turnID = "11000000-0000-4000-8000-000000000002"

func TestConversationPersistsSourcesAndDeduplicatesAcrossRestart(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	var calls atomic.Int32
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(responseJSON(t, testPlan()))
	}))
	defer server.Close()
	options := testOptions(t, server.URL)
	s, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	if _, err = s.CreateConversation(ctx, conversationID, 4); err != nil {
		t.Fatal(err)
	}
	if _, err = s.CreateConversation(ctx, conversationID, 6); !errors.Is(err, ErrConflict) {
		t.Fatalf("accepted changed question: %v", err)
	}
	turn := ConversationTurn{ID: turnID, Text: "为什么这样选？"}
	var terminal ChatEvent
	emit := func(event ChatEvent) error { terminal = event; return nil }
	profile := course.AIProfileVersion{CourseID: "basic-math", CourseVersion: "1.0.0"}
	evidence := ChatEvidence{Source: "trusted question", ProfileVersion: &profile}
	if err = s.ConversationChat(ctx, conversationID, turn, evidence, emit); err != nil {
		t.Fatal(err)
	}
	saved, err := s.Conversation(ctx, conversationID)
	if err != nil || len(saved.Messages) != 2 || saved.ActiveTurnID != "" ||
		saved.Messages[1].Status != "completed" || saved.Messages[1].Text != terminal.Text ||
		len(saved.Messages[1].Sources) == 0 || !saved.Messages[1].SearchUsed {
		t.Fatalf("lost persisted reply: %+v, %v", saved, err)
	}
	s.Close()
	restarted, err := New(ctx, options)
	if err != nil {
		t.Fatal(err)
	}
	defer restarted.Close()
	if err = restarted.ConversationChat(ctx, conversationID, turn, ChatEvidence{Source: "trusted"}, emit); err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 1 {
		t.Fatal("duplicate turn replayed a paid call")
	}
	afterRestart, err := restarted.Conversation(ctx, conversationID)
	if err != nil || afterRestart.Messages[1].ProfileVersion == nil ||
		*afterRestart.Messages[1].ProfileVersion != profile {
		t.Fatalf("lost original course version: %+v, %v", afterRestart, err)
	}
	turn.Text = "different text"
	if err = restarted.ConversationChat(ctx, conversationID, turn, ChatEvidence{Source: "trusted"}, emit); !errors.Is(err, ErrConflict) {
		t.Fatal("accepted reuse of a turn ID with different text", err)
	}
	page, err := restarted.Conversations(ctx, 4, "")
	if err != nil || len(page.Items) != 1 || page.Items[0].MessageCount != 2 || page.Items[0].SubjectID != 1 {
		t.Fatal("history summary lost", page, err)
	}
}

func TestConversationCancelKeepsPartialAndRejectsConcurrentTurns(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	var calls atomic.Int32
	started := make(chan struct{})
	server := newModelServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls.Add(1)
		w.Header().Set("Content-Type", "text/event-stream")
		fmt.Fprint(w, "data: {\"type\":\"response.output_text.delta\",\"delta\":\"已收到的部分\"}\n\n")
		w.(http.Flusher).Flush()
		close(started)
		<-r.Context().Done()
	}))
	defer server.Close()
	s, err := New(context.Background(), testOptions(t, server.URL))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if _, err = s.CreateConversation(ctx, conversationID, 4); err != nil {
		t.Fatal(err)
	}
	result := make(chan error, 1)
	delta := make(chan struct{}, 1)
	turn := ConversationTurn{ID: turnID, Text: "please explain"}
	go func() {
		result <- s.ConversationChat(ctx, conversationID, turn, ChatEvidence{Source: "trusted"}, func(event ChatEvent) error {
			if event.Type == "delta" {
				delta <- struct{}{}
			}
			return nil
		})
	}()
	select {
	case <-started:
	case <-time.After(5 * time.Second):
		t.Fatal("model not started")
	}
	select {
	case <-delta:
	case <-time.After(5 * time.Second):
		t.Fatal("partial reply not received")
	}
	concurrent := ConversationTurn{ID: "11000000-0000-4000-8000-000000000003", Text: "other tab"}
	if err = s.ConversationChat(ctx, conversationID, concurrent, ChatEvidence{Source: "trusted"}, func(ChatEvent) error { return nil }); !errors.Is(err, ErrConflict) {
		t.Fatal("accepted concurrent turn", err)
	}
	cancel()
	select {
	case err = <-result:
	case <-time.After(5 * time.Second):
		t.Fatal("cancel blocked")
	}
	if err == nil {
		t.Fatal("expected interruption")
	}
	record, err := s.Conversation(context.Background(), conversationID)
	if err != nil || record.ActiveTurnID != "" || record.Messages[1].Status != "interrupted" ||
		record.Messages[1].Text != "已收到的部分" {
		t.Fatal("partial reply lost", record, err)
	}
	if err = s.ConversationChat(context.Background(), conversationID, turn, ChatEvidence{Source: "trusted"}, func(ChatEvent) error { return nil }); !errors.Is(err, ErrConflict) {
		t.Fatal("interrupted turn was replayed", err)
	}
	if calls.Load() != 1 {
		t.Fatal("unexpected additional model calls")
	}
}

func TestConversationStartupMarksAbandonedRepliesInterrupted(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	options := testOptions(t, "http://127.0.0.1:1/v1")
	s, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	record, err := s.CreateConversation(ctx, conversationID, 4)
	if err != nil {
		t.Fatal(err)
	}
	record.Messages = []SavedChatMessage{{ID: turnID, Role: "user", Text: "question", Status: "completed"},
		{ID: turnID + "-reply", Role: "assistant", Text: "partial", Status: "running"}}
	record.ActiveTurnID = turnID
	if err = s.saveConversation(ctx, &record); err != nil {
		t.Fatal(err)
	}
	s.Close()
	restarted, err := New(ctx, options)
	if err != nil {
		t.Fatal(err)
	}
	defer restarted.Close()
	record, err = restarted.Conversation(ctx, conversationID)
	if err != nil || record.ActiveTurnID != "" || record.Messages[1].Status != "interrupted" ||
		record.Messages[1].Text != "partial" {
		t.Fatal("restart lost partial history", record, err)
	}
}

func TestConversationHistoryPaginatesWithoutDroppingTiedTimestamps(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	s, err := New(context.Background(), testOptions(t, "http://127.0.0.1:1/v1"))
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	ctx := context.Background()
	for i := 0; i < 53; i++ {
		id := fmt.Sprintf("22000000-0000-4000-8000-%012d", i)
		if _, err = s.CreateConversation(ctx, id, 4); err != nil {
			t.Fatal(err)
		}
	}
	page, err := s.Conversations(ctx, 4, "")
	if err != nil || len(page.Items) != 50 || page.NextCursor == "" {
		t.Fatal(page, err)
	}
	next, err := s.Conversations(ctx, 4, page.NextCursor)
	if err != nil || len(next.Items) != 3 || next.NextCursor != "" {
		t.Fatal(next, err)
	}
	seen := map[string]bool{}
	for _, item := range append(page.Items, next.Items...) {
		if seen[item.ID] {
			t.Fatal("duplicate history item")
		}
		seen[item.ID] = true
	}
	empty, err := s.Conversations(ctx, 6, "")
	if err != nil || len(empty.Items) != 0 {
		t.Fatal("question filter changed", empty, err)
	}
	if _, err = s.Conversations(ctx, 4, "not-a-cursor"); !errors.Is(err, ErrInvalid) {
		t.Fatal(err)
	}
}
