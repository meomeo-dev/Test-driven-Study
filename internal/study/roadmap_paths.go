package study

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"slices"
	"time"

	"test-driven-study/internal/storage/storedb"
)

type RoadmapPathRequest struct {
	Targets []string `json:"targets"`
}

type RoadmapStep struct {
	CourseID string   `json:"course_id"`
	Title    string   `json:"title"`
	Group    []string `json:"group"`
	// Strength labels the chosen group; it is empty when the course has none.
	Strength         string `json:"strength,omitempty"`
	State            string `json:"state"`
	Done             bool   `json:"done"`
	PrerequisitesMet bool   `json:"prerequisites_met"`
	Missing          bool   `json:"missing"`
}

// RoadmapPath is the saved route across courses joined with live states.
type RoadmapPath struct {
	ID              int64         `json:"id"`
	Targets         []string      `json:"targets"`
	CreatedAtMS     int64         `json:"created_at_ms"`
	Steps           []RoadmapStep `json:"steps"`
	CompletedSteps  int           `json:"completed_steps"`
	RemainingSteps  int           `json:"remaining_steps"`
	NextCourse      string        `json:"next_course,omitempty"`
	Completed       bool          `json:"completed"`
	Stale           bool          `json:"stale"`
	ReplanSuggested bool          `json:"replan_suggested"`
}

type RoadmapPathView struct {
	Path *RoadmapPath `json:"path"`
}

// savedRoadmapStep is the creation-time snapshot stored in steps_json.
type savedRoadmapStep struct {
	CourseID string   `json:"course_id"`
	Title    string   `json:"title"`
	Group    []string `json:"group"`
	Strength string   `json:"strength,omitempty"`
}

func (s *Service) RoadmapPath(ctx context.Context) (RoadmapPathView, error) {
	loaded, err := s.loadRoadmap(ctx, s.queries)
	if err != nil {
		return RoadmapPathView{}, err
	}
	row, err := s.queries.GetActiveCourseRoadmap(ctx)
	if errors.Is(err, sql.ErrNoRows) {
		return RoadmapPathView{}, nil
	}
	if err != nil {
		return RoadmapPathView{}, err
	}
	path, err := loaded.pathView(row)
	return RoadmapPathView{Path: &path}, err
}

// CreateRoadmapPath plans from the current completion and replaces the active
// route in one transaction; the previous route is archived, not deleted.
func (s *Service) CreateRoadmapPath(
	ctx context.Context, request RoadmapPathRequest,
) (RoadmapPath, error) {
	if err := validateRoadmapRequest(request); err != nil {
		return RoadmapPath{}, err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return RoadmapPath{}, err
	}
	defer tx.Rollback()
	q := s.queries.WithTx(tx)
	loaded, err := s.loadRoadmap(ctx, q)
	if err != nil {
		return RoadmapPath{}, err
	}
	row, err := loaded.insertPath(ctx, q, request)
	if err != nil {
		return RoadmapPath{}, err
	}
	if err := tx.Commit(); err != nil {
		return RoadmapPath{}, err
	}
	return loaded.pathView(row)
}

func validateRoadmapRequest(request RoadmapPathRequest) error {
	if len(request.Targets) > maxPathTargets {
		return invalid("学习目标最多选择 16 门课程")
	}
	seen := make(map[string]bool)
	for _, target := range request.Targets {
		if seen[target] {
			return invalid("学习目标包含重复的课程")
		}
		seen[target] = true
	}
	return nil
}

func (g roadmapGraph) insertPath(ctx context.Context, q *storedb.Queries,
	request RoadmapPathRequest) (storedb.CourseRoadmap, error) {
	targets := slices.Clone(request.Targets)
	if targets == nil {
		targets = []string{}
	}
	for _, target := range targets {
		if _, exists := g.course(target); !exists {
			return storedb.CourseRoadmap{}, notFound("课程不存在")
		}
	}
	steps, err := g.plan(targets)
	if err != nil {
		return storedb.CourseRoadmap{}, err
	}
	stepsJSON, err := json.Marshal(steps)
	if err != nil {
		return storedb.CourseRoadmap{}, err
	}
	targetsJSON, err := json.Marshal(targets)
	if err != nil {
		return storedb.CourseRoadmap{}, err
	}
	digest, err := g.digest()
	if err != nil {
		return storedb.CourseRoadmap{}, err
	}
	now := time.Now().UTC().UnixMilli()
	err = q.ArchiveCourseRoadmap(ctx, sql.NullInt64{Int64: now, Valid: true})
	if err != nil {
		return storedb.CourseRoadmap{}, err
	}
	return q.InsertCourseRoadmap(ctx, storedb.InsertCourseRoadmapParams{
		RelationDigest: digest, TargetsJson: string(targetsJSON),
		StepsJson: string(stepsJSON), CreatedAtMs: now,
	})
}

// plan returns snapshot steps for the targets from the current completion.
func (g roadmapGraph) plan(targets []string) ([]savedRoadmapStep, error) {
	nodes, satisfied := g.planInput()
	steps, err := PlanPath(nodes, satisfied, targets)
	if err != nil {
		return nil, err
	}
	saved := make([]savedRoadmapStep, 0, len(steps))
	for _, step := range steps {
		status, _ := g.course(step.ConceptID)
		group := step.Group
		if group == nil {
			group = []string{}
		}
		saved = append(saved, savedRoadmapStep{CourseID: step.ConceptID, Title: status.Title,
			Group: group, Strength: g.strength(step.ConceptID, step.Group)})
	}
	return saved, nil
}

// pathView joins saved steps with live course states. Steps whose course is
// no longer installed are marked missing and excluded from progress.
func (g roadmapGraph) pathView(row storedb.CourseRoadmap) (RoadmapPath, error) {
	var saved []savedRoadmapStep
	var targets []string
	if err := json.Unmarshal([]byte(row.StepsJson), &saved); err != nil {
		return RoadmapPath{}, err
	}
	if err := json.Unmarshal([]byte(row.TargetsJson), &targets); err != nil {
		return RoadmapPath{}, err
	}
	path := RoadmapPath{ID: row.ID, Targets: targets, CreatedAtMS: row.CreatedAtMs,
		Steps: make([]RoadmapStep, 0, len(saved))}
	remaining := make(map[string]bool)
	for _, step := range saved {
		live := RoadmapStep{CourseID: step.CourseID, Title: step.Title, Group: step.Group,
			Strength: step.Strength, State: "missing", Missing: true}
		if status, exists := g.course(step.CourseID); exists {
			live.Title, live.State, live.Missing = status.Title, status.State, false
			live.Done, live.PrerequisitesMet = status.Completed, status.PrerequisitesMet
		}
		path.Steps = append(path.Steps, live)
		switch {
		case live.Missing:
		case live.Done:
			path.CompletedSteps++
		default:
			path.RemainingSteps++
			remaining[live.CourseID] = true
			if path.NextCourse == "" && live.PrerequisitesMet {
				path.NextCourse = live.CourseID
			}
		}
	}
	path.Completed = path.RemainingSteps == 0
	digest, err := g.digest()
	if err != nil {
		return RoadmapPath{}, err
	}
	path.Stale = digest != row.RelationDigest
	path.ReplanSuggested, err = g.replanSuggested(targets, remaining)
	return path, err
}

// replanSuggested compares the remaining steps with a fresh plan for the same
// goal. A removed target already makes the route stale, so it skips the check.
func (g roadmapGraph) replanSuggested(targets []string, remaining map[string]bool) (bool, error) {
	for _, target := range targets {
		if _, exists := g.course(target); !exists {
			return false, nil
		}
	}
	fresh, err := g.plan(targets)
	if err != nil {
		return false, err
	}
	if len(fresh) != len(remaining) {
		return true, nil
	}
	for _, step := range fresh {
		if !remaining[step.CourseID] {
			return true, nil
		}
	}
	return false, nil
}
