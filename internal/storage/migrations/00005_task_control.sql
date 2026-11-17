-- +goose Up
ALTER TABLE palace_jobs ADD COLUMN control_state TEXT NOT NULL DEFAULT 'run'
    CHECK(control_state IN ('run', 'pausing', 'paused'));

CREATE TABLE palace_job_events (
    id INTEGER PRIMARY KEY,
    job_id TEXT NOT NULL REFERENCES palace_jobs(id),
    kind TEXT NOT NULL,
    from_state TEXT NOT NULL,
    to_state TEXT NOT NULL,
    created_at_ms INTEGER NOT NULL
);
CREATE INDEX palace_event_job ON palace_job_events(job_id, id);
INSERT INTO palace_job_events(job_id, kind, from_state, to_state, created_at_ms)
SELECT id, 'historical_snapshot', '', status, updated_at_ms FROM palace_jobs;

-- +goose StatementBegin
CREATE TRIGGER palace_job_created AFTER INSERT ON palace_jobs BEGIN
    INSERT INTO palace_job_events(job_id, kind, from_state, to_state, created_at_ms)
    VALUES (NEW.id, 'created', '', NEW.status, NEW.created_at_ms);
END;
-- +goose StatementEnd

-- +goose StatementBegin
CREATE TRIGGER palace_job_state_changed AFTER UPDATE OF status, control_state ON palace_jobs
WHEN OLD.status <> NEW.status OR OLD.control_state <> NEW.control_state BEGIN
    INSERT INTO palace_job_events(job_id, kind, from_state, to_state, created_at_ms)
    VALUES (NEW.id, 'state_changed',
        CASE WHEN OLD.status IN ('queued', 'running') AND OLD.control_state <> 'run'
            THEN OLD.control_state ELSE OLD.status END,
        CASE WHEN NEW.status IN ('queued', 'running') AND NEW.control_state <> 'run'
            THEN NEW.control_state ELSE NEW.status END,
        NEW.updated_at_ms);
END;
-- +goose StatementEnd

-- +goose Down
DROP TRIGGER palace_job_state_changed;
DROP TRIGGER palace_job_created;
DROP TABLE palace_job_events;
ALTER TABLE palace_jobs DROP COLUMN control_state;
