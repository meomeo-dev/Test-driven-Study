-- +goose Up
CREATE TABLE attempt_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    presentation_id TEXT NOT NULL REFERENCES practice_presentations(id) ON DELETE CASCADE,
    source TEXT NOT NULL CHECK (source IN ('llm', 'self_check')),
    passed INTEGER NOT NULL CHECK (passed IN (0, 1)),
    score_pct INTEGER NOT NULL CHECK (score_pct BETWEEN 0 AND 100),
    feedback_json TEXT NOT NULL,
    evaluated_at_ms INTEGER NOT NULL
);
CREATE INDEX attempt_evaluations_presentation_id
    ON attempt_evaluations(presentation_id, id DESC);
-- +goose StatementBegin
CREATE TRIGGER attempt_evaluations_no_update BEFORE UPDATE ON attempt_evaluations BEGIN
    SELECT RAISE(ABORT, 'attempt evaluations are immutable');
END;
-- +goose StatementEnd
-- +goose StatementBegin
CREATE TRIGGER attempt_evaluations_no_delete BEFORE DELETE ON attempt_evaluations BEGIN
    SELECT RAISE(ABORT, 'attempt evaluations are immutable');
END;
-- +goose StatementEnd

-- +goose Down
DROP TRIGGER IF EXISTS attempt_evaluations_no_delete;
DROP TRIGGER IF EXISTS attempt_evaluations_no_update;
DROP TABLE IF EXISTS attempt_evaluations;
