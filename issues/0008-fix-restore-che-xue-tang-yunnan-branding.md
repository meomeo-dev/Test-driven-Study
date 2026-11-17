---
id: 0008
type: fix
status: closed
closed-by: fb90718
labels: []
branch: fix/0008-restore-che-xue-tang-yunnan-branding
created: 2026-11-01
---
# Restore Che Xue Tang Yunnan branding

## 背景 / 目标

Replace the invented brand with the original Che Xue Tang Yunnan edition
identity. Copy the original local application logo without redrawing it.
Implement directly on main, as requested; no linked worktree is created.

## 关键功能清单（Key Feature List，KFL）

- Copy the original 192 px application icon into assets/img/.
- Replace the shared sidebar mark and name across all three modes.
- Correct the page title, description, favicon, and accessible home-link name.
- Preserve the compact desktop and mobile layout.

## 改造面

assets/img/, shared Sidebar component, layout/responsive styles, index.html,
and docs/ui/branding/ provenance and acceptance capture.

## 非目标

Question data, practice records, grading, analytics, dependencies, downloads,
new branding design, and worktrees.

## 验收标准（Acceptance Criteria，AC）

- AC1: Copied bytes match the original local application icon's SHA-256.
- AC2: All modes display the original icon and the correct product name.
- AC3: Browser title and favicon use the same identity.
- AC4: Desktop/mobile remain within the viewport; existing checks pass.

## 讨论

The selected source is res/drawable-xxxhdpi-v4/ic_launcher.png in the original
extracted application. Its actual format is JPEG despite the source extension;
the destination uses .jpg. Its pixels already include the Yunnan edition name.
The Android mipmap launcher resource is a generic Android icon and is not used.

Acceptance passed: byte comparison matches the source; npm run check passes
all 25 browser flows and the remaining checks. Updated desktop/mobile captures
show the copied logo. The live practice page title and sidebar were verified.
