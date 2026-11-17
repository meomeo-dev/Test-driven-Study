---
id: 0051
type: feat
status: closed
closed-by: c38652290e3fa665667d3465264b155d4510f13a
labels: []
branch: feat/0051-build-the-remaining-twelve-30-hour-sample-courses
created: 2026-11-13
---
# Build the remaining twelve 30-hour sample courses

## 背景 / 目标

Issue #49 built four complete sample courses of about 30 study hours. The other
twelve manufacturing roadmap packages from #46 still have one intro unit, four
sample items and no concepts: algebra-geometry, applied-machine-learning,
automatic-control, cad-fdm-printing, engineering-calculus, industrial-automation,
linear-algebra, machine-vision, pcb-design, probability-statistics,
python-programming and tolerances-metrology. Build each into a concise course of
about 30 hours. basic-math, starter, ielts and yunnan-driving are out of scope.

## 关键功能清单（Key Feature List，KFL）

- Each of the twelve packages becomes version 1.1.0 with six to eight units, a
  concept graph, one lesson per unit and concept-tagged items.
- Each course: 25–35 concepts whose minutes sum to about 1,800, five items per
  graded concept and at least one self-check lab concept without items.
- The four existing sample item IDs per package remain and are tagged to
  concepts in the units that hold them.
- READMEs describe the content scale; the README-backed roadmap notes and
  relations are unchanged.

## 改造面

Course packages under the twelve `courses/<id>/` directories, the README feature
summary and the handoff. Tests that mark these packages as completed move to
concept marks or to a package without concepts. No application code changes.

## 非目标

New item types, image or audio assets, concept relations across courses, new
course relations and automatic upgrade of bundled courses in existing learner
databases.

## 验收标准（Acceptance Criteria，AC）

- `npm run course:check` passes for the twelve packages with no sparse graded
  concept.
- Concept minutes per course sum to 1,700–1,900, with 25–35 concepts per course.
- Every item has a correct answer key and a consistent explanation; numeric and
  code-output items are checked independently by computation or execution.
- The bundled roadmap test still matches the README evidence, and the existing
  sample item IDs still load.
- `npm run check` passes.

## 讨论

Lesson and item drafts may be produced with an external model from course
outlines only; every draft is reviewed and corrected before it is committed.
