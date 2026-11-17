-- +goose Up
CREATE TABLE course_versions (
    course_id TEXT NOT NULL,
    version TEXT NOT NULL,
    digest TEXT NOT NULL,
    manifest_json TEXT NOT NULL,
    PRIMARY KEY (course_id, version)
);

CREATE TABLE active_courses (
    course_id TEXT PRIMARY KEY,
    version TEXT NOT NULL,
    FOREIGN KEY (course_id, version) REFERENCES course_versions(course_id, version)
);

CREATE TABLE course_items (
    course_id TEXT NOT NULL,
    version TEXT NOT NULL,
    item_id TEXT NOT NULL,
    unit_id TEXT NOT NULL,
    position INTEGER NOT NULL CHECK (position >= 0),
    payload_json TEXT NOT NULL,
    legacy_question_id INTEGER REFERENCES questions(question_id),
    PRIMARY KEY (course_id, version, item_id),
    UNIQUE (course_id, version, unit_id, position),
    FOREIGN KEY (course_id, version) REFERENCES course_versions(course_id, version)
);

CREATE TABLE course_lessons (
    course_id TEXT NOT NULL,
    version TEXT NOT NULL,
    unit_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    markdown TEXT NOT NULL,
    PRIMARY KEY (course_id, version, unit_id, lesson_id),
    FOREIGN KEY (course_id, version) REFERENCES course_versions(course_id, version)
);

CREATE TABLE course_assets (
    course_id TEXT NOT NULL,
    version TEXT NOT NULL,
    path TEXT NOT NULL,
    content BLOB NOT NULL,
    PRIMARY KEY (course_id, version, path),
    FOREIGN KEY (course_id, version) REFERENCES course_versions(course_id, version)
);

-- +goose Down
DROP TABLE course_assets;
DROP TABLE course_lessons;
DROP TABLE course_items;
DROP TABLE active_courses;
DROP TABLE course_versions;
