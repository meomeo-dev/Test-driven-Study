---
id: 0068
type: feat
status: closed
closed-by: c7b6c4c
labels: [frontend, navigation]
branch: feat/0068-share-question-navigation-across-study-modes
created: 2026-11-19
---
# Share question navigation across study modes

## 背景 / 目标

Memorization and practice maintain near-identical navigation drawers and grids.
Memory palace already reuses the memorization drawer. Give the three study
modes one component package so that navigation behavior has one implementation.

## 关键功能清单（Key Feature List，KFL）

- Composition groups the drawer, grid, legend, positioning, and keyboard focus
  in `web/src/features/question-navigation/` behind one public entry point.
- State presentation varies by mode through an ordered legend and a label
  function. Memorization and memory palace share the same state presentation.
- Study pages supply question rows, saved-resource markers, and selection
  callbacks. The package depends on UI primitives and a common keyboard guard.

## 改造面

The shared package, its three study-page consumers, navigation styles, and a
browser regression covering the shared entry points.

## 非目标

Exam answer cards, study API changes, question filtering and grading rules, and
visual redesign.

## 验收标准（Acceptance Criteria，AC）

- All three study pages import the same public component. The package imports
  neither study pages nor API models.
- Drawers retain their mode-specific legend, current question, original IDs,
  resource indicators, focus and keyboard behavior, and selection callbacks.
- Type checking, frontend unit tests, and the isolated browser suite pass.

## 讨论

Critical path: agree on the component contract, build the shared implementation,
wire the three study pages, then run acceptance before committing. Browser
regression authoring can proceed in parallel with package implementation.

### Verification

- Type checking and all 57 frontend unit tests passed.
- The browser suite passed 14 cases, including the shared drawer regression.
  The course roadmap case initially timed out while loading `/courses`. A
  focused retry with a 90-second limit passed in 12.8 seconds.
