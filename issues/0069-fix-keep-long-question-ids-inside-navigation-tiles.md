---
id: 0069
type: fix
status: open
labels: [frontend, navigation]
branch: fix/0069-keep-long-question-ids-inside-navigation-tiles
created: 2026-11-19
---
# Keep long question IDs inside navigation tiles

## 背景 / 目标

In the Beginner English introduction unit, tiles such as `self-introduction-5`
overflow into adjacent tiles. Multi-line IDs also push the list position
against the top edge of a fixed-height tile.

## 关键功能清单（Key Feature List，KFL）

- Wrap long original IDs within each tile and let the grid row fit its content.
- Preserve the complete original ID, legible list positions, and resource markers.

## 改造面

The shared question navigation styles and a layout regression using the real
Beginner English introduction unit.

## 非目标

Changes to question IDs, selection, state colors, or the six-column grid.

## 验收标准（Acceptance Criteria，AC）

- At desktop and narrow viewport widths, list positions and original IDs fit
  within their own tiles, including the current question.
- The complete original ID remains visible, and locating the current question
  keeps the tile in view after the rows resize.

## 讨论

Use a minimum row height for short labels and allow longer labels to wrap
inside the available width.
