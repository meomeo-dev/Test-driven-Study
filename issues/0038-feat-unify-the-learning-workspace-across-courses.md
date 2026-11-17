---
id: 0038
type: feat
status: closed
closed-by: fc18bea7cdf79c22eecec26f689db41e9742f0cd
labels: []
branch: feat/0038-unify-the-learning-workspace-across-courses
created: 2026-11-11
---
# Unify the learning workspace across courses

## 背景 / 目标

All courses should inherit the full existing study experience. Basic Math currently uses a separate, reduced workflow.

## 关键功能清单（Key Feature List，KFL）

- One shared workspace and application API.
- Course-scoped question identities, grading, learner history, and assets.
- Shared exam, guide, tutor, palace, and task management.

## 改造面

See the [saved design](../docs/features/course-platform/shared-learning-workspace.md) and [execution plan](../plans/20261111_shared-learning-workspace_execution-plan.yaml).

## 非目标

A visual redesign, additional question formats, or a new deployment architecture.

## 验收标准（Acceptance Criteria，AC）

- Both bundled courses and a third question-only package use the same feature routes and controls.
- Historical grades, deadlines, conversation references, and durable jobs retain their meaning.
- Two courses with overlapping source IDs keep independent data.

## 讨论

Use the existing full application as the implementation baseline and retain legacy bookmarks during the migration.
