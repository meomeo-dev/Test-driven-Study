---
id: 0049
type: feat
status: closed
closed-by: f013804fd3726bffa3b5fa9c8ab5922d56f65804
labels: []
branch: feat/0049-build-four-30-hour-sample-courses
created: 2026-11-13
---
# Build four 30-hour sample courses

## 背景 / 目标

The concept graph (#47) and the cross-course roadmap (#48) need complete
packages to exercise them. Beginner English 1.1.0 has 16 concepts and about
5.5 study hours; the roadmap triple circuit-fundamentals and c-programming →
embedded-mcu (a required AND relation) has one sample unit per course and no
concepts. Build these four packages into concise sample courses of about
30 study hours each.

## 关键功能清单（Key Feature List，KFL）

- Beginner English 1.2.0: re-estimated concept minutes and four added units
  (daily routine, describing parts, safety and problem reports, shift reports).
- circuit-fundamentals 1.1.0, c-programming 1.1.0 and embedded-mcu 1.1.0:
  seven units each with a concept graph, unit lessons and tagged items.
- Each course: concept minutes summing to about 1,800, roughly five items per
  graded concept, and at least one self-check lab concept without items.
- The existing sample item IDs remain and are tagged to suitable concepts.
- READMEs describe the content scale; embedded-mcu keeps its README-backed
  roadmap note and relation.

## 改造面

Course packages under `courses/beginner-english/`, `courses/circuit-fundamentals/`,
`courses/c-programming/` and `courses/embedded-mcu/`, the README feature summary
and the handoff. Roadmap tests that marked these packages as completed now
complete them through concept marks. No application code changes.

## 非目标

New item types, audio or image assets for the technical courses, course
relations beyond the README-backed set, concept relations across courses and
automatic upgrade of bundled courses in existing learner databases.

## 验收标准（Acceptance Criteria，AC）

- `npm run course:check` passes for the four packages; each reports concept and
  item counts with no sparse graded concept.
- Concept minutes per course sum to 1,700–1,900, with 25–35 concepts per course.
- Every item has a correct answer key and an explanation consistent with it;
  numeric and code-output items are checked independently.
- The bundled roadmap test still matches the README evidence, and the existing
  sample item IDs still load.
- `npm run check` passes.

## 讨论

Drafts of item text may be produced with an external model from course content
only; every draft is reviewed and corrected before it is committed.
