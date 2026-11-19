# Development Handoff

Updated 2026-11-18 (America/New_York).

## Repository state

- Recent completed issues: [#61](issues/0061-feat-refactor-question-types-to-named-polymorphic-dispatch.md)
  (polymorphic Go/OpenAPI/TS question-type contracts),
  [#62](issues/0062-feat-modularize-frontend-question-types-into-9-independent-module.md)
  (frontend `question-types` 5-layer DAG package), and
  [#63](issues/0063-fix-add-tts-playback-to-translation-source-text-and-reference.md)
  (translation, cloze, multi-paragraph writing sample, all-caps override, and judgment TTS fixes).
- User setup is in [README.md](README.md). Durable repository rules are in
  [AGENTS.md](AGENTS.md).

## V2 question types

- Cloze, listening, reading comprehension, writing and translation now use
  versioned course schemas, structured answers and shared practice, memorization
  and exam controls. V1 courses remain supported with no database migration.
- The [authoring guide](docs/features/question-types/README.md) documents
  scoring and optional AI feedback. The single 综合题型练习 unit in
  `step-up-english-1@1.2.7` has 15 questions across all nine question types.
  It covers all three writing subtypes, both translation directions, all
  three listening modes, and three reading sub-question types. The recorded
  listening example ships with a [local MP3](courses/step-up-english-1/assets/audio/README.md).
- Reading comprehension uses the existing study layout. Its passage,
  sub-questions, and choices declare inline TTS in the question bank.
- Memorization shows the writing prompt and requirements on the left, the
  sample in the middle, and the explanation and rubric on the right.
  Practice collects submissions and reveals the sample and rubric afterward.
- `writing` samples support either single-string `sample_response_tts` or
  per-paragraph `ContentSegment[]` arrays; `translation` supports `source_text_tts`
  and `reference_translation_tts`; `cloze` supports review-only `passage_tts`
  without leaking unanswered blanks. Version `1.2.7` is active in the local
  learner database with the existing question IDs. Course validation, TTS audit,
  and full `check` (unit, Go, startup, build, Playwright e2e) passed.

## Elementary Chinese pronunciation

- `elementary-chinese@1.0.4` is committed and installed in the local learner database.
- All seven fill-in prompts use local recordings. The complete `yīfu`
  recording preserves the neutral tone in 叠衣服. All 16 explanations play
  Han speech and local Pinyin in sequence. An unspecified TTS voice uses the
  saved service default before the cache lookup.
- The upgrade preserved the 16 question IDs, learner records and 12 existing
  illustrations. The [recording library](assets/audio/pinyin/README.md) credits
  the source. The [TTS reference](docs/features/tts/README.md) covers the service.

## English curriculum

- `beginner-english@1.4.1` includes sequential dialogue playback and expandable
  listening transcripts. See the [TTS architecture](docs/features/tts/deepseek-tts-architecture.md).
- The old semester lesson packages were retired from the question type demo.
  Curriculum research from [issue #52](issues/0052-feat-expand-sample-courses-to-180-hour-standard-curriculum.md)
  remains in the [progress tracker](docs/research/step-up-english-1/progress.json).
