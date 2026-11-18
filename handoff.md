# Development Handoff

Updated 2026-11-17 (America/New_York).

## 1. Baseline Context & Repository State

- **Repository**: `/Volumes/1TB-ZYJ/git/Test-driven-Study` (independent, standalone checkout).
- **Active Branch**: `feat/0052-expand-sample-courses-to-180-hour-standard-curriculum`
- **Baseline Commit**: `f0f3bf8` (`feat: complete research and review for step-up-english-1 lessons 26-30 (Unit 3 Complete)`)
- **Active Issue**: [issues/0052-feat-expand-sample-courses-to-180-hour-standard-curriculum.md](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/issues/0052-feat-expand-sample-courses-to-180-hour-standard-curriculum.md)
- **Current Execution Status**: **PAUSED FOR USER TESTING**. All background tasks stopped.

---

## 2. English Curriculum Packages (180h Total)

Following the zero-schema-change architecture, the 180-hour curriculum is split into two 90-hour semester course packages:

1. **Semester 1**: [courses/step-up-english-1](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/courses/step-up-english-1) ——《零基础阶梯进阶英语（一）》
   - **Progress**: **30 / 90 Lessons COMPLETED (Units 1, 2, 3 100% Complete & Committed)**
   - **Unit 1**: 国际音标与自然拼读规律（Lessons 1–10: 元音、辅音、破擦音、边音、重音规律与连读语调）—— **DONE**
   - **Unit 2**: 名词与代词系统精讲（Lessons 11–20: 可数/不可数、规则/不规则复数、度量量词、缩写、所有格、各类代词）—— **DONE**
   - **Unit 3**: 一般现在时与动词基础形态（Lessons 21–30: be动词、实义动词单三、do/does助动词、频度副词、真理陈述、5W1H、have/has、There be、综合测试）—— **DONE**
   - **Unit 4**: 形容词、副词与比较结构（Lessons 31–40）—— **READY TO RESUME**
   - **Units 5–9**: 现在进行时与介词、一般过去时、情态动词、日常工作交际、综合复习与自测

2. **Semester 2**: [courses/step-up-english-2](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/courses/step-up-english-2) ——《零基础阶梯进阶英语（二）》
   - **Progress**: 0 / 90 Lessons (Syllabus & Package structure initialized)
   - **Units 1–9**: 一般将来时、现在完成时、复杂过去时序、被动语态、状语从句、定语从句、名词性从句、职场邮件与技术读写、终结测评

---

## 3. Verification & Testing Instructions for User

The application and newly created course packages can be tested locally:

1. **Package Integrity Check**:
   ```bash
   go run ./cmd/course check courses/step-up-english-1
   go run ./cmd/course check courses/step-up-english-2
   ```

2. **Start Development Services**:
   ```bash
   npm run dev:up
   ```
   - Open Web Catalog: `http://127.0.0.1:43387/courses`
   - API Endpoint: `http://127.0.0.1:43388`

3. **Inspect Produced Artifacts**:
   - Research Notes: `docs/research/step-up-english-1/lesson_001/` to `lesson_030/`
   - Peer Reviews (Factual & Language): `review/step-up-english-1/lesson_001/` to `lesson_030/`
   - Progress Tracker: `docs/research/step-up-english-1/progress.json`

---

## 4. Instructions to Resume After Testing

When ready to proceed with Unit 4 (Lessons 31 to 40):
```python
run_workflow(
    ScriptPath="/Volumes/1TB-ZYJ/git/Test-driven-Study/scripts/curriculum_batch_workflow.py",
    Cwd="/Volumes/1TB-ZYJ/git/Test-driven-Study",
    Args={
        "courses": ["step-up-english-1"],
        "start_lesson": 31,
        "end_lesson": 35
    }
)
```
