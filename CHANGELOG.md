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
- DeepSeek text-to-speech with dedicated provider settings, inline playback,
  and a local cache indexed by voice and phrase.
- Elementary Chinese 1.0.4 adds local Pinyin playback for the seven fill-in
  prompts and pronunciation controls for the choices. All 16 explanations
  combine Han speech with local Pinyin and support speech regeneration.
  See the [recording credits](assets/audio/pinyin/README.md).
- Draft two-semester English courses, with the first 30 lessons authored in
  semester one, and expanded syllabi for the sample courses.

### Changed

- Modularized frontend `web/src/features/question-types/` into 9 independent
  question-type modules (`types/`) arranged in an acyclic 5-layer DAG behind
  typed registry and facade components.
- Beginner English 1.4.1 adds listening units, question audio, and sequential
  playback of authored dialogue lines. Listening transcripts are expandable.

### Fixed

- Unified `cloze`, `listening`, `reading_comprehension`, `writing`, and
  `translation` layout boundaries across memorization, practice, exam review,
  and memory palace reference views.
- Updated `sue1-extended-judgment` to full-sentence stem TTS and added lowercase
  `tts.text` overrides for all-caps headings (`LOCKER ROOM NOTICE`).
- Omitted TTS voices use the saved default before selecting cached audio.
- Forced speech regeneration returns an updated audio URL. Sequential listening
  retains the authored voices through the final turn.

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
