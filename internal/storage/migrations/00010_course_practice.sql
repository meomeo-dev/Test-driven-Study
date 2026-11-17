-- +goose Up
CREATE TABLE course_presentations (
    course_id TEXT NOT NULL,
    id TEXT NOT NULL,
    version TEXT NOT NULL,
    unit_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    opened_at_ms INTEGER NOT NULL,
    PRIMARY KEY (course_id, id),
    FOREIGN KEY (course_id, version, item_id)
        REFERENCES course_items(course_id, version, item_id)
);

CREATE TABLE course_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    course_id TEXT NOT NULL,
    presentation_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    response_json TEXT NOT NULL,
    correct INTEGER NOT NULL CHECK (correct IN (0, 1)),
    answered_at_ms INTEGER NOT NULL,
    UNIQUE (course_id, presentation_id),
    FOREIGN KEY (course_id, presentation_id) REFERENCES course_presentations(course_id, id)
);
CREATE INDEX course_attempts_item ON course_attempts(course_id, item_id, id DESC);

CREATE TABLE course_cursors (
    course_id TEXT NOT NULL REFERENCES active_courses(course_id),
    unit_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    PRIMARY KEY (course_id, unit_id)
);

-- +goose Down
DROP TABLE course_cursors;
DROP TABLE course_attempts;
DROP TABLE course_presentations;
