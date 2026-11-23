"""Offline unit tests for atomic IO, ProgressStore contention, JSON, and schemas."""

from __future__ import annotations

import asyncio
import json
import os
import sys
import tempfile
import unittest
from unittest import mock

_SCRIPTS_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)

from curriculum_workflow.backends import (  # noqa: E402
    BackendError,
    REVIEW_SCHEMA,
    SUMMARY_SCHEMA,
    SchemaValidationError,
    assert_valid_schema,
    extract_json_value,
    parse_cli_output,
    strip_ansi,
    validate_json_schema,
)
from curriculum_workflow.io_store import (  # noqa: E402
    ProgressStore,
    atomic_write_json,
    atomic_write_text,
    read_text,
    run_cmd_async,
)
from curriculum_workflow.tests import STUB_CLI_PATH  # noqa: E402
from curriculum_workflow.tests.helpers import (  # noqa: E402
    assert_pid_dead,
    read_state,
    write_stub_scenario,
)


class TestAtomicWritesAndProgressStore(unittest.TestCase):
    """Tests for crash-safe atomic persistence and concurrent ProgressStore locks."""

    def test_atomic_write_text_and_json_leave_no_temp_files(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            txt_path = os.path.join(tmp, "nested", "note.txt")
            atomic_write_text(txt_path, "hello 世界\n")
            self.assertEqual(read_text(txt_path), "hello 世界\n")

            json_path = os.path.join(tmp, "nested", "data.json")
            atomic_write_json(json_path, {"k": "值", "n": 3})
            raw = read_text(json_path)
            self.assertTrue(raw.endswith("\n"))
            self.assertEqual(json.loads(raw), {"k": "值", "n": 3})
            leftover = [f for f in os.listdir(os.path.dirname(txt_path)) if ".tmp" in f]
            self.assertEqual(leftover, [])

    def test_atomic_write_crash_preserves_existing_and_cleans_tmp(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            target = os.path.join(tmp, "course.json")
            atomic_write_text(target, '{"stable": true}\n')
            with mock.patch("os.replace", side_effect=OSError("disk full")):
                with self.assertRaises(OSError):
                    atomic_write_text(target, '{"corrupt": true}\n')
            self.assertEqual(read_text(target), '{"stable": true}\n')
            leftover = [f for f in os.listdir(tmp) if f.endswith(".tmp")]
            self.assertEqual(leftover, [])

    def test_progress_store_20_coroutine_contention_zero_lost_writes(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prog_path = os.path.join(tmp, "progress.json")
            store = ProgressStore(prog_path)

            async def _worker(idx: int) -> None:
                for step in range(3):
                    await store.update_one(
                        f"L{idx:02d}", {"status": f"STEP_{step}", "idx": idx}
                    )
                    await asyncio.sleep(0)

            async def _run() -> None:
                await asyncio.gather(*(_worker(i) for i in range(20)))
                await store.update_many(
                    {
                        "BATCH_1": {"status": "COMPLETED"},
                        "BATCH_2": {"status": "COMPLETED"},
                    }
                )

            asyncio.run(_run())
            with open(prog_path, "r", encoding="utf-8") as fh:
                data = json.load(fh)
            self.assertEqual(len(data), 22)
            for idx in range(20):
                self.assertEqual(
                    data[f"L{idx:02d}"], {"status": "STEP_2", "idx": idx}
                )
            self.assertEqual(data["BATCH_1"]["status"], "COMPLETED")
            self.assertEqual(data["BATCH_2"]["status"], "COMPLETED")
            leftover = [f for f in os.listdir(tmp) if f.endswith(".tmp")]
            self.assertEqual(leftover, [])

    def test_progress_store_across_event_loops_and_shared_instances(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            prog_path = os.path.join(tmp, "progress.json")
            s1 = ProgressStore(prog_path)
            s2 = ProgressStore(prog_path)

            async def _round_one() -> None:
                await asyncio.gather(
                    s1.update_one("A", {"status": "OK"}),
                    s2.update_one("B", {"status": "OK"}),
                )

            asyncio.run(_round_one())
            result = asyncio.run(s1.update_one("C", {"status": "DONE"}))
            self.assertEqual(set(result.keys()), {"A", "B", "C"})
            loaded = asyncio.run(s2.read())
            self.assertEqual(loaded["C"]["status"], "DONE")

    def test_run_cmd_async_cancellation_reaps_child_process(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            sc_path, state_path, _ = write_stub_scenario(
                tmp, {"default": {"mode": "sleep_timeout", "sleep_seconds": 30.0}}
            )
            env = dict(os.environ, STUB_SCENARIO_FILE=sc_path)

            async def _run_and_cancel() -> None:
                task = asyncio.create_task(
                    run_cmd_async(
                        [STUB_CLI_PATH, "-p", "cancel-me"],
                        cwd=tmp, env=env, timeout=30.0, grace_seconds=0.3,
                    )
                )
                for _ in range(40):
                    if os.path.exists(state_path) and read_state(state_path).get("pids"):
                        break
                    await asyncio.sleep(0.02)
                task.cancel()
                with self.assertRaises(asyncio.CancelledError):
                    await task

            asyncio.run(_run_and_cancel())
            pids = read_state(state_path).get("pids") or []
            self.assertEqual(len(pids), 1)
            assert_pid_dead(self, pids[0])


class TestJsonExtractionAndSchemaValidation(unittest.TestCase):
    """Tests for ANSI/fence/prose extraction and strict JSON Schema validation."""

    def test_strip_ansi_and_extract_plain_fenced_prose_json(self) -> None:
        self.assertEqual(strip_ansi("\x1b[32mhi\x1b[0m\x1b]0;title\x07"), "hi")
        self.assertEqual(extract_json_value('{"ok": true}'), {"ok": True})
        ansi_text = "\x1b[33m{\"ok\": true, \"summary\": \"ansi\"}\x1b[0m"
        self.assertEqual(
            extract_json_value(ansi_text), {"ok": True, "summary": "ansi"}
        )
        fenced = (
            "Noise before\n```text\nnot json\n```\n"
            "```json\n{\"ok\": true, \"summary\": \"fenced\"}\n```\nDone."
        )
        self.assertEqual(
            extract_json_value(fenced), {"ok": True, "summary": "fenced"}
        )
        prose = 'Result -> {"ok": true, "summary": "inline"} (end)'
        self.assertEqual(
            extract_json_value(prose), {"ok": True, "summary": "inline"}
        )
        self.assertEqual(extract_json_value("items: [1, 2, 3] trailing"), [1, 2, 3])

    def test_extract_json_value_rejects_empty_and_non_json(self) -> None:
        for bad in ("", "   \n\t", "\x1b[31m\x1b[0m", "plain text with no braces"):
            with self.assertRaises(ValueError):
                extract_json_value(bad)

    def test_validate_schema_required_and_additional_properties(self) -> None:
        valid_summary = {"ok": True, "summary": "done"}
        assert_valid_schema(valid_summary, SUMMARY_SCHEMA)

        valid_review = {
            "passed": True,
            "blocking_issues": [],
            "revision_instructions": [],
            "summary": "clean",
        }
        assert_valid_schema(valid_review, REVIEW_SCHEMA)

        missing_errs = validate_json_schema({"ok": True}, SUMMARY_SCHEMA)
        self.assertTrue(any("summary" in e for e in missing_errs))

        extra_errs = validate_json_schema(
            {"ok": True, "summary": "x", "extra": 1}, SUMMARY_SCHEMA
        )
        self.assertTrue(any("extra" in e for e in extra_errs))

        map_schema = {
            "type": "object",
            "additionalProperties": {"type": "integer"},
        }
        self.assertEqual(validate_json_schema({"a": 1, "b": 2}, map_schema), [])
        self.assertTrue(validate_json_schema({"a": "bad"}, map_schema))

    def test_validate_schema_distinguishes_bool_from_int_number_and_enum(self) -> None:
        int_schema = {"type": "integer"}
        num_schema = {"type": "number"}
        bool_schema = {"type": "boolean"}
        enum_int = {"enum": [0, 1]}
        enum_bool = {"enum": [True]}

        self.assertEqual(validate_json_schema(1, int_schema), [])
        self.assertEqual(validate_json_schema(1.5, num_schema), [])
        self.assertEqual(validate_json_schema(True, bool_schema), [])

        self.assertTrue(validate_json_schema(True, int_schema))
        self.assertTrue(validate_json_schema(False, int_schema))
        self.assertTrue(validate_json_schema(True, num_schema))
        self.assertTrue(validate_json_schema(False, num_schema))
        self.assertTrue(validate_json_schema(1, bool_schema))
        self.assertTrue(validate_json_schema(0, bool_schema))
        self.assertTrue(validate_json_schema(True, enum_int))
        self.assertTrue(validate_json_schema(1, enum_bool))

    def test_validate_schema_array_bounds_and_items(self) -> None:
        arr_schema = {
            "type": "array",
            "minItems": 1,
            "maxItems": 2,
            "items": {"type": "string"},
        }
        self.assertEqual(validate_json_schema(["a"], arr_schema), [])
        self.assertTrue(validate_json_schema([], arr_schema))
        self.assertTrue(validate_json_schema(["a", "b", "c"], arr_schema))
        self.assertTrue(validate_json_schema(["a", 123], arr_schema))

    def test_parse_cli_output_envelope_and_response_fallback(self) -> None:
        env_so = json.dumps({
            "conversation_id": "c1",
            "status": "SUCCESS",
            "structured_output": {"ok": True, "summary": "so"},
        })
        self.assertEqual(
            parse_cli_output(env_so, SUMMARY_SCHEMA), {"ok": True, "summary": "so"}
        )
        env_resp = json.dumps({
            "conversation_id": "c2",
            "status": "SUCCESS",
            "response": '```json\n{"ok": true, "summary": "resp"}\n```',
        })
        self.assertEqual(
            parse_cli_output(env_resp, SUMMARY_SCHEMA),
            {"ok": True, "summary": "resp"},
        )
        raw_json = '{"ok": true, "summary": "raw"}'
        self.assertEqual(
            parse_cli_output(raw_json, SUMMARY_SCHEMA),
            {"ok": True, "summary": "raw"},
        )

    def test_parse_cli_output_rejects_errors_null_status_and_bad_schema(self) -> None:
        ok_payload = {"ok": True, "summary": "x"}
        bad_envelopes = (
            {"status": "ERROR", "error": "boom"},
            {"status": "FAILED", "response": '{"ok": true}'},
            {"conversation_id": "c1", "status": None, "structured_output": ok_payload},
            {"conversation_id": "c2", "structured_output": ok_payload},
        )
        for env_obj in bad_envelopes:
            with self.assertRaises(BackendError):
                parse_cli_output(json.dumps(env_obj), SUMMARY_SCHEMA)
        with self.assertRaises(SchemaValidationError):
            parse_cli_output(
                json.dumps({"conversation_id": "c3", "status": "SUCCESS"}),
                SUMMARY_SCHEMA,
            )
        with self.assertRaises(SchemaValidationError):
            parse_cli_output(
                json.dumps({
                    "status": "SUCCESS",
                    "structured_output": {"ok": 1, "summary": "bad-bool"},
                }),
                SUMMARY_SCHEMA,
            )


if __name__ == "__main__":
    unittest.main()
