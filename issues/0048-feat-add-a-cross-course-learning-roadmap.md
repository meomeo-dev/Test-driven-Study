---
id: 0048
type: feat
status: closed
closed-by: 7ff6065b9c41cd85964ab283bde9e27c06663d63
labels: []
branch: feat/0048-add-a-cross-course-learning-roadmap
created: 2026-11-13
---
# Add a cross-course learning roadmap

## 背景 / 目标

Course packages declare concept graphs within one course, but the catalog has no
model of which installed course to study before another. Course READMEs state
some relations in their `学习起点` sections as prose of varying strength. Review
that evidence, encode only the stated course relations, and give the learner an
advisory roadmap and a saved route across courses.

## 关键功能清单（Key Feature List，KFL）

- An evidence table that classifies every `学习起点` sentence of the 16 packages
  from issue #46 as required, recommended, parallel or not a course relation.
- An optional protocol v1 `roadmap` with a quoted basis, alternative prerequisite
  groups labelled required or recommended, and parallel courses.
- Installation refuses a version whose prerequisites close a cycle among active
  courses.
- Course completion from concept states, or a learner mark for courses without
  concepts; course states that never block opening a course; missing courses
  reported as not installed.
- A saved route planned with `PlanPath`, with progress, stale, replan and
  completed states.
- A 学习路线 tab on the course catalog with the route and a course graph that
  shares the knowledge graph's dependency graph component.
- Patch versions of six packages carrying only README-backed relations.

## 改造面

Course protocol and validation, course installation, a storage migration, the
study service, the HTTP contract, the course catalog page, the learning graph
component and six course manifests.
Design: [docs/features/course-roadmap/README.md](../docs/features/course-roadmap/README.md).

## 非目标

Blocking courses by prerequisites, concept-level relations between courses,
durations and scheduling, inferred or rewritten README relations, and automatic
upgrade of bundled courses in existing databases.

## 验收标准（Acceptance Criteria，AC）

- The design records the evidence table; a test pins the bundled relations to
  the README-backed set, and untouched packages keep their digests.
- Validation rejects self references, containing groups, a course that is both
  prerequisite and parallel, an unknown strength and a missing basis.
- Installation refuses a cycle among active courses and keeps the previous
  version active.
- Go tests cover completion sources, the rejected mark on a concept course,
  readiness, missing courses, planning, route persistence, archiving, stale and
  replan states.
- HTTP tests cover not-found and invalid-request messages and the target limit.
- A browser spec verifies the 学习路线 tab on the bundled courses.
- `npm run check` passes.

## 讨论

Relations are advisory and come only from README sentences that name an
installed course as study before or alongside the course. Courses without
concepts complete by a learner mark because their four sample items do not
show completion.

The evidence review, protocol field, install-time cycle refusal, completion
marks, saved routes, HTTP contract and 学习路线 tab are implemented. Six
packages carry README-backed relations at 1.0.1. `npm run check` passed with
121 browser cases.
