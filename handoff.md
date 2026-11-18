# Development Handoff

Updated 2026-11-17 (America/New_York).

## 1. Baseline Context & Repository State

- **Repository**: `/Volumes/1TB-ZYJ/git/Test-driven-Study` (independent, standalone checkout).
- **Active Branch**: `feat/0052-expand-sample-courses-to-180-hour-standard-curriculum`
- **Baseline Commit**: `bdc17fd` (`docs: update handoff with 30 lessons complete (Units 1-3) and paused for user testing`)
- **Active Issue**: [issues/0052-feat-expand-sample-courses-to-180-hour-standard-curriculum.md](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/issues/0052-feat-expand-sample-courses-to-180-hour-standard-curriculum.md)
- **Current Milestone**: Design specifications for Unified 3-Tab Settings (TTS / LLM / Image), DeepSeek TTS Integration, and v2 Question Types Expansion formalized and committed into repository documentation.

---

## 2. Formal Feature Documentation Committed

The architectural specifications requested by the user are fully documented in:

1. **TTS Service & Unified Settings**:
   - [docs/features/tts/deepseek-tts-architecture.md](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/docs/features/tts/deepseek-tts-architecture.md)
   - [docs/features/tts/README.md](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/docs/features/tts/README.md)
   - **Key Architecture**:
     - **Unified 3-Tab Provider Dialog**: Expanded from 2 tabs to 3 tabs (`生图服务`, `LLM · Responses`, `TTS · 语音服务`).
     - **Keyring & Credential Reuse**: Option to reuse DeepSeek LLM API key or configure a dedicated key, encrypted in OS Keyring.
     - **DeepSeek TTS Protocol**: Integrates `POST /v1/tools/tts` (24kHz raw PCM wrapped in 44-byte RIFF WAV headers, FNV-1a 64-bit phrase hashing).
     - **Local Disk Cache**: Persistent storage in `var/audio/{voice_id}/{phrase_key}.wav` with singleflight concurrency deduplication.
     - **Audio Extraction & Anti-Cloze Rules**: Synthesizes English options, dialogue quotes in question stems (`Stop!`), and listening transcripts; strictly excludes grammar fill-in-the-blank items (`___`, `(   )`).
     - **UI Controls**: `<Volume2 />` play button and `<RotateCcw />` regenerate button with global single-instance audio coordination.

2. **Question Types Extension (v2 Specification)**:
   - [docs/features/question-types/v2-question-types-specification.md](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/docs/features/question-types/v2-question-types-specification.md)
   - [docs/features/question-types/README.md](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/docs/features/question-types/README.md)
   - **Key Architecture**:
     - Expanded from 4 basic types to 10 types: Cloze (`cloze`), True/False with Analysis (`true_false`), Listening Comprehension (`listening`), Reading Comprehension (`reading_comprehension`), Writing (`writing`: sentence making, short essay, full essay), and Translation (`translation`: EN->ZH, ZH->EN).
     - Zero-schema-breaking SQLite storage: leverages `payload_json` and `selected_json` text columns without database migrations.
     - Comprehensive JSON schemas and grading rules for all new types.
     - 10 production-grade golden samples for `step-up-english`.

---

## 3. English Curriculum Packages (180h Total)

The 180-hour English curriculum is split into two 90-hour semester course packages:

1. **Semester 1**: [courses/step-up-english-1](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/courses/step-up-english-1) ——《零基础阶梯进阶英语（一）》
   - **Progress**: **30 / 90 Lessons COMPLETED (Units 1, 2, 3 100% Complete & Committed)**
   - **Unit 1**: 国际音标与自然拼读规律（Lessons 1–10）—— **DONE**
   - **Unit 2**: 名词与代词系统精讲（Lessons 11–20）—— **DONE**
   - **Unit 3**: 一般现在时与动词基础形态（Lessons 21–30）—— **DONE**
   - **Unit 4**: 形容词、副词与比较结构（Lessons 31–40）—— **READY**
   - **Units 5–9**: 现在进行时与介词、一般过去时、情态动词、日常工作交际、综合复习与自测

2. **Semester 2**: [courses/step-up-english-2](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/courses/step-up-english-2) ——《零基础阶梯进阶英语（二）》
   - **Progress**: 0 / 90 Lessons (Syllabus & Package structure initialized)
   - **Units 1–9**: 一般将来时、现在完成时、复杂过去时序、被动语态、状语从句、定语从句、名词性从句、职场邮件与技术读写、终结测评

---

## 4. Verification & Testing Instructions

1. **Package Integrity Check**:
   ```bash
   go run ./cmd/course check courses/step-up-english-1
   go run ./cmd/course check courses/step-up-english-2
   ```

2. **Start Development Services**:
   ```bash
   npm run dev:up
   ```
   - Web Catalog: `http://127.0.0.1:43387/courses`
   - API Endpoint: `http://127.0.0.1:43388`

3. **Inspect Produced Artifacts**:
   - Research Notes: `docs/research/step-up-english-1/lesson_001/` to `lesson_030/`
   - Peer Reviews: `review/step-up-english-1/lesson_001/` to `lesson_030/`
   - Progress Tracker: `docs/research/step-up-english-1/progress.json`
