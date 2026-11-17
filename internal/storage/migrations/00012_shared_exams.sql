-- +goose Up
ALTER TABLE mock_exams RENAME TO old_mock_exams;
CREATE TABLE mock_exams (
    id TEXT PRIMARY KEY,
    subject_id INTEGER NOT NULL CHECK (subject_id > 0),
    status TEXT NOT NULL CHECK (status IN ('in_progress','finished')),
    rule_json TEXT NOT NULL,
    paper_json TEXT NOT NULL,
    answers_json TEXT NOT NULL,
    started_at_ms INTEGER NOT NULL CHECK (started_at_ms > 0),
    deadline_at_ms INTEGER NOT NULL CHECK (deadline_at_ms > started_at_ms),
    finished_at_ms INTEGER NOT NULL DEFAULT 0 CHECK (finished_at_ms >= 0),
    reason TEXT NOT NULL DEFAULT '',
    score INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
    current_index INTEGER NOT NULL DEFAULT 0 CHECK (current_index >= 0)
);
INSERT INTO mock_exams SELECT * FROM old_mock_exams;
DROP TABLE old_mock_exams;
CREATE INDEX mock_exams_subject_time ON mock_exams(subject_id,started_at_ms DESC,id);
CREATE UNIQUE INDEX mock_exams_one_active ON mock_exams(subject_id)
    WHERE status='in_progress';
