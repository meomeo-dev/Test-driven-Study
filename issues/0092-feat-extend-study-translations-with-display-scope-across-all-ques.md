---
id: 0092
type: feat
status: closed
closed-by: ec5307b
labels: [course, schema, frontend, backend, english]
branch: feat/0092-extend-study-translations-with-display-scope-across-all-ques
created: 2026-11-27
---
# Extend study translations with display scope across all question types

## 背景 / 目标

Currently `study_translation` in the v2 course contract is restricted to
`reading_comprehension` and `listening` items (`material` + `sub_questions`) and
has no declarative surface-visibility control. As a result:

1. In `courses/beginner-english@2.5.0` (507 items) and
   `courses/golden-course-template@1.4.0` (15 items), English content in
   `single_choice`, `multiple_choice`, `true_false`, `numeric`, `cloze`, and
   `writing` items lacks aligned Chinese translations (331 items in
   `beginner-english`, 8 items in `golden-course-template`).
2. In the floating Typing Study module (`web/src/features/typing/`), multi-sentence
   transcript lines or passage segments only attached their translation hint to
   the first split sentence, dropping aligned Chinese hints on subsequent
   sentences within the same turn (affecting 43 of 67 listening items in
   `beginner-english`), and `en_to_zh` translation source sentences did not
   display their paired reference translation hint.
3. Course authors need a declarative display-scope attribute array (`display_in`)
   to specify exactly which UI surfaces display each item's translations—some
   items across multiple surfaces, others selectively on one or two surfaces—while
   preserving strict review-only protection (never leaking translations before
   practice submission or during an active mock exam).

## 关键功能清单（Key Feature List，KFL）

1. **Unified v2 `study_translation` contract + `display_in` array across all 9 question types**:
   - Extend `contracts/course/v2/items.schema.json`, `internal/course/study_translation.go`,
     and `internal/course/item_kind.go` so all 9 v2 question types accept optional
     `study_translation` with:
     - `display_in?: Array<'memorize' | 'practice_review' | 'exam_review' | 'typing' | 'palace'>`
       (non-empty unique enum array; omitted defaults to all 5 surfaces for
       backward compatibility).
     - `stem?: string` (all 9 types).
     - `options?: Record<string, string>` (`single_choice`, `multiple_choice`,
       `true_false`, validated against declared option IDs).
     - `material?: string[]` (`reading_comprehension`, `listening`, and `cloze`
       completed passage, count-aligned to source segments/lines).
     - `sample_response?: string[]` (`writing`, count-aligned to nonblank
       `sample_response` segments).
     - `sub_questions?: Record<string, { stem?, options? }>` (`reading_comprehension`,
       `listening`).
   - Require at least one translation content field and reject blank strings or
     fields inapplicable to the item's question type.
2. **Backend projection, OpenAPI contract, and review-only redaction**:
   - Add optional `study_translation` to `study.Question` and optional `id` to
     `study.Option` in `internal/study/` and `contracts/http/openapi.yaml`,
     regenerating `web/src/api/generated/types.gen.ts`.
   - Keep `PublicQuestion` strictly free of `study_translation`, and redact
     `study_translation` in active in-progress mock exam reviews across all 9
     question types (releasing only after the entire paper ends).
3. **Frontend surface gating across all 5 surfaces + Typing Study multi-sentence alignment**:
   - Add a shared visibility helper (`canDisplayStudyTranslation(translation, surface)`)
     and wire `display_in` across:
     - `memorize` (Memorization card + full question modal + shared toggle for
       all 9 types: stem, options, cloze passage, writing sample, reading, listening)
     - `practice_review` (post-submit Practice review & details modal)
     - `exam_review` (finished mock exam review dialogs/feedback only)
     - `typing` (floating Typing Study window: fix multi-sentence 1-to-1 /
       context translation pairing, attach stem/option/cloze/writing/translation
       hints, and respect `display_in` including `'typing'`)
     - `palace` (Memory Palace `PalaceSource` reference card)
4. **Full English course translation coverage & version upgrade**:
   - Upgrade `courses/golden-course-template` (`1.4.0` -> `1.5.0`) to cover all
     remaining 8 English items and demonstrate both multi-surface and selective
     `display_in` configurations.
   - Upgrade `courses/beginner-english` (`2.5.0` -> `2.6.0`) to backfill aligned
     Chinese `study_translation` (with explicit `display_in`) for all 331
     remaining English items across all 12 units (preserving 100% of existing
     unit, concept, item, and option IDs), pass `course:audit --strict`, and
     install both upgraded packages into the local workspace database.
   - Update `docs/features/question-types/README.md` and
     `.agents/skills/design-course-tts/references/study-transcripts.md`.

## 改造面

- `contracts/course/v2/items.schema.json`, `contracts/course/v2/README.md`,
  `contracts/http/openapi.yaml`, `web/src/api/generated/types.gen.ts`.
- `internal/course/` (`study_translation.go`, `item_kind.go`, `extended.go`,
  `study_translation_test.go`).
- `internal/study/` (`models.go`, `type_projection.go`, `type_handler.go`,
  `study_translation_test.go`, `type_matrix_test.go`).
- `web/src/features/question-types/` (shared `study-translation.ts`, facade &
  type modules for choice/cloze/writing/reading/listening),
  `web/src/features/memorization/`, `web/src/features/practice/`,
  `web/src/features/exam/`, `web/src/features/palace/`,
  `web/src/features/typing/`.
- `courses/golden-course-template/` (`course.json`, `README.md`,
  `questions/extended-practice.json`) and `courses/beginner-english/`
  (`course.json`, `README.md`, `questions/*.json`).
- `docs/features/question-types/README.md`,
  `.agents/skills/design-course-tts/references/study-transcripts.md`,
  `tests/browser/typing-study.spec.ts`.

## 非目标

- Changing SQLite schema migrations or adding user-account preferences.
- Exposing translations before practice submission or on active unanswered/in-progress
  mock exams.
- Modifying `elementary-chinese` or existing Units 1–12 question/option IDs or
  answer keys.

## 验收标准（Acceptance Criteria，AC）

1. Go tests (`go test -count=1 ./...`) validate all 9 question types'
   `study_translation` + `display_in` rules and verify zero `study_translation`
   leakage on `PublicQuestion` or in-progress exam reviews.
2. `npm run check:generated`, `npm run typecheck`, `npm run test:unit`,
   `npm run build`, and `npx playwright test tests/browser/typing-study.spec.ts`
   pass, confirming multi-sentence listening translation pairing and selective
   `display_in` filtering across surfaces.
3. 100% of English items in `courses/golden-course-template@1.5.0` and
   `courses/beginner-english@2.6.0` pass `course:audit` (`--strict` for
   `beginner-english`) and zero English items remain without aligned Chinese
   translations (excluding `translation` items that natively pair source and
   reference).

## 讨论

- Keeping `display_in` optional with an all-5-surfaces default maintains full
  backward compatibility with every existing v2 course package while allowing
  exact per-item visibility control (`["memorize", "practice_review",
  "exam_review", "typing", "palace"]` or any non-empty subset).
- Projecting `study_translation` directly onto `study.Question` (never onto
  `PublicQuestion`) and exposing authored `id` on `study.Option` keeps option
  translation lookup resilient to option ordering across all choice types.

### Verification

- `npm run course:audit -- courses/golden-course-template`: PASS (`golden-course-template@1.5.0`, 15/15 items, 4 passed / 0 failed).
- `npm run course:audit -- --strict courses/beginner-english`: PASS (`beginner-english@2.6.0`, 12 units, 507/507 items, 4 passed / 0 failed).
- Immutability & coverage audit (`node -e` against `HEAD`): 0 mutated non-translation fields, 0 missing English items (`golden-course-template`: 13 `study_translation` + 2 native `translation`; `beginner-english`: 443 `study_translation` + 64 native `translation`).
- `npm run check:generated`: PASS (`Generated HTTP types and SQL bindings are current.`).
- `go vet ./... && go test -count=1 ./...`: PASS (`10/10` packages ok, including all-type `study_translation` + `display_in` schema/validation tests and review-only redaction tests).
- `npm run typecheck && npm run test:unit`: PASS (`tsc --noEmit` 0 errors; Vitest `21/21` files, `100/100` tests).
- `npm run build`: PASS (Vite `3379` modules + compiled `var/bin/test-driven-study`).
- `npx playwright test tests/browser/typing-study.spec.ts tests/browser/question-types.spec.ts`: PASS (`14/14` browser tests, verifying multi-sentence listening pairing on `be-verb-v2-listening-1`, all-type memorization/practice/palace translations, pre-submit protection, and selective `display_in` surface gating).
- Local installation: `npm run course:install -- courses/golden-course-template courses/beginner-english` installed `golden-course-template@1.5.0` and `beginner-english@2.6.0`.
- `node scripts/issue-check.mjs && git diff --check`: PASS.
