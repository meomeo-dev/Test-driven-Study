# Development Handoff

Updated 2026-11-20 (America/New_York). Functional baseline `aaf6fed` on `main`.

## Current learning behavior

- Memorization shows aligned English–Chinese reading and listening materials.
  The card and full-question dialog share the original-only switch. Practice
  exposes translations after submission. Mock exams expose them after the
  whole paper ends. See [#74](issues/0074-feat-add-bilingual-reading-and-listening-study-translations.md)
  and the [authoring guide](docs/features/question-types/README.md#study-translations).
- The shared navigator is available in memorization, practice, and memory palace.
  Memorization keeps the active tile and ordinal aligned with the visible card.
  Subject counts and filtered rows refresh together after marking. The active
  tile retains its learning-state color. See
  [#68](issues/0068-feat-share-question-navigation-across-study-modes.md) and
  [#76](issues/0076-fix-synchronize-memorization-progress-and-question-navigation.md).
- The memorization footer shows the filtered ordinal and total between Previous
  and Next. See [#77](issues/0077-fix-move-memorization-question-position-between-navigation-butto.md).

## Vocabulary notebook

- [#78](issues/0078-feat-add-vocabulary-notebook-to-english-memorization.md) adds
  an offline course-provided glossary to memorization, with question, unit, and
  course scopes.
- [#79](issues/0079-feat-add-vocabulary-tts-and-minimalist-grammar-notes.md) (`aaf6fed`)
  adds term and example TTS playback, optional `term_tts`/`example_tts`/`pos`/
  `grammar_note` schema support, `design-course-tts` vocabulary auditing, and
  updated glossaries in Golden Template `1.4.0` (12 entries) and Beginner
  English `2.4.0` (71 entries).
  See the [vocabulary authoring guide](docs/features/vocabulary/README.md) and
  [vocabulary design skill](.agents/skills/design-course-vocabulary/SKILL.md).

## Course packages and authoring

| Package | Active local version | Coverage |
| --- | --- | --- |
| [Golden course template](courses/golden-course-template/README.md) | 1.4.0 | 15 items across all nine question types, a five-concept learning path, two reading and three listening translation examples, and 12 vocabulary entries with TTS and targeted grammar notes. |
| [Beginner English](courses/beginner-english/README.md) | 2.4.0 | 10 units, 41 concepts, 424 items, translations for all 39 reading and 59 listening questions, and 71 vocabulary entries with TTS overrides and minimalist grammar notes. |
| [Elementary Chinese](courses/elementary-chinese/course.json) | 1.0.4 | Local Pinyin for the fill-in stems and combined Pinyin and Han speech for the explanations. |

Use the [versioned install workflow](README.md#author-a-course) to update
existing installations and retain learner history. Authoring and TTS skill
updates are recorded in
[#75](issues/0075-docs-document-bilingual-transcripts-in-course-authoring-skills.md).
The English curriculum research remains in the
[progress tracker](docs/research/step-up-english-1/progress.json).

## Verification

- The local course catalog confirmed the package versions above on 2026-11-20.
- [#74](issues/0074-feat-add-bilingual-reading-and-listening-study-translations.md)
  records package and TTS checks, Go and frontend tests, build, and browser
  validation. The roadmap case passed on a focused retry after a page-load timeout.
- [#76](issues/0076-fix-synchronize-memorization-progress-and-question-navigation.md)
  records type checking, 57 unit tests, and 20 isolated browser cases.
  [#77](issues/0077-fix-move-memorization-question-position-between-navigation-butto.md)
  records the later footer change and its three browser cases.
- [#79](issues/0079-feat-add-vocabulary-tts-and-minimalist-grammar-notes.md)
  (`aaf6fed`) records `npm run check` passing across all gates (62 unit tests,
  all Go packages, 4 startup tests, build, 29 browser cases including 5 in
  `tests/browser/vocabulary.spec.ts`), plus `design-course-tts` (9 tests, 0
  audit issues) and strict effort audit passing for `golden-course-template@1.4.0`
  and `beginner-english@2.4.0`.

See [README.md](README.md) for setup, [AGENTS.md](AGENTS.md) for repository
rules, and [CHANGELOG.md](CHANGELOG.md) for unreleased changes.
