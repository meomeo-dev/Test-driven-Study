---
id: 0030
type: fix
status: closed
closed-by: 396ed0288d10dbb5e78d3c4edd5cd02190b11a21
labels: []
branch: fix/0030-align-task-manager-typography-with-shared-css-tokens
created: 2026-11-04
---
# Align task manager typography with shared CSS tokens

## 背景 / 目标

The memory-palace task manager displays its filter label, select and empty state
at the browser default 16px, while shared buttons and helper text use 12px. The
user requested consistent typography through the existing CSS token system.
The source screenshot is retained in the matching issue assets directory.

## 关键功能清单（Key Feature List，KFL）

- Define shared typography tokens from the application's existing font sizes.
- Apply a predictable shared modal body size and reuse tokens for modal headings,
  helper text, shared buttons and task-manager text and controls.
- Preserve task filtering, controls, portal focus behavior and theme colors.

## 改造面

- `web/src/styles/tokens.css`: shared typography values.
- `web/src/styles/layout.css`: shared control typography.
- `web/src/styles/responsive.css`: shared modal and helper typography.
- `web/src/styles/tasks.css`: task-manager typography.
- `docs/ui/palace/README.md` and `handoff.md`: design and verification records.
- `docs/ui/themes/design.yaml` and `AGENTS.md`: shared typography conventions.

## 非目标

- Changing task lifecycle, provider configuration, exam styles or learner data.
- Migrating all application styles or introducing a styling dependency.
- Changing browser zoom or reducing the source-question reading size.

## 验收标准（Acceptance Criteria，AC）

- Filter labels and selects use the same 12px token as shared controls; task
  status/empty text uses the shared 14px body token and modal titles remain 17px.
- Task-manager font sizes use shared tokens, including task cards and events.
- Desktop and mobile, light and dark dialogs fit the viewport and wrap notes.
- Empty, loading, error and populated task views retain consistent typography.
- Existing task-control browser checks and the frontend build pass with isolated
  data and local provider fixtures; no paid requests or learner-data writes.

## 讨论

Baseline inspection on 2026-11-04 measured 17px modal title, 16px task filter
label/select and empty state, and 12px helper text. Radix portals render outside
the page's compact typography; the shared modal has no explicit body size.
The token source currently defines colors but no application typography scale.

Keep the fix in shared tokens and their consumers. Do not add component-specific
magic sizes or override browser preferences globally. Follow the normal sibling
worktree workflow for this issue.

Implemented shared caption/control/label/body/dialog-title tokens and connected
shared modal bodies, titles, notes, buttons, study filters and task-card styles.
No React behavior, task lifecycle or source-question reading sizes changed.

Validated 2026-11-04: production build and 16 existing browser regressions passed.
An additional 16 browser inspections covered empty/loading/error/populated states,
desktop/mobile bounds, light/dark themes, 16px/20px root defaults, computed token
sizes and restored trigger focus. Screenshots and the canonical verification
record are in `docs/ui/palace/`. All checks used isolated data/local fixtures.

Completed in `396ed02`.
