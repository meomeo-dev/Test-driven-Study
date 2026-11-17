-- +goose Up
CREATE TABLE task_trace_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL REFERENCES palace_jobs(id),
    span_id TEXT NOT NULL,
    parent_id TEXT NOT NULL,
    kind TEXT NOT NULL,
    label TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK(event_type IN ('start', 'delta', 'end', 'note')),
    status TEXT NOT NULL,
    origin TEXT NOT NULL,
    content TEXT NOT NULL,
    observed_at_ms INTEGER NOT NULL
);
CREATE INDEX trace_job_sequence ON task_trace_events(job_id, id);

-- +goose Down
DROP TABLE task_trace_events;
