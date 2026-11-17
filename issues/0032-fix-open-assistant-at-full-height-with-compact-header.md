---
id: 0032
type: fix
status: closed
closed-by: ac0525033fadf595f328c1e811b5343be64020c8
labels: []
branch: fix/0032-open-assistant-at-full-height-with-compact-header
created: 2026-11-08
---
# Open assistant at full height with compact header

## 背景 / 目标

The question assistant opens too short, and its title and question context consume
too much vertical space. Open at the available viewport height and reduce the
fixed header area so conversation content is readable immediately.

## 关键功能清单（Key Feature List，KFL）

- Open at full available height, with the existing 12-pixel viewport margins.
- Apply the opening height to old saved window geometry as well as new defaults.
- Use a compact title row and a single-line question context with full-text access.
- Retain manual dragging, independent resizing, keyboard controls and reset.

## 改造面

Assistant window geometry, opening interaction, header component, scoped styles,
frontend regression checks and feature evidence.

## 非目标

LLM behavior, provider settings, transcript persistence and study/exam logic.

## 验收标准（Acceptance Criteria，AC）

- Each open fills the available height while retaining saved width and horizontal
  placement; manual resizing remains available during the open conversation.
- Existing short saved rectangles no longer cause a short opening window.
- Title and question rows together occupy at most 80 CSS pixels on supported
  desktop/mobile layouts; the question remains available through accessible text
  and a native full-text tooltip.
- Pointer/touch/keyboard controls, reopen, viewport recovery, Markdown and source
  rendering pass relevant checks using isolated data and local provider fixtures.
- Record screenshots and update the dated handoff after verification.

## 讨论

Requested on 2026-11-08. Opening height supersedes the previous saved height and
vertical placement. Saved width and horizontal placement remain useful. Full
height leaves the established 12-pixel margins for reachable window controls.

Acceptance on 2026-11-08 passed the production build, 28 frontend unit tests and
26 targeted browser cases. Four viewport cases verify the available full height,
compact header and old-preference behavior. Existing pointer/touch/keyboard,
conversation, Markdown, hidden-entry and source-link checks also passed. Tests
used local provider fixtures and isolated data. The Vite chunk-size advisory
remains recorded in the existing dependency comparison.

- [Feature behavior](../docs/features/assistant/README.md)
- [Current UI evidence](../docs/ui/assistant/README.md)
