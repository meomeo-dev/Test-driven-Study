package study

import "errors"

var errPlanCycle = errors.New("concept prerequisites contain a cycle")

// PlanConcept is the planner's view of one concept. Concepts are passed in
// author order (unit order, then concept order), which breaks every tie.
type PlanConcept struct {
	ID      string
	Minutes int
	// Groups are alternatives; every member of one group must be satisfied.
	Groups [][]string
}

// PlanStep is one concept to study and the prerequisite group the plan uses.
// Group is nil for a concept without prerequisites.
type PlanStep struct {
	ConceptID string
	Group     []string
}

// pathPlanner holds the graph indexed by author position. Sets of concepts are
// []bool slices indexed by that position, so iteration order is deterministic.
type pathPlanner struct {
	concepts  []PlanConcept
	index     map[string]int
	satisfied []bool
	groups    [][][]int
	choice    []int
}

// PlanPath orders the unsatisfied concepts needed to reach the targets. Empty
// targets mean every concept. Each unsatisfied concept uses one prerequisite
// group: a satisfied group if any, otherwise the group with the smallest
// closure, then fewest minutes, then author order. A pruning pass then drops
// alternatives made redundant by concepts the plan already contains.
func PlanPath(concepts []PlanConcept, satisfied map[string]bool, targets []string) ([]PlanStep, error) {
	planner, err := newPathPlanner(concepts, satisfied)
	if err != nil {
		return nil, err
	}
	order, err := planner.topologicalOrder()
	if err != nil {
		return nil, err
	}
	goal := make([]int, 0, len(targets))
	for _, id := range targets {
		position, exists := planner.index[id]
		if !exists {
			return nil, ErrInvalid
		}
		goal = append(goal, position)
	}
	if len(targets) == 0 {
		goal = order
	}
	planner.chooseGroups(order)
	planner.pruneAlternatives(order, goal)
	return planner.steps(planner.reach(goal))
}

func newPathPlanner(concepts []PlanConcept, satisfied map[string]bool) (*pathPlanner, error) {
	planner := &pathPlanner{concepts: concepts, index: make(map[string]int, len(concepts))}
	for position, concept := range concepts {
		if _, exists := planner.index[concept.ID]; exists {
			return nil, ErrInvalid
		}
		planner.index[concept.ID] = position
	}
	planner.satisfied = make([]bool, len(concepts))
	planner.groups = make([][][]int, len(concepts))
	planner.choice = make([]int, len(concepts))
	for position, concept := range concepts {
		planner.satisfied[position] = satisfied[concept.ID]
		for _, group := range concept.Groups {
			members := make([]int, 0, len(group))
			for _, id := range group {
				member, exists := planner.index[id]
				if !exists {
					return nil, ErrInvalid
				}
				members = append(members, member)
			}
			planner.groups[position] = append(planner.groups[position], members)
		}
	}
	return planner, nil
}

// topologicalOrder lists every concept after all concepts referenced by any of
// its groups. Kahn's algorithm with the lowest ready author position first.
func (p *pathPlanner) topologicalOrder() ([]int, error) {
	dependents := make([][]int, len(p.concepts))
	pending := make([]int, len(p.concepts))
	for position, groups := range p.groups {
		seen := make(map[int]bool)
		for _, group := range groups {
			for _, member := range group {
				if !seen[member] {
					seen[member] = true
					dependents[member] = append(dependents[member], position)
					pending[position]++
				}
			}
		}
	}
	return kahn(len(p.concepts), pending, dependents)
}

// kahn emits ready nodes in ascending position. Graphs are small, so a linear
// scan for the lowest ready node keeps the code simple.
func kahn(size int, pending []int, dependents [][]int) ([]int, error) {
	ready := make([]bool, size)
	for node := range size {
		ready[node] = pending[node] == 0
	}
	order := make([]int, 0, size)
	for len(order) < size {
		next := -1
		for node := range size {
			if ready[node] {
				next = node
				break
			}
		}
		if next < 0 {
			return nil, errPlanCycle
		}
		ready[next] = false
		order = append(order, next)
		for _, dependent := range dependents[next] {
			pending[dependent]--
			if pending[dependent] == 0 {
				ready[dependent] = true
			}
		}
	}
	return order, nil
}

// chooseGroups picks one group per unsatisfied concept, visiting prerequisites
// before dependents so member closures are known when a group is compared.
func (p *pathPlanner) chooseGroups(order []int) {
	closures := make([][]bool, len(p.concepts))
	for _, position := range order {
		p.choice[position] = -1
		closures[position] = make([]bool, len(p.concepts))
		if p.satisfied[position] {
			continue
		}
		closures[position][position] = true
		best, bestSize, bestMinutes := -1, 0, 0
		for index, group := range p.groups[position] {
			closure := make([]bool, len(p.concepts))
			for _, member := range group {
				union(closure, closures[member])
			}
			size, minutes := p.measure(closure)
			if best < 0 || size < bestSize || (size == bestSize && minutes < bestMinutes) {
				best, bestSize, bestMinutes = index, size, minutes
			}
		}
		p.choice[position] = best
		if best >= 0 {
			for _, member := range p.groups[position][best] {
				union(closures[position], closures[member])
			}
		}
	}
}

// pruneAlternatives switches a concept to another group whose unsatisfied
// members the plan already contains when that strictly shrinks the plan.
// Every accepted switch removes a concept, so there are at most V switches.
func (p *pathPlanner) pruneAlternatives(order, goal []int) {
	current := p.reach(goal)
	for changed := true; changed; {
		changed = false
		for _, position := range order {
			if !current[position] {
				continue
			}
			for index, group := range p.groups[position] {
				if index == p.choice[position] || !p.covered(group, current) {
					continue
				}
				previous := p.choice[position]
				p.choice[position] = index
				candidate := p.reach(goal)
				if count(candidate) < count(current) {
					current, changed = candidate, true
					break
				}
				p.choice[position] = previous
			}
		}
	}
}

func (p *pathPlanner) covered(group []int, plan []bool) bool {
	for _, member := range group {
		if !p.satisfied[member] && !plan[member] {
			return false
		}
	}
	return true
}

// reach returns the unsatisfied concepts required by the goal under the
// current group choices.
func (p *pathPlanner) reach(goal []int) []bool {
	plan := make([]bool, len(p.concepts))
	stack := append([]int(nil), goal...)
	for len(stack) > 0 {
		position := stack[len(stack)-1]
		stack = stack[:len(stack)-1]
		if p.satisfied[position] || plan[position] {
			continue
		}
		plan[position] = true
		if choice := p.choice[position]; choice >= 0 {
			stack = append(stack, p.groups[position][choice]...)
		}
	}
	return plan
}

// steps orders the planned concepts so each follows its chosen group's
// planned members, preferring author order among ready concepts.
func (p *pathPlanner) steps(plan []bool) ([]PlanStep, error) {
	positions := make([]int, 0, len(p.concepts))
	local := make(map[int]int)
	for position, included := range plan {
		if included {
			local[position] = len(positions)
			positions = append(positions, position)
		}
	}
	pending := make([]int, len(positions))
	dependents := make([][]int, len(positions))
	for node, position := range positions {
		if choice := p.choice[position]; choice >= 0 {
			for _, member := range p.groups[position][choice] {
				if source, planned := local[member]; planned {
					dependents[source] = append(dependents[source], node)
					pending[node]++
				}
			}
		}
	}
	order, err := kahn(len(positions), pending, dependents)
	if err != nil {
		return nil, err
	}
	result := make([]PlanStep, 0, len(order))
	for _, node := range order {
		position := positions[node]
		step := PlanStep{ConceptID: p.concepts[position].ID}
		if choice := p.choice[position]; choice >= 0 {
			step.Group = append([]string(nil), p.concepts[position].Groups[choice]...)
		}
		result = append(result, step)
	}
	return result, nil
}

func (p *pathPlanner) measure(closure []bool) (size, minutes int) {
	for position, included := range closure {
		if included {
			size++
			minutes += p.concepts[position].Minutes
		}
	}
	return size, minutes
}

func union(target, source []bool) {
	for position, included := range source {
		if included {
			target[position] = true
		}
	}
}

func count(set []bool) int {
	total := 0
	for _, included := range set {
		if included {
			total++
		}
	}
	return total
}
