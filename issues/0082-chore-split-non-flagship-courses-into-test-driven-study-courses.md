---
id: 0082
type: chore
status: closed
closed-by: 1733272
labels: [course, repository]
branch: chore/0082-split-non-flagship-courses-into-test-driven-study-courses
created: 2026-11-20
---
# Split non-flagship courses into Test-driven-Study-Courses

## 背景 / 目标

Keep only the three primary course packages (`beginner-english`,
`elementary-chinese`, and `golden-course-template`) inside this application
repository, and split all other 16 courses out into a standalone repository at
`/Volumes/1TB-ZYJ/git/Test-driven-Study-Courses` so application runtime changes
and extra domain course banks evolve independently.

## 关键功能清单（Key Feature List，KFL）

- Create standalone git repository `/Volumes/1TB-ZYJ/git/Test-driven-Study-Courses`
  containing the 16 extracted courses (`basic-math`, `cad-fdm-printing`,
  `circuit-fundamentals`, `c-programming`, `embedded-mcu`,
  `python-programming`, `machine-vision`, `tolerances-metrology`,
  `applied-machine-learning`, `industrial-automation`, `pcb-design`,
  `algebra-geometry`, `engineering-calculus`, `linear-algebra`,
  `probability-statistics`, `automatic-control`) plus `README.md`.
- Keep only `beginner-english`, `elementary-chinese`, and
  `golden-course-template` (alongside scaffold `starter/` + `prompts.go`) in
  `courses/` and update `courses/defaults.json`.
- Decouple Go, Vitest/Node, and Playwright tests from the extracted packages
  using `tests/fixtures/courses/` and retained bundled courses without losing test
  coverage.
- Update `README.md`, `README.zh-CN.md`, `CHANGELOG.md`, and `handoff.md`.

## 改造面

- `courses/` (`defaults.json`, removal of 16 split directories)
- `/Volumes/1TB-ZYJ/git/Test-driven-Study-Courses/` (new standalone repo)
- `tests/fixtures/courses/`, `playwright.config.ts`, `tests/browser/*.spec.ts`
- `internal/course/`, `internal/storage/`, `internal/study/`, `internal/httpapi/`,
  `internal/tasktrace/`, `scripts/audit-course-effort.test.mjs`
- `README.md`, `README.zh-CN.md`, `CHANGELOG.md`, `handoff.md`

## 非目标

- Re-authoring or recalibrating the 16 extracted courses inside the new repo.
- Modifying runtime SQLite learner data in `var/`.

## 验收标准（Acceptance Criteria，AC）

- `courses/` retains strictly `beginner-english`, `elementary-chinese`,
  `golden-course-template`, `defaults.json`, `starter/`, and `prompts.go`.
- `/Volumes/1TB-ZYJ/git/Test-driven-Study-Courses` contains all 16 extracted
  courses committed cleanly on `main`.
- `npm run check` (`issue:check`, `check:generated`, `test:unit`, `test:go`,
  `test:startup`, `build`, `test:e2e`) and `node --test scripts/audit-course-effort.test.mjs`
  pass completely with zero skipped tests.

## 讨论

Moving test dependencies (roadmap graph fixtures and math palace/exam fixture)
into `tests/fixtures/courses/` isolates acceptance and Go tests cleanly from
bundled product courses while keeping user installations focused on the three
retained courses.

### Verification

- `/Volumes/1TB-ZYJ/git/Test-driven-Study-Courses` initialized on `main`
  (`5163522`, 324 files across 16 course packages + `courses/defaults.json` +
  `README.md`).
- `courses/` retains `beginner-english`, `elementary-chinese`,
  `golden-course-template`, `defaults.json`, `starter/`, and `prompts.go`;
  `npm run course:check` passed on all three retained packages.
- `node --test scripts/audit-course-effort.test.mjs`: `6/6` passed.
- `npm run check`: `issue:check` (`0001–0082`), `check:generated`, `test:unit`
  (`62/62`), `test:go` (all packages), `test:startup` (`4/4`), `build`, and
  `test:e2e` (`29/29` Playwright specs) all passed cleanly.
