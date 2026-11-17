---
id: 0001
type: feat
status: closed
closed-by: c6ca3edd1e29f032611e03043dee2747aeb64e74
labels: []
branch: feat/0001-memorization-mode
created: 2026-11-01
---
# Memorization mode

## 背景 / 目标

Initialize the selected local Go/React stack and implement the first usable
memorization page from the generated UI reference. Preserve the imported data.

## 关键功能清单（Key Feature List，KFL）

- Subject and chapter filters, text/ID search, and question navigation.
- Original question images, correct options, explanations, and tips.
- Persistent mastered/review markers and last-viewed position in SQLite.
- Responsive, accessible UI matching docs/ui/memorization/implemented-desktop.png.
- One npm development command, typed API contracts, and acceptance checks.

## 改造面

- package.json, lockfiles, frontend configuration, and scripts/.
- cmd/server/, internal/storage/, internal/study/, internal/httpapi/.
- web/src/, contracts/http/, db/, and tests/.
- docs/ui/memorization/ and project startup documentation.

## 非目标

AI provider requests, generated study images, mock-exam scoring, cloud hosting,
authentication, and learning-analysis dashboards are outside this first page.

## 验收标准（Acceptance Criteria，AC）

- AC1: npm run dev starts the real frontend and Go API with no API key.
- AC2: subjects expose exactly 1734 and 1413 imported questions.
- AC3: filters, search, previous/next, grid navigation, and answers use real data.
- AC4: markers and last position survive refresh and backend reopening.
- AC5: missing source images have an explicit, non-fabricated fallback.
- AC6: Go tests, type checks, production build, and browser acceptance pass.
- AC7: desktop/mobile screenshots and the generated design remain in docs/ui/.

## 讨论

The UI image is a layout reference; its illustrative road scene must not replace
original question images. Source order and source IDs remain unchanged.
Npm coordinates Node/Vite and Go; SQLite needs no external database service.
