---
id: 0035
type: fix
status: closed
closed-by: 72fe33c1d62221e3c26131f817ed1d85cef9be01
labels: []
branch: fix/0035-focus-the-practice-reading-and-answer-flow
created: 2026-11-09
---
# Focus the practice reading and answer flow

## 背景 / 目标

The practice page spreads the stem, options, and submission across a wide canvas. The empty explanation column, toolbar accents, and floating mascot compete with the active question.

## 关键功能清单（Key Feature List，KFL）

- Align text stems, options, and submission in a bounded reading lane.
- Keep wide-screen room for question images and reveal the explanation after grading.
- Use a compact assistant entry in the practice toolbar.

## 改造面

Practice layout, assistant launcher presentation, existing browser layout checks, and practice UI evidence.

## 非目标

Question content, grading, records, and exam terminal are outside this layout change.

## 验收标准（Acceptance Criteria，AC）

- Text questions follow a direct top-to-bottom reading and answering path.
- Image questions, long questions, and narrow screens retain readable content and accessible controls.
- Submit and Next retain their shared click target, and review follows grading.
- Keyboard navigation, full views, assistant conversations, and theme behavior work.

## 讨论

2026-11-08. The supplied practice screenshot shows a text-only question with widely separated actions and a large reserved explanation area.

Acceptance evidence is available in the [practice UI record](../docs/ui/practice/README.md)
and the [reported question capture](../docs/ui/practice/focus-text.png).
The production build and 59 targeted browser checks passed with isolated data.
