---
id: 0071
type: feat
status: open
labels: [course, learning-path]
branch: feat/0071-demonstrate-learning-paths-in-the-golden-course-template
created: 2026-11-19
---
# Demonstrate learning paths in the golden course template

## 背景 / 目标

The v2 golden course template demonstrates all nine question types, but its
manifest has no concepts. The sidebar therefore omits the learning path entry.
Provide an installable package that also demonstrates how authors declare
lessons, prerequisites, practice evidence, and self-checks.

## 关键功能清单（Key Feature List，KFL）

- Declare a five-concept workplace handover graph in the existing showcase unit,
  covering prerequisites that require all members or any one of two groups.
- Reuse the fifteen sample questions as practice evidence. Include a self-check
  concept with a lesson and no graded items.
- Release and activate `golden-course-template@1.1.0` and document the example.

## 改造面

The template manifest, question metadata, lesson, authoring documentation, and
the browser learning path suite.

## 非目标

Learning planner rules, sidebar gating, question text, answers, and audio.

## 验收标准（Acceptance Criteria，AC）

- Course validation reports five concepts and fifteen tagged items. The existing
  unit and item IDs are stable.
- The golden template sidebar opens both learning path and graph views. A chosen
  concept generates a path that links to its tagged questions.
- The graph shows an alternative prerequisite and a manual self-check.
- The running local catalog reports the new template version and its five
  concepts after installing the verified package.

## 讨论

The existing learning path is enabled by course data. The template uses the
same manifest and item fields as ordinary v2 courses.
