---
id: 0077
type: fix
status: closed
closed-by: f4860b2
labels: []
branch: fix/0077-move-memorization-question-position-between-navigation-butto
created: 2026-11-20
---
# Move memorization question position between navigation buttons

## 背景 / 目标

Place the current question position at the memorization navigation controls.

## 关键功能清单（Key Feature List，KFL）

Move the current and total question numbers between Previous and Next.

## 改造面

Memorization question card footer, layout styles, and its browser regression.

## 非目标

Changing position calculations, progression, or practice mode layout.

## 验收标准（Acceptance Criteria，AC）

The counter appears once between the navigation buttons and tracks the visible question at desktop and narrow viewport widths.

## 讨论

Use the existing position and filtered total from the question card.

### Verification

- Type checking and three isolated memorization browser cases passed.
- The position stays between Previous and Next while details load, updates
  after navigation, and fits in the viewport at 375 pixels.
