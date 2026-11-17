package storage

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strconv"
	"strings"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage/storedb"
	"test-driven-study/internal/study"
)

type oldCoursePresentation struct {
	id       string
	item     storedb.CourseItem
	opened   int64
	response sql.NullString
	correct  sql.NullInt64
	answered sql.NullInt64
}

func importCourseHistory(ctx context.Context, tx *sql.Tx) error {
	rows, err := tx.QueryContext(ctx, `SELECT p.id,i.course_id,i.version,i.unit_id,i.item_id,
		i.payload_json,p.opened_at_ms,a.response_json,a.correct,a.answered_at_ms
		FROM course_presentations p JOIN course_items i
		  ON i.course_id=p.course_id AND i.version=p.version AND i.item_id=p.item_id
		LEFT JOIN course_attempts a ON a.course_id=p.course_id AND a.presentation_id=p.id
		ORDER BY coalesce(a.answered_at_ms,p.opened_at_ms),a.id,p.course_id,p.id`)
	if err != nil {
		return err
	}
	defer rows.Close()
	var records []oldCoursePresentation
	for rows.Next() {
		var record oldCoursePresentation
		item := &record.item
		if err := rows.Scan(&record.id, &item.CourseID, &item.Version, &item.UnitID, &item.ItemID,
			&item.PayloadJson, &record.opened, &record.response, &record.correct,
			&record.answered); err != nil {
			return err
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return err
	}
	for _, record := range records {
		if err := importCoursePresentation(ctx, tx, record); err != nil {
			return err
		}
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO practice_cursors(subject_id,question_id)
		SELECT u.id,k.question_id FROM course_cursors c
		JOIN course_units u ON u.course_id=c.course_id AND u.unit_id=c.unit_id
		JOIN question_keys k ON k.course_id=c.course_id AND k.item_id=c.item_id
		JOIN questions q ON q.question_id=k.question_id AND q.subject_id=u.id
		WHERE u.active=1 ON CONFLICT(subject_id) DO NOTHING`)
	return err
}

func importCoursePresentation(ctx context.Context, tx *sql.Tx, old oldCoursePresentation) error {
	digest := sha256.Sum256([]byte(old.item.CourseID + "\x00" + old.id))
	id := "import-" + hex.EncodeToString(digest[:])
	if old.response.Valid {
		var saved string
		err := tx.QueryRowContext(ctx, "SELECT presentation_id FROM answer_attempts WHERE presentation_id=?",
			id).Scan(&saved)
		if err == nil {
			return nil
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return err
		}
	}
	q, err := historicalWorkspaceQuestion(ctx, tx, old.item)
	if err != nil {
		return err
	}
	data, err := json.Marshal(q)
	if err != nil {
		return err
	}
	revision := "package:" + old.item.Version
	queries := storedb.New(tx)
	prior, err := queries.PriorExposure(ctx, q.QuestionID)
	if err != nil {
		return err
	}
	if err := queries.CreatePresentation(ctx, storedb.CreatePresentationParams{
		ID: id, QuestionID: q.QuestionID, QuestionRevision: revision, OpenedAtMs: old.opened,
		PriorExposure: prior,
	}); err != nil {
		return err
	}
	if err := queries.SetPresentationSnapshot(ctx, storedb.SetPresentationSnapshotParams{
		PresentationID: id, QuestionJson: string(data),
	}); err != nil || !old.response.Valid {
		return err
	}
	selected, expected, err := historicalAnswers(q, old)
	if err != nil {
		return err
	}
	return queries.CreateAttempt(ctx, storedb.CreateAttemptParams{
		PresentationID: id, QuestionID: q.QuestionID, SubjectID: q.SubjectID,
		ChapterID: q.ChapterID, ChapterName: q.ChapterName, QuestionTitle: q.Title,
		QuestionRevision: revision, SelectedJson: selected, CorrectAnswerJson: expected,
		IsCorrect: old.correct.Int64, PriorExposure: prior, OpenedAtMs: old.opened,
		AnsweredAtMs: old.answered.Int64,
	})
}

func historicalWorkspaceQuestion(
	ctx context.Context, tx *sql.Tx, item storedb.CourseItem,
) (study.Question, error) {
	var unit int64
	err := tx.QueryRowContext(ctx, "SELECT id FROM course_units WHERE course_id=? AND unit_id=?",
		item.CourseID, item.UnitID).Scan(&unit)
	if errors.Is(err, sql.ErrNoRows) {
		unit, err = ensureWorkspaceUnit(ctx, tx, item.CourseID, item.UnitID, item.UnitID)
		if err == nil {
			_, err = tx.ExecContext(ctx, "UPDATE course_units SET active=0 WHERE id=?", unit)
		}
	}
	if err != nil {
		return study.Question{}, err
	}
	q, err := projectQuestion(item, unit)
	if err != nil {
		return q, err
	}
	err = tx.QueryRowContext(ctx, "SELECT question_id FROM question_keys WHERE course_id=? AND item_id=?",
		item.CourseID, item.ItemID).Scan(&q.QuestionID)
	if errors.Is(err, sql.ErrNoRows) {
		q.SubjectID = 0
		err = saveProjectedQuestion(ctx, tx, &q, item.Position)
		q.SubjectID = unit
	}
	return q, err
}

func historicalAnswers(q study.Question, old oldCoursePresentation) (string, string, error) {
	if q.QuestionType == 4 {
		encoded, err := json.Marshal(course.Response{Value: &q.Answer})
		return old.response.String, string(encoded), err
	}
	var response course.Response
	var item course.Item
	if err := json.Unmarshal([]byte(old.response.String), &response); err != nil {
		return "", "", err
	}
	if err := json.Unmarshal([]byte(old.item.PayloadJson), &item); err != nil {
		return "", "", err
	}
	var selected []int64
	if q.QuestionType == 3 {
		answer, err := strconv.ParseInt(q.Answer, 10, 64)
		if err != nil {
			return "", "", err
		}
		if old.correct.Int64 == 0 {
			answer = 3 - answer
		}
		selected = []int64{answer}
	} else {
		for i, option := range item.Options {
			for _, id := range response.ChoiceIDs {
				if option.ID == id {
					selected = append(selected, int64(i+1))
				}
			}
		}
	}
	expected := "[" + strings.ReplaceAll(q.Answer, " ", "") + "]"
	data, err := json.Marshal(selected)
	return string(data), expected, err
}
