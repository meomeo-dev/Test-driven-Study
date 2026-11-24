---
id: 0090
type: feat
status: open
labels: [course, workflow, english]
branch: feat/0090-expand-beginner-english-cefr-a2-path-and-language-workflow
created: 2026-11-24
---
# Expand beginner-english CEFR A2 path and language workflow

## 背景 / 目标

`courses/beginner-english` (`v2.4.0`) currently covers 10 Pre-A1/A1 units
(41 concepts, 2,240 minutes / 37.33 hours, 424 questions, 71 vocabulary entries)
with a workshop-oriented theme and passes all four strict audit gates (`eta=1.04`).
Meanwhile, `scripts/curriculum_workflow/` still uses STEM-only research roles,
omits `reading_comprehension` and skill-focused quotas on the `language` track,
lacks declarative cross-unit prerequisite and zero-item oral self-check support,
and does not proactively author vocabulary entries for new units.

This issue upgrades `scripts/curriculum_workflow/` for the `language` track and
expands `courses/beginner-english` (`v2.4.0` -> `v2.5.0`) with a general everyday
and workplace CEFR A1+ to A2 learning path (Units 11-16, +30 focused micro-lessons
and concepts, +1,380 minutes / +23.00 hours, reaching 60.33 hours total), starting
with Unit 11 (`everyday-shopping`, 5 lessons) as an end-to-end `run_workflow`
pilot before scaling to Units 12-16.

## 关键功能清单（Key Feature List，KFL）

1. **Language-track upgrades to `scripts/curriculum_workflow/`**:
   - Extract `scripts/curriculum_workflow/track_profiles.py` to support `language`
     vs `stem` research roles, `skill_focus` / explicit `recommended_quota`
     (including `reading_comprehension` and `writing` subtypes), and zero-item
     `oral_self_check` (`effort_lab`) concepts.
   - Support declarative `summary`, cross-unit `prerequisites` (DNF `all_of`
     groups including OR branches), and whole-manifest cycle/reference validation
     in `planning.py`.
   - Enhance `prompts.py` and `stages.py` for language-track lesson authoring,
     dual review, `study_translation` + TTS compliance, proactive unit vocabulary
     authoring when `vocabulary_file` is declared, `--dry-run` without requiring
     a live backend, and macOS Homebrew `node`/`go` PATH fallback in `io_store.py`.
   - Add unit tests under `scripts/curriculum_workflow/tests/`.
2. **CEFR A1+ to A2 expansion syllabus & workflow config**:
   - Commit the verified 6-unit / 30-lesson expansion syllabus and workflow config
     under `docs/research/beginner-english-a2-expansion/`.
3. **Phased expansion of `courses/beginner-english` (`v2.4.0` -> `v2.5.0`)**:
   - Preserve 100% of existing 10 unit IDs, 41 concept IDs, 424 item IDs
     (including `te-mc-03`), option IDs, and answer keys.
   - Pilot Unit 11 (`everyday-shopping`: 5 lessons/concepts, 210 minutes, ~38
     multi-type v2 questions, 100% `study_translation`, ~10 vocab entries, 1 oral
     self-check with `effort-lab`) via `run_workflow` and verify style + strict
     4-gate audit before proceeding to Units 12-16 (`travel-plans`,
     `experiences-progress`, `opinions-advice`, `conditions-processes`,
     `workplace-communication`).
   - Clean up legacy engineering boilerplate `courses/beginner-english/syllabus_180h.json`,
     fix Units 9-10 drift in `courses/beginner-english/README.md`, and backfill
     vocabulary links for the 8 legacy graded concepts that currently have zero
     linked entries.

## 改造面

- `scripts/curriculum_workflow/` (`track_profiles.py`, `prompts.py`, `planning.py`,
  `stages.py`, `io_store.py`, `orchestrator.py`, `__init__.py`, `tests/`).
- `docs/research/beginner-english-a2-expansion/` (`syllabus.json`,
  `workflow-config.json`, generated research notes and `progress.json`).
- `courses/beginner-english/` (`course.json`, new `lessons/*.md`, new
  `questions/*.json`, `assets/vocabulary/english.json`, `README.md`, removal of
  stale `syllabus_180h.json`).

## 非目标

- Modifying Go HTTP APIs, SQLite schema, React UI, or existing Units 1-10
  question/concept/unit IDs or answer keys.
- Bundling offline `.mp3` recordings or raster images in this pass.
- Running live paid TTS synthesis or modifying the user's production learner data
  without explicit isolated verification first.

## 验收标准（Acceptance Criteria，AC）

1. `python3 -m unittest discover -s scripts/curriculum_workflow/tests -p "test_*.py" -v`
   passes with new tests covering language-track roles, `skill_focus` /
   `effort_lab` quotas, declarative cross-unit DAG validation, vocabulary
   authoring hook, `--dry-run`, and PATH resolution; every modified Python module
   stays within 500 lines.
2. Unit 11 (`everyday-shopping`) pilot completes end-to-end through
   `scripts/curriculum_batch_run_workflow.py` (`run_workflow`), passes
   `npm run course:audit -- --strict` (0 errors, 0 warnings across `course:check`,
   `effort --strict`, `tts`, `vocabulary --strict`), and passes isolated
   `npm run course:install -- --data-dir /tmp/...`.
3. After style confirmation on Unit 11 and completion of Units 12-16, the full
   `courses/beginner-english@2.5.0` package (16 units, 71 concepts, 3,620 minutes /
   60.33 hours, 0 legacy ID changes) passes `npm run course:audit -- --strict`,
   isolated `course:install`, `npm run test:go`, and `npm run issue:check`.

## 讨论

- User confirmed the 6-unit CEFR A1+ to A2 general everyday & workplace expansion
  design, legacy hygiene cleanup (`syllabus_180h.json`, `README.md`, 8 unlinked
  legacy concepts), and phased pacing: workflow upgrade -> Unit 11 pilot + strict
  audit -> style confirmation -> Units 12-16.
