"""Offline unit tests for agy-ultra CLI resolution, retries, timeouts, and backends."""

from __future__ import annotations

import asyncio
import json
import os
import sys
import tempfile
import time
import unittest
from typing import Any, List, Tuple
from unittest import mock

_SCRIPTS_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)

from curriculum_workflow.backends import (  # noqa: E402
    AgyUltraCliBackend,
    BackendConfigError,
    BackendError,
    RunWorkflowBackend,
    SUMMARY_SCHEMA,
    SchemaValidationError,
    build_cli_command,
    resolve_cli_invocation,
)
from curriculum_workflow.config import (  # noqa: E402
    CliConfig,
    DEFAULT_APP_DATA_DIR,
    DEFAULT_CLI_BIN,
    DEFAULT_MODEL,
    RetryConfig,
)
from curriculum_workflow.io_store import CommandResult, run_cmd_async  # noqa: E402
from curriculum_workflow.tests import STUB_CLI_PATH  # noqa: E402
from curriculum_workflow.tests.helpers import (  # noqa: E402
    assert_pid_dead,
    read_state,
    read_trace,
    write_stub_scenario,
)


class TestCliResolutionAndCommand(unittest.TestCase):
    """Tests for default agy-ultra resolution, custom cli_bin, and argv wiring."""

    def test_default_agy_ultra_path_hit_without_wrapper_flags(self) -> None:
        cfg = CliConfig()
        self.assertEqual(cfg.cli_bin, DEFAULT_CLI_BIN)
        self.assertEqual(cfg.model, DEFAULT_MODEL)
        self.assertEqual(cfg.app_data_dir, DEFAULT_APP_DATA_DIR)
        argv, env = resolve_cli_invocation(
            cfg,
            env={"HOME": "/fake/home"},
            which_fn=lambda n: "/usr/local/bin/agy-ultra" if n == "agy-ultra" else None,
            exists_fn=lambda p: p == "/fake/home/.gemini/antigravity-cli-ultra",
            pw_dir_fn=lambda: "/real/home",
        )
        self.assertEqual(argv, ["/usr/local/bin/agy-ultra"])
        self.assertEqual(env["HOME"], "/fake/home")
        self.assertNotIn("SSH_CONNECTION", env)

    def test_default_agy_ultra_fallback_to_agy_app_data_dir_and_ssh(self) -> None:
        cfg = CliConfig()
        argv, env = resolve_cli_invocation(
            cfg,
            env={"HOME": "/app-ultra-sandbox"},
            which_fn=lambda _n: None,
            exists_fn=lambda p: p == "/opt/homebrew/bin/agy",
            pw_dir_fn=lambda: "/Users/real",
        )
        self.assertEqual(
            argv, ["/opt/homebrew/bin/agy", "--app_data_dir=antigravity-cli-ultra"]
        )
        self.assertEqual(env["SSH_CONNECTION"], "1")
        self.assertEqual(env["HOME"], "/Users/real")

        argv2, env2 = resolve_cli_invocation(
            cfg,
            env={"HOME": "/Users/real", "SSH_CONNECTION": "custom-ssh"},
            which_fn=lambda _n: None,
            exists_fn=lambda p: p in (
                "/usr/local/bin/agy",
                "/Users/real/.gemini/antigravity-cli-ultra",
            ),
            pw_dir_fn=lambda: "/Users/other",
        )
        self.assertEqual(
            argv2, ["/usr/local/bin/agy", "--app_data_dir=antigravity-cli-ultra"]
        )
        self.assertEqual(env2["SSH_CONNECTION"], "custom-ssh")
        self.assertEqual(env2["HOME"], "/Users/real")

    def test_default_agy_ultra_home_precedence_and_missing_binary(self) -> None:
        which_hit = lambda n: "/bin/agy-ultra" if n == "agy-ultra" else None
        _, env1 = resolve_cli_invocation(
            CliConfig(cli_home="/explicit/home"),
            env={"HOME": "/cur", "AGY_ULTRA_HOME": "/env/home"},
            which_fn=which_hit, exists_fn=lambda _p: False, pw_dir_fn=lambda: "/pw",
        )
        self.assertEqual(env1["HOME"], "/explicit/home")
        _, env2 = resolve_cli_invocation(
            CliConfig(),
            env={"HOME": "/cur", "AGY_ULTRA_HOME": "/env/home"},
            which_fn=which_hit, exists_fn=lambda _p: False, pw_dir_fn=lambda: "/pw",
        )
        self.assertEqual(env2["HOME"], "/env/home")
        with self.assertRaises(BackendConfigError):
            resolve_cli_invocation(
                CliConfig(), env={"HOME": "/cur"},
                which_fn=lambda _n: None, exists_fn=lambda _p: False,
                pw_dir_fn=lambda: "/pw",
            )

    def test_custom_cli_bin_direct_invocation_no_wrapper_injection(self) -> None:
        argv, env = resolve_cli_invocation(
            CliConfig(cli_bin="/custom/bin/my-cli"),
            env={"HOME": "/user/home"},
            which_fn=lambda _n: None,
            exists_fn=lambda p: p == "/custom/bin/my-cli",
            pw_dir_fn=lambda: "/real/home",
        )
        self.assertEqual(argv, ["/custom/bin/my-cli"])
        self.assertEqual(env["HOME"], "/user/home")
        self.assertNotIn("SSH_CONNECTION", env)

        argv2, env2 = resolve_cli_invocation(
            CliConfig(cli_bin="my-cli", cli_home="/override/home"),
            env={"HOME": "/user/home"},
            which_fn=lambda n: "/usr/bin/my-cli" if n == "my-cli" else None,
            exists_fn=lambda _p: False, pw_dir_fn=lambda: "/real/home",
        )
        self.assertEqual(argv2, ["/usr/bin/my-cli"])
        self.assertEqual(env2["HOME"], "/override/home")
        self.assertNotIn("SSH_CONNECTION", env2)

        with self.assertRaises(BackendConfigError):
            resolve_cli_invocation(
                CliConfig(cli_bin="/missing/bin"), env={},
                which_fn=lambda _n: None, exists_fn=lambda _p: False,
            )

    def test_build_cli_command_flags_model_and_schema_wiring(self) -> None:
        cfg = CliConfig(
            cli_bin="/opt/stub", model="gemini-4-hydrogen-high", timeout_seconds=120,
            dangerously_skip_permissions=True, effort="high",
            add_dirs=("/dir/a", "/dir/b"), extra_args=("--disable-slash-commands",),
        )
        argv, _ = build_cli_command(
            cfg, "hello prompt", SUMMARY_SCHEMA,
            env={}, exists_fn=lambda p: p == "/opt/stub",
        )
        self.assertEqual(argv[0], "/opt/stub")
        self.assertEqual(argv[argv.index("--model") + 1], "gemini-4-hydrogen-high")
        self.assertEqual(argv[argv.index("--output-format") + 1], "json")
        self.assertEqual(json.loads(argv[argv.index("--json-schema") + 1]), SUMMARY_SCHEMA)
        self.assertIn("--dangerously-skip-permissions", argv)
        self.assertEqual(argv[argv.index("--effort") + 1], "high")
        self.assertEqual(argv[argv.index("--print-timeout") + 1], "120s")
        self.assertEqual(argv[-2:], ["-p", "hello prompt"])
        self.assertEqual(argv.count("--add-dir"), 2)

        no_skip = CliConfig(cli_bin="/opt/stub", dangerously_skip_permissions=False)
        argv2, _ = build_cli_command(
            no_skip, "p", SUMMARY_SCHEMA,
            env={}, exists_fn=lambda p: p == "/opt/stub",
        )
        self.assertNotIn("--dangerously-skip-permissions", argv2)


class TestAgyUltraCliBackendExecution(unittest.TestCase):
    """End-to-end backend tests against the executable stub_agy_cli.py fixture."""

    def test_stub_wiring_devnull_envelope_response_and_ansi(self) -> None:
        seq = [
            {"mode": "envelope", "payload": {"ok": True, "summary": "env"}},
            {"mode": "response_json", "payload": {"ok": True, "summary": "resp"}},
            {"mode": "ansi_envelope", "payload": {"ok": True, "summary": "ansi"}},
        ]
        with tempfile.TemporaryDirectory() as tmp:
            sc_path, _, trace_path = write_stub_scenario(
                tmp, {"rules": [{"name": "formats", "sequence": seq}]}
            )
            cli_cfg = CliConfig(
                cli_bin=STUB_CLI_PATH, model="gemini-4-hydrogen-high",
                timeout_seconds=30, cwd=tmp,
            )
            backend = AgyUltraCliBackend(cli_cfg, RetryConfig(max_attempts=1))
            with mock.patch.dict(os.environ, {"STUB_SCENARIO_FILE": sc_path}):
                results = [
                    asyncio.run(backend.invoke(f"p{i}", SUMMARY_SCHEMA, role=f"T{i}"))
                    for i in range(3)
                ]
            self.assertEqual([r["summary"] for r in results], ["env", "resp", "ansi"])
            trace = read_trace(trace_path)
            self.assertEqual(len(trace), 3)
            for item in trace:
                self.assertTrue(item["stdin_is_devnull"] and item["stdin_eof"])
                self.assertEqual(item["model"], "gemini-4-hydrogen-high")
                self.assertEqual(os.path.realpath(item["cwd"]), os.path.realpath(tmp))
                for flag in ("--output-format", "--json-schema", "--print-timeout", "-p"):
                    self.assertIn(flag, item["argv"])

    def test_retry_backoff_flaky_exit_bad_json_and_schema_feedback(self) -> None:
        seq = [
            {"mode": "exit_error", "exit_code": 1},
            {"mode": "invalid_json"},
            {"mode": "schema_mismatch", "bad_payload": {"ok": 1, "summary": "bad"}},
            {"mode": "envelope", "payload": {"ok": True, "summary": "recovered"}},
        ]
        sleeps: List[float] = []

        async def _fake_sleep(delay: float) -> None:
            sleeps.append(delay)

        with tempfile.TemporaryDirectory() as tmp:
            sc_path, _, trace_path = write_stub_scenario(
                tmp, {"rules": [{"name": "flaky", "sequence": seq}]}
            )
            backend = AgyUltraCliBackend(
                CliConfig(cli_bin=STUB_CLI_PATH, cwd=tmp),
                RetryConfig(
                    max_attempts=4, initial_backoff_seconds=1.0,
                    max_backoff_seconds=3.0, jitter_ratio=0.25,
                ),
                sleep_fn=_fake_sleep, rng_fn=lambda _lo, _hi: 0.0,
            )
            with mock.patch.dict(os.environ, {"STUB_SCENARIO_FILE": sc_path}):
                res = asyncio.run(backend.invoke("base", SUMMARY_SCHEMA, role="Flaky"))
            self.assertEqual(res, {"ok": True, "summary": "recovered"})
            self.assertEqual(sleeps, [1.0, 2.0, 3.0])
            trace = read_trace(trace_path)
            self.assertNotIn("Previous attempt failed", trace[1]["prompt"])
            self.assertIn("Previous attempt failed", trace[2]["prompt"])
            self.assertIn("expected boolean", trace[3]["prompt"])

    def test_retry_exhaustion_and_jitter_bounds(self) -> None:
        sleeps: List[float] = []

        async def _fake_sleep(delay: float) -> None:
            sleeps.append(delay)

        with tempfile.TemporaryDirectory() as tmp:
            sc_path, state_path, _ = write_stub_scenario(
                tmp, {"default": {"mode": "exit_error", "exit_code": 1}}
            )
            backend = AgyUltraCliBackend(
                CliConfig(cli_bin=STUB_CLI_PATH, cwd=tmp),
                RetryConfig(
                    max_attempts=3, initial_backoff_seconds=2.0,
                    max_backoff_seconds=10.0, jitter_ratio=0.25,
                ),
                sleep_fn=_fake_sleep, rng_fn=lambda _lo, hi: hi,
            )
            with mock.patch.dict(os.environ, {"STUB_SCENARIO_FILE": sc_path}):
                with self.assertRaises(BackendError) as ctx:
                    asyncio.run(backend.invoke("fail", SUMMARY_SCHEMA, role="Ex"))
            self.assertIn("failed after 3 attempts", str(ctx.exception))
            self.assertEqual(read_state(state_path)["total_calls"], 3)
            self.assertEqual(sleeps, [2.5, 5.0])

    def test_timeout_terminates_stub_on_sigterm(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            sc_path, state_path, _ = write_stub_scenario(
                tmp, {"default": {"mode": "sleep_timeout", "sleep_seconds": 30.0}}
            )
            backend = AgyUltraCliBackend(
                CliConfig(cli_bin=STUB_CLI_PATH, timeout_seconds=1, cwd=tmp),
                RetryConfig(max_attempts=1),
            )
            started = time.monotonic()
            with mock.patch.dict(os.environ, {"STUB_SCENARIO_FILE": sc_path}):
                with self.assertRaises(BackendError) as ctx:
                    asyncio.run(backend.invoke("hang", SUMMARY_SCHEMA, role="TO"))
            self.assertIn("timed out", str(ctx.exception))
            self.assertLess(time.monotonic() - started, 5.0)
            for pid in read_state(state_path)["pids"]:
                assert_pid_dead(self, pid)

    def test_timeout_escalates_to_sigkill_when_sigterm_ignored(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            sc_path, state_path, _ = write_stub_scenario(
                tmp,
                {
                    "default": {
                        "mode": "sleep_timeout",
                        "sleep_seconds": 30.0,
                        "ignore_sigterm": True,
                    }
                },
            )
            env = dict(os.environ, STUB_SCENARIO_FILE=sc_path)
            res = asyncio.run(
                run_cmd_async(
                    [STUB_CLI_PATH, "-p", "hang-kill"],
                    cwd=tmp, env=env, timeout=0.35, grace_seconds=0.2,
                )
            )
            self.assertTrue(res.timed_out)
            self.assertEqual(res.returncode, -1)
            for pid in read_state(state_path)["pids"]:
                assert_pid_dead(self, pid)

    def test_fail_fast_on_missing_binary(self) -> None:
        sleeps: List[float] = []
        calls = 0

        async def _fake_sleep(delay: float) -> None:
            sleeps.append(delay)

        async def _raise_fnf(*_args: Any, **_kwargs: Any) -> CommandResult:
            nonlocal calls
            calls += 1
            raise FileNotFoundError("gone")

        missing = AgyUltraCliBackend(
            CliConfig(cli_bin="/nonexistent/agy-bin"),
            RetryConfig(max_attempts=3), sleep_fn=_fake_sleep,
        )
        with self.assertRaises(BackendConfigError):
            asyncio.run(missing.invoke("hi", SUMMARY_SCHEMA, role="Missing"))

        fnf = AgyUltraCliBackend(
            CliConfig(cli_bin=STUB_CLI_PATH),
            RetryConfig(max_attempts=3), cmd_runner=_raise_fnf, sleep_fn=_fake_sleep,
        )
        with self.assertRaises(BackendConfigError):
            asyncio.run(fnf.invoke("hi", SUMMARY_SCHEMA, role="FNF"))
        self.assertEqual(calls, 1)
        self.assertEqual(sleeps, [])

    def test_fail_fast_on_usage_exit_2(self) -> None:
        sleeps: List[float] = []

        async def _fake_sleep(delay: float) -> None:
            sleeps.append(delay)

        with tempfile.TemporaryDirectory() as tmp:
            sc_path, state_path, _ = write_stub_scenario(
                tmp, {"default": {"mode": "usage_error", "stderr": "unknown flag\n"}}
            )
            backend = AgyUltraCliBackend(
                CliConfig(cli_bin=STUB_CLI_PATH, cwd=tmp),
                RetryConfig(max_attempts=3), sleep_fn=_fake_sleep,
            )
            with mock.patch.dict(os.environ, {"STUB_SCENARIO_FILE": sc_path}):
                with self.assertRaises(BackendConfigError) as ctx:
                    asyncio.run(backend.invoke("bad", SUMMARY_SCHEMA, role="Usage"))
            self.assertIn("exit 2", str(ctx.exception))
            self.assertEqual(read_state(state_path)["total_calls"], 1)
            self.assertEqual(sleeps, [])


class TestRunWorkflowBackend(unittest.TestCase):
    """Tests for RunWorkflowBackend tier mapping, schema checks, and semaphore."""

    def test_default_inherit_and_tier_mapping(self) -> None:
        recorded: List[Tuple[str, str]] = []

        async def _fake_agent(
            _p: str, _s: Any, *, role: str, model: str
        ) -> Any:
            recorded.append((role, model))
            return {"ok": True, "summary": f"{role}:{model}"}

        backend = RunWorkflowBackend(_fake_agent)
        self.assertEqual(backend.default_model, "inherit")
        self.assertIn("finish", backend.completion_instruction(SUMMARY_SCHEMA))
        for tier in ("inherit", "flash_lite", "flash", "pro"):
            self.assertEqual(backend.resolve_model(tier), tier)
        self.assertEqual(backend.resolve_model("gemini-4-hydrogen-high"), "inherit")

        res = asyncio.run(
            backend.invoke("hi", SUMMARY_SCHEMA, role="R1", model="gemini-4-hydrogen-high")
        )
        self.assertEqual(res["summary"], "R1:inherit")
        pro_backend = RunWorkflowBackend(_fake_agent, default_model="pro")
        asyncio.run(pro_backend.invoke("hi", SUMMARY_SCHEMA, role="R2", model="flash"))
        asyncio.run(
            pro_backend.invoke("hi", SUMMARY_SCHEMA, role="R3", model="gemini-4-hydrogen-high")
        )
        self.assertEqual(recorded, [("R1", "inherit"), ("R2", "flash"), ("R3", "pro")])
        with self.assertRaises(BackendConfigError):
            RunWorkflowBackend(_fake_agent, default_model="gemini-4-hydrogen-high")

    def test_run_workflow_backend_semaphore_and_schema_validation(self) -> None:
        active, peak = 0, 0

        async def _slow_agent(_p: str, _s: Any, *, role: str, model: str) -> Any:
            nonlocal active, peak
            active += 1
            peak = max(peak, active)
            await asyncio.sleep(0.03)
            active -= 1
            if role == "Bad":
                return {"ok": "bad", "summary": "x"}
            return {"ok": True, "summary": model}

        async def _run() -> None:
            backend = RunWorkflowBackend(_slow_agent, agent_sem=asyncio.Semaphore(2))
            await asyncio.gather(
                *(backend.invoke("p", SUMMARY_SCHEMA, role=f"R{i}") for i in range(4))
            )
            with self.assertRaises(SchemaValidationError):
                await backend.invoke("p", SUMMARY_SCHEMA, role="Bad")

        asyncio.run(_run())
        self.assertEqual(peak, 2)


if __name__ == "__main__":
    unittest.main()
