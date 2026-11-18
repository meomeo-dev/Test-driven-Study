# Development Handoff

Updated 2026-11-17 (America/New_York).

## 1. Baseline Context & Repository State

- **Repository**: `/Volumes/1TB-ZYJ/git/Test-driven-Study` (independent, standalone checkout).
- **Active Branch**: `feat/0052-expand-sample-courses-to-180-hour-standard-curriculum`
- **Baseline Commit**: `e89b5e3` (`feat: scaffold 180-hour curriculum batch workflow and syllabi for 16 courses`)
- **Active Issue**: [issues/0052-feat-expand-sample-courses-to-180-hour-standard-curriculum.md](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/issues/0052-feat-expand-sample-courses-to-180-hour-standard-curriculum.md)
- **Primary Objective**: Expand the 16 active engineering/science curriculum courses to 180 instructional hours (180 lessons = 10,800 minutes each) with full web-grounded research notes and two-stage peer reviews.

### Excluded Courses (Out of Scope)
- `courses/basic-math`
- `courses/starter`
- `courses/ielts`
- `courses/yunnan-driving`
- `courses/elementary-chinese`

---

## 2. Architecture: Workflow Definition & Execution Engine

### Where is the Workflow Defined?
The workflow is **NOT** a standalone packaged skill. It is implemented as a **repository-resident script driven by the Antigravity system engine**:
- **Workflow Source Script**: [scripts/curriculum_batch_workflow.py](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/scripts/curriculum_batch_workflow.py).
- **Execution Driver**: Antigravity built-in `run_workflow` tool (which provides runtime primitives: `agent()`, `parallel()`, `phase()`, `log()`, and `args`).
- **Curriculum Master Data**: `courses/<course_id>/syllabus_180h.json` across all 16 target courses (18 units × 10 lessons each = 180 lessons).
- **State & Idempotency Tracker**: `docs/research/<course_id>/progress.json`.

### Per-Lesson Cadence (Strict 4-Phase Protocol)
For every single lesson (1 课时 = 60 minutes):
1. **Phase 1: 3 Parallel Research Subagents**
   - Subagent 1 (`topic_1`): National/international standards (GB/T, ISO, IEEE, ASME) and governing mathematical/physical equations $\to$ `docs/research/<course>/lesson_NNN/topic_1__subagent_1/research_notes.md`
   - Subagent 2 (`topic_2`): Industrial parameters, standard operating procedures, and configuration tables $\to$ `docs/research/<course>/lesson_NNN/topic_2__subagent_2/research_notes.md`
   - Subagent 3 (`topic_3`): Common pitfalls, hardware/code failure modes, and diagnostic quizzes $\to$ `docs/research/<course>/lesson_NNN/topic_3__subagent_3/research_notes.md`
2. **Phase 2: Coordinator Draft Synthesis**
   - Main coordinator verifies citations and aggregates notes into `docs/research/<course>/lesson_NNN/lesson_draft.md`.
3. **Phase 3: 2 Parallel Review Subagents**
   - Reviewer 1 (Factual Accuracy): Web-verifies every claim, formula, and standard number $\to$ `review/<course>/lesson_NNN/fact_check__subagent_1/review_report.md`
   - Reviewer 2 (Linguistic Precision): Audits terminology, eliminates hallucinated terms, empty jargon, and pseudo-scientific analogies $\to$ `review/<course>/lesson_NNN/language_precision__subagent_2/review_report.md`
4. **Phase 4: Coordinator Finalization**
   - Integrates review recommendations into `docs/research/<course>/lesson_NNN/lesson_final.md`.
   - Marks lesson status as `COMPLETED` in `docs/research/<course>/progress.json`.

---

## 3. Recommended Subagent Model & Quota Safety

- Use `flash_lite` or `gemini-3.8-flash-high` for subagent tasks (`agent(..., model="flash_lite")`).
- Subagent tasks are strictly bounded to single topics/lessons to prevent context blowup and ensure completion within the 273k context limit.
- Run lessons in small incremental chunks (e.g. 3 to 5 lessons per invocation) to prevent timeout and facilitate incremental git commits.

---

## 4. Course Batching Roadmap

Processing proceeds 3 courses in parallel, with lessons serial within each course:

| Batch | Target Courses | Status |
| :--- | :--- | :--- |
| **Batch 1** | `cad-fdm-printing`, `circuit-fundamentals`, `c-programming` | Syllabi initialized; ready for lesson execution |
| **Batch 2** | `embedded-mcu`, `python-programming`, `machine-vision` | Syllabi initialized |
| **Batch 3** | `tolerances-metrology`, `applied-machine-learning`, `industrial-automation` | Syllabi initialized |
| **Batch 4** | `pcb-design`, `algebra-geometry`, `engineering-calculus` | Syllabi initialized |
| **Batch 5** | `linear-algebra`, `probability-statistics`, `automatic-control` | Syllabi initialized |
| **Batch 6** | `beginner-english` | Syllabi initialized |

---

## 5. Instructions for Successor Agent

To start or resume execution in `/Volumes/1TB-ZYJ/git/Test-driven-Study`:

1. **Verify Checkout & Branch**:
   Ensure you are working in `/Volumes/1TB-ZYJ/git/Test-driven-Study` on branch `feat/0052-expand-sample-courses-to-180-hour-standard-curriculum`.

2. **Trigger Workflow Chunk**:
   Invoke `run_workflow` passing `ScriptPath`, `Cwd`, and `Args`:
   ```python
   run_workflow(
       ScriptPath="/Volumes/1TB-ZYJ/git/Test-driven-Study/scripts/curriculum_batch_workflow.py",
       Cwd="/Volumes/1TB-ZYJ/git/Test-driven-Study",
       Args={
           "courses": ["cad-fdm-printing", "circuit-fundamentals", "c-programming"],
           "start_lesson": 1,
           "end_lesson": 5
       }
   )
   ```

3. **Post-Chunk Verification & Atomic Commit**:
   After the workflow finishes:
   ```bash
   git add docs/research/ review/
   git commit -m "feat: complete research and review for lessons X-Y in batch N"
   ```

4. **Update Handoff & Repeat**:
   Update this document with verified lesson counts before handing off or proceeding to the next batch.
