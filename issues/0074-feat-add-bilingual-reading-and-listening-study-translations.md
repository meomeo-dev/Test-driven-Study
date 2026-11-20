---
id: 0074
type: feat
status: closed
closed-by: 7b36c09
labels: []
branch: feat/0074-add-bilingual-reading-and-listening-study-translations
created: 2026-11-20
---
# Add bilingual reading and listening study translations

## 背景 / 目标

Beginner English learners need aligned Simplified Chinese support for long English reading and listening materials in memorization mode. Use the golden course template as the authoring and behavior baseline.

## 关键功能清单（Key Feature List，KFL）

- Add optional v2 study translations with a material array and sub-question and option ID mappings.
- Show translations in memorization, with an original-only toggle shared by the question card and full-question dialog.
- Author translations for all five template items and all 98 Beginner English reading/listening items.

## 改造面

V2 course schema and validator, review projections and HTTP contract, memorization question rendering, and versioned course question banks.

## 非目标

Runtime machine translation, Chinese speech synthesis, new grading rules, and a separate course configuration.

## 验收标准（Acceptance Criteria，AC）

- Cover reading, synthesized dialogue, synthesized passage, and recorded listening in the template. Show English and Chinese in aligned reading order and keep playback bound to existing English and audio.
- Keep legacy packages and saved papers readable. Reuse stable course, item, sub-question, and option IDs on upgrade.
- Omit translations from unanswered practice and all active exam responses, including review for committed items.
- Verify course validation and TTS audit, Go and frontend checks, and browser behavior with isolated data.

## 讨论

Author material translations as plain strings. Align by nonblank passage segment or transcript line. Split a monologue using the existing rich-text shape and preserve the exact concatenated English speech text.

### Verification

- Both course packages pass `course:check` and the repository TTS audit.
- Verified 103 translated items and exact English reconstruction for all 14
  monologues by comparison with the previous course versions.
- Generated binding checks, 57 frontend unit tests, Go tests, four startup
  tests, the application build, and final type checking passed.
- Twenty browser cases passed in the suite run. The catalog roadmap case timed
  out loading the page on the first run and passed on a focused retry.
