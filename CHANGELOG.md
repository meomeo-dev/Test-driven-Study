# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Five v2 course question types (`cloze`, `listening`, `reading_comprehension`,
  `writing`, `translation`) with schema validation, structured evaluation,
  optional AI feedback, and the installable v2 showcase package
  `golden-course-template@1.0.0` (**黄金标准课程模板 → 题型展示**,
  renamed from `step-up-english-1`).
- Polymorphic discriminated-union HTTP contracts and Go projections
  (`PublicQuestion`, `Question`, `QuestionContent`, `CourseItemReview`) enforcing
  media vs. non-media boundaries per question type.
- Declarative TTS support for `translation` (`source_text_tts` and review-only
  `reference_translation_tts`), `cloze` review-only completed sentences
  (`passage_tts`), and multi-paragraph `writing.sample_response` arrays.
- Repository skill `design-course-tts` (`audit-course-tts.mjs`) for automated
  TTS segmentation, Pinyin placement, and all-caps override auditing.
- Repository skill `design-course-package`, bottom-up effort quality gate
  `scripts/audit-course-effort.mjs`, and upfront budget/quota decomposition in
  `scripts/curriculum_batch_workflow.py`.
- Repository skill `orchestrate-agent-swarm` for coordinating independent
  work, review, and progress monitoring.
- Optional v2 `study_translation` for aligned reading and listening translations.
  Memorization displays English–Chinese passages, transcripts, questions, and
  options, with a shared original-only toggle. Practice exposes the translation
  data after submission, and exams release it at the end of the paper.
- A memorization vocabulary notebook with question, unit, and course views,
  category filters, and bilingual search in Golden Course Template 1.3.0 and
  Beginner English 2.3.0.
- Vocabulary notebook TTS playback for terms and examples, optional `term_tts`,
  `example_tts`, `pos`, and minimalist `grammar_note` schema fields in
  `vocabulary_file`, `design-course-tts` vocabulary auditing, and updated glossaries
  in `golden-course-template@1.4.0` and `beginner-english@2.4.0`.
- DeepSeek text-to-speech with dedicated provider settings, inline playback,
  and a local cache indexed by voice and phrase.
- Elementary Chinese 1.0.4 adds local Pinyin playback for the seven fill-in
  prompts and pronunciation controls for the choices. All 16 explanations
  combine Han speech with local Pinyin and support speech regeneration.
  See the [recording credits](assets/audio/pinyin/README.md).
- Draft two-semester English courses, with the first 30 lessons authored in
  semester one, and expanded syllabi for the sample courses.

### Changed

- `golden-course-template@1.1.0` adds a five-concept learning graph, a handover
  lesson, and practice tags for all 15 existing items.
- `golden-course-template@1.2.0` and `beginner-english@2.2.0` add aligned
  translations to all 103 reading and listening items across both packages.
  Original item and option IDs and monologue speech text are preserved.
- Memorization, practice, and memory palace share a question navigator. The
  memorization footer places the filtered position between Previous and Next.
- Course authoring skills document translation alignment, original audio,
  review visibility, and the current golden template.
- Modularized frontend `web/src/features/question-types/` into 9 independent
  question-type modules (`types/`) arranged in an acyclic 5-layer DAG behind
  typed registry and facade components.
- Beginner English 2.1.0 (`protocol_version: 2`, upgraded from `1.4.1`) migrates
  all 10 units (41 concepts, 2,240 minutes) to v2 contracts and recalibrates
  lecture depth (`<!-- concepts -->` / `effort-lab` anchors) and typed item
  quotas to **424 items across all 9 v2 question types** (`single_choice` 76,
  `cloze` 65, `listening` 59, `translation` 51, `reading_comprehension` 39,
  `writing` 39, `multiple_choice` 38, `true_false` 38, `numeric` 19), preserving
  all 216 original IDs and passing `course:check`, `audit-course-tts`, and
  `audit-course-effort --strict` (`η = 1.04`, 0 errors, 0 warnings).

### Fixed

- Unified `cloze`, `listening`, `reading_comprehension`, `writing`, and
  `translation` layout boundaries across memorization, practice, exam review,
  and memory palace reference views.
- Updated `sue1-extended-judgment` to full-sentence stem TTS and added lowercase
  `tts.text` overrides for all-caps headings (`LOCKER ROOM NOTICE`).
- Omitted TTS voices use the saved default before selecting cached audio.
- Forced speech regeneration returns an updated audio URL. Sequential listening
  retains the authored voices through the final turn.
- Kept the memorization card, position, and navigator in sync during navigation.
  Remembering a question refreshes its tile and subject counts together, even
  when the filter removes that question. Selected tiles retain learning colors.
- Wrapped long original question IDs inside navigator tiles and enabled
  independent scrolling in the shared study sidebar.

## [0.1.0] - 2026-11-17

### Added
- **Initial Public Open-Source Release**.
- **Self-contained Local Study Engine**: Go backend server with embedded SQLite database, modern React 19 + TypeScript frontend with Tailwind CSS.
- **18 Standard Self-Contained Courses**:
  - Mechanical & Electronics: CAD & FDM 3D Printing, Circuit Fundamentals, C Programming, Embedded MCU.
  - Automation & Software: Python Programming, Machine Vision, Tolerances & Metrology, Applied Machine Learning, Industrial Automation & PLC, PCB Design.
  - Engineering Mathematics: Algebra & Trigonometry, Engineering Calculus, Linear Algebra, Probability & Statistics, Automatic Control Theory, Basic Math.
  - Humanities & Foundations: Beginner English (with listening audio and transcript), Elementary Chinese (with pinyin exercises).
- **Core Study Workspaces**:
  - **Subject Guide (科目指南)**: Unit curriculum reader and lesson reading pane.
  - **Memorization Mode (背题模式)**: Spaced repetition memorization with rapid marking.
  - **Practice Mode (答题模式)**: Numeric hotkey grading, question navigation, atomic submission.
  - **Mock Exam Terminal (模拟考试)**: Server-owned timer, blueprint-based paper generation, instant grading.
  - **Learning Analysis (学习分析)**: Time-series mastery tracking, radar charts, prioritized wrong-question review book.
  - **Knowledge Graphs & Paths (学习路径)**: Dependency DAG visualization, prerequisite resolution, filtered question exercises.
  - **Cross-Course Learning Roadmap (学习路线)**: Cross-course prerequisites navigation and customized learning tracks.
  - **AI Study Assistant & Memory Palace**: Integrated AI study tutor, context compaction, and multimodal memory palace generation pipeline with local provider isolation.
- **Compliance & Cleanroom Integrity**: Full Apache-2.0 license, 100% decoupling from proprietary third-party branding.
