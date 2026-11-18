# Development Handoff

Updated 2026-11-18 (America/New_York).

## Repository state

- Implementation commit: `0b96e4b`.
- Completed [#56, v2 question types](issues/0056-feat-implement-v2-question-types.md).
- User setup is in [README.md](README.md). Durable repository rules are in
  [AGENTS.md](AGENTS.md).

## V2 question types

- Cloze, listening, reading comprehension, writing and translation now use
  versioned course schemas, structured answers and shared practice, memorization
  and exam controls. V1 courses remain supported with no database migration.
- The [authoring guide](docs/features/question-types/README.md) documents
  scoring and optional AI feedback. The six examples ship in
  `step-up-english-1@1.1.0`. Use normal course import to activate the package;
  verification installed it only in isolated data directories.
- Generated bindings, course validation, TypeScript, Go and unit tests,
  startup checks, and production builds passed. All eight earlier Chromium
  cases passed; both new cases passed after tightening a text locator.
  The course check reports the existing concept coverage warnings.

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
- The two semester packages remain under [issue #52](issues/0052-feat-expand-sample-courses-to-180-hour-standard-curriculum.md).
  Semester one's first 30 lessons are recorded in the
  [progress tracker](docs/research/step-up-english-1/progress.json). Continue with
  unit 4, lessons 31–40.
