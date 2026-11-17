package palace

import (
	"context"
	"strconv"
	"strings"

	"test-driven-study/internal/storage/storedb"
)

type Task struct {
	CanRetryImage bool     `json:"can_retry_image"`
	ID            string   `json:"id"`
	QuestionID    int64    `json:"question_id"`
	SubjectID     int64    `json:"subject_id"`
	Title         string   `json:"title"`
	Status        string   `json:"status"`
	Stage         string   `json:"stage"`
	Model         string   `json:"model"`
	CreatedAtMS   int64    `json:"created_at_ms"`
	UpdatedAtMS   int64    `json:"updated_at_ms"`
	Error         *Failure `json:"error,omitempty"`
}

type TaskPage struct {
	Tasks      []Task `json:"tasks"`
	NextCursor string `json:"next_cursor"`
}

type TaskEvent struct {
	ID          int64  `json:"id"`
	Kind        string `json:"kind"`
	FromState   string `json:"from_state"`
	ToState     string `json:"to_state"`
	CreatedAtMS int64  `json:"created_at_ms"`
}

func (s *Service) Tasks(ctx context.Context, scope, before string) (TaskPage, error) {
	return s.CourseTasks(ctx, "", scope, before)
}

func (s *Service) CourseTasks(ctx context.Context, courseID, scope, before string) (TaskPage, error) {
	if scope == "" {
		scope = "active"
	}
	if scope != "active" && scope != "all" {
		return TaskPage{}, ErrInvalid
	}
	var timestamp int64
	var id string
	if before != "" {
		parts := strings.Split(before, ":")
		if len(parts) != 2 || !eventID.MatchString(parts[1]) {
			return TaskPage{}, ErrInvalid
		}
		var err error
		timestamp, err = strconv.ParseInt(parts[0], 10, 64)
		if err != nil || timestamp <= 0 {
			return TaskPage{}, ErrInvalid
		}
		id = parts[1]
	}
	rows, err := s.queries.ListPalaceTasks(ctx, storedb.ListPalaceTasksParams{
		Scope: scope, BeforeTime: timestamp, BeforeID: id, CourseID: courseID})
	if err != nil {
		return TaskPage{}, err
	}
	page := TaskPage{Tasks: []Task{}}
	if len(rows) > 50 {
		last := rows[49]
		page.NextCursor = strconv.FormatInt(last.CreatedAtMs, 10) + ":" + last.ID
		rows = rows[:50]
	}
	for _, row := range rows {
		job, err := jobValue(row)
		if err != nil {
			return TaskPage{}, err
		}
		stage := "generating"
		if job.Snapshot.Pipeline != nil {
			stage = job.Snapshot.Pipeline.Stage
		}
		page.Tasks = append(page.Tasks, Task{ID: job.ID, QuestionID: job.QuestionID,
			SubjectID: job.SubjectID, Title: job.Snapshot.Question.Title, Status: job.Status,
			Stage: stage, Model: job.Snapshot.Settings.Model, CreatedAtMS: job.CreatedAtMS,
			UpdatedAtMS: job.UpdatedAtMS, Error: job.Error, CanRetryImage: job.CanRetryImage})
	}
	return page, nil
}

func (s *Service) Events(ctx context.Context, id string) ([]TaskEvent, error) {
	if _, err := s.Get(ctx, id); err != nil {
		return nil, err
	}
	rows, err := s.queries.ListPalaceJobEvents(ctx, id)
	if err != nil {
		return nil, err
	}
	events := make([]TaskEvent, 0, len(rows))
	for _, row := range rows {
		events = append(events, TaskEvent{ID: row.ID, Kind: row.Kind,
			FromState: row.FromState, ToState: row.ToState, CreatedAtMS: row.CreatedAtMs})
	}
	return events, nil
}
