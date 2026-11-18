# Development Handoff

Updated 2026-11-17 (America/New_York).

## 1. Baseline Context & Repository State

- **Repository**: `/Volumes/1TB-ZYJ/git/Test-driven-Study` (independent, standalone checkout).
- **Active Branch**: `feat/0052-expand-sample-courses-to-180-hour-standard-curriculum`
- **Baseline Commit**: `94994eb` (`feat: complete research and review for step-up-english-1 lessons 8-10 (Unit 1 Complete)`)
- **Active Issue**: [issues/0052-feat-expand-sample-courses-to-180-hour-standard-curriculum.md](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/issues/0052-feat-expand-sample-courses-to-180-hour-standard-curriculum.md)
- **Primary Objective**: Focus exclusively on the new 180-hour Step-up Practical English curriculum (`step-up-english-1` & `step-up-english-2`), executing per-lesson 5-agent pipelines (3 research + 2 review).

---

## 2. English Curriculum Packages (180h Total)

Following the zero-schema-change architecture, the 180-hour curriculum is split into two 90-hour semester course packages:

1. **Semester 1**: [courses/step-up-english-1](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/courses/step-up-english-1) ——《零基础阶梯进阶英语（一）》
   - **Progress**: **10 / 90 Lessons COMPLETED (Unit 1 100% Complete & Committed)**
   - **Unit 1**: 国际音标与自然拼读规律（Lessons 1–10: 元音、辅音、破擦音、边音、重音规律与连读语调）—— **DONE**
   - **Unit 2**: 名词与代词系统精讲（Lessons 11–20）—— **NEXT**
   - **Units 3–9**: 一般现在时、形容词副词、现在进行时与介词、一般过去时、情态动词、日常工作交际、综合复习与自测

2. **Semester 2**: [courses/step-up-english-2](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/courses/step-up-english-2) ——《零基础阶梯进阶英语（二）》
   - **Progress**: 0 / 90 Lessons (Syllabus initialized)
   - **Units 1–9**: 一般将来时、现在完成时、复杂过去时序、被动语态、状语从句、定语从句、名词性从句、职场邮件与技术读写、终结测评

---

## 3. Workflow & Orchestration Primitives

- **Source Script**: [scripts/curriculum_batch_workflow.py](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/scripts/curriculum_batch_workflow.py)
- **Execution Driver**: Native Antigravity `run_workflow`
- **Model**: Subagents use `flash_lite` (or `gemini-3.8-flash-high`) for single-lesson bounded contexts.
- **Cadence**: 3 research agents (R1 standards, R2 industrial params, R3 failure modes) $\to$ coordinator draft $\to$ 2 review agents (factual correctness, language precision) $\to$ final integration.

---

## 4. Next Concrete Steps

To proceed with Unit 2 (Lessons 11 to 20):
```python
run_workflow(
    ScriptPath="/Volumes/1TB-ZYJ/git/Test-driven-Study/scripts/curriculum_batch_workflow.py",
    Cwd="/Volumes/1TB-ZYJ/git/Test-driven-Study",
    Args={
        "courses": ["step-up-english-1"],
        "start_lesson": 11,
        "end_lesson": 15
    }
)
```
Followed by atomic commit:
```bash
git add docs/research/step-up-english-1/ review/step-up-english-1/ docs/research/step-up-english-1/progress.json
git commit -m "feat: complete research and review for step-up-english-1 lessons 11-15"
```
