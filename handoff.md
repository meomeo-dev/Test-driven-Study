# Development Handoff

Updated 2026-11-18 (America/New_York).

## Repository state

- Implementation commit: `46d404a`.
- Completed issue: [#55, elementary Chinese pronunciation](issues/0055-fix-restore-elementary-chinese-pronunciation-controls.md).
- User setup is in [README.md](README.md). Durable repository rules are in
  [AGENTS.md](AGENTS.md).

## Elementary Chinese pronunciation

- `elementary-chinese@1.0.4` is committed and installed in the local learner database.
- All seven fill-in prompts use local recordings. The complete `yīfu`
  recording preserves the neutral tone in 叠衣服. All 16 explanations play
  Han speech and local Pinyin in sequence. An unspecified TTS voice uses the
  saved service default before the cache lookup.
- The upgrade preserved the 16 question IDs, learner records and 12 existing
  illustrations. The [recording library](assets/audio/pinyin/README.md) credits
  the source. The [TTS reference](docs/features/tts/README.md) covers the service.

## Verification and next step

- Generated bindings, course validation, TypeScript, unit and startup tests,
  and production builds passed.
- The Chromium suite passed seven cases, including Elementary Chinese speech
  regeneration and all three listening turns in an English dialogue. The
  roadmap case had an outdated concept count. Its corrected assertion,
  route planning and saved progress passed a separate Chromium check.

## English curriculum

- `beginner-english@1.4.1` includes sequential dialogue playback and expandable
  listening transcripts. See the [TTS architecture](docs/features/tts/deepseek-tts-architecture.md).
- The two semester packages remain under [issue #52](issues/0052-feat-expand-sample-courses-to-180-hour-standard-curriculum.md).
  Semester one's first 30 lessons are recorded in the
  [progress tracker](docs/research/step-up-english-1/progress.json). Continue with
  unit 4, lessons 31–40.
