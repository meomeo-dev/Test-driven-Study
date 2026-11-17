---
id: 0004
type: fix
status: closed
closed-by: 38e7074
labels: []
branch: fix/0004-compact-memorization-workspace-and-shortcuts
created: 2026-11-01
---
# Compact memorization workspace and shortcuts

## 背景 / 目标

The study page requires document scrolling and spends space on repeated
headings and decorative copy. Provide a compact viewport workspace and efficient,
accessible keyboard actions, implemented directly on main.

## 关键功能清单（Key Feature List，KFL）

- A 100dvh workspace with no document scrolling at supported viewport sizes.
- Remove breadcrumbs, the large heading, slogan, and decorative study notes.
- Subject switching in the left memorization submenu.
- Primary question/options/actions stay visible; explanation/navigation sit beside them.
- Full text, metadata, shortcuts, and small-screen secondary panels use dialogs.
- Vim-style navigation plus documented application shortcuts and an off switch.

## 改造面

- web/src/components/, features/memorization/, and styles/.
- Frontend shortcut unit tests and browser layout/interaction acceptance.
- docs/ui/memorization/ and project README.

## 非目标

Changes to grading, question data, AI provider calls, public deployment,
new dependencies, and creating another worktree.

## 验收标准（Acceptance Criteria，AC）

- AC1: document bounds stay within desktop and compact viewport dimensions.
- AC2: core reading and action controls are visible without scrolling the page.
- AC3: full content remains accessible in bounded dialogs without silent loss.
- AC4: subject controls are in the left memorization submenu.
- AC5: j/k, gg/G, search, image, detail, mark/review/reset, and help work.
- AC6: inputs, IME, dialogs, and browser modifier shortcuts are protected.
- AC7: character shortcuts can be disabled and the preference survives reload.
- AC8: existing workflows, layout/keyboard tests, and build pass; commit on main.
- AC9: desktop question/image and answers occupy two bounded columns. Long
  questions, absent images, and save notices do not move the answer column or footer.

## 讨论

The user explicitly requests direct development on main. Original screenshots
are frozen input evidence in the matching _assets directory. Navigation follows
Vim conventions; domain actions are documented as application mappings.
Long or enlarged content uses a locally scrollable dialog, not clipped content.

Acceptance: all four issue records validate, 8 frontend tests pass, the strict
TypeScript/production frontend/Go build passes, and all 13 browser workflows
pass. Browser evidence covers nine viewport sizes and five content cases at
three desktop heights. Current captures and full results are in
docs/ui/memorization/acceptance.md. Source data and original assets are unchanged.
