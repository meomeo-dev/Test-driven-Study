package storage

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"

	"test-driven-study/internal/study"
)

func importQuestions(ctx context.Context, db *sql.DB, filename string) error {
	payload, err := os.ReadFile(filename)
	if err != nil {
		return fmt.Errorf("read question bank: %w", err)
	}
	digest := sha256.Sum256(payload)
	hash := hex.EncodeToString(digest[:])
	var previous string
	err = db.QueryRowContext(ctx, "SELECT value FROM import_metadata WHERE key = 'question_sha256'").Scan(&previous)
	if err == nil {
		if previous != hash {
			return errors.New("question source changed; explicit data migration is required")
		}
		return nil
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	var rows []json.RawMessage
	if err := json.Unmarshal(payload, &rows); err != nil {
		return err
	}
	if len(rows) == 0 {
		return errors.New("empty question bank")
	}
	return insertQuestions(ctx, db, rows, hash)
}

func insertQuestions(ctx context.Context, db *sql.DB, rows []json.RawMessage, hash string) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	statement, err := tx.PrepareContext(ctx, `INSERT INTO questions
        (question_id, subject_id, chapter_id, chapter_name, question_type,
         difficulty, title, payload_json, source_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer statement.Close()
	for index, raw := range rows {
		var question study.Question
		if err := json.Unmarshal(raw, &question); err != nil {
			return err
		}
		if question.QuestionID <= 0 || question.Title == "" || len(question.Items) < 2 {
			return fmt.Errorf("invalid question at source index %d", index)
		}
		_, err := statement.ExecContext(ctx, question.QuestionID, question.SubjectID,
			question.ChapterID, question.ChapterName, question.QuestionType,
			question.Difficulty, question.Title, string(raw), index)
		if err != nil {
			return err
		}
	}
	if _, err := tx.ExecContext(ctx,
		"INSERT INTO import_metadata (key, value) VALUES ('question_sha256', ?)", hash); err != nil {
		return err
	}
	return tx.Commit()
}
