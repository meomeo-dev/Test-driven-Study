package course

import (
	"fmt"
	"slices"
	"strings"
)

// validateRoadmap checks the relations a package declares to other courses.
// Schemas bound sizes, slugs and strengths. A course ID that is not installed
// is valid because packages are installed independently; the roadmap reports
// such a course as missing.
func validateRoadmap(manifest Manifest) error {
	roadmap := manifest.Roadmap
	if roadmap == nil {
		return nil
	}
	groups := roadmapGroups(*roadmap)
	for index, group := range groups {
		if slices.Contains(group, manifest.ID) {
			return fmt.Errorf("roadmap: prerequisite group %d names the course itself", index+1)
		}
	}
	if outer, inner, found := containingGroup(groups); found {
		return fmt.Errorf("roadmap: prerequisite group %d contains group %d", outer+1, inner+1)
	}
	for _, id := range roadmap.ParallelWith {
		if id == manifest.ID {
			return fmt.Errorf("roadmap: parallel_with names the course itself")
		}
		for index, group := range groups {
			if slices.Contains(group, id) {
				return fmt.Errorf("roadmap: course %q is both parallel and in prerequisite group %d",
					id, index+1)
			}
		}
	}
	return nil
}

func roadmapGroups(roadmap Roadmap) [][]string {
	groups := make([][]string, 0, len(roadmap.Prerequisites))
	for _, group := range roadmap.Prerequisites {
		groups = append(groups, group.AllOf)
	}
	return groups
}

// CheckRoadmapCycles rejects a candidate version whose prerequisites form a
// cycle with the other active courses. The candidate replaces the active
// version of the same course. Prerequisites that name no active course and
// parallel relations do not take part. The search starts at the candidate, so
// a reported chain begins with the course being installed.
func CheckRoadmapCycles(candidate Manifest, active []Manifest) error {
	courses := []Manifest{candidate}
	for _, manifest := range active {
		if manifest.ID != candidate.ID {
			courses = append(courses, manifest)
		}
	}
	installed := make(map[string]bool, len(courses))
	order := make([]string, 0, len(courses))
	for _, manifest := range courses {
		installed[manifest.ID] = true
		order = append(order, manifest.ID)
	}
	requires := make(map[string][]string)
	for _, manifest := range courses {
		if manifest.Roadmap == nil {
			continue
		}
		for _, group := range manifest.Roadmap.Prerequisites {
			for _, member := range group.AllOf {
				if installed[member] {
					requires[manifest.ID] = append(requires[manifest.ID], member)
				}
			}
		}
	}
	if chain := findCycle(order, requires); chain != nil {
		return fmt.Errorf("course %q: roadmap prerequisite cycle %s",
			candidate.ID, strings.Join(chain, " requires "))
	}
	return nil
}
