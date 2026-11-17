---
id: 0012
type: fix
status: closed
closed-by: 6c81d57
labels: []
branch: fix/0012-align-question-context-and-explanation-keyboard-navigation
created: 2026-11-01
---
# Align question context and explanation keyboard navigation

## 背景 / 目标

Align question context with the three-column reading layout, add arrow-key
scrolling for long explanations, and make current-question navigation explicit.
Apply the fixes to practice and memorization on main without a linked worktree.

## 关键功能清单（Key Feature List，KFL）

- Move original question ID and state into the stem-column heading.
- Display the full chapter beside the question-type badge, truncating visually
  when needed while preserving its full accessible text and tooltip.
- Scroll visible overflowing explanations with Up/Down, including analysis
  dialogs, without scrolling the document or intercepting other dialog controls.
- Show both list positions and original IDs in the navigator.
- Locate the current original question by centering and focusing its tile.

## 改造面

Copied study cards, explanation panels, shortcut handlers/help, navigator
components, shared styles/scroll helper, browser tests, and UI documentation.

## 非目标

Question data/assets, grading, analytics, schema changes, answer disclosure
before submission, dependencies, downloads, new color palettes, and worktrees.

## 验收标准（Acceptance Criteria，AC）

- AC1: Question ID/state align with option and explanation column headings.
- AC2: The question-type row exposes the correct chapter in both modes.
- AC3: Up/Down scroll only the visible explanation, preserving input, IME,
  modifier, tab-list, navigation-grid, and unrelated-dialog behavior.
- AC4: Practice keeps explanations hidden before grading.
- AC5: Navigation associates original IDs with filtered positions, including
  resume routes without a question parameter; Locate restores focus/visibility.
- AC6: Desktop/mobile remain bounded and all existing checks pass in isolated data.

## 讨论

Original question IDs differ from source-order positions. The existing local
scroll action works in the observed session, but displayed ordinal-only tiles
obscure that relationship and Locate does not focus the tile. The change makes
the relationship visible and adds explicit centering/focus behavior.

Regression cases use original question 327, the longest subject-one explanation,
clean resume URLs, and chapter-filtered positions. They cover both copied study
modes, keyboard guards, continuous held-key scrolling, and compact dialogs.

Acceptance passed: all 41 browser flows, 8 frontend unit tests, Go tests,
generated bindings, startup lifecycle, strict builds, and issue validation.
Desktop/mobile captures show the aligned context and current original ID.
The personal database was not seeded by acceptance tests; the live service
remains running in the primary checkout.
