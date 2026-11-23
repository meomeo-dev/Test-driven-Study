# Development Handoff

Updated 2026-11-23 (America/New_York). Baseline `2515e23` on `main` (all 12
merged local issue branches deleted; zero linked worktrees; background dev
service stopped on ports `43387`/`43388`).

> Static architecture, invariants, and workflow rules live in
> [AGENTS.md](AGENTS.md). This file captures dynamic working memory: recent
> milestones, locked-in decisions, hard-learned lessons, verified commands, and
> prioritized next steps.

## Completed work (2026-11-23)

- **Repository skills, issue hygiene & workflow**:
  - [#83](issues/0083-chore-add-desktop-gui-design-knowledge-repository-skill.md)
    (`138cbc8`): installed `.agents/skills/desktop-gui-design-knowledge/` (13
    files) as the tracked prerequisite for Tauri 2 desktop GUI work.
  - Closed obsolete issues [#27](issues/0027-feat-replicate-the-current-yunnan-theory-examination-terminal.md)
    and [#52](issues/0052-feat-expand-sample-courses-to-180-hour-standard-curriculum.md)
    (`3252126`): Yunnan driving course removed/unused; 16 sample courses were
    extracted into `Test-driven-Study-Courses` in `#82` (`1733272`).
  - [#84](issues/0084-feat-upgrade-curriculum-batch-workflow-to-agy-ultra-and-bounded-p.md)
    (`de981e2`): modularized `scripts/curriculum_batch_workflow.py` into
    `scripts/curriculum_workflow/` with headless `agy-ultra` defaults, bounded
    parallelism, atomic `progress.json`, and 53 offline unit tests.
- **P0 roadmap (`#85`–`#89`, all verified, closed, and merged onto `main`)**:
  - [#85](issues/0085-fix-fix-learning-route-written-feedback-tts-test-and-review-cool.md)
    (`a154e57`): added `/learning` to built-mode SPA routing (`isFrontendRoute`),
    extended `written_feedback` write deadline to 105s + strict `json_schema` +
    fixture routing (`tests/fixtures/image-provider.mjs`), fixed DeepSeek TTS
    `Test()` to send `"voice_id"`, and excluded 24h/interval-cooldown `learning`
    items from active review practice queues while preserving review-book counts.
  - [#86](issues/0086-feat-add-explicit-allow-direct-https-opt-in-for-ai-and-tts-provid.md)
    (`09fd0c8`): preserved explicit proxy-by-default with zero silent direct
    fallback while adding manual, default-off `"Allow direct HTTPS"`
    (`allow_direct_https`) opt-in across LLM, Image/Palace, and TTS configs,
    transports, OpenAPI contracts, and Settings UI.
  - [#87](issues/0087-feat-persist-written-evaluations-and-add-offline-rubric-self-chec.md)
    (`a24c65c`): added immutable append-only `attempt_evaluations` (`00017`),
    `LEFT JOIN` `COALESCE(ev.passed, a.is_correct)` mastery wiring across review
    book / analysis / practice / concepts, cached LLM feedback reuse
    (`cached: true`), and offline rubric/reference self-check in Practice review.
  - [#88](issues/0088-feat-add-local-zip-course-import-and-lifecycle-management.md)
    (`07c5fea`): added bounded/safe `.zip` course loading (`os.OpenRoot`,
    zip-slip/symlink/size guards, extracted outside SQLite tx) and deterministic
    `PackZip`, `cmd/course` `pack`/`deactivate`/`rollback`, non-destructive
    lifecycle endpoints (`GET /api/courses/packages`, multipart
    `POST /api/courses/install`, activate/deactivate) preserving `question_keys`
    and learner history, and `/courses` package management UI.
  - [#89](issues/0089-chore-upgrade-course-scaffold-to-v2-unify-audit-and-add-ci.md)
    (`bc1aeb3`): upgraded `course:new` (`course.Scaffold`) to `protocol_version: 2`,
    added multi-path `cmd/course install`, added unified `npm run course:audit`
    (`scripts/course-audit.mjs`), updated `playwright.config.ts` to batch-install
    fixtures and test compiled `var/bin/test-driven-study`, and added
    `.github/workflows/ci.yml`.

## Decisions & lessons learned

1. **Tauri 2 desktop shell (P1 packaging decision)**: Maintainer selected a
   Tauri 2 desktop shell over a standalone browser-launching binary, gated on
   `.agents/skills/desktop-gui-design-knowledge/` (`#83`) and `macos-app-audit`.
2. **Remote AI/TTS proxy policy**: Keep strict explicit proxy by default with
   no silent direct fallback; allow direct remote HTTPS only via manual per-tab
   opt-in (`allow_direct_https`, `#86`). Unauthenticated LAN access remains an
   explicit non-goal.
3. **Offline `sqlc` cache path**: When running inside an agent profile whose
   `HOME` differs from `/Users/luojin`, pass `GOMODCACHE=/Users/luojin/go/pkg/mod`
   so `npm run generate:db` and `npm run check:generated` locate cached
   `sqlc@v1.31.1` offline.
4. **Monotonic written evaluation state**: Returning an older cached LLM row
   (`cached: true`, lower `id`) must never overwrite a newer persisted
   `self_check` evaluation in Practice UI (enforced via `shouldPromoteEvaluation`
   / `pickLatestEvaluation` in `web/src/features/question-types/shared/written-evaluation.ts`).
5. **Deactivated default courses & startup seeding**: `storage/courses.go`
   `seedCourse` checks `CountCourseVersions > 0` so restarting the server never
   silently reactivates a course the learner intentionally deactivated.
6. **Audit strictness across bundled packs**: `courses/golden-course-template@1.4.0`
   intentionally passes default `course:audit` (5 demo effort warnings);
   `courses/beginner-english` and `courses/elementary-chinese` pass `--strict`.

## Course packages

| Package | Active local version | Coverage |
| --- | --- | --- |
| [Golden course template](courses/golden-course-template/README.md) | 1.4.0 | 15 items across all nine question types, a five-concept learning path, aligned reading/listening translations, and 12 vocabulary entries with TTS and grammar notes. |
| [Beginner English](courses/beginner-english/README.md) | 2.4.0 | 10 units, 41 concepts, 424 items, translations for all 39 reading and 59 listening questions, and 71 vocabulary entries with TTS overrides and minimalist grammar notes. |
| [Elementary Chinese](courses/elementary-chinese/course.json) | 1.0.4 | Local Pinyin for fill-in stems and combined Pinyin and Han speech for explanations. |

The 16 extracted engineering, mathematics, and legacy courses live in
`/Volumes/1TB-ZYJ/git/Test-driven-Study-Courses` (`#82`, `1733272`).

## Verification (2026-11-23, complete P0 gate on `#89`)

- `GOMODCACHE=/Users/luojin/go/pkg/mod npm run check:generated`: PASS (OpenAPI
  types and SQLite `storedb` zero drift).
- `go test -count=1 ./...` & `go vet ./...`: PASS (`10/10` packages ok).
- `npm run typecheck && npm run test:unit`: PASS (`tsc --noEmit` 0 errors;
  Vitest `18/18` files, `81/81` tests).
- `node --test scripts/course-audit.test.mjs scripts/audit-course-effort.test.mjs`:
  PASS (`12/12` tests).
- `npm run course:audit`: PASS on `courses/golden-course-template` (default,
  `4/4`), `--strict` on `courses/beginner-english` (`4/4`, `η=1.04`),
  `--strict` on `courses/elementary-chinese` (`3` pass, `1` skipped vocabulary),
  and `--strict` on a freshly scaffolded `course:new` v2 pack (`η=1.06`).
- `npm run test:startup`: PASS (`4/4` tests).
- `npm run build`: PASS (`tsc --noEmit` + `vite build` 3369 modules +
  `go build ./cmd/server`).
- `npm run test:e2e`: PASS (`29/29` Playwright browser tests in `1.1m` against
  compiled `var/bin/test-driven-study` on isolated ports `43287`/`43288`/`43289`).
- `git diff --check`, `gofmt -l`, and `node scripts/issue-check.mjs`: PASS
  (`89/89` issues valid).

## Next steps (P1–P2 prioritized backlog)

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
  concept-less certification banks, split `scripts/curriculum_workflow/`
  templates by domain (`language`/`stem`/`certification`), and deepen flagship
  packs (`elementary-chinese` v2 + 2–3 STEM/cert packs).
- [ ] **P1 — Scoped provider portability & concurrency**: optional
  `/v1/chat/completions` adapter for local loopback LLMs (Ollama/llama.cpp with
  capability flags), TTS provider interface + WAV cache cap, and SQLite WAL
  1-writer/N-reader pool split once contention is measured.
- [ ] **P2 — Unified proactive SRS, cumulative multi-unit mock exams, and
  measured `course_assets` externalization**.

See [README.md](README.md) for setup, [AGENTS.md](AGENTS.md) for repository
rules, and [CHANGELOG.md](CHANGELOG.md) for unreleased changes.
