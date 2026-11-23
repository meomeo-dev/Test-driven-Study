"""Thin run_workflow shim sharing scripts/curriculum_workflow/ via RunWorkflowBackend."""

from __future__ import annotations

import asyncio
import os
import sys


def _bootstrap_scripts_path() -> None:
    """Add WORKSPACES[0]/scripts (or cwd/scripts) to sys.path for local imports."""
    workspaces = globals().get("WORKSPACES") or ()
    root = workspaces[0] if workspaces else os.getcwd()
    scripts_dir = os.path.join(root, "scripts")
    if scripts_dir not in sys.path:
        sys.path.insert(0, scripts_dir)


_bootstrap_scripts_path()

from curriculum_workflow.backends import RunWorkflowBackend  # noqa: E402
from curriculum_workflow.config import config_from_mapping  # noqa: E402
from curriculum_workflow.orchestrator import run_batch  # noqa: E402


async def _run_in_workflow() -> None:
    """Build config from run_workflow args, inject RunWorkflowBackend, and run batch."""
    raw_args = dict(args) if isinstance(globals().get("args"), dict) else {}
    raw_args.setdefault("backend", "run_workflow")
    cfg = config_from_mapping(raw_args)
    agent_sem = asyncio.Semaphore(cfg.concurrency.max_agents)
    backend = RunWorkflowBackend(
        agent,
        default_model=cfg.run_workflow_model,
        agent_sem=agent_sem,
    )
    result = await run_batch(cfg, backend=backend, log_fn=log, phase_fn=phase)
    for outcome in result.courses:
        log(
            f"Finished [{outcome.course_id}]: ok={outcome.ok} "
            f"completed={outcome.completed} skipped={outcome.skipped} "
            f"failed={outcome.failed}"
        )
    if not result.ok:
        raise RuntimeError(f"curriculum batch workflow failed: {result.to_dict()}")


await _run_in_workflow()
