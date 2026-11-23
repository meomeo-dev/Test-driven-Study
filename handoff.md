# Development Handoff

Updated 2026-11-23 (America/New_York). Baseline `#89` on `main` (following
`da0e9a3`; local commits ahead of `origin/main`, not pushed).

## Recent completed work (2026-11-23)

- **Repository skills & workflow**:
  - [#83](issues/0083-chore-add-desktop-gui-design-knowledge-repository-skill.md)
    (`138cbc8`): added the `desktop-gui-design-knowledge` repository skill.
  - [#84](issues/0084-feat-upgrade-curriculum-batch-workflow-to-agy-ultra-and-bounded-p.md)
    (`de981e2`): modularized `scripts/curriculum_batch_workflow.py` into
    `scripts/curriculum_workflow/` with headless `agy-ultra` defaults, bounded
    parallelism, atomic `progress.json`, and offline unit tests.
- **P0 roadmap (`#85`–`#89`, all closed on `main`)**:
  - [#85](issues/0085-fix-fix-learning-route-written-feedback-tts-test-and-review-cool.md)
    (`a154e57`): fixed built-mode `/learning` SPA routing, extended
    `written_feedback` HTTP write deadlines + strict `json_schema` + fixture
    routing, aligned DeepSeek TTS `Test()` to send `"voice_id"`, and excluded
    24h-cooldown `learning` items from active review practice queues.
  - [#86](issues/0086-feat-add-explicit-allow-direct-https-opt-in-for-ai-and-tts-provid.md)
    (`09fd0c8`): added manual, default-off `"Allow direct HTTPS"`
    (`allow_direct_https`) opt-in across LLM, Image/Palace, and TTS settings,
    OpenAPI contracts, Go transports, and Settings UI while enforcing explicit
    proxy-by-default and zero silent direct fallback.
  - [#87](issues/0087-feat-persist-written-evaluations-and-add-offline-rubric-self-chec.md)
    (`a24c65c`): added immutable append-only `attempt_evaluations` migration
    (`00017`), `COALESCE(ev.passed, a.is_correct)` mastery wiring across review
    book / analysis / concepts, cached persisted LLM evaluations (`cached: true`),
    and offline rubric/reference self-check in Practice review UI.
  - [#88](issues/0088-feat-add-local-zip-course-import-and-lifecycle-management.md)
    (`07c5fea`): added bounded/safe `.zip` course loading and deterministic
    `PackZip`, `cmd/course` `pack`/`deactivate`/`rollback`, non-destructive
    version lifecycle APIs (`GET /api/courses/packages`, multipart
    `POST /api/courses/install`, activate/deactivate) preserving `question_keys`
    and learner history, and `/courses` package management UI.
  - [#89](issues/0089-chore-upgrade-course-scaffold-to-v2-unify-audit-and-add-ci.md):
    upgraded `course:new` (`course.Scaffold`) to `protocol_version: 2`, extended
    `cmd/course install` for multi-path installs, added unified
    `npm run course:audit` (`scripts/course-audit.mjs`), switched Playwright E2E
    to batch-install fixtures and serve compiled `var/bin/test-driven-study`,
    and added `.github/workflows/ci.yml`.

## Course packages and authoring

| Package | Active local version | Coverage |
| --- | --- | --- |
| [Golden course template](courses/golden-course-template/README.md) | 1.4.0 | 15 items across all nine question types, a five-concept learning path, aligned reading/listening translations, and 12 vocabulary entries with TTS and grammar notes. |
| [Beginner English](courses/beginner-english/README.md) | 2.4.0 | 10 units, 41 concepts, 424 items, translations for all 39 reading and 59 listening questions, and 71 vocabulary entries with TTS overrides and minimalist grammar notes. |
| [Elementary Chinese](courses/elementary-chinese/course.json) | 1.0.4 | Local Pinyin for fill-in stems and combined Pinyin and Han speech for explanations. |

The 16 non-flagship engineering, mathematics, and legacy courses live in
`/Volumes/1TB-ZYJ/git/Test-driven-Study-Courses`
([#82](issues/0082-chore-split-non-flagship-courses-into-test-driven-study-courses.md),
`1733272`), leaving only the three flagship packages above in
`courses/defaults.json`. Use `npm run course:audit -- [--strict] <dir>` and
local `.zip` import (`/courses` or `cmd/course install`) to validate and
upgrade courses while preserving learner history.

## Verification (2026-11-23, complete P0 gate on `#89`)

- `GOMODCACHE=/Users/luojin/go/pkg/mod npm run check:generated`: PASS (HTTP
  types and SQL bindings current).
- `go test -count=1 ./...` & `go vet ./...`: PASS (`10/10` packages ok).
- `npm run typecheck && npm run test:unit`: PASS (`tsc --noEmit` 0 errors;
  Vitest `18/18` files, `81/81` tests).
- `node --test scripts/course-audit.test.mjs scripts/audit-course-effort.test.mjs`:
  PASS (`12/12` tests).
- `npm run course:audit`: PASS on `courses/golden-course-template` (default,
  `4/4` gates), `--strict` on `courses/beginner-english` (`4/4`, `η=1.04`),
  `--strict` on `courses/elementary-chinese` (`3` pass, `1` skipped vocabulary),
  and `--strict` on a freshly scaffolded `course:new` v2 package (`3` pass, `1`
  skipped vocabulary, `η=1.06`).
- `npm run test:startup`: PASS (`4/4` tests).
- `npm run build`: PASS (`tsc --noEmit` + `vite build` 3369 modules +
  `go build ./cmd/server`).
- `npm run test:e2e`: PASS (`29/29` Playwright browser tests in `1.1m` against
  compiled `var/bin/test-driven-study` on isolated ports `43287`/`43288`/`43289`).
- `git diff --check`, `gofmt -l`, and `node scripts/issue-check.mjs`: PASS
  (`89/89` issues valid).

## Next steps

- Review local commits on `main` (`#83`–`#89`) and push when ready.
- Proceed to P1 roadmap items (e.g., unit-scoped `exam_rules`, embedded binary +
  backup/restore, or flagship v2 course pack expansions) via new numbered issues.

See [README.md](README.md) for setup, [AGENTS.md](AGENTS.md) for repository
rules, and [CHANGELOG.md](CHANGELOG.md) for unreleased changes.
