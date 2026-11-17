-- +goose Up
CREATE TABLE palace_jobs (
    id TEXT PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(question_id),
    subject_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN
        ('queued', 'running', 'succeeded', 'failed', 'canceled', 'interrupted')),
    snapshot_json TEXT NOT NULL,
    image_json TEXT NOT NULL DEFAULT '',
    error_json TEXT NOT NULL DEFAULT '',
    created_at_ms INTEGER NOT NULL,
    updated_at_ms INTEGER NOT NULL
);
CREATE INDEX palace_question_time ON palace_jobs(question_id, created_at_ms DESC, id);
CREATE INDEX palace_queue ON palace_jobs(status, created_at_ms, id);

-- +goose Down
DROP TABLE palace_jobs;
