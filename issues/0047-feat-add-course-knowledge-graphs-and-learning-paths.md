---
id: 0047
type: feat
status: closed
closed-by: 26885eb83eb155004c636e2e209b62e324b6efbe
labels: []
branch: feat/0047-add-course-knowledge-graphs-and-learning-paths
created: 2026-11-13
---
# Add course knowledge graphs and learning paths

## 背景 / 目标

Courses provide units, lessons and graded items, but the application has no
model of what a learner must know before a topic or which topic to study next.
Add versioned concept graphs to course packages and saved learning paths
generated from the graph, the learner's practice evidence and a goal.
Beginner English is the reference course.

## 关键功能清单（Key Feature List，KFL）

- Concepts with AND/OR prerequisite groups and item tags in protocol v1,
  validated as an acyclic graph.
- Concept states from practice evidence and known marks that evidence can
  override.
- A deterministic planner that skips satisfied concepts and chooses
  alternatives.
- Saved learning paths with live progress and stale, replan and completed
  states.
- A learning page with path and graph views, and a practice concept filter.
- Beginner English 1.1.0 with four units, sixteen concepts and at least sixty
  items.

## 改造面

Course protocol and loader, study service, storage migration, HTTP contract,
workspace sidebar, learning page, practice filtering, a browser fixture course
and the Beginner English package.
Design: [docs/features/learning-path/README.md](../docs/features/learning-path/README.md).

## 非目标

A cross-course roadmap, accounts, probabilistic knowledge tracing, calendar or
constraint scheduling, in-app graph editing, AI-generated paths, a graph
database, new graded item types and speech assessment.

## 验收标准（Acceptance Criteria，AC）

- Untouched packages, including Yunnan driving, keep their digests and
  behavior; concept tags never appear in learner-facing question JSON.
- Validation rejects unknown, self, duplicate and cyclic prerequisites and
  cross-unit item tags with a message naming the concept.
- Planner and state tests cover AND groups, alternatives, satisfied concepts,
  targets, redundant alternatives, deterministic order, the mastery outcome
  table and overridden marks.
- Paths persist across restart, replanning archives the previous path, and a
  concept graph change marks it stale.
- HTTP tests cover not-found messages, request limits and the concept filter.
- A browser spec verifies the learning page and practice filter on an isolated
  fixture course.
- Beginner English 1.1.0 passes validation, preserves its four item IDs and
  includes an alternative prerequisite group.
- `npm run check` passes.

## 讨论

The package owns the concept graph and the learner database owns the path.
The planner chooses one group per concept by closure size, then minutes, then
author order; this is deterministic and documented as a heuristic. Course
README prerequisites are advisory prose, so a cross-course roadmap needs a
separate evidence review and issue.

Concept graphs, learner states, saved paths, the HTTP contract, the learning
page and Beginner English 1.1.0 (16 concepts, 79 items) are implemented.
`npm run check` passed with 120 browser cases, and an isolated server rendered
the Beginner English graph and path.
