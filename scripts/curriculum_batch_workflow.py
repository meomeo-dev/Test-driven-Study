#!/usr/bin/env python3
"""Standalone CLI entrypoint for the modular v2 curriculum batch workflow."""

from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
from typing import Any, Dict, Mapping, Optional, Sequence, Tuple

_SCRIPTS_DIR = os.path.dirname(os.path.abspath(__file__))
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)

from curriculum_workflow.config import (  # noqa: E402
    DEFAULT_APP_DATA_DIR,
    DEFAULT_BACKEND,
    DEFAULT_CLI_BIN,
    DEFAULT_MODEL,
    DEFAULT_RUN_WORKFLOW_MODEL,
    VALID_BACKENDS,
    VALID_RUN_WORKFLOW_MODELS,
    VALID_TRACKS,
    WorkflowConfig,
    build_workflow_config,
    load_config_file,
)
from curriculum_workflow.orchestrator import run_batch  # noqa: E402


def _add_backend_args(parser: argparse.ArgumentParser) -> None:
    """Register config file, backend selection, model, and output mode flags."""
    grp = parser.add_argument_group("backend and modes")
    grp.add_argument("--config", help="Path to JSON workflow configuration file")
    grp.add_argument(
        "--backend", choices=VALID_BACKENDS, default=None,
        help=f"Agent backend (default: {DEFAULT_BACKEND})",
    )
    grp.add_argument(
        "--model", default=None,
        help=f"Model ID for CLI backend (default: {DEFAULT_MODEL})",
    )
    grp.add_argument(
        "--run-workflow-model", choices=VALID_RUN_WORKFLOW_MODELS, default=None,
        help=f"Tier for run_workflow (default: {DEFAULT_RUN_WORKFLOW_MODEL})",
    )
    grp.add_argument("--dry-run", action="store_true", default=None, help="Plan only")
    grp.add_argument(
        "--print-config", action="store_true", default=False,
        help="Print resolved JSON configuration and exit without running",
    )
    grp.add_argument("--json", dest="json_output", action="store_true", default=False)


def _add_cli_args(parser: argparse.ArgumentParser) -> None:
    """Register agy-ultra CLI binary, profile, permission, and timeout flags."""
    grp = parser.add_argument_group("agy-ultra CLI")
    grp.add_argument(
        "--cli-bin", default=None,
        help=f"CLI executable name or path (default: {DEFAULT_CLI_BIN})",
    )
    grp.add_argument(
        "--app-data-dir", default=None,
        help=f"agy --app_data_dir value (default: {DEFAULT_APP_DATA_DIR})",
    )
    grp.add_argument("--cli-home", default=None, help="Override HOME for agy profile")
    grp.add_argument("--cli-timeout", type=int, default=None, help="Timeout (s)")
    grp.add_argument("--effort", default=None, help="Optional agy --effort level")
    grp.add_argument(
        "--no-skip-permissions", dest="dangerously_skip_permissions",
        action="store_false", default=None,
        help="Disable --dangerously-skip-permissions on CLI invocations",
    )
    grp.add_argument(
        "--add-dir", dest="add_dirs", action="append", default=None,
        help="Extra workspace directory for agy --add-dir (repeatable)",
    )
    grp.add_argument("--cwd", default=None, help="Working directory for CLI calls")


def _add_concurrency_args(parser: argparse.ArgumentParser) -> None:
    """Register semaphore concurrency and retry/backoff flags."""
    grp = parser.add_argument_group("concurrency and retries")
    grp.add_argument("--max-courses", type=int, default=None)
    grp.add_argument("--max-lessons-per-course", type=int, default=None)
    grp.add_argument("--max-units-per-course", type=int, default=None)
    grp.add_argument("--max-agents", type=int, default=None)
    grp.add_argument("--max-subprocesses", type=int, default=None)
    grp.add_argument("--max-attempts", type=int, default=None)
    grp.add_argument(
        "--initial-backoff", dest="initial_backoff_seconds", type=float, default=None
    )
    grp.add_argument(
        "--max-backoff", dest="max_backoff_seconds", type=float, default=None
    )
    grp.add_argument("--jitter-ratio", type=float, default=None)
    grp.add_argument(
        "--validate-timeout", dest="validate_timeout_seconds", type=int, default=None
    )


def _add_course_args(parser: argparse.ArgumentParser) -> None:
    """Register course selection, syllabus paths, and quality gate flags."""
    grp = parser.add_argument_group("course selection and packaging")
    grp.add_argument("--courses", nargs="+", default=None, help="Course IDs")
    grp.add_argument("--start-lesson", type=int, default=None)
    grp.add_argument("--end-lesson", type=int, default=None)
    grp.add_argument("--courses-root", default=None)
    grp.add_argument("--syllabus-file", default=None)
    grp.add_argument("--base-manifest", default=None)
    grp.add_argument("--package-dir", default=None)
    grp.add_argument("--research-dir", default=None)
    grp.add_argument("--target-course-id", default=None)
    grp.add_argument("--target-title", default=None)
    grp.add_argument("--version", default=None)
    grp.add_argument("--language", default=None)
    grp.add_argument("--track", choices=VALID_TRACKS, default=None)
    grp.add_argument(
        "--no-split-concepts", dest="split_concepts",
        action="store_false", default=None,
    )
    grp.add_argument("--ingest-archived", action="store_true", default=None)
    grp.add_argument("--force-research", action="store_true", default=None)
    grp.add_argument("--force-recheck", action="store_true", default=None)
    grp.add_argument("--strict-effort", action="store_true", default=None)
    grp.add_argument("--max-revisions", type=int, default=None)
    grp.add_argument(
        "--no-package-on-partial-failure", dest="package_on_partial_failure",
        action="store_false", default=None,
    )


def build_parser() -> argparse.ArgumentParser:
    """Construct the command-line argument parser."""
    parser = argparse.ArgumentParser(
        prog="curriculum_batch_workflow.py",
        description=(
            "Run quota-driven v2 curriculum generation with agy-ultra "
            "and bounded parallelism."
        ),
    )
    _add_backend_args(parser)
    _add_cli_args(parser)
    _add_concurrency_args(parser)
    _add_course_args(parser)
    return parser


def _namespace_to_overrides(ns: argparse.Namespace) -> Dict[str, Any]:
    """Convert non-None parsed CLI arguments into a config override dict."""
    ignore = {"config", "print_config", "json_output"}
    return {
        k: v for k, v in vars(ns).items() if k not in ignore and v is not None
    }


def parse_args_to_config(
    argv: Optional[Sequence[str]] = None,
    env: Optional[Mapping[str, str]] = None,
) -> Tuple[WorkflowConfig, argparse.Namespace]:
    """Parse CLI arguments, load optional JSON config, and return WorkflowConfig."""
    parser = build_parser()
    ns = parser.parse_args(list(argv) if argv is not None else None)
    file_cfg = load_config_file(ns.config) if ns.config else None
    cfg = build_workflow_config(
        cli_overrides=_namespace_to_overrides(ns),
        file_config=file_cfg,
        env=env,
    )
    return cfg, ns


def main(argv: Optional[Sequence[str]] = None) -> int:
    """CLI entrypoint returning process exit code (0 on success, 1 on failure)."""
    cfg, ns = parse_args_to_config(argv)
    if ns.print_config:
        print(json.dumps(cfg.to_dict(), ensure_ascii=False, indent=2))
        return 0
    json_mode = bool(ns.json_output or cfg.dry_run)
    log_fn = (lambda msg: print(msg, file=sys.stderr)) if json_mode else print
    result = asyncio.run(run_batch(cfg, log_fn=log_fn))
    if json_mode:
        print(json.dumps(result.to_dict(), ensure_ascii=False, indent=2))
    else:
        for outcome in result.courses:
            print(
                f"Finished [{outcome.course_id}]: ok={outcome.ok} "
                f"completed={outcome.completed} skipped={outcome.skipped} "
                f"failed={outcome.failed} package={outcome.package_dir}"
            )
    return result.exit_code


if __name__ == "__main__":
    sys.exit(main())
