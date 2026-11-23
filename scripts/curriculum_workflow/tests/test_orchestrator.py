"""Offline end-to-end tests for orchestrator concurrency, isolation, and entrypoints."""

from __future__ import annotations

import ast
import asyncio
import json
import os
import subprocess
import sys
import tempfile
import unittest
from typing import Any, Dict, List
from unittest import mock

_SCRIPTS_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)

from curriculum_workflow.backends import (  # noqa: E402
    RunWorkflowBackend,
    SUMMARY_SCHEMA,
)
from curriculum_workflow.config import ConcurrencyConfig, RetryConfig  # noqa: E402
from curriculum_workflow.io_store import (  # noqa: E402
    atomic_write_json,
    atomic_write_text,
    load_json,
    read_text,
)
from curriculum_workflow.orchestrator import BatchResult  # noqa: E402
from curriculum_workflow.planning import assert_acyclic_concepts  # noqa: E402
from curriculum_workflow.stages import VOCAB_AUDIT_SCRIPT  # noqa: E402
from curriculum_workflow.tests import REPO_ROOT, SCRIPTS_DIR  # noqa: E402
from curriculum_workflow.tests.helpers import (  # noqa: E402
    lesson_meta,
    make_cli_cfg,
    peak_overlap,
    read_trace,
    run_stub_batch,
    write_stub_scenario,
    write_syllabus,
)


def _setup_two_courses(tmp: str) -> Dict[str, Dict[str, Any]]:
    """Create two 3-lesson / 2-unit syllabuses and return course_overrides."""
    lessons = [
        lesson_meta(1, "unit-1", "Unit 1"),
        lesson_meta(2, "unit-1", "Unit 1"),
        lesson_meta(3, "unit-2", "Unit 2"),
    ]
    overrides: Dict[str, Dict[str, Any]] = {}
    for cid in ("course-a", "course-b"):
        syl = os.path.join(tmp, f"{cid}_syl.json")
        write_syllabus(syl, cid, lessons)
        overrides[cid] = {
            "syllabus_file": syl,
            "package_dir": os.path.join(tmp, "pkg", cid),
            "research_dir": os.path.join(tmp, "res", cid),
        }
    return overrides


class TestOrchestratorConcurrencyAndOrdering(unittest.TestCase):
    """End-to-end concurrency bounds and deterministic manifest ordering tests."""

    def test_bounded_multi_course_lesson_unit_and_agent_concurrency(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            overrides = _setup_two_courses(tmp)
            sc_path, state_path, trace_path = write_stub_scenario(
                tmp,
                {
                    "default_delay": 0.06,
                    "rules": [
                        {"name": "q-delay", "stage": "questions", "delay_seconds": 0.14}
                    ],
                },
                auto_side_effects=True,
            )
            cfg = make_cli_cfg(
                tmp,
                courses=("course-a", "course-b"),
                start_lesson=1, end_lesson=3,
                concurrency=ConcurrencyConfig(
                    max_courses=2, max_lessons_per_course=2,
                    max_units_per_course=2, max_agents=4, max_subprocesses=2,
                ),
                course_overrides=overrides,
            )
            res = run_stub_batch(cfg, sc_path)
            self.assertTrue(res.ok and res.exit_code == 0)
            state = load_json(state_path)
            self.assertGreater(state["peak_active"], 1)
            self.assertLessEqual(state["peak_active"], 4)
            self._assert_lesson_and_unit_bounds(read_trace(trace_path), tmp)

    def _assert_lesson_and_unit_bounds(
        self, trace: List[Dict[str, Any]], tmp: str
    ) -> None:
        """Verify per-course lesson bounds and post-manifest parallel unit questions."""
        for cid in ("course-a", "course-b"):
            prefix = os.path.join(tmp, "res", cid)
            by_lesson: Dict[str, List[Dict[str, Any]]] = {}
            for item in trace:
                if str(item["lesson_key"]).startswith(prefix):
                    by_lesson.setdefault(str(item["lesson_key"]), []).append(item)
            spans = [
                (min(x["start_ts"] for x in rows), max(x["end_ts"] for x in rows))
                for rows in by_lesson.values()
            ]
            peak_lessons = peak_overlap(spans)
            self.assertGreater(peak_lessons, 1)
            self.assertLessEqual(peak_lessons, 2)

        q_items = [x for x in trace if x["stage"] == "questions"]
        self.assertEqual(len(q_items), 4)
        self.assertTrue(all(x["manifest_exists_at_start"] for x in q_items))
        q_peak = peak_overlap([(x["start_ts"], x["end_ts"]) for x in q_items])
        self.assertGreater(q_peak, 1)
        self.assertLessEqual(q_peak, 4)

    def test_out_of_order_completion_produces_deterministic_manifest(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            syl, pkg, res_dir = f"{tmp}/syl.json", f"{tmp}/pkg", f"{tmp}/res"
            lessons = [lesson_meta(i, "unit-1", "Unit 1", 60) for i in (1, 2, 3)]
            write_syllabus(syl, "order-course", lessons)
            rules = [
                {"name": "l1", "path_contains": "/L01/", "delay_seconds": 0.14},
                {"name": "l2", "path_contains": "/L02/", "delay_seconds": 0.06},
                {"name": "l3", "path_contains": "/L03/", "delay_seconds": 0.0},
            ]
            sc_path, _, trace_path = write_stub_scenario(
                tmp, {"rules": rules}, auto_side_effects=True
            )
            cfg = make_cli_cfg(
                tmp, courses=("order-course",), start_lesson=1, end_lesson=3,
                syllabus_file=syl, package_dir=pkg, research_dir=res_dir,
                concurrency=ConcurrencyConfig(
                    max_courses=1, max_lessons_per_course=3,
                    max_units_per_course=2, max_agents=6, max_subprocesses=2,
                ),
            )
            cfg.split_concepts = True
            res = run_stub_batch(cfg, sc_path)
            self.assertTrue(res.ok)
            self._assert_canonical_order(read_trace(trace_path), pkg)

    def _assert_canonical_order(self, trace: List[Dict[str, Any]], pkg: str) -> None:
        """Verify L03 completed before L01 yet manifest stays canonically ordered."""
        l1_end = max(x["end_ts"] for x in trace if "/L01/" in x["target_path"])
        l3_end = max(x["end_ts"] for x in trace if "/L03/" in x["target_path"])
        self.assertLess(l3_end, l1_end)
        unit = load_json(os.path.join(pkg, "course.json"))["units"][0]
        self.assertEqual([x["id"] for x in unit["lessons"]], ["l01", "l02", "l03"])
        cids = [
            "c-l01-core", "c-l01-apply", "c-l02-core",
            "c-l02-apply", "c-l03-core", "c-l03-apply",
        ]
        self.assertEqual([c["id"] for c in unit["concepts"]], cids)
        self.assertNotIn("prerequisites", unit["concepts"][0])
        for idx in range(1, len(cids)):
            self.assertEqual(
                unit["concepts"][idx]["prerequisites"], [{"all_of": [cids[idx - 1]]}]
            )
        assert_acyclic_concepts(unit["concepts"])


class TestOrchestratorReliabilityAndGates(unittest.TestCase):
    """Tests for review-revise loops, failure isolation, resume skip, and vocab gate."""

    def test_review_revise_pass_loop(self) -> None:
        fail_review = {
            "passed": False, "summary": "needs revision",
            "blocking_issues": ["missing worked example"],
            "revision_instructions": ["add worked example"],
        }
        pass_review = {
            "passed": True, "summary": "approved",
            "blocking_issues": [], "revision_instructions": [],
        }
        rule = {
            "name": "fact-fail-once", "stage": "review_fact",
            "sequence": [
                {"mode": "envelope", "payload": fail_review},
                {"mode": "envelope", "payload": pass_review},
            ],
        }
        with tempfile.TemporaryDirectory() as tmp:
            syl, pkg, res_dir = f"{tmp}/syl.json", f"{tmp}/pkg", f"{tmp}/res"
            write_syllabus(syl, "rev-course", [lesson_meta(1, "u1", "U1")])
            sc_path, _, trace_path = write_stub_scenario(
                tmp, {"rules": [rule]}, auto_side_effects=True
            )
            cfg = make_cli_cfg(
                tmp, courses=("rev-course",), start_lesson=1, end_lesson=1,
                syllabus_file=syl, package_dir=pkg, research_dir=res_dir,
            )
            res = run_stub_batch(cfg, sc_path)
            self.assertTrue(res.ok)
            trace = read_trace(trace_path)
            revise = [x for x in trace if x["stage"] == "revise"]
            self.assertEqual(len(revise), 1)
            self.assertIn("missing worked example", revise[0]["prompt"])
            self.assertIn("add worked example", revise[0]["prompt"])
            self.assertEqual(sum(1 for x in trace if x["stage"] == "review_fact"), 2)
            self.assertIn("<!-- revised -->", read_text(f"{pkg}/lessons/l01.md"))

    def test_per_lesson_and_per_course_failure_isolation(self) -> None:
        rule = {
            "name": "break-l1", "stage": "research",
            "path_contains": "/L01/", "mode": "exit_error", "exit_code": 1,
        }
        with tempfile.TemporaryDirectory() as tmp:
            good_syl = f"{tmp}/good_syl.json"
            write_syllabus(
                good_syl, "good-course",
                [lesson_meta(1, "u1", "U1"), lesson_meta(2, "u1", "U1")],
            )
            sc_path, _, _ = write_stub_scenario(
                tmp, {"rules": [rule]}, auto_side_effects=True
            )
            overrides = {
                "missing-course": {
                    "syllabus_file": f"{tmp}/missing.json",
                    "package_dir": f"{tmp}/pkg-m", "research_dir": f"{tmp}/res-m",
                },
                "good-course": {
                    "syllabus_file": good_syl,
                    "package_dir": f"{tmp}/pkg-g", "research_dir": f"{tmp}/res-g",
                },
            }
            cfg = make_cli_cfg(
                tmp, courses=("missing-course", "good-course"),
                start_lesson=1, end_lesson=2,
                package_on_partial_failure=True, course_overrides=overrides,
            )
            cfg.retry = RetryConfig(max_attempts=1)
            res = run_stub_batch(cfg, sc_path)
            self.assertFalse(res.ok)
            self.assertEqual(res.exit_code, 1)
            by_id = {c.course_id: c for c in res.courses}
            self.assertFalse(by_id["missing-course"].ok)
            good = by_id["good-course"]
            self.assertEqual((good.completed, good.failed), (1, 1))
            prog = load_json(f"{tmp}/res-g/progress.json")
            self.assertEqual(prog["L01"]["status"], "FAILED_RESEARCH")
            self.assertEqual(prog["L02"]["status"], "COMPLETED")

    def test_no_package_on_partial_failure_skips_manifest_write(self) -> None:
        rule = {
            "name": "break-l1", "stage": "research",
            "path_contains": "/L01/", "mode": "exit_error", "exit_code": 1,
        }
        with tempfile.TemporaryDirectory() as tmp:
            syl, pkg, res_dir = f"{tmp}/syl.json", f"{tmp}/pkg", f"{tmp}/res"
            write_syllabus(
                syl, "strict-course",
                [lesson_meta(1, "u1", "U1"), lesson_meta(2, "u1", "U1")],
            )
            sc_path, _, _ = write_stub_scenario(
                tmp, {"rules": [rule]}, auto_side_effects=True
            )
            cfg = make_cli_cfg(
                tmp, courses=("strict-course",), start_lesson=1, end_lesson=2,
                syllabus_file=syl, package_dir=pkg, research_dir=res_dir,
                package_on_partial_failure=False,
            )
            cfg.retry = RetryConfig(max_attempts=1)
            res = run_stub_batch(cfg, sc_path)
            self.assertFalse(res.ok)
            self.assertEqual((res.courses[0].completed, res.courses[0].failed), (0, 1))
            self.assertFalse(os.path.exists(f"{pkg}/course.json"))

    def test_completed_resume_skips_without_rewriting_budget_plan(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            syl, pkg, res_dir = f"{tmp}/syl.json", f"{tmp}/pkg", f"{tmp}/res"
            write_syllabus(
                syl, "resume-course",
                [lesson_meta(1, "u1", "U1"), lesson_meta(2, "u1", "U1")],
            )
            atomic_write_text(f"{pkg}/lessons/l01.md", "existing verified lesson " * 15)
            l1_budget = f"{res_dir}/L01/budget_plan.json"
            atomic_write_json(l1_budget, {"sentinel": "untouched"})
            atomic_write_json(
                f"{res_dir}/progress.json",
                {
                    "L01": {
                        "status": "COMPLETED", "effort_audit": "PASSED",
                        "course_check": "PASSED", "package_dir": pkg,
                    }
                },
            )
            sc_path, _, trace_path = write_stub_scenario(tmp, {}, auto_side_effects=True)
            cfg = make_cli_cfg(
                tmp, courses=("resume-course",), start_lesson=1, end_lesson=2,
                syllabus_file=syl, package_dir=pkg, research_dir=res_dir,
            )
            res = run_stub_batch(cfg, sc_path)
            self.assertTrue(res.ok)
            self.assertEqual((res.courses[0].skipped, res.courses[0].completed), (1, 1))
            self.assertEqual(load_json(l1_budget), {"sentinel": "untouched"})
            self.assertTrue(os.path.exists(f"{res_dir}/L02/budget_plan.json"))
            self.assertFalse(any("/L01/" in x["target_path"] for x in read_trace(trace_path)))

    def test_vocab_audit_skipped_when_vocabulary_file_absent(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            syl, pkg, res_dir = f"{tmp}/syl.json", f"{tmp}/pkg", f"{tmp}/res"
            write_syllabus(syl, "no-vocab", [lesson_meta(1, "u1", "U1")])
            sc_path, _, _ = write_stub_scenario(tmp, {}, auto_side_effects=True)
            cmds: List[List[str]] = []
            cfg = make_cli_cfg(
                tmp, courses=("no-vocab",), start_lesson=1, end_lesson=1,
                syllabus_file=syl, package_dir=pkg, research_dir=res_dir,
            )
            res = run_stub_batch(cfg, sc_path, recorded_cmds=cmds)
            self.assertTrue(res.ok)
            self.assertFalse(any(VOCAB_AUDIT_SCRIPT in c for c in cmds))
            self.assertNotIn("vocabulary_audit", load_json(f"{res_dir}/progress.json")["L01"])

    def test_vocab_audit_strict_and_repair_when_vocabulary_file_declared(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            syl, pkg, res_dir = f"{tmp}/syl.json", f"{tmp}/pkg", f"{tmp}/res"
            write_syllabus(syl, "with-vocab", [lesson_meta(1, "u1", "U1")])
            base = f"{tmp}/base.json"
            atomic_write_json(
                base,
                {
                    "protocol_version": 2, "course_id": "with-vocab",
                    "version": "2.0.0", "title": "Vocab", "language": "zh-CN",
                    "description": "d", "vocabulary_file": "assets/vocabulary/en.json",
                    "units": [],
                },
            )
            sc_path, _, trace_path = write_stub_scenario(tmp, {}, auto_side_effects=True)
            cmds: List[List[str]] = []
            cfg = make_cli_cfg(
                tmp, courses=("with-vocab",), start_lesson=1, end_lesson=1,
                syllabus_file=syl, base_manifest=base,
                package_dir=pkg, research_dir=res_dir,
            )
            res = run_stub_batch(
                cfg, sc_path, recorded_cmds=cmds, fail_vocab_once=True
            )
            self.assertTrue(res.ok)
            vocab_cmds = [c for c in cmds if VOCAB_AUDIT_SCRIPT in c]
            self.assertEqual(len(vocab_cmds), 2)
            self.assertEqual(
                vocab_cmds[0], ["node", VOCAB_AUDIT_SCRIPT, pkg, "--strict", "--json"]
            )
            trace = read_trace(trace_path)
            self.assertEqual(sum(1 for x in trace if x["stage"] == "repair_vocab"), 1)
            self.assertEqual(
                load_json(f"{res_dir}/progress.json")["L01"]["vocabulary_audit"], "PASSED"
            )


class TestCliAndRunWorkflowEntrypoints(unittest.TestCase):
    """Subprocess CLI checks and run_workflow top-level-await shim verification."""

    def test_cli_help_and_print_config(self) -> None:
        cli_script = os.path.join(SCRIPTS_DIR, "curriculum_batch_workflow.py")
        clean_env = {"PATH": os.environ.get("PATH", "")}

        help_res = subprocess.run(
            [sys.executable, cli_script, "--help"],
            capture_output=True, text=True, env=clean_env, check=False,
        )
        self.assertEqual(help_res.returncode, 0)
        for flag in ("--model", "--cli-bin", "--max-agents", "--dry-run"):
            self.assertIn(flag, help_res.stdout)

        cfg_res = subprocess.run(
            [sys.executable, cli_script, "--print-config"],
            capture_output=True, text=True, env=clean_env, check=False,
        )
        self.assertEqual(cfg_res.returncode, 0)
        printed = json.loads(cfg_res.stdout)
        self.assertEqual(printed["backend"], "cli")
        self.assertEqual(printed["model"], "gemini-4-hydrogen-high")
        self.assertEqual(printed["cli"]["cli_bin"], "agy-ultra")
        self.assertEqual(printed["cli"]["app_data_dir"], "antigravity-cli-ultra")
        self.assertEqual(printed["run_workflow_model"], "inherit")

    def test_cli_dry_run_makes_zero_writes(self) -> None:
        cli_script = os.path.join(SCRIPTS_DIR, "curriculum_batch_workflow.py")
        clean_env = {"PATH": os.environ.get("PATH", "")}
        with tempfile.TemporaryDirectory() as tmp:
            syl, pkg, res_dir = f"{tmp}/syl.json", f"{tmp}/pkg", f"{tmp}/res"
            write_syllabus(
                syl, "dry-demo",
                [lesson_meta(1, "u1", "U1"), lesson_meta(2, "u1", "U1")],
            )
            dry_res = subprocess.run(
                [
                    sys.executable, cli_script, "--dry-run",
                    "--courses", "dry-demo", "--syllabus-file", syl,
                    "--package-dir", pkg, "--research-dir", res_dir,
                    "--start-lesson", "1", "--end-lesson", "2",
                ],
                capture_output=True, text=True, env=clean_env, check=False,
            )
            self.assertEqual(dry_res.returncode, 0)
            out = json.loads(dry_res.stdout)
            self.assertTrue(out["ok"])
            self.assertEqual(len(out["courses"][0]["dry_run_plan"]["selected_lessons"]), 2)
            self.assertFalse(os.path.exists(pkg))
            self.assertFalse(os.path.exists(res_dir))

    def test_run_workflow_shim_ast_compile_and_dry_run(self) -> None:
        shim_path = os.path.join(SCRIPTS_DIR, "curriculum_batch_run_workflow.py")
        src = read_text(shim_path)
        tree = ast.parse(src, filename=shim_path)
        self.assertTrue(any(isinstance(n, ast.Await) for n in ast.walk(tree)))
        code = compile(src, shim_path, "exec", flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT)

        with tempfile.TemporaryDirectory() as tmp:
            syl = f"{tmp}/syl.json"
            write_syllabus(syl, "rw-demo", [lesson_meta(1, "u1", "U1")])
            logs: List[str] = []

            async def _noop_agent(_p: str, _s: Any, **_kw: Any) -> Dict[str, Any]:
                return {"ok": True, "summary": "unused"}

            ns: Dict[str, Any] = {
                "WORKSPACES": [REPO_ROOT],
                "args": {
                    "courses": ["rw-demo"], "start_lesson": 1, "end_lesson": 1,
                    "syllabus_file": syl, "package_dir": f"{tmp}/pkg",
                    "research_dir": f"{tmp}/res", "dry_run": True,
                },
                "agent": _noop_agent, "log": logs.append,
                "phase": lambda t: logs.append(f"PHASE:{t}"),
            }
            asyncio.run(eval(code, ns))
            self.assertTrue(any("Finished [rw-demo]: ok=True" in m for m in logs))

    def test_run_workflow_shim_injects_backend_and_raises_on_failure(self) -> None:
        shim_path = os.path.join(SCRIPTS_DIR, "curriculum_batch_run_workflow.py")
        code = compile(
            read_text(shim_path), shim_path, "exec",
            flags=ast.PyCF_ALLOW_TOP_LEVEL_AWAIT,
        )
        models: List[str] = []
        captured: Dict[str, Any] = {}

        async def _fake_agent(_p: str, _s: Any, *, role: str, model: str) -> Any:
            models.append(model)
            return {"ok": True, "summary": role}

        async def _spy_batch(cfg: Any, **kwargs: Any) -> BatchResult:
            captured["backend"] = kwargs["backend"]
            await kwargs["backend"].invoke("p", SUMMARY_SCHEMA, role="Spy", model=cfg.model)
            return BatchResult(ok=False, exit_code=1, courses=[])

        ns: Dict[str, Any] = {
            "WORKSPACES": [REPO_ROOT],
            "args": {"courses": ["rw-fail"], "model": "gemini-4-hydrogen-high"},
            "agent": _fake_agent, "log": lambda _m: None, "phase": lambda _t: None,
        }
        with mock.patch("curriculum_workflow.orchestrator.run_batch", _spy_batch):
            with self.assertRaises(RuntimeError):
                asyncio.run(eval(code, ns))
        self.assertIsInstance(captured["backend"], RunWorkflowBackend)
        self.assertEqual(captured["backend"].default_model, "inherit")
        self.assertEqual(models, ["inherit"])


if __name__ == "__main__":
    unittest.main()
