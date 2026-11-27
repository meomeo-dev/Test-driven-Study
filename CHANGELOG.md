# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Full-type v2 `study_translation` with declarative `display_in` surface
  scoping (`memorize`, `practice_review`, `exam_review`, `typing`, `palace`;
  omitted defaults to all five surfaces) across all nine question types (`stem`,
  `options`, `material`, `sample_response`, `sub_questions`), preserving strict
  review-only redaction on unanswered practice and in-progress mock exams,
  exposing authored `Option.id` for shuffle-safe option translations, fixing
  multi-sentence translation pairing in Typing Study, and upgrading
  `golden-course-template@1.5.0` (15/15 items) and `beginner-english@2.6.0`
  (507/507 items across 12 units) to 100% Chinese–English translation coverage
  (`#92`).
- Floating **Typing Study (打字学习)** module
  (`web/src/features/typing/`) across memorization, memory palace, and
  post-submit practice (disabled pre-submit; excluded from mock exams). Extracts
  sentence-by-sentence drills from the current question and its correct answer
  across all nine question types (with cloze blank highlights, aligned
  `study_translation` hints, inline audio controls, scope filters, recall mode,
  and `Tab` hints), guards Chinese IME composition and uncommitted Pinyin
  against premature errors, and smoothly auto-scrolls multi-sentence items like
  a typewriter roll (`#91`).
- Language-track curriculum workflow upgrades (`scripts/curriculum_workflow/`)
  adding `track_profiles.py`, cross-unit prerequisite DAG validation, proactive
  unit vocabulary authoring hooks, lecture/research length caps, and promoted
  lesson reuse on resume (`#90`, in progress).
- Repository skill `desktop-gui-design-knowledge`
  (`.agents/skills/desktop-gui-design-knowledge/`) providing desktop platform
  guidelines, design tokens, and Tauri 2 native-shell references (`#83`).
- Explicit manually-checked `"Allow direct HTTPS"` (`allow_direct_https`,
  default `false`) opt-in across LLM, Image/Palace, and TTS settings, HTTP
  contracts, Go transports, and Settings UI while enforcing explicit
  proxy-by-default and zero silent direct fallback (`#86`).
- Append-only immutable `attempt_evaluations` table (`00017`), persisted cached
  LLM written feedback (`cached: true`), and offline rubric/reference self-check
  mastery wired across practice, review book, learning analysis, and concept
  progression (`#87`).
- Safe local `.zip` course import and deterministic packing
  (`internal/course/archive.go`), `cmd/course` `pack`/`deactivate`/`rollback`
  commands, non-destructive course lifecycle HTTP APIs (`GET /api/courses/packages`,
  multipart `POST /api/courses/install`, version activate/deactivate) preserving
  `question_keys` and learner history, and `/courses` package management UI
  (`#88`).
- Unified `npm run course:audit` CLI (`scripts/course-audit.mjs`) combining
  `course:check`, effort, TTS, and conditional vocabulary gates, plus GitHub
  Actions CI workflow (`.github/workflows/ci.yml`) (`#89`).
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
- Repository skill `design-course-vocabulary` (`audit-course-vocabulary.mjs`)
  guiding unit/question coverage, `category` vs. `pos` boundaries, and
  minimalist `grammar_note` authoring and auditing.
- DeepSeek text-to-speech with dedicated provider settings, inline playback,
  and a local cache indexed by voice and phrase.
- Elementary Chinese 1.0.4 adds local Pinyin playback for the seven fill-in
  prompts and pronunciation controls for the choices. All 16 explanations
  combine Han speech with local Pinyin and support speech regeneration.
  See the [recording credits](assets/audio/pinyin/README.md).
- Draft two-semester English courses, with the first 30 lessons authored in
  semester one, and expanded syllabi for the sample courses.

### Changed

- Expanded `beginner-english` to `2.5.0` (`#90`, Units 11–12:
  `everyday-shopping` and `travel-plans`), reaching **12 units, 51 concepts
  (2,670 minutes / 44.50 hours), 507 questions across all 9 v2 types, 45 reading
  and 67 listening study translations, and 93 vocabulary entries** while
  preserving all legacy IDs; checkpointed Unit 13 (`experiences-progress`)
  research drafts under `docs/research/beginner-english-a2-expansion/`.
- Upgraded `course:new` (`course.Scaffold`) to emit valid `protocol_version: 2`
  course packages with concept graphs and tagged v2 items, extended
  `cmd/course install` to accept multiple paths/zips in one invocation, and
  updated Playwright E2E (`playwright.config.ts`) to batch-install fixtures and
  serve the compiled `var/bin/test-driven-study` binary (`#89`).
- Modularized `scripts/curriculum_batch_workflow.py` into the Python 3.9+ stdlib
  package `scripts/curriculum_workflow/` (plus the thin
  `scripts/curriculum_batch_run_workflow.py` shim), defaulting to headless
  `agy-ultra` (`gemini-4-hydrogen-high`) with deadlock-free bounded parallelism,
  atomic locked `progress.json` writes, deterministic cycle-safe manifest updates,
  error isolation, conditional strict vocabulary auditing, and 53 offline unit tests.
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
- Split the 16 non-flagship engineering, mathematics, and legacy sample courses
  out into the separate `/Volumes/1TB-ZYJ/git/Test-driven-Study-Courses`
  repository, leaving only `beginner-english`, `elementary-chinese`, and
  `golden-course-template` in `courses/` (`defaults.json`) and isolating
  roadmap/math test fixtures under `tests/fixtures/courses/`.
- Beginner English 2.1.0 (`protocol_version: 2`, upgraded from `1.4.1`) migrates
  all 10 units (41 concepts, 2,240 minutes) to v2 contracts and recalibrates
  lecture depth (`<!-- concepts -->` / `effort-lab` anchors) and typed item
  quotas to **424 items across all 9 v2 question types** (`single_choice` 76,
  `cloze` 65, `listening` 59, `translation` 51, `reading_comprehension` 39,
  `writing` 39, `multiple_choice` 38, `true_false` 38, `numeric` 19), preserving
  all 216 original IDs and passing `course:check`, `audit-course-tts`, and
  `audit-course-effort --strict` (`η = 1.04`, 0 errors, 0 warnings).

### Fixed

- Classified upstream HTTP 403 `INSUFFICIENT_BALANCE` / `insufficient_quota`
  responses as `quota` failures across `internal/llm/` and `internal/palace/`
  without leaking upstream text, and added sanitized upstream rejection
  diagnostics in `internal/llm/provider.go`.
- Added `/learning` to built-mode SPA routing (`isFrontendRoute`), extended
  `written_feedback` HTTP write deadlines and upgraded evaluation prompts to
  strict `json_schema` (with aligned mock fixture routing), fixed DeepSeek TTS
  `Test()` to send `"voice_id"`, and excluded 24h-cooldown `learning` items from
  active review practice queues while preserving review-book counts (`#85`).
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
- Restored the shared two-button `(play/stop + regenerate)` TTS control pair
  inline directly after vocabulary terms and examples, and scoped regenerate
  accessibility labels when `targetLabel` is provided.

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
