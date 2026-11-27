# Development Handoff

Updated 2026-11-27 (America/New_York). Baseline `d6ce83c` on `main` (zero
linked worktrees; `feat/0090-expand-beginner-english-cefr-a2-path-and-language-workflow`
preserved at `8d0aa78` for remaining `#90` Units 13–16; background dev service
running on ports `43387`/`43388` for live review).

> Static architecture, invariants, and workflow rules live in
> [AGENTS.md](AGENTS.md). This file captures dynamic working memory: recent
> milestones, locked-in decisions, hard-learned lessons, verified commands, and
> prioritized next steps.

## Completed work (2026-11-23 – 2026-11-27)

- **Floating Typing Study module (`#91`, verified, closed, and integrated on `main`)**:
  - [#91](issues/0091-feat-add-floating-typing-study-module.md) (`f3b744b`,
    closed in `d6ce83c`): added draggable/resizable floating **打字学习**
    (`web/src/features/typing/`) modeled on `QuestionAssistant` (reusing
    parameterized `windowGeometry` / `useWindowGeometry` with independent
    persisted geometry). Extracts ordered question + correct-answer sentences
    across all 9 v2 question types, protects Chinese IME composition and
    uncommitted Pinyin against premature error grading, auto-scrolls completed
    lines upward with a typewriter roll (`focus({ preventScroll: true })`), and
    mounts in Memorization, Memory Palace, and post-submit Practice (disabled
    pre-submit; untouched in Mock Exam).
- **Provider diagnostics & quota handling (`e2413f9`)**:
  - Classified HTTP 403 `INSUFFICIENT_BALANCE` / `insufficient_quota` responses
    as `quota` failures in `internal/llm/` and `internal/palace/` without
    leaking upstream messages, plus sanitized rejection logging in
    `internal/llm/provider.go`.
- **Beginner English CEFR A2 expansion (`#90`, in progress on `main`)**:
  - [#90](issues/0090-feat-expand-beginner-english-cefr-a2-path-and-language-workflow.md):
    upgraded `scripts/curriculum_workflow/` for language tracks (`33cc528`,
    `9dc013d`, `9ccef3f`, `f8f1c06`), expanded `courses/beginner-english` to
    `2.5.0` with Units 11–12 (`8d0aa78`), and checkpointed Unit 13
    (`experiences-progress`) research drafts (`dea8bb7`; 4 lessons
    `REVIEW_APPROVED`, `status-summary-writing` mid-review).
- **Prior P0 roadmap (`#83`–`#89`, all verified, closed, and merged on `main`)**:
  - `#83` (`138cbc8`, `desktop-gui-design-knowledge`), `#84` (`de981e2`,
    `curriculum_workflow`), `#85` (`a154e57`, `/learning` SPA route + written
    feedback + TTS test + cooldown), `#86` (`09fd0c8`, explicit
    `allow_direct_https` opt-in), `#87` (`a24c65c`, `attempt_evaluations` +
    offline self-check), `#88` (`07c5fea`, safe `.zip` import & lifecycle UI),
    `#89` (`bc1aeb3`, v2 `course:new`, unified `course:audit`, compiled-binary
    E2E, and `.github/workflows/ci.yml`).

## Decisions & lessons learned

1. **Typewriter auto-scroll & native Chinese IME**: Using a real auto-growing
   underline `<textarea>` directly under the character-feedback prompt keeps
   macOS/Windows OS IME candidate popups anchored to the caret. Focusing the
   next sentence must call `focus({ preventScroll: true })` inside the same
   frame before `container.scrollTo({ behavior: 'smooth' })`, otherwise Chromium
   cancels the smooth upward roll.
2. **Tauri 2 desktop shell (P1 packaging decision)**: Maintainer selected a
   Tauri 2 desktop shell over a standalone browser-launching binary, gated on
   `.agents/skills/desktop-gui-design-knowledge/` (`#83`) and `macos-app-audit`.
3. **Remote AI/TTS proxy policy**: Keep strict explicit proxy by default with
   no silent direct fallback; allow direct remote HTTPS only via manual per-tab
   opt-in (`allow_direct_https`, `#86`). Unauthenticated LAN access remains an
   explicit non-goal.
4. **Offline `sqlc` cache path**: When running inside an agent profile whose
   `HOME` differs from `/Users/luojin`, pass `GOMODCACHE=/Users/luojin/go/pkg/mod`
   so Go builds, `npm run generate:db`, and `npm run check:generated` locate
   cached modules (`sqlc@v1.31.1`) offline.
5. **Monotonic written evaluation state**: Returning an older cached LLM row
   (`cached: true`, lower `id`) must never overwrite a newer persisted
   `self_check` evaluation in Practice UI (enforced via `shouldPromoteEvaluation`
   / `pickLatestEvaluation` in `web/src/features/question-types/shared/written-evaluation.ts`).
6. **Deactivated default courses & startup seeding**: `storage/courses.go`
   `seedCourse` checks `CountCourseVersions > 0` so restarting the server never
   silently reactivates a course the learner intentionally deactivated.
7. **Audit strictness across bundled packs**: `courses/golden-course-template@1.4.0`
   intentionally passes default `course:audit` (5 demo effort warnings);
   `courses/beginner-english` and `courses/elementary-chinese` pass `--strict`.

## Course packages

| Package | Active local version | Coverage |
| --- | --- | --- |
| [Golden course template](courses/golden-course-template/README.md) | 1.4.0 | 15 items across all nine question types, a five-concept learning path, aligned reading/listening translations, and 12 vocabulary entries with TTS and grammar notes. |
| [Beginner English](courses/beginner-english/README.md) | 2.5.0 | 12 units, 51 concepts (2,670 min), 507 items across all 9 v2 types, translations for all 45 reading and 67 listening questions, and 93 vocabulary entries with TTS overrides and minimalist grammar notes. |
| [Elementary Chinese](courses/elementary-chinese/course.json) | 1.0.4 | Local Pinyin for fill-in stems and combined Pinyin and Han speech for explanations. |

The 16 extracted engineering, mathematics, and legacy courses live in
`/Volumes/1TB-ZYJ/git/Test-driven-Study-Courses` (`#82`, `1733272`).

## Verification (2026-11-27, `#91` & `e2413f9`)

- `go test -count=1 ./...` & `go vet ./...`: PASS (`10/10` packages ok,
  including `internal/llm` and `internal/palace` HTTP 403 quota tests).
- `npm run typecheck && npm run test:unit`: PASS (`tsc --noEmit` 0 errors;
  Vitest `20/20` files, `96/96` tests, including `web/src/features/typing/engine.test.ts`
  and `extract.test.ts`).
- `npx vite build` & `node scripts/build-api.mjs`: PASS (`3378` modules, lazy
  `TypingPanel` chunk `8.78 kB` gzipped; compiled `var/bin/test-driven-study`).
- `npx playwright test tests/browser/typing-study.spec.ts`: PASS (`3/3` tests:
  cloze/writing typewriter auto-scroll, Chinese IME composition + uncommitted
  Pinyin guard, Practice pre-submit protection & mobile viewport bounds).
- Full Playwright suite (`npx playwright test`): `31/32` passed; the sole
  failure is a pre-existing unit-count assertion in
  `tests/browser/courses.spec.ts:192` still expecting `10` units for
  `beginner-english` after `8d0aa78` expanded the course to `12` units.
- `git diff --check` and `node scripts/issue-check.mjs`: PASS (`91/91` issues
  valid).

## Next steps (prioritized backlog)

- [ ] **Follow-up — Update `tests/browser/courses.spec.ts:192` & complete `#90`**:
  align the hardcoded `beginner-english` sidebar unit count assertion (`10` ->
  dynamic/current `12`+) and finish Units 13–16 (`experiences-progress`,
  `opinions-advice`, `conditions-processes`, `workplace-communication`) in
  [#90](issues/0090-feat-expand-beginner-english-cefr-a2-path-and-language-workflow.md).
- [ ] **P1 — Course-wide "Today" queue & in-flow review**: read-only daily
  study queue aggregating due reviews (`buildReviewItems` over `course_units`)
  and next unlocked concepts (`learning_paths`, budgeted by `daily_minutes`),
  inline Palace images + read-only `VocabularyNotebook` in post-submit Practice,
  and spaced stability checks in `concepts.go`.
- [ ] **P1 — Tauri 2 desktop shell & atomic backup/restore**: design and build
  a Tauri 2 native wrapper (following `.agents/skills/desktop-gui-design-knowledge/`
  and `macos-app-audit`) bundling the Go backend/assets plus atomic
  `VACUUM INTO` + `var/palaces/` backup/export (excluding OS keyring secrets).
- [ ] **P1 — Unit-scoped v2 `ExamBlueprint` & flagship content depth**: expose
  optional unit `exam_rules` in `contracts/course/v2/manifest.schema.json` wired
  to `internal/study/exam_rules.go`, add lightweight structural gates for
  concept-less certification banks, and deepen flagship packs
  (`elementary-chinese` v2 + 2–3 STEM/cert packs).
- [ ] **P1 — Scoped provider portability & concurrency**: optional
  `/v1/chat/completions` adapter for local loopback LLMs (Ollama/llama.cpp with
  capability flags), TTS provider interface + WAV cache cap, and SQLite WAL
  1-writer/N-reader pool split once contention is measured.
- [ ] **P2 — Unified proactive SRS, cumulative multi-unit mock exams, and
  measured `course_assets` externalization**.

See [README.md](README.md) for setup, [AGENTS.md](AGENTS.md) for repository
rules, and [CHANGELOG.md](CHANGELOG.md) for unreleased changes.
