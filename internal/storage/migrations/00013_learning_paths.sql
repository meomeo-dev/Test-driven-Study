-- +goose Up
-- A known mark is the learner's self-assessment of one concept. Marks are keyed
-- by stable course and concept IDs so they survive package upgrades.
CREATE TABLE concept_marks (
    course_id TEXT NOT NULL,
    concept_id TEXT NOT NULL,
    marked_at_ms INTEGER NOT NULL CHECK (marked_at_ms > 0),
    PRIMARY KEY (course_id, concept_id)
);

-- A learning path is a saved plan for one course. Replanning archives the
-- active row; archived rows are retained.
CREATE TABLE learning_paths (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id TEXT NOT NULL,
    course_version TEXT NOT NULL,
    graph_digest TEXT NOT NULL,
    targets_json TEXT NOT NULL,
    daily_minutes INTEGER NOT NULL CHECK (daily_minutes BETWEEN 10 AND 480),
    steps_json TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL CHECK (created_at_ms > 0),
    archived_at_ms INTEGER CHECK (archived_at_ms IS NULL OR archived_at_ms >= created_at_ms)
);
CREATE UNIQUE INDEX learning_paths_one_active ON learning_paths(course_id)
    WHERE archived_at_ms IS NULL;

-- +goose Down
DROP INDEX learning_paths_one_active;
DROP TABLE learning_paths;
DROP TABLE concept_marks;
