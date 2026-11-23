---
id: 0085
type: fix
status: open
labels: [backend, httpapi, llm, tts, study]
branch: fix/0085-fix-learning-route-written-feedback-tts-test-and-review-cool
created: 2026-11-23
---
# Fix learning route, written feedback, TTS test, and review cooldown

## 背景 / 目标

Four targeted backend defects affect core study and optional AI workflows in
built-app and daily study runs:

1. Direct navigation or page refresh on `/learning` returns HTTP 404 in built
   mode because `isFrontendRoute` in `internal/httpapi/files.go` omits
   `"/learning"`.
2. `POST /api/practice/presentations/{presentation}/written-feedback` can hit
   the HTTP server's 30s `WriteTimeout` while `llm.Service.EvaluateWritten`
   allows a 90s upstream call, and `EvaluateWritten` requests loosely typed
   `json_object` output instead of a strict `json_schema`.
3. `tts.Service.Test()` sends `"voice"` instead of `"voice_id"` in its DeepSeek
   TTS connectivity-check payload, diverging from `Synthesize()`.
4. `study.Service.reviewPracticeQuestions()` queues any item with
   `Status != "mastered"`, prematurely pulling 24h-cooldown `"learning"` items
   into the active review practice queue alongside truly due (`needs_review` /
   `due`) items.

This issue fixes all four defects with focused regression tests and fixture
alignment.

## 关键功能清单（Key Feature List，KFL）

- Add `"/learning"` to `isFrontendRoute` in `internal/httpapi/files.go` so the
  built SPA serves `index.html` on `/learning`, with regression test coverage.
- Extend the HTTP response write deadline in
  `internal/httpapi/written_feedback.go` (matching the 90s LLM evaluation window)
  and upgrade `internal/llm/written_feedback.go` to send a strict `json_schema`
  format matching `WrittenFeedback`.
- Update `tests/fixtures/image-provider.mjs` to route written-feedback mock
  responses by schema `format.name` while preserving existing palace
  `json_schema` routing and browser test compatibility.
- Change `internal/tts/service.go` `Test()` to send `"voice_id"` matching
  `Synthesize()` and add a regression test asserting the exact request JSON.
- Update `internal/study/review_book.go` so `reviewPracticeQuestions` excludes
  24h-cooldown `"learning"` items (queuing only due review states) without
  altering review-book status counts or overview breakdowns, with regression
  tests covering `needs_review`, `due`, `learning`, and `mastered`.

## 改造面

- `internal/httpapi/files.go` and HTTP route tests under `internal/httpapi/`
- `internal/httpapi/written_feedback.go` and tests under `internal/httpapi/`
- `internal/llm/written_feedback.go` and tests under `internal/llm/`
- `internal/tts/service.go` and tests under `internal/tts/`
- `internal/study/review_book.go` and tests under `internal/study/`
- `tests/fixtures/image-provider.mjs`

## 非目标

- Changing SQLite schema, OpenAPI contracts, or frontend routing/UI components.
- Persisting LLM written evaluations to SQLite or changing extended-grading
  scoring rules (tracked separately in P0 follow-up issues).
- Modifying course packages, TTS audio assets, or provider credential storage.

## 验收标准（Acceptance Criteria，AC）

- `GET /learning` and `HEAD /learning` are recognized by `isFrontendRoute` and
  serve `dist/index.html` in built-app mode.
- `writtenFeedback` extends the HTTP write deadline before calling
  `EvaluateWritten`, and `EvaluateWritten` sends a strict `json_schema` payload
  that validates cleanly against `WrittenFeedback` and the local fixture.
- `tts.Service.Test()` sends `"voice_id"` (not `"voice"`) in its JSON body,
  verified by unit test.
- `reviewPracticeQuestions` excludes 24h-cooldown `"learning"` items while
  retaining `needs_review` and `due` items and keeping `ReviewBook` overview
  counts unchanged.
- `go test ./...`, `npm run typecheck`, `npm run test:unit`, `git diff --check`,
  and `node scripts/issue-check.mjs` all pass cleanly.

## 讨论

- Updating `tests/fixtures/image-provider.mjs` alongside the strict
  `json_schema` change keeps local browser/fixture tests (`question-types.spec.ts`
  and palace flows) deterministic without affecting production provider calls.
