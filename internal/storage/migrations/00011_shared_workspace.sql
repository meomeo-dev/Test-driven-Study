-- +goose Up
CREATE TABLE course_units (
    id INTEGER PRIMARY KEY,
    course_id TEXT NOT NULL,
    unit_id TEXT NOT NULL,
    title TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
    UNIQUE (course_id, unit_id)
);


CREATE TABLE question_keys (
    question_id INTEGER PRIMARY KEY REFERENCES questions(question_id),
    course_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    UNIQUE (course_id, item_id)
);

CREATE TABLE practice_question_snapshots (
    presentation_id TEXT PRIMARY KEY REFERENCES practice_presentations(id),
    question_json TEXT NOT NULL
);

-- +goose Down
DROP TABLE practice_question_snapshots;
DROP TABLE question_keys;
DROP TABLE course_units;
