package course

import (
	"fmt"
	"slices"
	"strings"
)

// minimumGradedConceptItems is the item count below which course:check warns
// that a graded concept can be mastered by very few answers.
const minimumGradedConceptItems = 3

// ConceptSummary reports the size of a package's knowledge graph for authors.
type ConceptSummary struct {
	Concepts      int
	Groups        int
	TaggedItems   int
	UntaggedItems int
	// SparseConcepts lists graded concepts with fewer than three tagged items.
	SparseConcepts []string
}

// validateConcepts checks the concept graph declared in the manifest and the
// concept tags of every item. Schemas already bound sizes and ID formats; this
// function checks references, unit membership, redundant groups and cycles.
func validateConcepts(manifest Manifest, units map[string]UnitContent) error {
	owner := make(map[string]string)
	for _, unit := range manifest.Units {
		lessons := make(map[string]bool, len(unit.Lessons))
		for _, lesson := range unit.Lessons {
			lessons[lesson.ID] = true
		}
		for _, concept := range unit.Concepts {
			if _, exists := owner[concept.ID]; exists {
				return fmt.Errorf("concept %q: duplicate ID", concept.ID)
			}
			owner[concept.ID] = unit.ID
			if concept.Lesson != "" && !lessons[concept.Lesson] {
				return fmt.Errorf("concept %q: unit %q has no lesson %q",
					concept.ID, unit.ID, concept.Lesson)
			}
		}
	}
	for _, concept := range allConcepts(manifest) {
		if err := validateGroups(concept, owner); err != nil {
			return err
		}
	}
	if err := rejectCycles(manifest); err != nil {
		return err
	}
	for _, unit := range manifest.Units {
		for _, item := range units[unit.ID].Items {
			for _, tag := range item.Concepts {
				home, exists := owner[tag]
				if !exists {
					return fmt.Errorf("item %q: unknown concept %q", item.ID, tag)
				}
				if home != unit.ID {
					return fmt.Errorf("item %q: concept %q belongs to unit %q, not %q",
						item.ID, tag, home, unit.ID)
				}
			}
		}
	}
	return nil
}

func allConcepts(manifest Manifest) []Concept {
	var result []Concept
	for _, unit := range manifest.Units {
		result = append(result, unit.Concepts...)
	}
	return result
}

// validateGroups rejects unknown or self references and a group that contains
// another group of the same concept. A containing group can never be the
// cheaper alternative, so it only adds misleading edges to the graph.
func validateGroups(concept Concept, owner map[string]string) error {
	for index, group := range concept.Prerequisites {
		for _, member := range group.AllOf {
			if member == concept.ID {
				return fmt.Errorf("concept %q: prerequisite group %d names the concept itself",
					concept.ID, index+1)
			}
			if _, exists := owner[member]; !exists {
				return fmt.Errorf("concept %q: prerequisite group %d names unknown concept %q",
					concept.ID, index+1, member)
			}
		}
	}
	groups := make([][]string, 0, len(concept.Prerequisites))
	for _, group := range concept.Prerequisites {
		groups = append(groups, group.AllOf)
	}
	if outer, inner, found := containingGroup(groups); found {
		return fmt.Errorf("concept %q: prerequisite group %d contains group %d",
			concept.ID, outer+1, inner+1)
	}
	return nil
}

// containingGroup finds the first group that contains another group of the
// same owner. Of two equal groups, the later one is reported as containing.
func containingGroup(groups [][]string) (outer, inner int, found bool) {
	for index, group := range groups {
		for other, candidate := range groups {
			if other != index && containsAll(group, candidate) &&
				(len(group) > len(candidate) || other < index) {
				return index, other, true
			}
		}
	}
	return 0, 0, false
}

func containsAll(group, subset []string) bool {
	for _, member := range subset {
		if !slices.Contains(group, member) {
			return false
		}
	}
	return true
}

// rejectCycles walks every prerequisite reference, across all alternative
// groups, in author order. A cycle is reported as a requirement chain so the
// author can see which declaration to remove.
func rejectCycles(manifest Manifest) error {
	requires := make(map[string][]string)
	var order []string
	for _, concept := range allConcepts(manifest) {
		order = append(order, concept.ID)
		for _, group := range concept.Prerequisites {
			requires[concept.ID] = append(requires[concept.ID], group.AllOf...)
		}
	}
	if chain := findCycle(order, requires); chain != nil {
		return fmt.Errorf("concept %q: prerequisite cycle %s",
			chain[0], strings.Join(chain, " requires "))
	}
	return nil
}

// findCycle runs a depth-first search from each node in order and returns the
// first cycle found as a chain that starts and ends with the same node, or nil.
func findCycle(order []string, requires map[string][]string) []string {
	const (
		unvisited = iota
		visiting
		done
	)
	state := make(map[string]int)
	var stack []string
	var visit func(string) []string
	visit = func(id string) []string {
		state[id] = visiting
		stack = append(stack, id)
		for _, next := range requires[id] {
			switch state[next] {
			case visiting:
				start := slices.Index(stack, next)
				return append(slices.Clone(stack[start:]), next)
			case unvisited:
				if chain := visit(next); chain != nil {
					return chain
				}
			}
		}
		stack = stack[:len(stack)-1]
		state[id] = done
		return nil
	}
	for _, id := range order {
		if state[id] == unvisited {
			if chain := visit(id); chain != nil {
				return chain
			}
		}
	}
	return nil
}

// ConceptSummary counts concepts, alternative groups and item tags, and lists
// graded concepts whose few items make mastery easy to reach by chance.
func (pkg Package) ConceptSummary() ConceptSummary {
	var summary ConceptSummary
	itemsPerConcept := make(map[string]int)
	for _, unit := range pkg.Manifest.Units {
		for _, item := range pkg.Units[unit.ID].Items {
			if len(item.Concepts) == 0 {
				summary.UntaggedItems++
				continue
			}
			summary.TaggedItems++
			for _, tag := range item.Concepts {
				itemsPerConcept[tag]++
			}
		}
	}
	for _, concept := range allConcepts(pkg.Manifest) {
		summary.Concepts++
		summary.Groups += len(concept.Prerequisites)
		count := itemsPerConcept[concept.ID]
		if count > 0 && count < minimumGradedConceptItems {
			summary.SparseConcepts = append(summary.SparseConcepts, concept.ID)
		}
	}
	return summary
}
