---
id: 0067
type: feat
status: closed
closed-by: 1f0cb79
labels: [course, tts, v2]
branch: feat/0067-upgrade-beginner-english-course-to-protocol-v2
created: 2026-11-19
---
# Upgrade beginner-english course to protocol v2

## 背景 / 目标

Against `.agents/skills/design-course-tts` and `courses/golden-course-template`,
`courses/beginner-english` (currently `protocol_version: 1`, `version: 1.4.1`,
10 units, 41 concepts, 216 items) has four structural gaps:

1. `audit-course-tts` reports 21 issues (13 errors: `MIXED_ZH_EN_TTS`,
   `NON_SPEAKABLE_IN_TTS`; 8 warnings: `UNVOICED_ENGLISH_OPTIONS`,
   `UNVOICED_ENGLISH_SENTENCE`).
2. All 20 listening items use v1 `single_choice`/`multiple_choice`/`true_false`/
   `numeric` with `transcript[]`, so mock exams strip their transcripts and play
   no audio, and 7 numeric listening items leave English sub-questions unvoiced.
3. All 25 blank items use v1 `single_choice` + `blank` stem segments without v2
   `cloze.passage_tts` post-submit review audio, all 216 items use plain-string
   `explanation` (202 with unvoiced English phrases), and 70 choice items
   hardcode option letters (`选项 a/b/c/d`) that break under exam shuffling.
4. Manual TTS issues exist: un-expanded colon clock times across 7 items, em-dash
   options (`wh-questions-3`), non-word/orthographic distractors with `tts`,
   small-number/unit abbreviations, stem spoilers (`days-dates-2`/`5`), meta
   notes (`te-sc-04`, `wd-sc-04`), and stale `README.md` counts.

Goal: upgrade `courses/beginner-english` to `protocol_version: 2` (`version:
"2.0.0"`) while preserving every existing `id`, `chapter`, and `concepts`
mapping, achieving 0 errors and 0 warnings in `audit-course-tts`, full mock-exam
audio support on listening items, and clean browser/Go verification.

## 关键功能清单（Key Feature List，KFL）

1. Upgrade `courses/beginner-english/course.json` to `protocol_version: 2`,
   `version: "2.0.0"`, keeping all 10 units, lessons, and 41 concepts intact.
2. Convert all 20 transcript-based listening items across the 10 question files
   to v2 `type: "listening"` with `audio.mode` + `sub_questions[]` (`id`,
   graded v2 types, voiced English sub-question stems, and `analysis`), keeping
   existing item IDs (including `te-mc-03` for the Playwright memorization test)
   and parent stems in pure Chinese.
3. Convert all 25 blank-segment `single_choice` items to v2 `type: "cloze"` with
   `passage`, `passage_tts` (`voice` + complete spoken `text`), `blanks[]`, and
   `analysis`.
4. Migrate all remaining `true_false` items from `grading.boolean` to
   `grading.value` and convert all 216 items from plain-string `explanation` to
   v2 `analysis` (`RichContent` with segmented `tts` on real English tokens,
   non-words/symbols kept unvoiced/backticked, and zero hardcoded option-letter
   references).
5. Fix all automated and manual `design-course-tts` findings: `MIXED_ZH_EN_TTS`,
   `NON_SPEAKABLE_IN_TTS`, `UNVOICED_ENGLISH_OPTIONS`, `UNVOICED_ENGLISH_SENTENCE`,
   clock-time `tts.text` rewrites, `——` em-dash `tts.text` strips, unit/number
   `tts.text` normalization, non-word/case-only distractor silence, stem spoiler
   cleanup, and removal of authoring meta text.
6. Update `courses/beginner-english/README.md` (and root changelog/handoff if
   affected by package version bump) and reinstall/verify `beginner-english@2.0.0`
   via `course:check`, `audit-course-tts`, and test suites.

## 改造面

- `courses/beginner-english/course.json`
- `courses/beginner-english/README.md`
- `courses/beginner-english/questions/*.json` (all 10 unit files)
- `CHANGELOG.md`, `handoff.md` (status update after verification)

## 非目标

- Changing any existing question ID (`id`), unit ID, concept ID, lesson markdown,
  or prerequisite graph.
- Adding net-new questions beyond the existing 216 items or altering `golden-course-template`
  or Go/frontend runtime code (unless a genuine v2 bug is uncovered during verification).
- Pre-synthesizing `.mp3` files into `courses/beginner-english/assets/`.

## 验收标准（Acceptance Criteria，AC）

1. `npm run course:check -- courses/beginner-english` exits 0 (`protocol_version: 2`,
   `beginner-english@2.0.0`, 10 units, 41 concepts, 216 tagged items, 0 untagged).
2. `node .agents/skills/design-course-tts/scripts/audit-course-tts.mjs courses/beginner-english --json`
   exits 0 with `issueCount: 0` (`errorCount: 0`, `warningCount: 0`).
3. Zero hardcoded option-letter references (`选项 a/b/c/d` etc.) and zero colon
   clock times without spoken `tts.text` remain in any item.
4. All 20 listening items use `type: "listening"` and all 25 single-blank items use
   `type: "cloze"`.
5. `npm run typecheck`, `npm run test:go`, `npm run test:unit`, and targeted
   Playwright browser checks (`tests/browser/courses.spec.ts` and
   `tests/browser/course-roadmap.spec.ts`) pass cleanly against `beginner-english@2.0.0`.

## 讨论

- Preserving `id: "te-mc-03"` on the upgraded `listening` item ensures
  `tests/browser/courses.spec.ts` finds `source_item_id === 'te-mc-03'` and plays
  the 3-turn dialogue (`['stella', 'tide', 'stella']`) via `DialoguePlayer`.
- Keeping all 41 concept mappings unchanged preserves `tests/browser/course-roadmap.spec.ts`
  and existing learner concept mastery tracking.

### Merge verification

- Course validation reported 10 units, 216 items, and 41 concepts. The TTS audit
  reported zero issues. The course contains 20 listening and 27 cloze items.
- Type checking, all 57 frontend unit tests, Go tests, and all 15 browser tests
  passed on the combined course and question navigation changes.
