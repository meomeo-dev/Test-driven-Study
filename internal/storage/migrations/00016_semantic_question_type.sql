-- +goose NO TRANSACTION
-- +goose Up
PRAGMA foreign_keys = OFF;
PRAGMA legacy_alter_table = ON;
BEGIN IMMEDIATE;
ALTER TABLE questions RENAME TO old_questions;
CREATE TABLE questions (
    question_id INTEGER PRIMARY KEY,
    subject_id INTEGER NOT NULL,
    chapter_id INTEGER NOT NULL,
    chapter_name TEXT NOT NULL,
    question_type TEXT NOT NULL CHECK (question_type IN (
        'single_choice',
        'multiple_choice',
        'true_false',
        'numeric',
        'cloze',
        'listening',
        'reading_comprehension',
        'writing',
        'translation'
    )),
    difficulty INTEGER NOT NULL,
    title TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    source_order INTEGER NOT NULL
);
INSERT INTO questions (
    question_id,
    subject_id,
    chapter_id,
    chapter_name,
    question_type,
    difficulty,
    title,
    payload_json,
    source_order
)
SELECT
    question_id,
    subject_id,
    chapter_id,
    chapter_name,
    CASE question_type
        WHEN 1 THEN 'single_choice'
        WHEN 2 THEN 'multiple_choice'
        WHEN 3 THEN 'true_false'
        WHEN 4 THEN 'numeric'
        WHEN 5 THEN 'cloze'
        WHEN 6 THEN 'listening'
        WHEN 7 THEN 'reading_comprehension'
        WHEN 8 THEN 'writing'
        WHEN 9 THEN 'translation'
        ELSE CAST(question_type AS TEXT)
    END,
    difficulty,
    title,
    payload_json,
    source_order
FROM old_questions;
DROP TABLE old_questions;
CREATE INDEX questions_subject_order ON questions(subject_id, source_order);
DELETE FROM import_metadata WHERE key LIKE 'workspace:%';
PRAGMA foreign_key_check;
COMMIT;
PRAGMA legacy_alter_table = OFF;
PRAGMA foreign_keys = ON;
