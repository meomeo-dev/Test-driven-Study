# Development Handoff

Updated 2026-11-18 (America/New_York).

## 1. Baseline Context & Repository State

- **Repository**: `/Volumes/1TB-ZYJ/git/Test-driven-Study` (independent, standalone checkout).
- **Active Branch**: `main` (all feature branches merged and pruned).
- **Baseline Commit**: `def9b05` (`fix(listening): separate listening audio from transcript and hide transcript text by default`)
- **Active Issue**: [issues/0052-feat-expand-sample-courses-to-180-hour-standard-curriculum.md](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/issues/0052-feat-expand-sample-courses-to-180-hour-standard-curriculum.md)
- **Current Milestone**: Completed end-to-end implementation of DeepSeek TTS and Unified 3-Tab Settings (WU-001), passed double-blind subagent audit (Backend Clean Pass, Frontend Clean Pass), upgraded course to `beginner-english@1.3.3`, separated listening audio playback from transcript text, and removed legacy static audio assets.
- **WU Status**: [.todo_tasks/20261117_agents-system_deepseek-tts-implementation_WU-001.json](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/.todo_tasks/20261117_agents-system_deepseek-tts-implementation_WU-001.json) (`completed`, phase: `close`).

---

## 2. Implementation Milestones Completed (WU-001)

1. **Contracts & Schema Extension**:
   - `contracts/course/v1/items.schema.json`: Added polymorphic `$defs/richContent`, `$defs/contentSegment`, `$defs/ttsConfig`, and allowed `tts` in `options.items`.
   - `contracts/http/openapi.yaml`: Added paths `/api/audio/{voice}/{key}.wav`, `/api/tts/synthesize`, `/api/tts/settings`, `/api/tts/settings/test`. Added schemas `TTSConfig`, `ContentSegment`, `TTSProviderSettings`, `TTSProviderUpdate`, `TTSSynthesizeInput`, `TTSSynthesizeResult`. Added `rich_content` to `Question` and `PublicQuestion`.
   - Generated TypeScript bindings: `web/src/api/generated/types.gen.ts`. Passed `npm run check:generated` drift gate.

2. **Backend Go TTS Service & Keyring**:
   - `internal/tts/`: Implemented DeepSeek `/v1/tools/tts` client, 24kHz raw PCM to 44-byte RIFF WAV header synthesis, FNV-1a 64-bit normalized phrase key hashing (`0xcbf29ce484222325`, `0x100000001b3`), local disk cache at `var/audio/{voice}/{key}.wav` with `singleflight.Group` deduplication, and dedicated OS Keyring service (`test-driven-study.tts-provider`, zero credential reuse).
   - `internal/httpapi/tts.go`: Handlers for audio streaming with `Cache-Control: public, max-age=31536000, immutable`, synthesis endpoint with `force?: boolean`, settings GET/PUT with `X-Settings-Token`, and connectivity test endpoint.
   - `internal/course/model.go` & `internal/study/models.go`: Polymorphic `RichContent`, `OptionTTS`, `Transcript` with custom JSON marshalling.
   - Wired in `cmd/server/main.go` and `internal/httpapi/server.go`.

3. **Frontend API & 3-Tab Provider Dialog**:
   - `web/src/api/tts.ts`: Handwritten client with `settings`, `save`, `test`, `synthesize`, and `audioUrl`.
   - `web/src/features/palace/ProviderDialog.tsx`: Expanded from 2 tabs to 3 tabs (`生图服务`, `LLM · Responses`, `TTS · 语音服务`) with ARIA tabs and 3-way circular keyboard navigation (`Home`, `End`, `ArrowLeft`, `ArrowRight`).
   - `web/src/features/palace/ProviderForm.tsx`: Dynamic form adapting to `kind === 'tts'`. Hides models/reasoning fields, exposes voice selector radio group (`stella` / `tide`), proxy configuration, dedicated API key entry, and test/save mutations.
   - `web/src/styles/provider-settings.css`: Added styles for voice selector fieldset and radio controls.

4. **RichContent Component & Anti-Leakage Option Audio**:
   - `web/src/components/AudioControls.tsx`: Play button (`Volume2`), loading spinner (`LoaderCircle`), regenerate button (`RotateCcw` with `force: true`), and global single-instance audio player (`globalAudio`) with playback mutex (starting audio stops any active playback) and keyboard accessibility (`Enter`/`Space`).
   - `web/src/components/RichContent.tsx`: Mixed layout supporting `text`, `speech` (with `AudioControls`), and `blank` (`___`).
   - `web/src/features/practice/QuestionCard.tsx` & `ChoiceOptions.tsx` & `web/src/features/memorization/QuestionCard.tsx`: Integrated `RichContent` for stem rendering, and enforced the **Anti-Leakage Uniformity Rule**: if any option has TTS enabled, all options uniformly render audio controls to prevent answer leakage.

5. **Curriculum Upgrade (`courses/beginner-english@1.3.0`)**:
   - Upgraded all 8 question files (159 items preserved) with declarative rich content and uniform option TTS.
   - 70 stem dialogue/prompt segments tagged with `tide` / `stella`.
   - 19 declarative cloze blank segments (`{ "type": "blank", "index": 1 }`).
   - 98 items with uniform option-level TTS across 392 options (100% Anti-Leakage Uniformity passed).
   - Package installed and projected into `var/study.sqlite` via `go run ./cmd/course install courses/beginner-english`.

6. **Automated Verification Results**:
   - `npm run typecheck`: 0 errors.
   - `npm run test:unit`: 11 test files, 42 tests passed.
   - `npm run test:go`: 100% passed across all Go packages.
   - `npm run build`: Production client bundle and Go binary built cleanly.
   - `go run ./cmd/course check`: All course packages validated with 0 errors.

1. **TODO Document Created & Validated**:
   - JSON: [.todo_tasks/20261117_agents-system_deepseek-tts-implementation_WU-001.json](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/.todo_tasks/20261117_agents-system_deepseek-tts-implementation_WU-001.json)
   - Report: [.todo_tasks/20261117_agents-system_deepseek-tts-implementation_WU-001.md](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/.todo_tasks/20261117_agents-system_deepseek-tts-implementation_WU-001.md)
   - Gate verification: `node scripts/todo-check.mjs` passed with 0 errors.

2. **Subagent 1 (Backend & Contract Auditor) Review Highlights**:
   - Addressed: Explicit `options.items.properties.tts` in `contracts/course/v1/items.schema.json` to prevent `additionalProperties: false` validation rejection.
   - Addressed: Added `POST /api/tts/settings/test` with `X-Settings-Token` header and `force?: boolean` on `POST /api/tts/synthesize` in OpenAPI.
   - Addressed: Backed by `singleflight.Group` deduplication, `Cache-Control` static streaming, and dedicated OS Keyring service (`test-driven-study.tts-provider`) without key reuse.
   - Addressed: Go course models updated to support polymorphic `RichContent` deserialization in `internal/course/model.go`.

3. **Subagent 2 (Frontend & UI Auditor) Review Highlights**:
   - Addressed: Explicit requirement to create handwritten `web/src/api/tts.ts` client.
   - Addressed: `ProviderForm.tsx` adapts dynamically to hide `models` text input and reasoning fields when `kind === 'tts'`, displaying voice selector (`stella`/`tide`).
   - Addressed: `ProviderDialog.tsx` updated with accessible 3-way circular keyboard navigation across the 3 tabs.
   - Addressed: `RichContent.tsx` handles `blank` segment types alongside `text` and `speech`.
   - Addressed: Enforced option-level anti-leakage uniformity invariant in `ChoiceOptions.tsx` and review components.
   - Addressed: Comprehensive test gate in Task 5 incorporating `npm run test:unit` (Vitest) alongside `typecheck`, `test:go`, and `course check`.

---

## 3. Formal Feature Documentation Committed

1. **TTS Service & Unified Settings**:
   - [docs/features/tts/deepseek-tts-architecture.md](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/docs/features/tts/deepseek-tts-architecture.md)
   - [docs/features/tts/README.md](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/docs/features/tts/README.md)
   - **Key Architecture**:
     - **Declarative Rich Content / In-Line Mixed Layout**: Questions and options defined as structured segment arrays (`ContentSegment[]`) or strings. Segments with `"tts"` render text plus play/regenerate audio buttons; segments without `"tts"` render as plain text. Zero heuristic string parsing.
     - **Option Anti-Leakage Uniformity Rule**: All options within an option set uniformly provide TTS to prevent leaking the correct answer via visual button presence.
     - **Unified 3-Tab Provider Dialog**: Expanded from 2 tabs to 3 tabs (`生图服务`, `LLM · Responses`, `TTS · 语音服务`).
     - **Keyring & Dedicated Credential**: Dedicated DeepSeek TTS API key configured independently in its own tab and encrypted in OS Keyring.
     - **DeepSeek TTS Protocol**: Integrates `POST /v1/tools/tts` (24kHz raw PCM wrapped in 44-byte RIFF WAV headers, FNV-1a 64-bit phrase hashing).
     - **Local Disk Cache**: Persistent storage in `var/audio/{voice_id}/{phrase_key}.wav` with singleflight concurrency deduplication.
     - **UI Controls**: `<Volume2 />` play button and `<RotateCcw />` regenerate button with global single-instance audio coordination.

2. **Question Types Extension (v2 Specification)**:
   - [docs/features/question-types/v2-question-types-specification.md](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/docs/features/question-types/v2-question-types-specification.md)
   - [docs/features/question-types/README.md](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/docs/features/question-types/README.md)
   - **Key Architecture**:
     - Expanded from 4 basic types to 10 types: Cloze (`cloze`), True/False with Analysis (`true_false`), Listening Comprehension (`listening`), Reading Comprehension (`reading_comprehension`), Writing (`writing`: sentence making, short essay, full essay), and Translation (`translation`: EN->ZH, ZH->EN).
     - Declarative array + object stems, passages, and options.
     - Zero-schema-breaking SQLite storage: leverages `payload_json` and `selected_json` text columns without database migrations.
     - 10 production-grade golden samples for `step-up-english` demonstrating mixed text/TTS stems and options.

---

## 4. English Curriculum Packages (180h Total)

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

## 5. Verification & Testing Instructions

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
