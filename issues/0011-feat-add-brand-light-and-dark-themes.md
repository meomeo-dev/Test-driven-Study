---
id: 0011
type: feat
status: closed
closed-by: 8ed51f7
labels: []
branch: feat/0011-add-brand-light-and-dark-themes
created: 2026-11-01
---
# Add brand light and dark themes

## 背景 / 目标

Apply selected preview A as the light theme and C as the dark theme across
memorization, practice, and learning analysis. Keep the current compact layout
and original logo. Implement directly on main without a worktree.

## 关键功能清单（Key Feature List，KFL）

- Define shared semantic color tokens for both selected palettes.
- Add a compact, keyboard-accessible theme control to every page toolbar.
- Default to light mode; remember the selected mode across routes and reloads.
- Apply the stored theme before rendering the app and style native controls.
- Cover panels, dialogs, navigation, answer states, focus, charts, and help.
- Preserve answer selections, grading history, and viewport bounds on switching.

## 改造面

CSS token definitions and all existing component styles, shared theme provider
and toggle, three page toolbars, root bootstrap, browser tests, and UI docs.

## 非目标

The unselected navy-sidebar option B, automatic system-theme switching,
new layout or app features, changing the original logo/question images,
database/schema changes, dependencies, downloads, and worktrees.

## 验收标准（Acceptance Criteria，AC）

- AC1: Selected A/C palettes apply consistently to all three modes.
- AC2: Theme switches persist across navigation/reload without resetting answers.
- AC3: Storage failure falls back to usable in-memory switching.
- AC4: Labels, answer feedback, active actions, and focus remain readable.
- AC5: Desktop/mobile keep the single-screen layout and bounded overlays.
- AC6: Existing workflows and new theme acceptance checks pass in isolated data.

## 讨论

Semantic colors distinguish brand actions, neutral text/surfaces, success,
error, and review states. The original blue-white-red icon and question media
are not recolored. Generated references remain under the theme-options topic;
implemented screenshots belong under docs/ui/themes/.

The shared provider persists a two-state preference and preserves current React
study state when toggled. A head bootstrap initializes the canvas and browser
theme color before the application renders. Semantic link and feedback shades
are adjusted for readable contrast while preserving the selected visual direction.

Acceptance passed: npm run check completes all 31 browser flows, 8 frontend
unit tests, Go tests, generated bindings, startup checks, issue validation, and
production builds. Screenshots cover both themes, dark analysis, and mobile.
Original source data/assets are unchanged by this feature. The live local
service remains running, with the default light theme restored after inspection.
