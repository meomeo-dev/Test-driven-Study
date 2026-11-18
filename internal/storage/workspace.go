package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"path"
	"strconv"
	"strings"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage/storedb"
	"test-driven-study/internal/study"
)

func initializeWorkspace(ctx context.Context, db *sql.DB) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	active, err := storedb.New(tx).ListActiveCourses(ctx)
	if err != nil {
		return err
	}
	for _, version := range active {
		if err := projectWorkspace(ctx, tx, version); err != nil {
			return fmt.Errorf("prepare workspace for %s: %w", version.CourseID, err)
		}
	}
	if err := importCourseHistory(ctx, tx); err != nil {
		return fmt.Errorf("merge course study history: %w", err)
	}
	return tx.Commit()
}

func projectWorkspace(ctx context.Context, tx *sql.Tx, version storedb.CourseVersion) error {
	key := "workspace:" + version.CourseID
	var previous string
	err := tx.QueryRowContext(ctx, "SELECT value FROM import_metadata WHERE key=?", key).Scan(&previous)
	if err == nil && previous == version.Version {
		return nil
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	var manifest course.Manifest
	if err := json.Unmarshal([]byte(version.ManifestJson), &manifest); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `UPDATE questions SET subject_id=0
		WHERE question_id IN (SELECT question_id FROM question_keys WHERE course_id=?)`,
		version.CourseID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, "UPDATE course_units SET active=0 WHERE course_id=?",
		version.CourseID); err != nil {
		return err
	}
	for _, unit := range manifest.Units {
		unitKey, err := ensureWorkspaceUnit(ctx, tx, version.CourseID, unit.ID, unit.Title)
		if err != nil {
			return err
		}
		if err := projectWorkspaceUnit(ctx, tx, version, unit, unitKey); err != nil {
			return err
		}
	}
	_, err = tx.ExecContext(ctx, `INSERT INTO import_metadata(key,value) VALUES (?,?)
		ON CONFLICT(key) DO UPDATE SET value=excluded.value`, key, version.Version)
	return err
}

func ensureWorkspaceUnit(
	ctx context.Context, tx *sql.Tx, courseID, unitID, title string,
) (int64, error) {
	var key int64
	err := tx.QueryRowContext(ctx, `INSERT INTO course_units(id,course_id,unit_id,title)
		VALUES ((SELECT max(100,coalesce(max(id),0))+1 FROM course_units),?,?,?)
		ON CONFLICT(course_id,unit_id) DO UPDATE SET title=excluded.title,active=1
		RETURNING id`, courseID, unitID, title).Scan(&key)
	return key, err
}

func projectWorkspaceUnit(
	ctx context.Context, tx *sql.Tx, version storedb.CourseVersion, unit course.Unit, unitKey int64,
) error {
	rows, err := storedb.New(tx).ListCourseItems(ctx, storedb.ListCourseItemsParams{
		CourseID: version.CourseID, Version: version.Version, UnitID: unit.ID,
	})
	if err != nil {
		return err
	}
	chapters := map[string]int64{}
	for _, row := range rows {
		question, err := projectQuestion(row, unitKey)
		if err != nil {
			return err
		}
		if question.ChapterName != "" {
			chapter := chapters[question.ChapterName]
			if chapter == 0 {
				chapter = int64(len(chapters) + 1)
				chapters[question.ChapterName] = chapter
			}
			question.ChapterID = chapter
		}
		if err := saveProjectedQuestion(ctx, tx, &question, row.Position); err != nil {
			return err
		}
	}
	return nil
}

func projectQuestion(row storedb.CourseItem, unit int64) (study.Question, error) {
	var item course.Item
	if err := json.Unmarshal([]byte(row.PayloadJson), &item); err != nil {
		return study.Question{}, err
	}
	transcriptURL := ""
	if item.Transcript != nil {
		transcriptURL = item.Transcript.String()
	}
	question := study.Question{SubjectID: unit, PackageID: row.CourseID,
		PackageVersion: row.Version, SourceItemID: row.ItemID, Title: item.Stem.String(),
		Analysis: item.Explanation, Skill: item.Hint, ChapterName: item.Chapter,
		ImageURL: item.Image, AudioURL: item.Audio, TranscriptURL: transcriptURL,
		Items: []study.Option{}}
	if len(item.Stem.Segments) > 0 {
		question.RichContent = item.Stem.Segments
	}
	if item.Image != "" {
		question.ImageType = 1
		if strings.EqualFold(path.Ext(item.Image), ".gif") {
			question.ImageType = 2
		}
	}
	switch item.Type {
	case course.SingleChoice, course.MultipleChoice:
		question.QuestionType = 1
		if item.Type == course.MultipleChoice {
			question.QuestionType = 2
		}
		question.Answer = projectChoices(&question, item)
	case course.TrueFalse:
		question.QuestionType = 3
		if len(item.Options) == 0 {
			yes, no := true, false
			item.Options = []course.Option{{Text: "正确", Value: &yes}, {Text: "错误", Value: &no}}
		}
		for i, option := range item.Options {
			sign := int64(i + 1)
			opt := study.Option{
				Sign: sign, ItemTitle: option.Text, BooleanValue: option.Value,
			}
			if option.TTS != nil && option.TTS.Enabled {
				voice := option.TTS.Config.Voice
				if voice == "" {
					voice = "stella"
				}
				text := option.TTS.Config.Text
				if text == "" {
					text = option.Text
				}
				opt.TTS = &study.OptionTTS{Voice: voice, Text: text, Speed: option.TTS.Config.Speed}
			}
			question.Items = append(question.Items, opt)
			if *option.Value == *item.Grading.Boolean {
				question.Answer = strconv.FormatInt(sign, 10)
			}
		}
	case course.Numeric:
		question.QuestionType = 4
		question.Answer, question.NumberTolerance = item.Grading.Value, item.Grading.AbsoluteTolerance
	default:
		return study.Question{}, fmt.Errorf("unsupported question type %q", item.Type)
	}
	return question, nil
}

func projectChoices(question *study.Question, item course.Item) string {
	signs := make(map[string]string, len(item.Options))
	for i, option := range item.Options {
		sign := int64(i + 1)
		signs[option.ID] = strconv.FormatInt(sign, 10)
		opt := study.Option{Sign: sign, ItemTitle: option.Text}
		if option.TTS != nil && option.TTS.Enabled {
			voice := option.TTS.Config.Voice
			if voice == "" {
				voice = "stella"
			}
			text := option.TTS.Config.Text
			if text == "" {
				text = option.Text
			}
			opt.TTS = &study.OptionTTS{Voice: voice, Text: text, Speed: option.TTS.Config.Speed}
		}
		question.Items = append(question.Items, opt)
	}
	answers := make([]string, 0, len(item.Grading.ChoiceIDs))
	for _, id := range item.Grading.ChoiceIDs {
		answers = append(answers, signs[id])
	}
	return strings.Join(answers, ",")
}

func saveProjectedQuestion(ctx context.Context, tx *sql.Tx, q *study.Question, position int64) error {
	queries := storedb.New(tx)
	id, err := queries.GetWorkspaceQuestionID(ctx, storedb.GetWorkspaceQuestionIDParams{
		CourseID: q.PackageID, ItemID: q.SourceItemID,
	})
	isNew := errors.Is(err, sql.ErrNoRows)
	if isNew {
		err = tx.QueryRowContext(ctx,
			"SELECT max(4294967296,coalesce(max(question_id),0))+1 FROM questions").Scan(&id)
	}
	if err != nil {
		return err
	}
	q.QuestionID = id
	data, err := json.Marshal(q)
	if err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO questions
		(question_id,subject_id,chapter_id,chapter_name,question_type,difficulty,title,payload_json,source_order)
		VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(question_id) DO UPDATE SET
		subject_id=excluded.subject_id,chapter_id=excluded.chapter_id,chapter_name=excluded.chapter_name,
		question_type=excluded.question_type,title=excluded.title,payload_json=excluded.payload_json,
		source_order=excluded.source_order`, id, q.SubjectID, q.ChapterID, q.ChapterName,
		q.QuestionType, q.Difficulty, q.Title, string(data), position); err != nil {
		return err
	}
	if isNew {
		_, err = tx.ExecContext(ctx, `INSERT INTO question_keys(question_id,course_id,item_id)
			VALUES (?,?,?)`, id, q.PackageID, q.SourceItemID)
	}
	return err
}
