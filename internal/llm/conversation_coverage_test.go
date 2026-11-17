package llm

import (
	"context"
	"fmt"
	"testing"

	"test-driven-study/internal/testsupport"
)

func TestConversationCoverageIncludesOldMessagesAndSeparatesSubjects(t *testing.T) {
	testsupport.RequireDrivingBank(t)
	options := testOptions(t, "http://127.0.0.1:1/v1")
	s, err := New(context.Background(), options)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	ctx := context.Background()
	var subjectFour int64
	if err := options.DB.QueryRowContext(ctx,
		"SELECT question_id FROM questions WHERE subject_id=4 LIMIT 1").Scan(&subjectFour); err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 55; i++ {
		questionID := int64(4)
		if i == 0 {
			questionID = 6
		}
		if i == 53 {
			questionID = 9
		}
		if i == 54 {
			questionID = subjectFour
		}
		record, err := s.CreateConversation(ctx,
			fmt.Sprintf("34000000-0000-4000-8000-%012d", i), questionID)
		if err != nil {
			t.Fatal(err)
		}
		if i == 53 {
			continue
		} // An empty welcome screen is not a conversation marker.
		record.Messages = []SavedChatMessage{{Role: "user", Text: "saved question", Status: "completed"},
			{Role: "assistant", Text: "partial", Status: "interrupted"}}
		if err := s.saveConversation(ctx, &record); err != nil {
			t.Fatal(err)
		}
	}
	rows, err := s.ConversationCoverage(ctx, 1)
	if err != nil || len(rows) != 2 || rows[0].QuestionID != 4 ||
		rows[0].ConversationCount != 52 || rows[1].QuestionID != 6 || rows[1].ConversationCount != 1 {
		t.Fatalf("incomplete or mixed coverage: %+v %v", rows, err)
	}
	other, err := s.ConversationCoverage(ctx, 4)
	if err != nil || len(other) != 1 || other[0].QuestionID != subjectFour {
		t.Fatal(other, err)
	}
	if _, err := s.ConversationCoverage(ctx, 2); err == nil {
		t.Fatal("accepted invalid subject")
	}
}
