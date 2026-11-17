---
id: 0009
type: fix
status: closed
closed-by: fba2ba6
labels: []
branch: fix/0009-advance-practice-with-enter-after-grading
created: 2026-11-01
---
# Advance practice with Enter after grading

## 背景 / 目标

Use Enter throughout the practice loop: submit the selected answer before
grading, then advance to the next question after the saved result is shown.
Implement directly on main without creating a worktree.

## 关键功能清单（Key Feature List，KFL）

- Dispatch Enter according to the current practice session state.
- Show the post-answer Enter binding beside the next-question action and in help.
- Preserve pending-submit, key-repeat, editing, dialog, and native-button guards.
- Keep the final question visible when no next question exists.

## 改造面

Practice session commands, shortcut dispatch, question footer/help, existing
browser acceptance tests, and practice interaction documentation.

## 非目标

Grading, persistence schema, analytics, memorization shortcuts, dependencies,
automatic advance immediately after grading, and worktrees.

## 验收标准（Acceptance Criteria，AC）

- AC1: One Enter saves one selected answer and reveals its feedback.
- AC2: A subsequent Enter advances once, without adding an attempt.
- AC3: A pending request or held Enter does not skip feedback or duplicate saves.
- AC4: Input/dialog focus and unrelated native button actions remain protected.
- AC5: The last question does not wrap or create an extra attempt.
- AC6: Existing practice and memorization checks pass using isolated test data.

## 讨论

The change extends the existing copied practice implementation. Server grading
and immutable attempts stay unchanged. The keyboard command confirms the
current action, while explicitly clicking Submit still only submits an answer.

Regression coverage includes a deliberately paused save, held-key events,
focused Submit/Next controls, input/dialog protection, native Retry activation,
and the final question. All test attempts use the isolated acceptance database.

Acceptance: all 27 browser flows pass, including both new Enter regressions.
Frontend unit tests, Go tests, generated bindings, startup checks, and strict
production builds also pass. The live service remains on the primary checkout.
