package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"io/fs"
	"path/filepath"
	"slices"
	"testing"

	"github.com/pressly/goose/v3"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage/storedb"
	"test-driven-study/internal/study"
)

func TestMigration00016SemanticQuestionTypeAndLegacySnapshots(t *testing.T) {
	ctx := context.Background()
	root, err := filepath.Abs("../..")
	if err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "study.sqlite")
	old, err := sql.Open("sqlite", dbPath+"?_pragma=foreign_keys(1)")
	if err != nil {
		t.Fatal(err)
	}
	migrationFS, err := fs.Sub(migrations, "migrations")
	if err != nil {
		t.Fatal(err)
	}
	provider, err := goose.NewProvider(goose.DialectSQLite3, old, migrationFS)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := provider.UpTo(ctx, 15); err != nil {
		t.Fatal(err)
	}

	// Seed integer 1..9 question rows including a polluted legacy cloze payload_json.
	allTypes := course.AllQuestionTypes()
	for i, qt := range allTypes {
		qid := int64(4294967300 + i)
		code := i + 1
		payloadMap := map[string]any{
			"question_id":      qid,
			"question_type":    code,
			"title":            "Legacy " + string(qt),
			"items":            []any{},
			"image_url":        "",
			"image_type":       0,
			"answer":           "1",
			"analysis":         "Analysis",
			"skill":            "",
			"difficulty":       1,
			"tags":             "",
			"licence_id":       0,
			"subject_id":       101,
			"chapter_id":       1,
			"chapter_name":     "Ch1",
			"sub_chapter_id":   0,
			"sub_chapter_name": "",
			"course_id":        0,
			"course_name":      "",
			"sort":             0,
			"province_id":      0,
			"city_id":          0,
		}
		if qt == course.Cloze {
			payloadMap["audio_url"] = "assets/stale.mp3"
			payloadMap["transcript_url"] = "Every worker {{1}} sign."
			payloadMap["transcript_lines"] = []map[string]any{{"speaker": "W", "text": "Leaked cloze passage"}}
			payloadMap["content"] = map[string]any{
				"passage": "Every worker {{1}} sign.",
				"blanks": []map[string]any{{
					"index": 1,
					"options": []map[string]any{
						{"id": "must", "text": "must"},
						{"id": "has", "text": "has"},
					},
				}},
			}
			payloadMap["question_review"] = map[string]any{
				"id":      "legacy-cloze",
				"type":    "cloze",
				"stem":    "Cloze stem",
				"passage": "Every worker {{1}} sign.",
				"blanks": []map[string]any{{
					"index": 1,
					"options": []map[string]any{
						{"id": "must", "text": "must"},
						{"id": "has", "text": "has"},
					},
					"grading": map[string]any{"choice_ids": []string{"must"}},
				}},
			}
		}
		rawPayload, _ := json.Marshal(payloadMap)
		if _, err := old.ExecContext(ctx, `INSERT INTO questions
			(question_id, subject_id, chapter_id, chapter_name, question_type, difficulty, title, payload_json, source_order)
			VALUES (?, 101, 1, 'Ch1', ?, 1, ?, ?, ?)`,
			qid, code, "Legacy "+string(qt), string(rawPayload), i); err != nil {
			t.Fatal(err)
		}
	}

	// Seed a child FK row in answer_attempts + practice_presentations + practice_question_snapshots
	// using a pre-fix cloze snapshot containing transcript_lines & integer question_type=5.
	clozeID := int64(4294967300 + 4)
	var clozePayload string
	if err := old.QueryRowContext(ctx, `SELECT payload_json FROM questions WHERE question_id=?`, clozeID).Scan(&clozePayload); err != nil {
		t.Fatal(err)
	}
	if _, err := old.ExecContext(ctx, `INSERT INTO practice_presentations
		(id, question_id, question_revision, opened_at_ms, prior_exposure)
		VALUES ('legacy-cloze-pres-0001', ?, 'rev1', 1000, 0)`, clozeID); err != nil {
		t.Fatal(err)
	}
	if _, err := old.ExecContext(ctx, `INSERT INTO practice_question_snapshots
		(presentation_id, question_json) VALUES ('legacy-cloze-pres-0001', ?)`, clozePayload); err != nil {
		t.Fatal(err)
	}
	if _, err := old.ExecContext(ctx, `INSERT INTO answer_attempts
		(presentation_id, question_id, subject_id, chapter_id, chapter_name, question_title,
		 question_revision, selected_json, correct_answer_json, is_correct, is_first_attempt,
		 prior_exposure, opened_at_ms, answered_at_ms)
		VALUES ('legacy-cloze-pres-0001', ?, 101, 1, 'Ch1', 'Legacy cloze', 'rev1',
		 '{"blanks":{"1":["must"]}}', '{"blanks":{"1":["must"]},"score":1}', 1, 1, 0, 1000, 2000)`, clozeID); err != nil {
		t.Fatal(err)
	}

	// Seed an in_progress mock_exams row with legacy integer rule_json & polluted cloze paper_json.
	ruleJSON := `{"subject_id":101,"count":1,"minutes":10,"points":1,"pass_score":1,"version":"legacy-1","blueprint":{"scope":"test","content_alignment":"unverified","types":[{"question_type":1,"name":"单选题","count":1}],"topics":[],"sources":[]}}`
	paperJSON := `[{"question":` + clozePayload + `,"image_available":false,"prior_exposure":0,"revision":"rev1"}]`
	answersJSON := `[{"selected":[],"answered_at_ms":0,"flagged":false}]`
	const examID = "a8000000-0000-4000-8000-000000000001"
	if _, err := old.ExecContext(ctx, `INSERT INTO mock_exams
		(id, subject_id, status, rule_json, paper_json, answers_json, started_at_ms, deadline_at_ms)
		VALUES (?, 101, 'in_progress', ?, ?, ?, 1000, 9999999999999)`,
		examID, ruleJSON, paperJSON, answersJSON); err != nil {
		t.Fatal(err)
	}

	// Seed a palace_jobs row with legacy snapshot_json.
	palaceSnap := `{"question":` + clozePayload + `,"settings":{"model":"m","size":"720x1280","quality":"low","palace_address":"A","use_reference":false},"prompt":"P","template_id":"t","template_version":"1","reference_hash":""}`
	if _, err := old.ExecContext(ctx, `INSERT INTO palace_jobs
		(id, question_id, subject_id, status, snapshot_json, created_at_ms, updated_at_ms)
		VALUES ('b8000000-0000-4000-8000-000000000001', ?, 101, 'succeeded', ?, 1000, 1000)`,
		clozeID, palaceSnap); err != nil {
		t.Fatal(err)
	}

	// Seed a workspace:% marker to verify 00016 clears it so active courses re-project cleanly.
	if _, err := old.ExecContext(ctx, `INSERT INTO import_metadata (key, value) VALUES ('workspace:demo', '1.0.0')`); err != nil {
		t.Fatal(err)
	}
	if err := old.Close(); err != nil {
		t.Fatal(err)
	}

	// Upgrade via storage.Open (applies 00016 + seeds/reprojects active courses).
	db, err := Open(ctx, root, dir)
	if err != nil {
		t.Fatalf("upgrade via Open failed: %v", err)
	}
	defer db.Close()

	var fkEnabled int
	if err := db.QueryRowContext(ctx, "PRAGMA foreign_keys").Scan(&fkEnabled); err != nil || fkEnabled != 1 {
		t.Fatalf("foreign_keys not enabled: %d, %v", fkEnabled, err)
	}
	var fkViolations int
	if err := db.QueryRowContext(ctx, "SELECT count(*) FROM pragma_foreign_key_check").Scan(&fkViolations); err != nil || fkViolations != 0 {
		t.Fatalf("foreign_key_check violations: %d, %v", fkViolations, err)
	}

	// Check workspace:% marker was cleared (and re-seeded courses don't keep 'workspace:demo').
	var demoCount int
	if err := db.QueryRowContext(ctx, "SELECT count(*) FROM import_metadata WHERE key = 'workspace:demo'").Scan(&demoCount); err != nil || demoCount != 0 {
		t.Fatalf("00016 did not delete workspace:demo marker: %d, %v", demoCount, err)
	}

	// Verify 1..9 migrated to canonical strings and CHECK constraint enforces them.
	for i, want := range allTypes {
		qid := int64(4294967300 + i)
		var got course.QuestionType
		if err := db.QueryRowContext(ctx, "SELECT question_type FROM questions WHERE question_id=?", qid).Scan(&got); err != nil || got != want {
			t.Fatalf("migrated question %d: got %q (%v), want %q", qid, got, err, want)
		}
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO questions
		(question_id, subject_id, chapter_id, chapter_name, question_type, difficulty, title, payload_json, source_order)
		VALUES (9999999, 101, 1, 'Ch1', 'bogus', 1, 'Bad', '{}', 99)`); err == nil {
		t.Fatal("CHECK constraint accepted invalid question_type")
	}

	// Verify legacy in_progress mock_exams decodes cleanly without cloze listening leak.
	svc := study.New(db, root)
	exam, err := svc.GetExam(ctx, examID)
	if err != nil {
		t.Fatalf("GetExam on legacy in_progress exam failed: %v", err)
	}
	if len(exam.Rule.Blueprint.Types) != 1 || exam.Rule.Blueprint.Types[0].QuestionType != course.SingleChoice {
		t.Fatalf("legacy ExamRule blueprint not decoded cleanly: %+v", exam.Rule.Blueprint)
	}
	clozeExamQ := exam.Items[0].Detail.Question
	if clozeExamQ.QuestionType != course.Cloze {
		t.Fatalf("legacy paper question_type got %q, want cloze", clozeExamQ.QuestionType)
	}
	if clozeExamQ.AudioURL != "" || clozeExamQ.TranscriptURL != "" || len(clozeExamQ.TranscriptLines) != 0 {
		t.Fatalf("legacy cloze exam item leaked media/transcript: %+v", clozeExamQ)
	}
	if _, err := svc.ExamSpeech(ctx, examID, 0, 0); err == nil {
		t.Fatal("ExamSpeech should reject cloze question")
	}

	// Verify legacy answer_attempts + analysis populates QuestionType cleanly.
	analysis, err := svc.Analysis(ctx, 101, 0)
	if err != nil || len(analysis.RecentAttempts) != 1 || analysis.RecentAttempts[0].QuestionType != course.Cloze {
		t.Fatalf("analysis on legacy attempt failed: %+v, %v", analysis.RecentAttempts, err)
	}

	// Verify legacy palace snapshot decodes cleanly and strips cloze transcript_lines.
	var snapRaw string
	if err := db.QueryRowContext(ctx, `SELECT snapshot_json FROM palace_jobs WHERE id='b8000000-0000-4000-8000-000000000001'`).Scan(&snapRaw); err != nil {
		t.Fatal(err)
	}
	var snap struct {
		Question study.Question `json:"question"`
	}
	if err := json.Unmarshal([]byte(snapRaw), &snap); err != nil {
		t.Fatalf("unmarshal legacy palace snapshot: %v", err)
	}
	if snap.Question.QuestionType != course.Cloze || len(snap.Question.TranscriptLines) != 0 || snap.Question.AudioURL != "" {
		t.Fatalf("legacy palace snapshot leaked media: %+v", snap.Question)
	}

	// Verify golden-course-template (v2) installs cleanly and its cloze question has zero media/transcript.
	if _, err := InstallCourse(ctx, db, filepath.Join(root, "courses", "golden-course-template")); err != nil {
		t.Fatal(err)
	}
	queries := storedb.New(db)
	units, err := queries.ListWorkspaceUnits(ctx, "golden-course-template")
	if err != nil || len(units) == 0 {
		t.Fatalf("golden-course-template units: %+v, %v", units, err)
	}
	qRows, err := queries.ListQuestions(ctx, storedb.ListQuestionsParams{
		SubjectID: units[0].ID, ChapterID: -1, Search: "", State: "all",
	})
	if err != nil {
		t.Fatal(err)
	}
	idx := slices.IndexFunc(qRows, func(r storedb.ListQuestionsRow) bool { return r.QuestionType == course.Cloze })
	if idx < 0 {
		t.Fatal("cloze question missing after install")
	}
	detail, err := svc.Detail(ctx, qRows[idx].QuestionID)
	if err != nil {
		t.Fatal(err)
	}
	if detail.Question.AudioURL != "" || detail.Question.TranscriptURL != "" || len(detail.Question.TranscriptLines) != 0 {
		t.Fatalf("installed cloze question has media/transcript: %+v", detail.Question)
	}
}
