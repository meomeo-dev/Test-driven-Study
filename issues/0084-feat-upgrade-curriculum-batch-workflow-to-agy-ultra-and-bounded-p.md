---
id: 0084
type: feat
status: open
labels: [tooling, workflow, courses]
branch: feat/0084-upgrade-curriculum-batch-workflow-to-agy-ultra-and-bounded-p
created: 2026-11-23
---
# Upgrade curriculum batch workflow to agy-ultra and bounded parallelism

## 背景 / 目标

The existing monolithic `scripts/curriculum_batch_workflow.py` depends on
`run_workflow` injected globals with bare top-level `await`, runs lessons and
unit question authoring sequentially, uses blocking `subprocess.run` inside
`async def`, writes `progress.json` non-atomically without synchronization,
can introduce prerequisite cycles when re-running concepts, and omits the
conditional `audit-course-vocabulary.mjs --strict --json` validation gate.

This feature modularizes the workflow into a Python 3.9+ standard-library
package (`scripts/curriculum_workflow/`), defaults to standalone `agy-ultra`
headless CLI execution with `gemini-4-hydrogen-high`, retains a thin
`run_workflow` shim, and adds deadlock-free bounded parallelism, atomic state
persistence, deterministic manifest assembly, and per-lesson/per-course error
isolation.

## 关键功能清单（Key Feature List，KFL）

- Modularize workflow logic into `scripts/curriculum_workflow/` (`config.py`,
  `io_store.py`, `backends.py`, `planning.py`, `prompts.py`, `stages.py`,
  `orchestrator.py`), keeping every file `<= 500` lines and every function
  `<= 40` lines using Python 3.9+ stdlib only.
- Replace `scripts/curriculum_batch_workflow.py` with an executable CLI
  entrypoint (no top-level `await`) supporting argparse flags, JSON config,
  env defaults, `--dry-run`, and `--print-config`, plus a thin
  `scripts/curriculum_batch_run_workflow.py` shim for `run_workflow`.
- Implement `AgyUltraCliBackend` (default backend `"cli"`, CLI `"agy-ultra"`,
  model `"gemini-4-hydrogen-high"`):
  - Resolve `agy-ultra` on `PATH` or fall back to `agy` (including
    `/opt/homebrew/bin/agy` and `/usr/local/bin/agy`) with
    `--app_data_dir=<app_data_dir>`, `SSH_CONNECTION=1`, and real user `HOME`
    fallback when `$HOME/.gemini/<app_data_dir>` is missing; invoke custom
    `cli_bin` binaries directly without wrapper flags.
  - Pass `--model`, `--output-format json`, `--json-schema`,
    `--dangerously-skip-permissions` (configurable), `--print-timeout`, and
    `-p <prompt>` with `stdin=DEVNULL`.
  - Parse JSON envelopes (`status == "SUCCESS"`, no `error`, prefer
    `structured_output`, fallback to `response`/plain JSON extraction),
    strictly validate schemas (`bool` vs `int`, `required`,
    `additionalProperties`), and retry with exponential backoff + jitter and
    schema-error feedback (fail fast on missing binary / usage exit code 2).
- Implement `RunWorkflowBackend` accepting `inherit|flash_lite|flash|pro`
  (defaulting to `"inherit"`).
- Implement a deadlock-free semaphore DAG (`course_sem`, `lesson_sem`,
  `unit_sem`, global `agent_sem` on leaf backend invocations, `validate_sem`),
  non-blocking async subprocesses, atomic `ProgressStore` with per-file
  `asyncio.Lock` + `fsync` + `os.replace`, deferred `budget_plan.json` writes,
  canonical lesson/unit ordering, cycle-safe `upsert_unit_in_manifest`,
  per-lesson/per-course error isolation, and conditional vocabulary audit
  (`audit-course-vocabulary.mjs --strict --json`) when `vocabulary_file` is set.
- Add offline `unittest` coverage under `scripts/curriculum_workflow/tests/`
  using an executable stub CLI (no live/paid LLM calls).

## 改造面

- `scripts/curriculum_batch_workflow.py`
- `scripts/curriculum_batch_run_workflow.py`
- `scripts/curriculum_workflow/` (`__init__.py`, `config.py`, `io_store.py`,
  `backends.py`, `planning.py`, `prompts.py`, `stages.py`, `orchestrator.py`)
- `scripts/curriculum_workflow/tests/`

## 非目标

- Adding third-party Python or Node dependencies (`docs/dependencies.yaml`
  remains unchanged).
- Executing live/paid LLM calls or modifying existing installed course
  content during verification.
- Changing Go server, SQLite storage, or React frontend runtime behavior.

## 验收标准（Acceptance Criteria，AC）

- Every `.py` file under `scripts/curriculum_batch*.py` and
  `scripts/curriculum_workflow/` compiles cleanly under Python 3.9, has
  `<= 500` lines, and has every function/method `<= 40` lines.
- `python3 scripts/curriculum_batch_workflow.py --help`, `--print-config`,
  and `--dry-run` against a real syllabus exit `0` without modifying files or
  invoking any LLM.
- Offline unit tests (`python3 -m unittest discover -s
  scripts/curriculum_workflow/tests -p "test_*.py"`) pass and verify CLI argv
  and env resolution, retry/timeout/schema validation, atomic progress store
  under concurrency, deadlock-free bounded parallelism, deterministic manifest
  ordering without prerequisite cycles, error isolation, resume skips, and the
  conditional vocabulary gate.
- `npm run issue:check` passes cleanly.

## 讨论

- Splitting `scripts/curriculum_batch_run_workflow.py` from
  `scripts/curriculum_batch_workflow.py` avoids top-level `await` syntax errors
  under standalone `python3` while allowing `run_workflow` to append
  `WORKSPACES[0]/scripts` to `sys.path` and inject `RunWorkflowBackend`.
- In `agy` 1.5.12, `--app_data_dir` uses underscores (Go `flag` syntax), and
  `agy-ultra` is commonly defined as a zsh alias (`SSH_CONNECTION=1 agy
  --app_data_dir=antigravity-cli-ultra`), so subprocess fallback handling is
  required for non-interactive shells.
