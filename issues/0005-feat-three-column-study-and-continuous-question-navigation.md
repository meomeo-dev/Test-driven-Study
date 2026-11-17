---
id: 0005
type: feat
status: closed
closed-by: dca5a70
labels: []
branch: feat/0005-three-column-study-and-continuous-question-navigation
created: 2026-11-01
---
# Three-column study and continuous question navigation

## 背景 / 目标

Paginated question numbers make finding a question cumbersome. Put question
text, answers, and explanation in three bounded desktop columns. Replace the
permanent auxiliary sidebar with a collapsed navigation control in the toolbar.
Implement directly on main, as explicitly requested by the user.

## 关键功能清单（Key Feature List，KFL）

- Desktop columns for question/image, answer options, and full explanation.
- A toolbar navigation control opens and collapses a floating right drawer.
- One continuous, locally scrollable question-number grid, without pagination.
- A vertical index with the first question, every 100th question, and the last.
- Selected question positioning, learning-state colors, and filtered ordering.
- Small-screen explanation access, keyboard access, and bounded viewport layout.

## 改造面

- web/src/features/memorization/ and web/src/styles/.
- tests/browser/ and existing shortcut domain tests.
- docs/ui/memorization/, README.md, and this issue.

## 非目标

Backend changes, question or asset migration, AI provider calls, new dependencies,
public deployment, and creating a linked worktree.

## 验收标准（Acceptance Criteria，AC）

- AC1: Desktop has three stable columns and no permanent right sidebar.
- AC2: Navigation is collapsed initially; its toolbar button toggles a floating
  right drawer without changing the reading panel bounds.
- AC3: All filtered question numbers are in a single scrollable grid, with no
  previous-group, next-group, or page-number controls.
- AC4: Every 100th question has a vertical index point. Jumping scrolls only the
  drawer and leaves the current question unchanged until a tile is selected.
- AC5: Selecting a tile opens that original question, closes the drawer, and
  restores focus to the navigation trigger. Reopening locates the current tile.
- AC6: Subject/filter changes retain correct counts, order, state colors, and
  current position; empty results remain usable.
- AC7: Escape, outside click, trigger toggling, and the navigation shortcut work.
  Existing typing/IME/dialog safeguards remain effective.
- AC8: Supported viewport bounds, existing workflows, browser acceptance, strict
  types, and production build pass. Commit the result on main.

## 讨论

The previous screenshot is frozen in the matching _assets directory. Continuous
navigation applies to the question-number browser, not to scrolling the entire
study page. Index labels refer to positions in the current filtered list;
original question identifiers remain available on each tile.

The continuous list supports native wheel scrolling and keyboard focus movement.
The index highlights the current question's range without changing selection
when browsing a different range. Drawer descriptions clarify the distinction
between scrolling to a position and selecting an original question.

Acceptance: 8 frontend unit tests, strict TypeScript checking, the production
frontend/Go build, and all 18 browser workflows passed. Browser evidence covers
nine page sizes and four floating-drawer sizes. The actual local page was also
checked with navigation expanded and then restored to its collapsed state.
Personal study records, source data, and original assets were not changed by
acceptance. Full results and screenshots are in docs/ui/memorization/.
