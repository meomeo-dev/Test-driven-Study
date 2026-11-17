---
id: 0015
type: feat
status: closed
closed-by: 0238bfa
labels: []
branch: feat/0015-add-memory-palace-image-generation
created: 2026-11-01
---
# Add memory palace image generation

## 背景 / 目标

Implement the memory-palace page using the supplied GPT Image-compatible
configuration and the existing single-question prompt. Research the local
dependency collection and public primary sources. Work directly on main.

## 关键功能清单（Key Feature List，KFL）

- A Go image-provider adapter using explicit proxy transport and server-only keys.
- An embedded, versioned prompt preserving the supplied full template.
- Full question/options/reference-answer rendering and optional original image input.
- Durable asynchronous jobs with idempotent creation, history, local images,
  explicit retries, bounded requests, cancellation, and restart interruption.
- A compact light/dark page with question selection, parameters, prompt preview,
  progress, saved-image viewing, download, and history.
- Typed HTTP contracts and SQLite queries, isolated provider/browser tests,
  and one real single-question integration check through the configured proxy.

## 改造面

internal/palace/ including embedded prompts; SQLite migration/query bindings;
HTTP handlers/contracts; server startup; web palace feature/API/styles; sidebar
and study entry links; acceptance fixtures/tests; feature/selection/UI docs.

## 非目标

Browser credentials, direct external fallback, automatic paid-request retries,
local model inference, new AI SDK dependencies, mock exams, changing original
questions/assets/attempts, and worktrees.

## 验收标准（Acceptance Criteria，AC）

- AC1: Configuration and credentials stay out of browser bundles, APIs, and logs.
- AC2: Remote provider calls and result downloads require an explicit proxy.
- AC3: The full original template is embedded from one canonical source file;
  all four placeholders resolve with original question content and answer text.
- AC4: Jobs remain readable across navigation/restart without resubmitting calls.
- AC5: Images are validated, stored locally, previewed, and downloadable.
- AC6: Tests use isolated databases and a local fake provider, never real keys.
- AC7: A real configured-model call is checked without repeated paid submissions.
- AC8: Existing workflows, generated bindings, builds, and browser checks pass.
- AC9: Record dependency findings, selected boundaries, and module layout.

## 讨论

The local curated catalogue has no dedicated image-generation category. Public
SDK and image-stack options are compared by an isolated research agent. A
standard-library Go adapter fits the existing runtime and limits compatibility
assumptions for this provider. Model-list access succeeds through the existing
explicit local proxy; all four configured model IDs are listed by the endpoint.

Implemented in commit 0238bfa directly on main. All acceptance criteria passed;
the real reference-image request produced a local 1152×2048 PNG. Complete
regression checks passed with 47 browser tests. Selection, module layout,
configuration, preview images, and validation evidence are documented under
docs/technical-selection/image-generation/, docs/features/palace/, and
docs/ui/palace/. No linked worktree was created.
