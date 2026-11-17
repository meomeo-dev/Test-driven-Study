-- +goose Up
CREATE TABLE llm_plans (
    id TEXT PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(question_id),
    status TEXT NOT NULL CHECK(status IN ('running', 'succeeded', 'failed', 'interrupted')),
    record_json TEXT NOT NULL
);
CREATE INDEX llm_plan_question ON llm_plans(question_id, id);

-- +goose Down
DROP TABLE llm_plans;
