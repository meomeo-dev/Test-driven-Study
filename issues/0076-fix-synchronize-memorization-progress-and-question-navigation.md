---
id: 0076
type: fix
status: closed
closed-by: 303865c
labels: []
branch: fix/0076-synchronize-memorization-progress-and-question-navigation
created: 2026-11-20
---
# Synchronize memorization progress and question navigation

## 背景 / 目标

Learners report inconsistent progress and question navigation when moving backward or forward and when marking a question remembered before advancing.

## 关键功能清单（Key Feature List，KFL）

- Keep the current question, its number, and navigator selection aligned across loading and state transitions.
- Keep remembered and review state consistent between the card, navigator, and subject progress.
- Keep the navigator's selection and learning status independently recognizable.

## 改造面

Memorization page, progress queries and mutations, shared question navigator, and isolated acceptance tests.

## 非目标

Changing what counts as remembered, clearing learner progress, or changing grading.

## 验收标准（Acceptance Criteria，AC）

- Previous and next keep the card and active tile aligned and do not change mastery counts.
- Remember and advance updates the marked tile and subject count consistently.
- State-filtered navigation selects the intended remaining question without showing or recording an unrelated intermediate question.
- Verify the reported behavior with isolated data and compare stored progress with displayed state.

## 讨论

The progress strip is subject-wide, while the drawer lists the current search and filter results. The selected tile must still communicate its learning status.

### Findings and verification

- The reported unit contained 45 items, one remembered and zero to review.
  A read-only check found matching counts in the overview and unfiltered list.
- The UI had separate render states for the requested question and the visible
  card, and published the post-mark overview and list at different times.
  The current tile also overrode the learning-state color.
- Type checking, 57 frontend unit tests, and 20 isolated browser cases passed.
  The three new cases cover a delayed next question, delayed overview after
  marking, and advancing within a filter without recording an intermediate
  question exposure.
