---
id: 0014
type: fix
status: closed
closed-by: 2f5393e
labels: []
branch: fix/0014-keep-next-action-at-practice-submit-position
created: 2026-11-01
---
# Keep next action at practice submit position

## 背景 / 目标

Keep the right-side primary action in the same location after an answer is
submitted. Replace Submit with a redundant Next button and put Retry directly
to its left. Preserve the existing left Previous/Next pair. Work on main.

## 关键功能清单（Key Feature List，KFL）

- Keep one primary button at the right edge: Submit before grading, Next after.
- Place Retry to the left of the new right-side Next button after grading.
- Preserve the left navigation pair, Enter behavior, pending guards, and history.
- Keep the footer bounded on desktop and mobile in both themes.

## 改造面

Practice QuestionCard, practice-only footer styling, browser acceptance,
README usage text, and practice UI documentation/captures.

## 非目标

Changing the left navigation pair, memorization actions, grading, storage,
analytics, dependencies, question data/assets, and worktrees.

## 验收标准（Acceptance Criteria，AC）

- AC1: After grading, right-side Next occupies the original Submit target.
- AC2: Retry is immediately to its left and starts a fresh attempt.
- AC3: The left Previous/Next pair stays in its existing location and works.
- AC4: Both Next actions disable at the final question and while saving.
- AC5: No duplicate attempt is created by advancing; existing checks pass.

## 讨论

The primary button remains mounted while its label and action change after
grading. Practice-only responsive styles keep the status and two right-side
actions within the viewport. Personal study data is excluded from acceptance.

Acceptance passed: the complete check includes 42 browser workflows and the
existing unit/backend/build gates. Final compact styling passes a production
build and all 7 focused practice flows. Click-target and left-button positions
are checked at 1440×900, 1280×600, 700×700, 651×700, and 390×844. Wrong/correct
submissions, Retry, both navigation pairs, final-question guards, and attempt
counts are covered using isolated data.
