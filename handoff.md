# Development Handoff

Updated 2026-11-18 (America/New_York).

## Repository state

- Active branch: `fix/0055-restore-elementary-chinese-pronunciation-controls`.
- Baseline before this documentation update: `0c245ac`.
- Active issue: [#55, elementary Chinese pronunciation](issues/0055-fix-restore-elementary-chinese-pronunciation-controls.md).
- User setup is in [README.md](README.md). Durable repository rules are in
  [AGENTS.md](AGENTS.md).

## Elementary Chinese pronunciation

- Committed course version: `elementary-chinese@1.0.1`. The local learner
  database has `1.0.3` installed from the working tree.
- The working tree adds local Pinyin playback, per-clip loudness normalization,
  and speech for the pictured words in the fill-in questions. An unspecified
  TTS voice uses the saved service default before the cache lookup.
- The upgrade preserved the 16 question IDs, learner records and 12 existing
  illustrations. The [recording library](assets/audio/pinyin/README.md) credits
  the source. The [TTS reference](docs/features/tts/README.md) covers the service.

## Verification and next step

- Course validation, TypeScript, frontend unit tests, Go tests and the focused
  Elementary Chinese Chromium case passed during implementation. The browser
  case used a local fixture for synthesis and played the local Pinyin files.
- The earlier broader course-browser run had three failures at catalog or exam
  navigation. The implementation and related verification remain open in
  [issue #55](issues/0055-fix-restore-elementary-chinese-pronunciation-controls.md).
- Review the pending application and fixture changes together, resolve the
  browser failures, then close the issue with its implementation commit.

## English curriculum

- `beginner-english@1.4.1` includes sequential dialogue playback and expandable
  listening transcripts. See the [TTS architecture](docs/features/tts/deepseek-tts-architecture.md).
- The two semester packages remain under [issue #52](issues/0052-feat-expand-sample-courses-to-180-hour-standard-curriculum.md).
  Semester one's first 30 lessons are recorded in the
  [progress tracker](docs/research/step-up-english-1/progress.json). Continue with
  unit 4, lessons 31–40.
