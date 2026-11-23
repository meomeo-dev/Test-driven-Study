---
id: 0052
type: feat
status: closed
closed-by: 1733272
labels: []
branch: feat/0052-expand-sample-courses-to-180-hour-standard-curriculum
created: 2026-11-14
---
# Expand sample courses to 180-hour standard curriculum

## 背景 / 目标

The sixteen sample track courses built in #49 and #51 currently represent
concise 30-hour introductory modules (1,800 concept minutes each). In standard
higher vocational and technical engineering education curricula, core technical
courses follow a 180-hour comprehensive standard (180 credit/class hours,
totalling 10,800 instructional minutes).

Expand the active track courses (excluding basic-math, starter, ielts and
yunnan-driving) in sequential order, processing three courses in parallel and
executing lessons serially within each course. Each class hour / lesson follows a
disciplined cadence: three subagents perform web-grounded research, the main
coordinator validates citations and integrates lesson materials, and two review
subagents audit the content (one for factual authenticity and error correction,
one for linguistic precision, terminology accuracy and elimination of
hallucinated or pseudo-scientific vocabulary).

## 关键功能清单（Key Feature List，KFL）

- Define and establish the 180-hour standard curriculum syllabus structure for
  the targeted courses in parallel batches of three courses.
- Per-lesson research process: three research subagents per lesson conduct
  external search and store research artifacts under
  `docs/research/<course>/<lesson_n>/<topic__subagent_n>/`.
- Coordinator synthesis: main controller aggregates research, verifies source
  authenticity, and authors/updates lesson content, concept objectives and
  exercises.
- Two-stage review process:
  - Reviewer 1 (factual authenticity & error correction): validates technical
    claims, formulas, parameters and references against search evidence, saved to
    `review/<course>/<lesson_n>/<topic__subagent_n>/`.
  - Reviewer 2 (linguistic precision & anti-hallucination): validates terminology,
    prunes pseudo-scientific metaphors, buzzwords, and vague generalizations,
    saved to `review/<course>/<lesson_n>/<topic__subagent_n>/`.
- Final integration: coordinator applies corrections into course packages,
  updating manifests, lesson markdown files, concepts and questions.

## 改造面

- Course packages under `courses/<course>/`: `course.json`, `README.md`,
  `lessons/`, `questions/`.
- Research documentation under `docs/research/<course>/<lesson_n>/`.
- Audit and review reports under `review/<course>/<lesson_n>/`.
- Development status in `handoff.md`.

## 非目标

- Modifying excluded packages: `courses/basic-math`, `courses/starter`,
  `courses/ielts`, `courses/yunnan-driving`.
- Modifying core application schema versions or Go/React database schemas.
- Adding unverified course relations or altering README-backed roadmap notes.

## 验收标准（Acceptance Criteria，AC）

- Research documentation is organized and recorded under
  `docs/research/<course>/<lesson_n>/<topic__subagent_n>/`.
- Review reports are organized and recorded under
  `review/<course>/<lesson_n>/<topic__subagent_n>/`.
- Course packages pass `go run ./cmd/course check courses/<course>`.
- Preserved item IDs and roadmap relations remain valid and pass existing tests.
- `npm run check` passes.

## 讨论

Subagents execute targeted, bounded research and review tasks with bounded
context windows. Research and review artifacts remain archived in the repository
for auditability and source verification.

Closed on 2026-11-23: all 16 targeted non-flagship sample courses were extracted
out of this application repository into `Test-driven-Study-Courses` in #82
(`1733272`).
