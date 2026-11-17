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

const (
	maxPathTargets  = 16
	minDailyMinutes = 10
	maxDailyMinutes = 480
)

type LearningPathRequest struct {
	Targets      []string `json:"targets"`
	DailyMinutes int      `json:"daily_minutes"`
}

type LearningPathStep struct {
	ConceptID        string   `json:"concept_id"`
	Title            string   `json:"title"`
	UnitID           string   `json:"unit_id"`
	SubjectID        int64    `json:"subject_id"`
	EstimatedMinutes int      `json:"estimated_minutes"`
	Group            []string `json:"group"`
	State            string   `json:"state"`
	Done             bool     `json:"done"`
	Unlocked         bool     `json:"unlocked"`
	Missing          bool     `json:"missing"`
}

// LearningPath is a saved plan joined with live concept states.
type LearningPath struct {
	ID               int64              `json:"id"`
	CourseID         string             `json:"course_id"`
	CourseVersion    string             `json:"course_version"`
	Targets          []string           `json:"targets"`
	DailyMinutes     int                `json:"daily_minutes"`
	CreatedAtMS      int64              `json:"created_at_ms"`
	Steps            []LearningPathStep `json:"steps"`
	MasteredSteps    int                `json:"mastered_steps"`
	KnownSteps       int                `json:"known_steps"`
	RemainingSteps   int                `json:"remaining_steps"`
	TotalMinutes     int                `json:"total_minutes"`
	RemainingMinutes int                `json:"remaining_minutes"`
	EstimatedDays    int                `json:"estimated_days"`
	NextConcept      string             `json:"next_concept,omitempty"`
	Completed        bool               `json:"completed"`
	Stale            bool               `json:"stale"`
	ReplanSuggested  bool               `json:"replan_suggested"`
}

type LearningPathView struct {
	Path *LearningPath `json:"path"`
}

// savedStep is the creation-time snapshot stored in steps_json.
type savedStep struct {
	ConceptID        string   `json:"concept_id"`
	Title            string   `json:"title"`
	UnitID           string   `json:"unit_id"`
	EstimatedMinutes int      `json:"estimated_minutes"`
	Group            []string `json:"group"`
}

func (s *Service) LearningPath(ctx context.Context, courseID string) (LearningPathView, error) {
	loaded, err := loadCourseGraph(ctx, s.queries, courseID)
	if err != nil {
		return LearningPathView{}, err
	}
	row, err := s.queries.GetActiveLearningPath(ctx, courseID)
	if errors.Is(err, sql.ErrNoRows) {
		return LearningPathView{}, nil
	}
	if err != nil {
		return LearningPathView{}, err
	}
	path, err := loaded.pathView(row)
	return LearningPathView{Path: &path}, err
}

// CreateLearningPath plans from the current state and replaces the active path
// in one transaction; the previous path is archived, not deleted.
func (s *Service) CreateLearningPath(
	ctx context.Context, courseID string, request LearningPathRequest,
) (LearningPath, error) {
	if err := validatePathRequest(request); err != nil {
		return LearningPath{}, err
	}
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return LearningPath{}, err
	}
	defer tx.Rollback()
	q := s.queries.WithTx(tx)
	loaded, err := loadCourseGraph(ctx, q, courseID)
	if err != nil {
		return LearningPath{}, err
	}
	row, err := loaded.insertPath(ctx, q, request)
	if err != nil {
		return LearningPath{}, err
	}
	if err := tx.Commit(); err != nil {
		return LearningPath{}, err
	}
	return loaded.pathView(row)
}

func validatePathRequest(request LearningPathRequest) error {
	if len(request.Targets) > maxPathTargets {
		return invalid("学习目标最多选择 16 个知识点")
	}
	if request.DailyMinutes < minDailyMinutes || request.DailyMinutes > maxDailyMinutes {
		return invalid("每天学习时间需在 10–480 分钟之间")
	}
	seen := make(map[string]bool)
	for _, target := range request.Targets {
		if seen[target] {
			return invalid("学习目标包含重复的知识点")
		}
		seen[target] = true
	}
	return nil
}

func (g *courseGraph) insertPath(ctx context.Context, q *storedb.Queries,
	request LearningPathRequest) (storedb.LearningPath, error) {
	if len(g.graph.Concepts) == 0 {
		return storedb.LearningPath{}, invalid("该课程尚未定义知识点")
	}
	targets := slices.Clone(request.Targets)
	if targets == nil {
		targets = []string{}
	}
	for _, target := range targets {
		if _, exists := g.status(target); !exists {
			return storedb.LearningPath{}, notFound("知识点不存在")
		}
	}
	steps, err := g.plan(targets)
	if err != nil {
		return storedb.LearningPath{}, err
	}
	stepsJSON, err := json.Marshal(steps)
	if err != nil {
		return storedb.LearningPath{}, err
	}
	targetsJSON, err := json.Marshal(targets)
	if err != nil {
		return storedb.LearningPath{}, err
	}
	digest, err := g.digest()
	if err != nil {
		return storedb.LearningPath{}, err
	}
	now := time.Now().UTC().UnixMilli()
	err = q.ArchiveLearningPath(ctx, storedb.ArchiveLearningPathParams{
		ArchivedAtMs: sql.NullInt64{Int64: now, Valid: true}, CourseID: g.version.CourseID,
	})
	if err != nil {
		return storedb.LearningPath{}, err
	}
	return q.InsertLearningPath(ctx, storedb.InsertLearningPathParams{
		CourseID: g.version.CourseID, CourseVersion: g.version.Version, GraphDigest: digest,
		TargetsJson: string(targetsJSON), DailyMinutes: int64(request.DailyMinutes),
		StepsJson: string(stepsJSON), CreatedAtMs: now,
	})
}

// plan returns snapshot steps for the targets from the current state.
func (g *courseGraph) plan(targets []string) ([]savedStep, error) {
	concepts, satisfied := g.planInput()
	steps, err := PlanPath(concepts, satisfied, targets)
	if err != nil {
		return nil, err
	}
	saved := make([]savedStep, 0, len(steps))
	for _, step := range steps {
		status, _ := g.status(step.ConceptID)
		group := step.Group
		if group == nil {
			group = []string{}
		}
		saved = append(saved, savedStep{ConceptID: step.ConceptID, Title: status.Title,
			UnitID: status.UnitID, EstimatedMinutes: status.EstimatedMinutes, Group: group})
	}
	return saved, nil
}

// pathView joins saved steps with live states. Steps whose concept left the
// active version are marked missing and excluded from progress.
func (g *courseGraph) pathView(row storedb.LearningPath) (LearningPath, error) {
	var saved []savedStep
	var targets []string
	if err := json.Unmarshal([]byte(row.StepsJson), &saved); err != nil {
		return LearningPath{}, err
	}
	if err := json.Unmarshal([]byte(row.TargetsJson), &targets); err != nil {
		return LearningPath{}, err
	}
	path := LearningPath{ID: row.ID, CourseID: row.CourseID, CourseVersion: row.CourseVersion,
		Targets: targets, DailyMinutes: int(row.DailyMinutes), CreatedAtMS: row.CreatedAtMs,
		Steps: make([]LearningPathStep, 0, len(saved))}
	remaining := make(map[string]bool)
	for _, step := range saved {
		live := g.liveStep(step)
		path.Steps = append(path.Steps, live)
		path.count(live)
		if !live.Done && !live.Missing {
			remaining[live.ConceptID] = true
		}
	}
	path.Completed = path.RemainingSteps == 0
	if path.RemainingMinutes > 0 {
		path.EstimatedDays = (path.RemainingMinutes + path.DailyMinutes - 1) / path.DailyMinutes
	}
	digest, err := g.digest()
	if err != nil {
		return LearningPath{}, err
	}
	path.Stale = digest != row.GraphDigest
	path.ReplanSuggested, err = g.replanSuggested(targets, remaining)
	return path, err
}

func (g *courseGraph) liveStep(step savedStep) LearningPathStep {
	live := LearningPathStep{ConceptID: step.ConceptID, Title: step.Title, UnitID: step.UnitID,
		EstimatedMinutes: step.EstimatedMinutes, Group: step.Group}
	status, exists := g.status(step.ConceptID)
	if !exists {
		live.State, live.Missing = "missing", true
		return live
	}
	live.Title, live.UnitID, live.SubjectID = status.Title, status.UnitID, status.SubjectID
	live.EstimatedMinutes, live.State = status.EstimatedMinutes, status.State
	live.Done, live.Unlocked = conceptSatisfied(status.State), status.Unlocked
	return live
}

func (path *LearningPath) count(step LearningPathStep) {
	if step.Missing {
		return
	}
	path.TotalMinutes += step.EstimatedMinutes
	switch {
	case step.State == ConceptMastered:
		path.MasteredSteps++
	case step.State == ConceptKnown:
		path.KnownSteps++
	default:
		path.RemainingSteps++
		path.RemainingMinutes += step.EstimatedMinutes
		if path.NextConcept == "" && step.Unlocked {
			path.NextConcept = step.ConceptID
		}
	}
}

// replanSuggested compares the remaining steps with a fresh plan for the same
// goal. Removed targets already make the path stale, so they skip the check.
func (g *courseGraph) replanSuggested(targets []string, remaining map[string]bool) (bool, error) {
	for _, target := range targets {
		if _, exists := g.status(target); !exists {
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
		if !remaining[step.ConceptID] {
			return true, nil
		}
	}
	return false, nil
}
