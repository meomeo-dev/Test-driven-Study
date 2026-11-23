---
id: 0089
type: chore
status: closed
closed-by: bc1aeb3
labels: [courses, tooling, ci, testing]
branch: chore/0089-upgrade-course-scaffold-to-v2-unify-audit-and-add-ci
created: 2026-11-23
---
# Upgrade course scaffold to v2, unify audit, and add CI

## 背景 / 目标

Course authoring and repository verification currently have four remaining P0
tooling gaps:

1. `course.Scaffold` (`course:new`) still emits a protocol v1 skeleton instead
   of a valid v2 course package aligned with `contracts/course/v2/` and
   `golden-course-template`.
2. Validating a course package requires invoking four separate commands
   (`course:check`, effort audit, TTS audit, and vocabulary audit) with no
   single unified entrypoint.
3. Playwright E2E setup compiles and runs `go run ./cmd/course install` once
   per fixture course and boots both `go run ./cmd/server` and the Vite dev
   server instead of batch-installing and serving the compiled binary
   `var/bin/test-driven-study`.
4. There is no GitHub Actions workflow enforcing `npm run check`, script unit
   tests, and `course:audit --strict` on pushes and pull requests.

This chore resolves all four tooling gaps and updates `handoff.md` and
`CHANGELOG.md` for the completed P0 roadmap (`#85`–`#89`).

## 关键功能清单（Key Feature List，KFL）

- Upgrade `internal/course/author.go` (`course.Scaffold` / `course:new`) to
  emit a minimal valid `protocol_version: 2` course package (unit, lesson,
  concept graph with `estimated_minutes` and anchored `question_ids`, v2
  `questions/*.json` using `grading.value` and rich `analysis`) that passes
  `course.Load`, `audit-course-tts.mjs`, and `audit-course-effort.mjs`, with
  updated and regression tests.
- Extend `cmd/course/main.go` `install` to accept one or more course
  directories/zips in a single invocation (`course install [--data-dir <dir>]
  <path1> [path2 ...]`) while preserving single-path backward compatibility,
  with unit tests in `cmd/course/main_test.go`.
- Add `scripts/course-audit.mjs` + `scripts/course-audit.test.mjs` and wire
  `"course:audit": "node scripts/course-audit.mjs"` in `package.json`, running
  `course check`, `audit-course-effort.mjs`, `audit-course-tts.mjs`, and
  conditional `audit-course-vocabulary.mjs` (reporting `SKIP` when no
  `vocabulary_file` is declared) with clear per-gate PASS/FAIL/SKIP summaries
  and `--strict` support.
- Optimize `playwright.config.ts` to batch-install all fixture courses in one
  `cmd/course install` invocation and serve the compiled binary
  `var/bin/test-driven-study` while keeping isolated test ports
  (`43287`/`43288`/`43289`) and isolated temp data dirs separate from learner
  `var/`.
- Add `.github/workflows/ci.yml` triggering on `push` to `main` and
  `pull_request`, caching npm and Go modules, pre-fetching
  `github.com/sqlc-dev/sqlc@v1.31.1` for offline `check:generated`, installing
  Playwright Chromium, and running `npm run check`, script unit tests, and
  `npm run course:audit -- --strict` on `golden-course-template`,
  `beginner-english`, and `elementary-chinese`.
- Update `handoff.md` (dated `2026-11-23`) and `CHANGELOG.md` (`[Unreleased]`)
  to record completed P0 work (`#85`–`#89`) and full verification outcomes.

## 改造面

- `internal/course/author.go` and `internal/course/*_test.go`
- `cmd/course/main.go` and `cmd/course/main_test.go`
- `scripts/course-audit.mjs`, `scripts/course-audit.test.mjs`, and `package.json`
- `playwright.config.ts`
- `.github/workflows/ci.yml`
- `handoff.md` and `CHANGELOG.md`

## 非目标

- Rewriting existing Node course auditors into Go or changing course package
  schemas/content.
- Modifying runtime study, storage, or UI application behavior.
- Touching learner data under `var/` or pushing commits to remote repositories.

## 验收标准（Acceptance Criteria，AC）

- A newly scaffolded `course:new` package has `protocol_version: 2` and passes
  `course.Load`, `audit-course-tts.mjs`, and `audit-course-effort.mjs`.
- `cmd/course install` accepts both single and multiple paths/zips in one run.
- `npm run course:audit -- --strict` passes on `courses/golden-course-template`,
  `courses/beginner-english`, and `courses/elementary-chinese`, and
  `node --test scripts/course-audit.test.mjs scripts/audit-course-effort.test.mjs`
  passes.
- Full acceptance gate passes cleanly: `npm run check:generated`,
  `go test -count=1 ./...`, `go vet ./...`, `npm run typecheck`,
  `npm run test:unit`, `npm run test:startup`, `npm run build`,
  `npm run test:e2e`, `git diff --check`, and `node scripts/issue-check.mjs`.
- `handoff.md` and `CHANGELOG.md` concisely reflect `#85`–`#89` and observed
  verification results.

## 讨论

- Serving the compiled binary `var/bin/test-driven-study` in Playwright E2E
  exercises the exact production SPA + API routing path (including `/learning`
  from `#85`) while cutting startup overhead and keeping full port and data
  isolation.
- Per coordinator confirmation, `course:audit --strict` stays strict: CI runs
  default `npm run course:audit -- courses/golden-course-template` (preserving
  its 5 documented demo effort warnings matching `audit-course-effort.test.mjs`)
  and `npm run course:audit -- --strict` on `courses/beginner-english` and
  `courses/elementary-chinese`.

### Verification

- `GOMODCACHE=/Users/luojin/go/pkg/mod npm run check:generated`: passed
  (`Generated HTTP types and SQL bindings are current.`).
- `GOMODCACHE=/Users/luojin/go/pkg/mod go test -count=1 ./...` and
  `go vet ./...`: passed (`10/10` packages ok).
- `npm run typecheck && npm run test:unit`: passed (`tsc --noEmit` 0 errors;
  Vitest `18/18` files, `81/81` tests passed).
- `node --test scripts/course-audit.test.mjs scripts/audit-course-effort.test.mjs`:
  passed (`12/12` tests).
- `npm run course:audit -- courses/golden-course-template`: passed (`4` pass,
  `0` skip, `0` fail).
- `npm run course:audit -- --strict courses/beginner-english`: passed (`4` pass,
  `0` skip, `0` fail; `η=1.04`).
- `npm run course:audit -- --strict courses/elementary-chinese`: passed
  (`3` pass, `1` skipped vocabulary, `0` fail).
- Fresh `course:new` v2 smoke test + `course:audit --strict`: passed (`3` pass,
  `1` skipped vocabulary, `0` fail; `η=1.06`).
- `npm run test:startup`: passed (`4/4` tests).
- `GOMODCACHE=/Users/luojin/go/pkg/mod npm run build`: passed (`tsc --noEmit`,
  `vite build` 3369 modules, and `go build ./cmd/server`).
- `GOMODCACHE=/Users/luojin/go/pkg/mod npm run test:e2e`: passed (`29/29`
  Playwright browser tests in `1.1m` against compiled `var/bin/test-driven-study`).
- `git diff --check`, `gofmt -l`, and `node scripts/issue-check.mjs`: all clean
  (`89/89` issues valid).
