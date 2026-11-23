---
id: 0088
type: feat
status: open
labels: [courses, storage, httpapi, cli, ui]
branch: feat/0088-add-local-zip-course-import-and-lifecycle-management
created: 2026-11-23
---
# Add local zip course import and lifecycle management

## 背景 / 目标

Installing, upgrading, rolling back, or deactivating external course packages
(such as releases downloaded from `Test-driven-Study-Courses`) currently
requires running `course:install` against an unpacked directory on the command
line and provides no UI or CLI support for `.zip` archives, version switching,
rollback, or non-destructive deactivation.

This feature adds safe local `.zip` archive loading and deterministic packing,
non-destructive course version lifecycle management in SQLite and `cmd/course`,
bounded multipart upload and lifecycle HTTP endpoints, and a `/courses` package
management UI that preserves `question_keys` and learner study history.

## 关键功能清单（Key Feature List，KFL）

- Add `internal/course/archive.go` (`LoadPath`, `LoadZipBytes`, `PackZip`)
  supporting both unpacked directories and `.zip` archives (root `course.json`
  or single top-level directory containing `course.json`), deterministic zip
  packing skipping `.DS_Store`, extraction into a cleaned temp dir with full
  `course.Load` validation strictly outside any SQLite transaction, and hard
  safety limits rejecting zip-slip (`..`, absolute paths, drive letters),
  symlinks, non-regular entries, `> 2000` files, `> 64 MiB` total uncompressed
  size, and `> 24 MiB` single files.
- Extend `cmd/course/` so `check` and `install` accept directories or `.zip`
  files, and add `pack`, `deactivate`, and `rollback` subcommands with tests.
- Add storage lifecycle operations in `internal/storage/`
  (`ListInstalledPackages`, `ActivateCourseVersion`, `DeactivateCourse`,
  `RollbackCourse`) that reproject the active workspace cleanly while preserving
  `course_versions`, `question_keys`, `answer_attempts`, and
  `memorization_progress` across upgrades, rollbacks, deactivation, and
  re-activation, keeping `storage.InstallCourse` and `GET /api/courses`
  backward compatible.
- Update `contracts/http/openapi.yaml` and regenerate `web/src/api/generated/`
  (plus `db/queries.sql` / `internal/storage/storedb/` as needed) with:
  - `GET /api/courses/packages` returning installed courses (active and
    inactive) and their version lists.
  - `POST /api/courses/install` accepting bounded `multipart/form-data` (`file`,
    `<= 64 MiB` via `http.MaxBytesReader`), allowing multipart strictly on this
    route while retaining `localOnly` checks and JSON enforcement elsewhere.
  - `POST /api/courses/{course}/versions/{version}/activate` and
    `POST /api/courses/{course}/deactivate`.
- Add local `.zip` upload (`导入本地课程包（.zip）`) and installed version
  lifecycle controls (`切换此版本` / `启用` / `停用` with inline confirmation
  and history-preservation note) in `web/src/api/courses.ts` and
  `web/src/features/courses/`, preserving existing `/courses` catalog and
  `RoadmapTab` behavior.
- Add Go and Vitest unit/integration tests covering archive safety limits,
  lifecycle persistence/history preservation, `localOnly` protection, CLI
  commands, and UI package management flows.

## 改造面

- `internal/course/archive.go` and `internal/course/archive_test.go`
- `cmd/course/` (`main.go` and tests)
- `db/queries.sql`, `internal/storage/storedb/`, `internal/storage/`
  (`courses.go`, `workspace.go`, tests), and `internal/study/courses.go`
- `contracts/http/openapi.yaml`, `web/src/api/generated/`, and
  `internal/httpapi/` (`server.go`, `courses.go`, tests)
- `web/src/api/courses.ts` and `web/src/features/courses/` (components, styles,
  and Vitest tests)

## 非目标

- Fetching remote course catalogs or auto-downloading packages over the network.
- Deleting learner study records, `question_keys`, or historical
  `course_versions` on deactivation or rollback.
- Adding authentication or relaxing `localOnly` host/origin enforcement.

## 验收标准（Acceptance Criteria，AC）

- `LoadPath` / `LoadZipBytes` reject zip-slip, symlinks, non-regular entries,
  excessive file counts (`> 2000`), and oversize archives (`> 64 MiB` total /
  `> 24 MiB` single file), while accepting valid root or single-top-dir `.zip`
  packages produced by `PackZip`.
- Installing `.zip` packages, upgrading, rolling back, deactivating, and
  re-activating preserve stable `question_keys`, `answer_attempts`, and
  `memorization_progress` without leaving dangling active workspace rows for
  deactivated courses.
- `POST /api/courses/install` enforces `localOnly` and `64 MiB` upload bounds
  and validates outside SQLite transactions; all other mutation endpoints keep
  strict JSON Content-Type validation.
- `/courses` supports local `.zip` import and version activate/deactivate while
  keeping existing catalog and `RoadmapTab` views intact.
- `GOMODCACHE=/Users/luojin/go/pkg/mod npm run check:generated`,
  `go test -count=1 ./...`, `go vet ./...`, `npm run typecheck`,
  `npm run test:unit`, `npm run build`, `git diff --check`, and
  `node scripts/issue-check.mjs` all pass cleanly.

## 讨论

- Extracting and running full `course.Load` validation in a temporary directory
  before opening any SQLite write transaction ensures malformed archives never
  hold database write locks or leave partial state behind.
