# Development Handoff

Updated 2026-11-19 (America/New_York).

## Repository state

- `main` integrates the course and study navigation changes through `#71`:
  - [#61](issues/0061-feat-refactor-question-types-to-named-polymorphic-dispatch.md)
    (`4d2c69a`): polymorphic Go/OpenAPI/TS question-type contracts.
  - [#62](issues/0062-feat-modularize-frontend-question-types-into-9-independent-module.md)
    (`e2edccf`): frontend `question-types/` 9-module 5-layer DAG package.
  - [#63](issues/0063-fix-add-tts-playback-to-translation-source-text-and-reference.md)
    (`e5084eb`): translation, review-only cloze, paragraph writing, all-caps override,
    and judgment TTS fixes.
  - [#64](issues/0064-chore-rename-step-up-english-1-demo-course-and-unit-titles.md)
    (`1b49fe8` / `8fc3ee9`): renamed demo display titles to **题型展示**.
  - [#65](issues/0065-chore-rename-course-package-to-golden-course-template.md)
    (`973ef9e`): renamed `step-up-english-1` package/directory to
    `golden-course-template` (**黄金标准课程模板 → 题型展示**, `1.0.0`).
  - [#66](issues/0066-chore-update-design-course-tts-skill-against-golden-course-templat.md)
    (`fac27ef`): updated `.agents/skills/design-course-tts` against `golden-course-template`.
  - [#67](issues/0067-feat-upgrade-beginner-english-course-to-protocol-v2.md)
    (`1f0cb79`):
    upgraded `courses/beginner-english` from `1.4.1` (v1) to `2.0.0` (v2).
  - [#68](issues/0068-feat-share-question-navigation-across-study-modes.md)
    (`c7b6c4c`): shared the question drawer and grid across study modes.
- User setup is in [README.md](README.md). Durable repository rules are in
  [AGENTS.md](AGENTS.md).

## V2 question types

- Cloze, listening, reading comprehension, writing and translation now use
  versioned course schemas, structured answers and shared practice, memorization
  and exam controls. V1 courses remain supported with no database migration.
- The [authoring guide](docs/features/question-types/README.md) documents
  scoring and optional AI feedback. The single 题型展示 unit in
  `golden-course-template@1.1.0` (titled `黄金标准课程模板`) has 15 questions across all
  nine question types.
  It covers all three writing subtypes, both translation directions, all
  three listening modes, and three reading sub-question types. The recorded
  listening example ships with a [local MP3](courses/golden-course-template/assets/audio/README.md).
- Reading comprehension uses the existing study layout. Its passage,
  sub-questions, and choices declare inline TTS in the question bank.
- Memorization shows the writing prompt and requirements on the left, the
  sample in the middle, and the explanation and rubric on the right.
  Practice collects submissions and reveals the sample and rubric afterward.
- `writing` samples support either single-string `sample_response_tts` or
  per-paragraph `ContentSegment[]` arrays; `translation` supports `source_text_tts`
  and `reference_translation_tts`; `cloze` supports review-only `passage_tts`
  without leaking unanswered blanks.
- [#71](issues/0071-feat-demonstrate-learning-paths-in-the-golden-course-template.md),
  based on `58ceeb1`, adds a five-node learning path example with AND/OR
  prerequisites, tagged practice, and a handover lesson. Version `1.1.0` is active
  in the local learner database with all fifteen question IDs preserved. Course
  validation, type checking, Go tests, and eighteen browser tests passed.

## Shared question navigation

- Memorization, practice, and memory palace use the same drawer and grid.
  The [browser regression](tests/browser/courses.spec.ts) exercises status legends,
  resource markers, selection, focus, and filter retention.
- Type checking, all 57 frontend unit tests, Go tests, and all 15 browser tests
  passed on the combined changes.
- [#69](issues/0069-fix-keep-long-question-ids-inside-navigation-tiles.md), based
  on `ef3513c`, wraps original IDs within their tiles and sizes rows to fit the
  content. Type checking and all six course browser tests passed, including
  the layout regression at 1280 and 375 pixels.
- [#70](issues/0070-fix-enable-independent-study-sidebar-scrolling.md), based on
  `70d3999`, makes the shared sidebar scroll independently. Type checking and
  all seven course browser tests passed, including wheel scrolling in two short
  viewports.

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

- `beginner-english@2.1.0` (`protocol_version: 2`, 10 units, 41 concepts, 2,240
  minutes, 424 items across all 9 v2 question types) preserves all 216 original
  IDs, enriches all 10 unit lessons with explicit `concepts` / `effort-lab`
  anchors, and passes `course:check`, `audit-course-tts` (`issueCount: 0`),
  and `audit-course-effort --strict` (`η = 1.04`, 0 errors, 0 warnings). See the
  [TTS architecture](docs/features/tts/deepseek-tts-architecture.md) and
  [package design skill](.agents/skills/design-course-package/SKILL.md).
- The old semester lesson packages were retired from the question type demo.
  Curriculum research from [issue #52](issues/0052-feat-expand-sample-courses-to-180-hour-standard-curriculum.md)
  remains in the [progress tracker](docs/research/step-up-english-1/progress.json).
