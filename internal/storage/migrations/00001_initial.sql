-- +goose Up
CREATE TABLE questions (
    question_id INTEGER PRIMARY KEY,
    subject_id INTEGER NOT NULL,
    chapter_id INTEGER NOT NULL,
    chapter_name TEXT NOT NULL,
    question_type INTEGER NOT NULL,
    difficulty INTEGER NOT NULL,
    title TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    source_order INTEGER NOT NULL
);
CREATE INDEX questions_subject_order ON questions(subject_id, source_order);
CREATE TABLE import_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
CREATE TABLE memorization_progress (
    question_id INTEGER PRIMARY KEY REFERENCES questions(question_id),
    state TEXT NOT NULL CHECK (state IN ('mastered', 'review')),
    updated_at TEXT NOT NULL
);
CREATE TABLE study_cursors (
    subject_id INTEGER PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(question_id)
);

-- +goose Down
DROP TABLE study_cursors;
DROP TABLE memorization_progress;
DROP TABLE import_metadata;
DROP TABLE questions;
