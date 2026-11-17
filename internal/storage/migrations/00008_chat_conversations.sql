-- +goose Up
CREATE TABLE chat_conversations (
    id TEXT PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(question_id),
    title TEXT NOT NULL DEFAULT '',
    messages_json TEXT NOT NULL DEFAULT '[]',
    message_count INTEGER NOT NULL DEFAULT 0,
    revision INTEGER NOT NULL DEFAULT 0,
    active_turn_id TEXT NOT NULL DEFAULT '',
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);
CREATE INDEX chat_conversations_question_time
    ON chat_conversations(question_id, updated_at_ms DESC, id DESC);
CREATE INDEX chat_conversations_time ON chat_conversations(updated_at_ms DESC, id DESC);

-- +goose Down
DROP TABLE chat_conversations;
