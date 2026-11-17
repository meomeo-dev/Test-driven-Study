-- +goose Up
CREATE TABLE practice_presentations (
    id TEXT PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(question_id),
    question_revision TEXT NOT NULL,
    opened_at_ms INTEGER NOT NULL,
    prior_exposure INTEGER NOT NULL CHECK (prior_exposure IN (0, 1))
);
CREATE TABLE answer_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    presentation_id TEXT NOT NULL UNIQUE REFERENCES practice_presentations(id),
    question_id INTEGER NOT NULL REFERENCES questions(question_id),
    subject_id INTEGER NOT NULL,
    chapter_id INTEGER NOT NULL,
    chapter_name TEXT NOT NULL,
    question_title TEXT NOT NULL,
    question_revision TEXT NOT NULL,
    selected_json TEXT NOT NULL,
    correct_answer_json TEXT NOT NULL,
    is_correct INTEGER NOT NULL CHECK (is_correct IN (0, 1)),
    is_first_attempt INTEGER NOT NULL CHECK (is_first_attempt IN (0, 1)),
    prior_exposure INTEGER NOT NULL CHECK (prior_exposure IN (0, 1)),
    opened_at_ms INTEGER NOT NULL,
    answered_at_ms INTEGER NOT NULL CHECK (answered_at_ms >= opened_at_ms)
);
CREATE INDEX attempts_subject_time ON answer_attempts(subject_id, answered_at_ms, id);
CREATE INDEX attempts_question_time ON answer_attempts(question_id, answered_at_ms, id);
CREATE TABLE memorization_exposures (
    id TEXT PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(question_id),
    viewed_at_ms INTEGER NOT NULL
);
CREATE INDEX exposures_question ON memorization_exposures(question_id);
CREATE TABLE practice_cursors (
    subject_id INTEGER PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(question_id)
);
-- +goose StatementBegin
CREATE TRIGGER attempts_no_update BEFORE UPDATE ON answer_attempts BEGIN
    SELECT RAISE(ABORT, 'answer attempts are immutable');
END;
-- +goose StatementEnd
-- +goose StatementBegin
CREATE TRIGGER attempts_no_delete BEFORE DELETE ON answer_attempts BEGIN
    SELECT RAISE(ABORT, 'answer attempts are immutable');
END;
-- +goose StatementEnd

-- +goose Down
DROP TABLE practice_cursors;
DROP TABLE memorization_exposures;
DROP TABLE answer_attempts;
DROP TABLE practice_presentations;
