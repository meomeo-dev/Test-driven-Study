---
id: 0079
type: feat
status: closed
closed-by: aaf6fed
labels: []
branch: feat/0079-add-vocabulary-tts-and-minimalist-grammar-notes
created: 2026-11-20
---
# Add vocabulary TTS and minimalist grammar notes

## 背景 / 目标

Learners using the Vocabulary Notebook (`生词本`) in English memorization need audio playback for vocabulary terms and example sentences, along with concise grammar notes where part of speech, morphology, or usage rules help prevent mistakes.

## 关键功能清单（Key Feature List，KFL）

- Add optional `term_tts`, `example_tts`, `pos`, and `grammar_note` fields to the v2 vocabulary schema, HTTP OpenAPI contract, and generated TypeScript bindings.
- Reject whitespace-only TTS synthesis input with HTTP 400 instead of falling through to HTTP 500.
- Support term and example TTS playback in the Vocabulary Notebook UI with shared audio mutual exclusion and accessible status/error feedback.
- Render optional part-of-speech badges and minimalist grammar notes in the Vocabulary Notebook without cluttering entries that need no grammar hint.
- Extend `design-course-tts` auditing and update Beginner English and Golden Course Template vocabulary assets with TTS overrides and targeted grammar notes.

## 改造面

Course v2 vocabulary schema, OpenAPI contract and generated API types, `internal/httpapi/tts.go`, `AudioControls` and Vocabulary Notebook UI/styles, `docs/features/vocabulary/README.md`, `design-course-tts` audit script, course vocabulary assets, and unit/browser tests.

## 非目标

Mandatory TTS or grammar metadata on all entries, personal vocabulary editing, automatic grammar generation, offline batch audio pre-synthesis, or changes to exam grading.

## 验收标准（Acceptance Criteria，AC）

- Course schema and Go tests validate optional `term_tts`, `example_tts` (paired with `example`), `pos` enum, `grammar_note` length/non-whitespace constraints, and `additionalProperties: false`.
- `POST /api/tts/synthesize` returns HTTP 400 on whitespace-only `text`.
- Learners can play term and example audio in the Vocabulary Notebook on desktop and mobile with mutual exclusion and clear error handling when TTS is unconfigured.
- Entries with `pos` and `grammar_note` display them cleanly while entries omitting them remain uncluttered.
- Course validation, TTS audits, generated code checks, Go tests, frontend unit tests, and browser tests pass.

## 讨论

Keeping `term` and `example` as plain strings while adding optional `term_tts` and `example_tts` (`TTSConfig`) preserves search filtering and backward compatibility with existing v2 packages, mirroring `source_text_tts` and `reference_translation_tts` in translation items. Minimalist `pos` and `grammar_note` fields avoid duplicating `category` and allow omitting grammar notes on transparent compounds, fixed greetings, and regular nouns.

### Verification

- `node --test .agents/skills/design-course-tts/tests/*.test.mjs`: 9 passed, 0 failed.
- `npm run course:check -- courses/golden-course-template` (`1.4.0`: 1 unit, 15 items) and `npm run course:check -- courses/beginner-english` (`2.4.0`: 10 units, 424 items) passed.
- `node .agents/skills/design-course-tts/scripts/audit-course-tts.mjs` passed with 0 issues (`golden-course-template`: 12 vocabulary entries; `beginner-english`: 71 vocabulary entries), and `node scripts/audit-course-effort.mjs courses/beginner-english --strict` passed (`error=0, warning=0`).
- `npm run check` passed across all gates (`issue:check` 0001–0079, `check:generated`, `test:unit` 62 passed, `test:go` all packages, `test:startup` 4/4, `build`, and `test:e2e` 29 passed including all 5 specs in `tests/browser/vocabulary.spec.ts`).
