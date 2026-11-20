---
id: 0072
type: feat
status: closed
closed-by: 45df0fb
labels: [course, tooling, curriculum]
branch: feat/0072-add-course-effort-audit-and-recalibrate-beginner-english
created: 2026-11-20
---
# Add course effort audit and recalibrate beginner-english

## 背景 / 目标

Course packages previously declared `estimated_minutes` per concept without a
bottom-up effort model linking lesson depth, practical workshops, and typed
question bank density to declared hours. Meanwhile, `curriculum_batch_workflow.py`
drafted lessons from research topics without decomposing `duration_minutes` into
explicit concept budgets and typed item quotas, and `beginner-english@2.0.0`
only carried 216 items against 2,240 declared minutes (`37.33h`). Add a shared
effort quality gate, a course-package design skill, budget-first batch authoring,
and recalibrate `beginner-english` to `2.1.0`.

## 关键功能清单（Key Feature List，KFL）

- Add `scripts/lib/effort-audit.mjs`, `scripts/audit-course-effort.mjs`, and
  `scripts/audit-course-effort.test.mjs` implementing a bottom-up 5-layer effort
  model across concept lessons, structured labs (`effort-lab` / speaking tasks),
  and all 9 v2 question types.
- Add repository skill `.agents/skills/design-course-package/` (`SKILL.md`,
  `agents/openai.yaml`, `references/package-and-effort-spec.md`) and track it
  in `.gitignore`.
- Update `scripts/curriculum_batch_workflow.py` to plan upfront concept time
  budgets and typed question quotas before drafting content, gated by
  `audit-course-tts`, `audit-course-effort`, and `course:check`.
- Upgrade `courses/beginner-english` to `2.1.0` (`424` items across all 9 v2
  types, enriched lessons across all 10 units, `2,240` declared minutes).

## 改造面

- `scripts/lib/effort-audit.mjs`, `scripts/audit-course-effort.mjs`,
  `scripts/audit-course-effort.test.mjs`, and `scripts/curriculum_batch_workflow.py`
- `.agents/skills/design-course-package/` and `.gitignore`
- `courses/beginner-english/` (`course.json`, `README.md`, 10 `lessons/*.md`,
  10 `questions/*.json`)
- `CHANGELOG.md` and `handoff.md`

## 非目标

- Recalibrating the remaining fifteen legacy 30-hour engineering/math courses.
- Modifying runtime SQLite schema, Go grading services, or frontend React views.

## 验收标准（Acceptance Criteria，AC）

- `node --test scripts/audit-course-effort.test.mjs` passes all unit tests.
- `npm run course:check -- courses/beginner-english` validates `2.1.0` (`10`
  units, `41` concepts, `424` tagged items, `0` untagged items) with all 216
  original IDs preserved.
- `audit-course-tts` passes with `0` errors and `0` warnings; `audit-course-effort`
  `--strict` passes with `0` errors and `0` warnings (`η = 1.04`).
- Full repository checks and rebuilt/restarted local service expose
  `beginner-english@2.1.0` with `10` units and `424` items.

## 讨论

Bottom-up accounting attributes shared unit markdown sections evenly across
unanchored graded concepts unless explicit `<!-- concepts: ... -->` markers are
present, and scores multi-stage lab workshops via explicit `<!-- effort-lab: ... -->`
or structured speaking stages so self-check practice hours do not require fake
auto-graded MCQs.

### Verification

- `node --test scripts/audit-course-effort.test.mjs`: 6/6 passed.
- `npm run course:check -- courses/beginner-english`: `beginner-english@2.1.0:
  10 units, 424 items` (`concepts: 41, prerequisite groups: 36, tagged items:
  424, untagged items: 0`).
- `audit-course-tts.mjs courses/beginner-english --json`: 10 files, 424 items,
  0 errors, 0 warnings.
- `audit-course-effort.mjs courses/beginner-english --strict`: declared `2240m`
  vs design `2337.27m` (`η=1.04`, first-pass `1280.71m`, 0 errors, 0 warnings).
- `npm run issue:check`, `npm run check:generated`, `npm run test:unit` (14 files,
  57 tests), `npm run test:go`, `npm run test:startup` (4/4), `npm run build`, and
  `npm run test:e2e` (18/18) all passed.
