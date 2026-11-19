-- name: GetQuestion :one
SELECT payload_json FROM questions WHERE question_id = ?;

-- name: CreatePalaceJob :exec
INSERT INTO palace_jobs(id, question_id, subject_id, status, snapshot_json,
    created_at_ms, updated_at_ms) VALUES (?, ?, ?, 'queued', ?, ?, ?)
ON CONFLICT(id) DO NOTHING;

-- name: GetPalaceJob :one
SELECT * FROM palace_jobs WHERE id = ?;

-- name: ListPalaceJobs :many
SELECT * FROM palace_jobs WHERE subject_id = sqlc.arg(subject_id)
  AND (CAST(sqlc.arg(question_id) AS INTEGER) = 0 OR question_id = sqlc.arg(question_id))
ORDER BY created_at_ms DESC, id DESC LIMIT 30;

-- name: NextPalaceJob :one
SELECT * FROM palace_jobs WHERE status = 'queued' AND control_state = 'run'
ORDER BY created_at_ms, id LIMIT 1;

-- name: ClaimPalaceJob :one
UPDATE palace_jobs SET status = 'running', updated_at_ms = ?
WHERE id = ? AND status = 'queued' AND control_state = 'run' RETURNING *;

-- name: FinishPalaceJob :execrows
UPDATE palace_jobs SET status = ?, image_json = ?, error_json = ?, updated_at_ms = ?,
    control_state = 'run' WHERE id = ? AND status = 'running' AND control_state <> 'paused';

-- name: CancelPalaceJob :execrows
UPDATE palace_jobs SET status = 'canceled', control_state = 'run', updated_at_ms = ?
WHERE id = ? AND status IN ('queued', 'running');

-- name: InterruptPalaceJobs :exec
UPDATE palace_jobs SET status = 'interrupted', error_json = ?, updated_at_ms = ?
WHERE status IN ('queued', 'running') AND control_state <> 'paused';

-- name: CountActivePalaceJobs :one
SELECT COUNT(*) FROM palace_jobs WHERE status IN ('queued', 'running');

-- name: PalaceCoverage :many
WITH saved AS (
    SELECT question_id, id,
        count(*) OVER (PARTITION BY question_id) AS image_count,
        row_number() OVER (PARTITION BY question_id
            ORDER BY created_at_ms DESC, id DESC) AS position
    FROM palace_jobs WHERE subject_id = ? AND status = 'succeeded'
)
SELECT question_id, image_count, id AS latest_job_id
FROM saved WHERE position = 1 ORDER BY question_id;

-- name: ListQuestions :many
SELECT q.question_id, q.title, q.question_type, q.chapter_id, q.chapter_name,
    q.difficulty, CAST(COALESCE(k.item_id, '') AS TEXT) AS source_item_id,
    CAST(COALESCE(p.state, 'unlearned') AS TEXT) AS state
FROM questions q
LEFT JOIN memorization_progress p ON p.question_id = q.question_id
LEFT JOIN question_keys k ON k.question_id = q.question_id
WHERE q.subject_id = sqlc.arg(subject_id)
  AND (CAST(sqlc.arg(chapter_id) AS INTEGER) = -1 OR q.chapter_id = sqlc.arg(chapter_id))
  AND (CAST(sqlc.arg(search) AS TEXT) = ''
    OR instr(q.title, CAST(sqlc.arg(search) AS TEXT)) > 0
    OR CAST(q.question_id AS TEXT) = CAST(sqlc.arg(search) AS TEXT)
    OR k.item_id = CAST(sqlc.arg(search) AS TEXT))
  AND (CAST(sqlc.arg(state) AS TEXT) = 'all'
    OR COALESCE(p.state, 'unlearned') = CAST(sqlc.arg(state) AS TEXT))
ORDER BY q.source_order;

-- name: SubjectOverview :one
SELECT COUNT(*) AS total,
    COUNT(CASE WHEN p.state = 'mastered' THEN 1 END) AS mastered,
    COUNT(CASE WHEN p.state = 'review' THEN 1 END) AS review
FROM questions q
LEFT JOIN memorization_progress p ON p.question_id = q.question_id
WHERE q.subject_id = ?;

-- name: ListChapters :many
SELECT chapter_id, CAST(MIN(chapter_name) AS TEXT) AS chapter_name, COUNT(*) AS total
FROM questions WHERE subject_id = ?
GROUP BY chapter_id ORDER BY MIN(source_order);

-- name: GetProgress :one
SELECT state FROM memorization_progress WHERE question_id = ?;

-- name: SetProgress :exec
INSERT INTO memorization_progress (question_id, state, updated_at)
VALUES (?, ?, ?)
ON CONFLICT (question_id) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at;

-- name: ClearProgress :exec
DELETE FROM memorization_progress WHERE question_id = ?;

-- name: GetCursor :one
SELECT question_id FROM study_cursors WHERE subject_id = ?;

-- name: SetCursor :exec
INSERT INTO study_cursors (subject_id, question_id) VALUES (?, ?)
ON CONFLICT (subject_id) DO UPDATE SET question_id = excluded.question_id;

-- name: CreatePresentation :exec
INSERT INTO practice_presentations (id, question_id, question_revision, opened_at_ms, prior_exposure)
VALUES (?, ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING;

-- name: GetPresentation :one
SELECT * FROM practice_presentations WHERE id = ?;

-- name: PriorExposure :one
SELECT CAST(EXISTS(SELECT 1 FROM memorization_exposures e WHERE e.question_id = sqlc.arg(question_id))
    OR EXISTS(SELECT 1 FROM answer_attempts a WHERE a.question_id = sqlc.arg(question_id))
    OR EXISTS(SELECT 1 FROM memorization_progress m WHERE m.question_id = sqlc.arg(question_id)) AS INTEGER) AS exposed;

-- name: CountAttempts :one
SELECT COUNT(*) FROM answer_attempts WHERE question_id = ?;

-- name: CreateAttempt :exec
INSERT INTO answer_attempts (presentation_id, question_id, subject_id, chapter_id,
    chapter_name, question_title, question_revision, selected_json, correct_answer_json,
    is_correct, is_first_attempt, prior_exposure, opened_at_ms, answered_at_ms)
VALUES (sqlc.arg(presentation_id), sqlc.arg(question_id), sqlc.arg(subject_id),
    sqlc.arg(chapter_id), sqlc.arg(chapter_name), sqlc.arg(question_title),
    sqlc.arg(question_revision), sqlc.arg(selected_json), sqlc.arg(correct_answer_json),
    sqlc.arg(is_correct),
    CAST(NOT EXISTS(SELECT 1 FROM answer_attempts a WHERE a.question_id = sqlc.arg(question_id)) AS INTEGER),
    sqlc.arg(prior_exposure), sqlc.arg(opened_at_ms), sqlc.arg(answered_at_ms))
ON CONFLICT(presentation_id) DO NOTHING;

-- name: GetAttempt :one
SELECT a.*, q.question_type
FROM answer_attempts a
JOIN questions q ON q.question_id = a.question_id
WHERE a.presentation_id = ?;

-- name: ListAttempts :many
SELECT a.*, q.question_type
FROM answer_attempts a
JOIN questions q ON q.question_id = a.question_id
WHERE a.subject_id = ?
ORDER BY a.answered_at_ms, a.id;

-- name: RecordExposure :exec
INSERT INTO memorization_exposures (id, question_id, viewed_at_ms)
VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING;

-- name: GetExposure :one
SELECT * FROM memorization_exposures WHERE id = ?;

-- name: GetPracticeCursor :one
SELECT question_id FROM practice_cursors WHERE subject_id = ?;

-- name: SetPracticeCursor :exec
INSERT INTO practice_cursors (subject_id, question_id) VALUES (?, ?)
ON CONFLICT(subject_id) DO UPDATE SET question_id = excluded.question_id;

-- name: ListPracticeQuestions :many
WITH latest AS (
    SELECT question_id, is_correct,
        ROW_NUMBER() OVER (PARTITION BY question_id ORDER BY answered_at_ms DESC, id DESC) AS rn
    FROM answer_attempts
)
SELECT q.question_id, q.title, q.question_type, q.chapter_id, q.chapter_name,
    q.difficulty, CAST(COALESCE(k.item_id, '') AS TEXT) AS source_item_id,
    CAST(CASE WHEN a.is_correct = 1 THEN 'correct'
        WHEN a.is_correct = 0 THEN 'incorrect' ELSE 'unanswered' END AS TEXT) AS state
FROM questions q
LEFT JOIN latest a ON a.question_id = q.question_id AND a.rn = 1
LEFT JOIN question_keys k ON k.question_id = q.question_id
WHERE q.subject_id = sqlc.arg(subject_id)
  AND (CAST(sqlc.arg(chapter_id) AS INTEGER) = -1 OR q.chapter_id = sqlc.arg(chapter_id))
  AND (CAST(sqlc.arg(search) AS TEXT) = '' OR instr(q.title, CAST(sqlc.arg(search) AS TEXT)) > 0
      OR CAST(q.question_id AS TEXT) = CAST(sqlc.arg(search) AS TEXT)
      OR k.item_id = CAST(sqlc.arg(search) AS TEXT))
  AND (CAST(sqlc.arg(state) AS TEXT) = 'all'
    OR CASE WHEN a.is_correct = 1 THEN 'correct'
        WHEN a.is_correct = 0 THEN 'incorrect' ELSE 'unanswered' END = CAST(sqlc.arg(state) AS TEXT))
ORDER BY q.source_order;

-- name: GetLLMPlan :one
SELECT record_json FROM llm_plans WHERE id = ?;

-- name: CreateLLMPlan :exec
INSERT INTO llm_plans(id, question_id, status, record_json) VALUES (?, ?, 'running', ?);

-- name: FinishLLMPlan :exec
UPDATE llm_plans SET status = ?, record_json = ? WHERE id = ? AND status = 'running';

-- name: ListRunningLLMPlans :many
SELECT record_json FROM llm_plans WHERE status = 'running'
AND NOT EXISTS (SELECT 1 FROM palace_jobs WHERE palace_jobs.id = llm_plans.id
    AND palace_jobs.control_state = 'paused') ORDER BY id;

-- name: UpdatePalaceSnapshot :execrows
UPDATE palace_jobs SET snapshot_json = ?, updated_at_ms = ?
WHERE id = ? AND status = 'running' AND control_state <> 'paused';

-- name: RequestPalacePause :execrows
UPDATE palace_jobs SET control_state = CASE WHEN status = 'queued' THEN 'paused'
    ELSE 'pausing' END, updated_at_ms = ?
WHERE id = ? AND status IN ('queued', 'running') AND control_state = 'run';

-- name: ParkPalaceJob :execrows
UPDATE palace_jobs SET control_state = 'paused', updated_at_ms = ?
WHERE id = ? AND status = 'running' AND control_state = 'pausing';

-- name: ResumePalaceJob :execrows
UPDATE palace_jobs SET status = 'queued', control_state = 'run', updated_at_ms = ?
WHERE id = ? AND status IN ('queued', 'running') AND control_state = 'paused';

-- name: ListPalaceTasks :many
SELECT * FROM palace_jobs
WHERE (sqlc.arg(scope) = 'all' OR status IN ('queued', 'running'))
AND (CAST(sqlc.arg(course_id) AS TEXT)='' OR EXISTS (
    SELECT 1 FROM course_units u WHERE u.id=palace_jobs.subject_id
        AND u.course_id=sqlc.arg(course_id)))
AND (CAST(sqlc.arg(before_time) AS INTEGER) = 0
    OR created_at_ms < sqlc.arg(before_time)
    OR (created_at_ms = sqlc.arg(before_time) AND palace_jobs.id < sqlc.arg(before_id)))
ORDER BY created_at_ms DESC, palace_jobs.id DESC LIMIT 51;

-- name: ListPalaceJobEvents :many
SELECT * FROM palace_job_events WHERE job_id = ? ORDER BY id;

-- name: AppendTraceEvent :exec
INSERT INTO task_trace_events(job_id, span_id, parent_id, kind, label, event_type,
    status, origin, content, observed_at_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: ListTraceEvents :many
SELECT * FROM task_trace_events WHERE job_id = ? AND id > ? ORDER BY id LIMIT 256;

-- name: CountTraceEvents :one
SELECT COUNT(*) FROM task_trace_events WHERE job_id = ?;

-- name: CreateMockExam :exec
INSERT INTO mock_exams(id,subject_id,status,rule_json,paper_json,answers_json,
    started_at_ms,deadline_at_ms) VALUES (?,?,'in_progress',?,?,?,?,?);

-- name: GetMockExam :one
SELECT * FROM mock_exams WHERE id = ?;

-- name: ListMockExams :many
SELECT * FROM mock_exams WHERE subject_id = ? ORDER BY started_at_ms DESC,id DESC LIMIT 30;

-- name: SaveMockExam :exec
UPDATE mock_exams SET status=?,answers_json=?,finished_at_ms=?,reason=?,score=?,
    current_index=? WHERE id=?;

-- name: ExamQuestionPool :many
SELECT payload_json FROM questions WHERE subject_id=? ORDER BY source_order;

-- name: CreateConversation :exec
INSERT INTO chat_conversations(id,question_id,created_at_ms,updated_at_ms)
VALUES (?,?,?,?) ON CONFLICT(id) DO NOTHING;

-- name: GetConversation :one
SELECT * FROM chat_conversations WHERE id=?;

-- name: ListConversations :many
SELECT c.id,c.question_id,c.title,c.message_count,c.active_turn_id,c.updated_at_ms,
    q.subject_id,q.title AS question_title
FROM chat_conversations c JOIN questions q ON q.question_id=c.question_id
WHERE (CAST(sqlc.arg(question_id) AS INTEGER)=0 OR c.question_id=sqlc.arg(question_id))
AND (CAST(sqlc.arg(course_id) AS TEXT)='' OR EXISTS (
    SELECT 1 FROM question_keys k WHERE k.question_id=c.question_id
        AND k.course_id=sqlc.arg(course_id)))
AND (CAST(sqlc.arg(before_time) AS INTEGER)=0 OR c.updated_at_ms<sqlc.arg(before_time)
    OR (c.updated_at_ms=sqlc.arg(before_time) AND c.id<sqlc.arg(before_id)))
ORDER BY c.updated_at_ms DESC,c.id DESC LIMIT 51;

-- name: SaveConversation :execrows
UPDATE chat_conversations SET title=?,messages_json=?,message_count=?,
    active_turn_id=?,updated_at_ms=?,revision=revision+1 WHERE id=? AND revision=?;

-- name: ListActiveConversations :many
SELECT * FROM chat_conversations WHERE active_turn_id<>'';

-- name: ConversationCoverage :many
SELECT c.question_id, COUNT(*) AS conversation_count
FROM chat_conversations c JOIN questions q ON q.question_id=c.question_id
WHERE q.subject_id=? AND c.message_count>0
GROUP BY c.question_id ORDER BY c.question_id;

-- name: ListReviewAnswers :many
SELECT a.question_id, a.answered_at_ms,
    CAST(CASE WHEN a.is_correct=1 THEN 'correct'
        WHEN e.id IS NOT NULL THEN 'exam_wrong' ELSE 'practice_wrong' END AS TEXT) AS kind
FROM answer_attempts a
LEFT JOIN mock_exams e ON substr(a.presentation_id, 1, 5)='exam-'
    AND substr(a.presentation_id, 6, 36)=e.id AND e.status='finished'
WHERE a.subject_id=? ORDER BY a.answered_at_ms, a.id;

-- name: ListReviewHelp :many
SELECT c.question_id, CAST(json_extract(m.value, '$.created_at_ms') AS INTEGER) AS asked_at_ms
FROM chat_conversations c JOIN questions q ON q.question_id=c.question_id
JOIN json_each(c.messages_json) m
WHERE q.subject_id=? AND c.message_count>0 AND json_extract(m.value, '$.role')='user'
    AND CAST(json_extract(m.value, '$.created_at_ms') AS INTEGER)>0;

-- name: InsertCourseVersion :execrows
INSERT INTO course_versions(course_id,version,digest,manifest_json)
VALUES (?,?,?,?) ON CONFLICT(course_id,version) DO NOTHING;

-- name: GetCourseVersion :one
SELECT * FROM course_versions WHERE course_id=? AND version=?;

-- name: ActivateCourseVersion :exec
INSERT INTO active_courses(course_id,version) VALUES (?,?)
ON CONFLICT(course_id) DO UPDATE SET version=excluded.version;

-- name: GetActiveCourse :one
SELECT cv.* FROM course_versions cv
JOIN active_courses ac USING(course_id,version) WHERE cv.course_id=?;

-- name: ListActiveCourses :many
SELECT cv.* FROM course_versions cv JOIN active_courses ac USING(course_id,version)
ORDER BY cv.course_id;

-- name: InsertCourseItem :exec
INSERT INTO course_items(course_id,version,item_id,unit_id,position,payload_json,legacy_question_id)
VALUES (?,?,?,?,?,?,?);

-- name: InsertCourseLesson :exec
INSERT INTO course_lessons(course_id,version,unit_id,lesson_id,markdown) VALUES (?,?,?,?,?);

-- name: InsertCourseAsset :exec
INSERT INTO course_assets(course_id,version,path,content) VALUES (?,?,?,?);

-- name: GetCourseAsset :one
SELECT content FROM course_assets WHERE course_id=? AND version=? AND path=?;

-- name: ListCourseItems :many
SELECT * FROM course_items WHERE course_id=? AND version=? AND unit_id=? ORDER BY position;

-- name: GetCourseItem :one
SELECT * FROM course_items WHERE course_id=? AND version=? AND item_id=?;

-- name: GetCourseLesson :one
SELECT markdown FROM course_lessons WHERE course_id=? AND version=? AND unit_id=? AND lesson_id=?;

-- name: GetWorkspaceUnit :one
SELECT * FROM course_units WHERE id=? AND active=1;

-- name: ListWorkspaceUnits :many
SELECT * FROM course_units WHERE course_id=? AND active=1 ORDER BY id;

-- name: GetWorkspaceQuestionID :one
SELECT question_id FROM question_keys WHERE course_id=? AND item_id=?;

-- name: SetPresentationSnapshot :exec
INSERT INTO practice_question_snapshots(presentation_id,question_json) VALUES (?,?)
ON CONFLICT(presentation_id) DO NOTHING;

-- name: GetPresentationSnapshot :one
SELECT question_json FROM practice_question_snapshots WHERE presentation_id=?;

-- name: ListConceptMarks :many
SELECT concept_id FROM concept_marks WHERE course_id = ? ORDER BY concept_id;

-- name: MarkConceptKnown :exec
INSERT INTO concept_marks(course_id, concept_id, marked_at_ms) VALUES (?, ?, ?)
ON CONFLICT(course_id, concept_id) DO NOTHING;

-- name: ClearConceptKnown :exec
DELETE FROM concept_marks WHERE course_id = ? AND concept_id = ?;

-- name: GetActiveLearningPath :one
SELECT * FROM learning_paths WHERE course_id = ? AND archived_at_ms IS NULL;

-- name: ArchiveLearningPath :exec
UPDATE learning_paths SET archived_at_ms = ? WHERE course_id = ? AND archived_at_ms IS NULL;

-- name: InsertLearningPath :one
INSERT INTO learning_paths(course_id, course_version, graph_digest, targets_json,
    daily_minutes, steps_json, created_at_ms)
VALUES (?, ?, ?, ?, ?, ?, ?)
RETURNING *;

-- name: ListCourseMarks :many
SELECT course_id FROM course_marks ORDER BY course_id;

-- name: MarkCourseCompleted :exec
INSERT INTO course_marks(course_id, marked_at_ms) VALUES (?, ?)
ON CONFLICT(course_id) DO NOTHING;

-- name: ClearCourseCompleted :exec
DELETE FROM course_marks WHERE course_id = ?;

-- name: GetActiveCourseRoadmap :one
SELECT * FROM course_roadmaps WHERE archived_at_ms IS NULL;

-- name: ArchiveCourseRoadmap :exec
UPDATE course_roadmaps SET archived_at_ms = ? WHERE archived_at_ms IS NULL;

-- name: InsertCourseRoadmap :one
INSERT INTO course_roadmaps(relation_digest, targets_json, steps_json, created_at_ms)
VALUES (?, ?, ?, ?)
RETURNING *;
