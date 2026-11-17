---
id: 0010
type: docs
status: closed
closed-by: 4fac254
labels: []
branch: docs/0010-preview-three-logo-based-color-themes
created: 2026-11-01
---
# Preview three logo-based color themes

## 背景 / 目标

Generate three comparable desktop UI previews based on the original blue,
white, and red Che Xue Tang Yunnan logo. The user selects a palette before
any live application theme changes. Work remains on main without worktrees.

## 关键功能清单（Key Feature List，KFL）

- Generate separate light blue, navy-sidebar, and full dark-blue UI images.
- Preserve the current compact three-column practice layout and original logo.
- Save all three previews, complete prompts, and palette values together.
- Present images inline for user selection.

## 改造面

docs/ui/theme-options/2026-11-01/ only, plus this issue record.

## 非目标

Applying a theme, changing layout or study records, redrawing the logo,
adding dependencies, CLI image-generation fallback, and worktrees.

## 验收标准（Acceptance Criteria，AC）

- AC1: Three separate generated preview images are saved and displayed.
- AC2: Variants preserve the recognizable brand and existing study workflow.
- AC3: Palette and prompt records make each option reproducible for implementation.
- AC4: Live application CSS is unchanged by the preview task.

## 讨论

Use the built-in image generation tool with a practice-page screenshot as
layout reference and the copied original icon as brand reference. Preview
images are visual design proposals, not pixel-perfect implementation evidence.
The blue-white light option is recommended for matching the logo and current
daytime study workflow; the final choice belongs to the user.

Three separate generated images, their prompts, and palette values are saved
under docs/ui/theme-options/2026-11-01/. The user selected A for light mode and
C for dark mode. Applying those themes is a separate implementation task.
