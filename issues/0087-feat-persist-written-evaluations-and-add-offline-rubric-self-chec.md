---
id: 0087
type: feat
status: closed
closed-by: a24c65c
labels: [study, storage, httpapi, ui, pedagogy]
branch: feat/0087-persist-written-evaluations-and-add-offline-rubric-self-chec
created: 2026-11-23
---
# Persist written evaluations and add offline rubric self-check

## 背景 / 目标

Writing and translation practice attempts currently face two structural gaps:

1. Exact-string and key-term heuristic grading caps non-exact valid translation
   paraphrases at `0.5` while practice/concept mastery requires `score == 1`,
   causing false failures that block concept mastery in offline study.
2. Optional LLM written feedback (`POST .../feedback`) discards its result
   immediately after rendering, so reopening a submission cannot restore past
   feedback, re-clicking re-bills the LLM, and LLM passes never update review
   book, analysis, or concept mastery.

This feature adds an append-only, immutable `attempt_evaluations` table,
wires effective pass (`COALESCE(eval.passed, answer_attempts.is_correct)`) into
review book, learning analysis, and concept mastery, caches persisted LLM
evaluations to avoid duplicate billing, and provides an offline rubric/reference
self-check flow so written/translation mastery works cleanly without AI.

## 关键功能清单（Key Feature List，KFL）

- Add SQLite migration `internal/storage/migrations/00017_attempt_evaluations.sql`
  defining append-only `attempt_evaluations` (`id`, `presentation_id`, `source`
  in `('llm', 'self_check')`, `passed`, `score_pct` in `0..100`, `feedback_json`,
  `evaluated_at_ms`), an index on `(presentation_id, id DESC)`, and
  `BEFORE UPDATE`/`BEFORE DELETE` immutability triggers matching
  `answer_attempts` without altering migrations `00001`–`00016`.
- Update `db/queries.sql` and regenerate `internal/storage/storedb/` (`sqlc`)
  with evaluation insert/lookup queries and `LEFT JOIN` latest evaluation
  (`COALESCE(eval.passed, answer_attempts.is_correct)`) across review book,
  learning analysis, and concept mastery queries.
- Add decoupled evaluation methods on `study.Service`
  (`GetLatestAttemptEvaluation`, `GetLatestLLMEvaluation`,
  `RecordLLMEvaluation`, `RecordSelfCheckEvaluation`) rejecting unanswered
  presentations, non-writing/non-translation items, and active mock exams.
- Update `contracts/http/openapi.yaml` and regenerate `web/src/api/generated/`:
  - `POST /api/practice/presentations/{presentationId}/feedback`: reuse latest
    persisted LLM evaluation (`cached: true`) without re-calling LLM; otherwise
    evaluate via LLM, compute `score_pct` and `passed` (`score_pct >= 60`),
    persist, and return existing feedback fields plus evaluation metadata.
  - `POST /api/practice/presentations/{presentationId}/self-check`: persist
    offline self-check (`{ passed, checked_criteria? }`) for submitted
    writing/translation presentations.
  - `GET /api/practice/presentations/{presentationId}/evaluation`: return
    `{ evaluation: AttemptEvaluation | null }` to restore persisted state.
- Update Practice review UI (`web/src/api/practice.ts`, Practice components, and
  `WrittenFeedback.tsx`, obeying `question-types/` L0–L5 DAG and `<= 300` lines)
  with post-submit offline rubric/reference/alternates/key-terms self-check
  controls (`自评通过（计入掌握）` / `仍需改进`), persisted evaluation badge
  (`AI 评分` / `离线自评`, pass state, score), reload restoration, and React
  Query invalidation for `analysis`, `learning`, and `practice`.
- Add Go unit/SQLite integration tests and frontend Vitest unit tests covering
  immutability triggers, effective mastery override, latest-wins re-evaluation,
  LLM cache reuse, boundary rejections, and UI self-check/restoration flows.

## 改造面

- `internal/storage/migrations/00017_attempt_evaluations.sql`
- `db/queries.sql` and generated `internal/storage/storedb/`
- `contracts/http/openapi.yaml` and generated `web/src/api/generated/`
- `internal/study/` (`attempt_evaluations.go`, review/analysis/concept queries
  and tests)
- `internal/httpapi/written_feedback.go` (and routes/handlers/tests)
- `web/src/api/practice.ts`, `web/src/features/practice/`,
  `web/src/features/question-types/shared/WrittenFeedback.tsx`, styles, and
  Vitest tests

## 非目标

- Modifying applied migrations `00001`–`00016` or relaxing `answer_attempts`
  immutability triggers.
- Exposing evaluations or self-check actions during active unanswered mock exams
  or before practice submission.
- Adding new question types or modifying course package schemas/content.

## 验收标准（Acceptance Criteria，AC）

- Both `answer_attempts` and `attempt_evaluations` reject `UPDATE`/`DELETE` via
  SQLite triggers; append-only re-evaluations let the latest row determine
  effective pass state.
- A non-exact valid translation or writing attempt capped below full heuristic
  score advances review book, analysis, and concept mastery once passed via
  either offline self-check or persisted LLM evaluation.
- Repeating `POST .../feedback` for a presentation with a persisted LLM
  evaluation returns the cached evaluation (`cached: true`) without invoking the
  LLM provider again.
- Unanswered presentations, non-writing/non-translation items, and active mock
  exams cannot record or expose evaluations.
- `question-types/` respects the L0–L5 dependency DAG and `<= 300` lines/file.
- `npm run check:generated`, `go test -count=1 ./...`, `go vet ./...`,
  `npm run typecheck`, `npm run test:unit`, `npm run build`, `git diff --check`,
  and `node scripts/issue-check.mjs` all pass cleanly.

## 讨论

- Keeping `attempt_evaluations` as a separate append-only table preserves full
  auditability of original heuristic `answer_attempts` while letting learners
  achieve honest offline mastery or persist optional AI rubric grades.
- Keeping `internal/study` independent of `internal/llm` preserves existing
  package layering (`httpapi` orchestrates `study` + `llm`).

### Verification

- `GOMODCACHE=/Users/luojin/go/pkg/mod npm run check:generated`: passed
  (`Generated HTTP types and SQL bindings are current.`).
- `go test -count=1 ./...`: passed (`9/9` packages ok).
- `go vet ./...`: passed.
- `npm run typecheck && npm run test:unit`: passed (`tsc --noEmit` 0 errors;
  Vitest `17/17` files, `75/75` tests passed, including `registry.test.ts` `6/6`
  and `written-evaluation.test.ts` `9/9`).
- `npm run build`: passed (`tsc --noEmit`, `vite build` 3366 modules, and
  `go build ./cmd/server`).
- `git diff --check`, `gofmt -l`, and `node scripts/issue-check.mjs`: all clean.
