# Development Handoff

Updated 2026-11-18 (America/New_York).

## Repository state

- Question type implementation commits: `0b96e4b`, `9202171`, and `88cf136`.
- Completed [#56, v2 question types](issues/0056-feat-implement-v2-question-types.md).
- User setup is in [README.md](README.md). Durable repository rules are in
  [AGENTS.md](AGENTS.md).

## V2 question types

- Cloze, listening, reading comprehension, writing and translation now use
  versioned course schemas, structured answers and shared practice, memorization
  and exam controls. V1 courses remain supported with no database migration.
- The [authoring guide](docs/features/question-types/README.md) documents
  scoring and optional AI feedback. The six examples ship in the single
  综合题型练习 unit of `step-up-english-1@1.2.0`.
- Reading comprehension uses the existing study layout. Its passage,
  sub-questions, and choices declare inline TTS in the question bank.
- Version `1.2.0` is active in the local learner database. Course validation
  and the course, storage, and study tests passed. The live sidebar shows one
  unit, and all six example question IDs and existing attempts were preserved.

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
