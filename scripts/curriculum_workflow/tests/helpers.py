"""Shared offline test helpers for stub_agy_cli scenarios, traces, and validators."""

from __future__ import annotations

import asyncio
import json
import os
import sys
import unittest
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple
from unittest import mock

_SCRIPTS_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)

from curriculum_workflow.config import (  # noqa: E402
    CliConfig,
    RetryConfig,
    WorkflowConfig,
)
from curriculum_workflow.io_store import (  # noqa: E402
    CommandResult,
    atomic_write_json,
)
from curriculum_workflow.orchestrator import BatchResult, run_batch  # noqa: E402
from curriculum_workflow.stages import VOCAB_AUDIT_SCRIPT  # noqa: E402
from curriculum_workflow.tests import STUB_CLI_PATH  # noqa: E402


def write_stub_scenario(
    tmp: str, scenario: Dict[str, Any], *, auto_side_effects: bool = False
) -> Tuple[str, str, str]:
    """Write a stub scenario JSON in tmp and return (scenario, state, trace) paths."""
    sc_path = os.path.join(tmp, "scenario.json")
    state_path = os.path.join(tmp, "state.json")
    trace_path = os.path.join(tmp, "trace.jsonl")
    payload = {
        "auto_side_effects": auto_side_effects,
        "state_file": state_path,
        "trace_file": trace_path,
        "lock_file": os.path.join(tmp, "stub.lock"),
        **scenario,
    }
    atomic_write_json(sc_path, payload)
    return sc_path, state_path, trace_path


def read_trace(trace_path: str) -> List[Dict[str, Any]]:
    """Read JSONL trace entries produced by stub_agy_cli.py."""
    if not os.path.exists(trace_path):
        return []
    with open(trace_path, "r", encoding="utf-8") as fh:
        return [json.loads(line) for line in fh if line.strip()]


def read_state(state_path: str) -> Dict[str, Any]:
    """Read lock-protected state JSON written by stub_agy_cli.py."""
    with open(state_path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def assert_pid_dead(test: unittest.TestCase, pid: int) -> None:
    """Verify subprocess PID is no longer alive (reaped)."""
    with test.assertRaises(ProcessLookupError):
        os.kill(pid, 0)


def lesson_meta(
    num: int, unit_slug: str, unit_title: str, duration: int = 30
) -> Dict[str, Any]:
    """Create one compact syllabus lesson entry."""
    return {
        "lesson_number": num,
        "lesson_id": f"L{num:02d}",
        "lesson_title": f"Lesson {num}",
        "unit_slug": unit_slug,
        "unit_title": unit_title,
        "duration_minutes": duration,
        "topic_1": f"L{num} Topic 1",
        "topic_2": f"L{num} Topic 2",
        "topic_3": f"L{num} Topic 3",
    }


def write_syllabus(
    path: str, course_id: str, lessons: Sequence[Dict[str, Any]]
) -> None:
    """Persist a temporary syllabus JSON file."""
    atomic_write_json(
        path,
        {
            "course_id": course_id,
            "course_title": f"Course {course_id}",
            "lessons": list(lessons),
        },
    )


def peak_overlap(intervals: Sequence[Tuple[float, float]]) -> int:
    """Compute maximum simultaneously overlapping intervals via sweep line."""
    events: List[Tuple[float, int]] = []
    for start, end in intervals:
        events.append((start, 1))
        events.append((end, -1))
    events.sort(key=lambda pair: (pair[0], pair[1]))
    cur, peak = 0, 0
    for _, delta in events:
        cur += delta
        peak = max(peak, cur)
    return peak


def make_mock_validator(
    recorded: List[List[str]], *, fail_vocab_once: bool = False
) -> Callable[..., Any]:
    """Create an async validation cmd_runner mock returning passing audit JSON."""
    vocab_calls = 0

    async def _runner(cmd: Sequence[str], **_kwargs: Any) -> CommandResult:
        nonlocal vocab_calls
        argv = list(cmd)
        recorded.append(argv)
        if argv[0] == "go":
            return CommandResult(0, "course check OK\n", "")
        if len(argv) > 1 and argv[1] == VOCAB_AUDIT_SCRIPT:
            vocab_calls += 1
            if fail_vocab_once and vocab_calls == 1:
                body = json.dumps({"ok": False, "issueCount": 1, "issues": ["pos"]})
                return CommandResult(1, body, "")
            return CommandResult(0, json.dumps({"ok": True, "issueCount": 0}), "")
        body = json.dumps({
            "ok": True, "issueCount": 0, "ratio": 1.0,
            "designMinutes": 60, "declaredMinutes": 60,
        })
        return CommandResult(0, body, "")

    return _runner


def make_cli_cfg(tmp: str, **kwargs: Any) -> WorkflowConfig:
    """Construct a fast offline WorkflowConfig wired to STUB_CLI_PATH."""
    return WorkflowConfig(
        cli=CliConfig(cli_bin=STUB_CLI_PATH, timeout_seconds=30, cwd=tmp),
        retry=RetryConfig(
            max_attempts=2, initial_backoff_seconds=0.01, max_backoff_seconds=0.05
        ),
        split_concepts=False,
        **kwargs,
    )


def run_stub_batch(
    cfg: WorkflowConfig,
    scenario_path: str,
    *,
    recorded_cmds: Optional[List[List[str]]] = None,
    fail_vocab_once: bool = False,
) -> BatchResult:
    """Execute run_batch against stub_agy_cli.py with mocked validation commands."""
    cmds = recorded_cmds if recorded_cmds is not None else []
    validator = make_mock_validator(cmds, fail_vocab_once=fail_vocab_once)
    with mock.patch.dict(os.environ, {"STUB_SCENARIO_FILE": scenario_path}):
        return asyncio.run(
            run_batch(cfg, log_fn=lambda _m: None, cmd_runner=validator)
        )
