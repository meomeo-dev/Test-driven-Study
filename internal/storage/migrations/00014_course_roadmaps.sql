-- +goose Up
-- A completion mark is the learner's statement that a course without concepts
-- is complete. Marks are keyed by stable course IDs so they survive upgrades.
CREATE TABLE course_marks (
    course_id TEXT PRIMARY KEY,
    marked_at_ms INTEGER NOT NULL CHECK (marked_at_ms > 0)
);

-- A course roadmap is the learner's saved route across installed courses.
-- Replanning archives the active row; archived rows are retained.
CREATE TABLE course_roadmaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    relation_digest TEXT NOT NULL,
    targets_json TEXT NOT NULL,
    steps_json TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL CHECK (created_at_ms > 0),
    archived_at_ms INTEGER CHECK (archived_at_ms IS NULL OR archived_at_ms >= created_at_ms)
);
-- The indexed expression is 1 for every active row, so at most one row can be
-- active for the single local learner.
CREATE UNIQUE INDEX course_roadmaps_one_active ON course_roadmaps((archived_at_ms IS NULL))
    WHERE archived_at_ms IS NULL;

-- +goose Down
DROP INDEX course_roadmaps_one_active;
DROP TABLE course_roadmaps;
DROP TABLE course_marks;
