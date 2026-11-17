package study

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"slices"
	"time"

	"test-driven-study/internal/course"
	"test-driven-study/internal/storage/storedb"
)

// Mastery policy. Packages describe content; the application decides how
// evidence becomes mastery: at least min(3, items) tagged items answered
// correctly, and correct latest answers at least 3/4 of attempted items.
const (
	conceptRequiredCorrect = 3
	masteryNumerator       = 3
	masteryDenominator     = 4
)

const (
	ConceptMastered = "mastered"
	ConceptKnown    = "known"
	ConceptLearning = "learning"
	ConceptReady    = "ready"
	ConceptLocked   = "locked"
)

var ErrNotFound = errors.New("study resource not found")

// UserError carries a learner-facing message for a missing or invalid request.
type UserError struct {
	Kind    error
	Message string
}

func (e *UserError) Error() string { return e.Message }
func (e *UserError) Unwrap() error { return e.Kind }

func notFound(message string) error { return &UserError{Kind: ErrNotFound, Message: message} }
func invalid(message string) error  { return &UserError{Kind: ErrInvalid, Message: message} }

type ConceptGraph struct {
	CourseID string          `json:"course_id"`
	Version  string          `json:"version"`
	Units    []ConceptUnit   `json:"units"`
	Concepts []ConceptStatus `json:"concepts"`
}

type ConceptUnit struct {
	ID        string `json:"id"`
	Title     string `json:"title"`
	SubjectID int64  `json:"subject_id"`
}

type ConceptStatus struct {
	ID               string     `json:"id"`
	Title            string     `json:"title"`
	Summary          string     `json:"summary,omitempty"`
	UnitID           string     `json:"unit_id"`
	SubjectID        int64      `json:"subject_id"`
	Lesson           string     `json:"lesson,omitempty"`
	EstimatedMinutes int        `json:"estimated_minutes"`
	Prerequisites    [][]string `json:"prerequisites"`
	ItemCount        int        `json:"item_count"`
	Attempted        int        `json:"attempted"`
	Correct          int        `json:"correct"`
	RequiredCorrect  int        `json:"required_correct"`
	// Known reports the learner's mark even when wrong answers override it.
	Known    bool   `json:"known"`
	Unlocked bool   `json:"unlocked"`
	State    string `json:"state"`
}

// conceptEvidence counts a concept's tagged items and their latest attempts.
type conceptEvidence struct{ items, attempted, correct int }

func (e conceptEvidence) requiredCorrect() int { return min(conceptRequiredCorrect, e.items) }

func (e conceptEvidence) mastered() bool {
	return e.items > 0 && e.correct >= e.requiredCorrect() &&
		masteryDenominator*e.correct >= masteryNumerator*e.attempted
}

// A wrong latest answer on any tagged item overrides a known mark.
func (e conceptEvidence) contradicted() bool { return e.attempted > e.correct }

func conceptState(e conceptEvidence, known, unlocked bool) string {
	switch {
	case e.mastered():
		return ConceptMastered
	case known && !e.contradicted():
		return ConceptKnown
	case e.attempted > 0:
		return ConceptLearning
	case unlocked:
		return ConceptReady
	}
	return ConceptLocked
}

func conceptSatisfied(state string) bool {
	return state == ConceptMastered || state == ConceptKnown
}

// courseGraph is the active course version's concept graph with live states.
type courseGraph struct {
	version storedb.CourseVersion
	units   []course.Unit
	graph   ConceptGraph
	// items maps each concept to its tagged item IDs in author order.
	items map[string][]string
}

func (s *Service) Concepts(ctx context.Context, courseID string) (ConceptGraph, error) {
	loaded, err := loadCourseGraph(ctx, s.queries, courseID)
	return loaded.graph, err
}

// SetConceptKnown sets or clears the learner's known mark and returns the
// updated graph. Marks never change attempts.
func (s *Service) SetConceptKnown(
	ctx context.Context, courseID, conceptID string, known bool,
) (ConceptGraph, error) {
	loaded, err := loadCourseGraph(ctx, s.queries, courseID)
	if err != nil {
		return ConceptGraph{}, err
	}
	if _, exists := loaded.status(conceptID); !exists {
		return ConceptGraph{}, notFound("知识点不存在")
	}
	if known {
		err = s.queries.MarkConceptKnown(ctx, storedb.MarkConceptKnownParams{
			CourseID: courseID, ConceptID: conceptID, MarkedAtMs: time.Now().UTC().UnixMilli(),
		})
	} else {
		err = s.queries.ClearConceptKnown(ctx, storedb.ClearConceptKnownParams{
			CourseID: courseID, ConceptID: conceptID,
		})
	}
	if err != nil {
		return ConceptGraph{}, err
	}
	return s.Concepts(ctx, courseID)
}

func loadCourseGraph(ctx context.Context, q *storedb.Queries, courseID string) (courseGraph, error) {
	row, err := q.GetActiveCourse(ctx, courseID)
	if errors.Is(err, sql.ErrNoRows) {
		return courseGraph{}, notFound("课程不存在")
	}
	if err != nil {
		return courseGraph{}, err
	}
	var manifest course.Manifest
	if err := json.Unmarshal([]byte(row.ManifestJson), &manifest); err != nil {
		return courseGraph{}, err
	}
	units, err := q.ListWorkspaceUnits(ctx, courseID)
	if err != nil {
		return courseGraph{}, err
	}
	subjects := make(map[string]int64, len(units))
	for _, unit := range units {
		subjects[unit.UnitID] = unit.ID
	}
	loaded := courseGraph{version: row, units: manifest.Units, items: map[string][]string{},
		graph: ConceptGraph{CourseID: row.CourseID, Version: row.Version,
			Units: []ConceptUnit{}, Concepts: []ConceptStatus{}}}
	evidence := make(map[string]*conceptEvidence)
	for _, unit := range manifest.Units {
		loaded.graph.Units = append(loaded.graph.Units, ConceptUnit{
			ID: unit.ID, Title: unit.Title, SubjectID: subjects[unit.ID]})
		if len(unit.Concepts) > 0 && unit.QuestionFile != "" {
			err = loaded.collectEvidence(ctx, q, unit.ID, subjects[unit.ID], evidence)
			if err != nil {
				return courseGraph{}, err
			}
		}
	}
	marks, err := q.ListConceptMarks(ctx, courseID)
	if err != nil {
		return courseGraph{}, err
	}
	loaded.buildStatuses(subjects, evidence, marks)
	return loaded, nil
}

// collectEvidence reads the unit's tagged items in the active version and the
// latest recorded attempt of each, from practice or a finalized mock exam.
func (g *courseGraph) collectEvidence(ctx context.Context, q *storedb.Queries,
	unitID string, subject int64, evidence map[string]*conceptEvidence) error {
	items, err := q.ListCourseItems(ctx, storedb.ListCourseItemsParams{
		CourseID: g.version.CourseID, Version: g.version.Version, UnitID: unitID,
	})
	if err != nil {
		return err
	}
	tagsByItem := make(map[string][]string)
	for _, item := range items {
		var authored struct {
			Concepts []string `json:"concepts"`
		}
		if err := json.Unmarshal([]byte(item.PayloadJson), &authored); err != nil {
			return err
		}
		tagsByItem[item.ItemID] = authored.Concepts
		for _, tag := range authored.Concepts {
			g.items[tag] = append(g.items[tag], item.ItemID)
			counts(evidence, tag).items++
		}
	}
	rows, err := q.ListPracticeQuestions(ctx, storedb.ListPracticeQuestionsParams{
		SubjectID: subject, ChapterID: -1, State: "all",
	})
	if err != nil {
		return err
	}
	for _, row := range rows {
		for _, tag := range tagsByItem[row.SourceItemID] {
			if row.State != "unanswered" {
				counts(evidence, tag).attempted++
			}
			if row.State == "correct" {
				counts(evidence, tag).correct++
			}
		}
	}
	return nil
}

func counts(evidence map[string]*conceptEvidence, id string) *conceptEvidence {
	if evidence[id] == nil {
		evidence[id] = &conceptEvidence{}
	}
	return evidence[id]
}

// buildStatuses decides satisfaction from each concept's own evidence and mark
// first, because unlocking depends on the prerequisites' satisfaction.
func (g *courseGraph) buildStatuses(subjects map[string]int64,
	evidence map[string]*conceptEvidence, marks []string) {
	satisfied := make(map[string]bool)
	for _, unit := range g.units {
		for _, concept := range unit.Concepts {
			e := *counts(evidence, concept.ID)
			known := slices.Contains(marks, concept.ID)
			satisfied[concept.ID] = e.mastered() || (known && !e.contradicted())
		}
	}
	for _, unit := range g.units {
		for _, concept := range unit.Concepts {
			e := *counts(evidence, concept.ID)
			known := slices.Contains(marks, concept.ID)
			groups := conceptGroups(concept)
			unlocked := groupsSatisfied(groups, satisfied)
			g.graph.Concepts = append(g.graph.Concepts, ConceptStatus{
				ID: concept.ID, Title: concept.Title, Summary: concept.Summary,
				UnitID: unit.ID, SubjectID: subjects[unit.ID], Lesson: concept.Lesson,
				EstimatedMinutes: concept.EstimatedMinutes, Prerequisites: groups,
				ItemCount: e.items, Attempted: e.attempted, Correct: e.correct,
				RequiredCorrect: e.requiredCorrect(), Known: known, Unlocked: unlocked,
				State: conceptState(e, known, unlocked),
			})
		}
	}
}

func conceptGroups(concept course.Concept) [][]string {
	groups := make([][]string, 0, len(concept.Prerequisites))
	for _, group := range concept.Prerequisites {
		groups = append(groups, slices.Clone(group.AllOf))
	}
	return groups
}

// groupsSatisfied reports whether a concept is unlocked: it has no
// prerequisites, or every member of one alternative group is satisfied.
func groupsSatisfied(groups [][]string, satisfied map[string]bool) bool {
	if len(groups) == 0 {
		return true
	}
	for _, group := range groups {
		if !slices.ContainsFunc(group, func(id string) bool { return !satisfied[id] }) {
			return true
		}
	}
	return false
}

// conceptItems returns the item IDs tagged with a concept of the subject's unit.
func (s *Service) conceptItems(ctx context.Context, subject int64, conceptID string) (map[string]bool, error) {
	unit, err := s.WorkspaceUnit(ctx, subject)
	if err != nil {
		return nil, err
	}
	loaded, err := loadCourseGraph(ctx, s.queries, unit.CourseID)
	if err != nil {
		return nil, err
	}
	status, exists := loaded.status(conceptID)
	if !exists {
		return nil, notFound("知识点不存在")
	}
	if status.UnitID != unit.UnitID {
		return nil, invalid("知识点不属于当前单元")
	}
	items := make(map[string]bool)
	for _, id := range loaded.items[conceptID] {
		items[id] = true
	}
	return items, nil
}

func (g *courseGraph) status(id string) (ConceptStatus, bool) {
	index := slices.IndexFunc(g.graph.Concepts, func(c ConceptStatus) bool { return c.ID == id })
	if index < 0 {
		return ConceptStatus{}, false
	}
	return g.graph.Concepts[index], true
}

// planInput lists concepts in author order with their satisfied set.
func (g *courseGraph) planInput() ([]PlanConcept, map[string]bool) {
	concepts := make([]PlanConcept, 0, len(g.graph.Concepts))
	satisfied := make(map[string]bool)
	for _, status := range g.graph.Concepts {
		concepts = append(concepts, PlanConcept{ID: status.ID,
			Minutes: status.EstimatedMinutes, Groups: status.Prerequisites})
		satisfied[status.ID] = conceptSatisfied(status.State)
	}
	return concepts, satisfied
}

// digest hashes the planning-relevant graph: concept IDs, units, minutes,
// groups and tagged items. Lesson text and titles do not affect it.
func (g *courseGraph) digest() (string, error) {
	type canonical struct {
		ID      string     `json:"id"`
		Unit    string     `json:"unit"`
		Minutes int        `json:"minutes"`
		Groups  [][]string `json:"groups"`
		Items   []string   `json:"items"`
	}
	list := make([]canonical, 0, len(g.graph.Concepts))
	for _, status := range g.graph.Concepts {
		items := slices.Sorted(slices.Values(g.items[status.ID]))
		list = append(list, canonical{ID: status.ID, Unit: status.UnitID,
			Minutes: status.EstimatedMinutes, Groups: status.Prerequisites, Items: items})
	}
	data, err := json.Marshal(list)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:]), nil
}
