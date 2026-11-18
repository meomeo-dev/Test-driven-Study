---
id: 0056
type: feat
status: closed
closed-by: 0b96e4bc07e7ce52dc5826835a0c1a7bcf49e5c1
labels: []
branch: feat/0056-implement-v2-question-types
created: 2026-11-18
---
# Implement v2 question types

## 背景 / 目标

Implement the five extended types in the [v2 specification](../docs/features/question-types/v2-question-types-specification.md).

## 关键功能清单（Key Feature List，KFL）

- Author and import cloze, listening, reading comprehension, writing, and translation.
- Accept structured responses and return per-question credit and review.
- Support practice, memorization, and mock exams with the same authored content.

## 改造面

Course schemas, workspace projection, study services, HTTP contracts, and study UI.

## 非目标

Rewriting existing course items, migrating learner data, or using external AI for exam scores.

## 验收标准（Acceptance Criteria，AC）

- V1 courses and stored attempts remain compatible.
- All five types load and render from a v2 package.
- Active questions withhold answer keys; active exams withhold transcripts.
- Composite answers earn proportional local credit; writing and translation have local feedback.
- AI rubric feedback is requested explicitly from a submitted practice attempt.

## 讨论

Use JSON payloads and existing paper snapshots. Keep the exam score deterministic.


## Verification

- V1 and v2 package validation, versioned import and stable question/option IDs.
- Go coverage verifies validation, response normalization, scoring, attempt
  replay, review boundaries and protected listening sources.
- Chromium covers all five question types, practice AI feedback through the
  local provider fixture, and listening exam playback and recovery.
