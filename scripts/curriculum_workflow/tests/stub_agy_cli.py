#!/usr/bin/env python3
"""Executable offline mock CLI fixture for agy-ultra backend and orchestrator tests."""

from __future__ import annotations

import fcntl
import json
import os
import re
import select
import signal
import stat
import sys
import time
from typing import Any, Callable, Dict, List, Mapping, Optional, Sequence, Tuple

_RESEARCH_RE = re.compile(r"写入 `([^`]+research_notes\.md)`")
_AUTHOR_RE = re.compile(r"至 `([^`]+lesson_draft\.md)`")
_FACT_RE = re.compile(r"写报告至 `([^`]+fact_check\.md)`")
_LANG_RE = re.compile(r"写报告至 `([^`]+language_precision\.md)`")
_REVISE_RE = re.compile(r"覆写 `([^`]+lesson_draft\.md)`")
_QUESTIONS_RE = re.compile(r"写入 `([^`]+questions/[^`]+\.json)`")
_CONCEPT_ID_RE = re.compile(r'"id":\s*"([a-z0-9-]+)"')


def _parse_flags(argv: Sequence[str]) -> Dict[str, Any]:
    """Extract known CLI flags while leaving arbitrary flags tolerated."""
    out: Dict[str, Any] = {
        "model": None, "output_format": None, "json_schema": None,
        "print_timeout": None, "prompt": "", "app_data_dir": None, "add_dirs": [],
    }
    val_map = {
        "--model": "model", "--output-format": "output_format",
        "--json-schema": "json_schema", "--print-timeout": "print_timeout",
        "-p": "prompt", "--print": "prompt", "--prompt": "prompt",
    }
    i = 0
    while i < len(argv):
        tok, nxt = argv[i], argv[i + 1] if i + 1 < len(argv) else ""
        if tok in val_map:
            out[val_map[tok]], i = nxt, i + 2
        elif tok == "--add-dir":
            out["add_dirs"].append(nxt)
            i += 2
        elif tok.startswith("--app_data_dir="):
            out["app_data_dir"], i = tok.split("=", 1)[1], i + 1
        else:
            i += 1
    return out


def _inspect_stdin() -> Tuple[bool, bool]:
    """Return (stdin_is_devnull, stdin_eof) without blocking on open pipes."""
    try:
        st0 = os.fstat(0)
        st_null = os.stat("/dev/null")
        is_devnull = stat.S_ISCHR(st0.st_mode) and st0.st_rdev == st_null.st_rdev
    except OSError:
        return False, False
    if is_devnull:
        return True, os.read(0, 1) == b""
    try:
        ready, _, _ = select.select([0], [], [], 0.0)
        if ready:
            return False, os.read(0, 1) == b""
    except (OSError, ValueError):
        pass
    return False, False


def _infer_prompt_meta(prompt: str) -> Dict[str, Any]:
    """Infer workflow stage, target artifact path, and lesson key from prompt."""
    checks = (
        ("research", _RESEARCH_RE, ""),
        ("author", _AUTHOR_RE, ""),
        ("review_fact", _FACT_RE, "事实复核员"),
        ("review_lang", _LANG_RE, "语言审查员"),
        ("revise", _REVISE_RE, "按审查阻断项修改"),
        ("questions", _QUESTIONS_RE, "v2 题库作者"),
    )
    for stage, pattern, marker in checks:
        if marker and marker not in prompt:
            continue
        match = pattern.search(prompt)
        if match:
            target = match.group(1)
            return _build_meta(stage, target)
    if "语音设计问题" in prompt:
        return _build_meta("repair_tts", "")
    if "生词本审计问题" in prompt:
        return _build_meta("repair_vocab", "")
    if "欠载的讲义小节" in prompt:
        return _build_meta("repair_effort", "")
    return _build_meta("generic", "")


def _build_meta(stage: str, target_path: str) -> Dict[str, Any]:
    """Construct stage metadata including lesson_key and manifest visibility."""
    lesson_key = ""
    manifest_exists = False
    if target_path:
        parent = os.path.dirname(target_path)
        if stage in ("research", "review_fact", "review_lang"):
            lesson_key = os.path.dirname(parent)
        elif stage in ("author", "revise"):
            lesson_key = parent
        elif stage == "questions":
            pkg_dir = os.path.dirname(parent)
            manifest_exists = os.path.exists(os.path.join(pkg_dir, "course.json"))
    return {
        "stage": stage,
        "target_path": target_path,
        "lesson_key": lesson_key,
        "manifest_exists_at_start": manifest_exists,
    }


def _with_state_lock(
    lock_path: str, state_path: str, fn: Callable[[Dict[str, Any]], Any]
) -> Any:
    """Execute fn(state) under an exclusive POSIX file lock and persist state."""
    os.makedirs(os.path.dirname(lock_path) or ".", exist_ok=True)
    with open(lock_path, "a+", encoding="utf-8") as lock_fh:
        fcntl.flock(lock_fh.fileno(), fcntl.LOCK_EX)
        try:
            state: Dict[str, Any] = {}
            if os.path.exists(state_path):
                with open(state_path, "r", encoding="utf-8") as sfh:
                    state = json.load(sfh)
            result = fn(state)
            tmp_path = f"{state_path}.{os.getpid()}.tmp"
            with open(tmp_path, "w", encoding="utf-8") as out:
                json.dump(state, out, ensure_ascii=False, indent=2)
            os.replace(tmp_path, state_path)
            return result
        finally:
            fcntl.flock(lock_fh.fileno(), fcntl.LOCK_UN)


def _append_trace(lock_path: str, trace_path: str, entry: Mapping[str, Any]) -> None:
    """Append one JSONL trace record under the scenario file lock."""
    os.makedirs(os.path.dirname(trace_path) or ".", exist_ok=True)
    with open(lock_path, "a+", encoding="utf-8") as lock_fh:
        fcntl.flock(lock_fh.fileno(), fcntl.LOCK_EX)
        try:
            with open(trace_path, "a", encoding="utf-8") as tfh:
                tfh.write(json.dumps(entry, ensure_ascii=False) + "\n")
        finally:
            fcntl.flock(lock_fh.fileno(), fcntl.LOCK_UN)


def _rule_matches(
    rule: Mapping[str, Any],
    meta: Mapping[str, Any],
    flags: Mapping[str, Any],
) -> bool:
    """Return True when all filters defined on rule match this invocation."""
    if rule.get("stage") and rule["stage"] != meta["stage"]:
        return False
    if rule.get("model") and rule["model"] != flags["model"]:
        return False
    if rule.get("path_contains"):
        if str(rule["path_contains"]) not in str(meta["target_path"]):
            return False
    contains = rule.get("prompt_contains")
    if isinstance(contains, str) and contains not in flags["prompt"]:
        return False
    if isinstance(contains, list):
        if any(str(tok) not in flags["prompt"] for tok in contains):
            return False
    return True


def _select_action(
    scenario: Mapping[str, Any],
    meta: Mapping[str, Any],
    flags: Mapping[str, Any],
    state: Dict[str, Any],
) -> Tuple[str, Dict[str, Any]]:
    """Match first scenario rule and resolve per-attempt sequence action."""
    counts = state.setdefault("rule_counts", {})
    for idx, rule in enumerate(scenario.get("rules") or ()):
        if not _rule_matches(rule, meta, flags):
            continue
        name = str(rule.get("name") or f"rule_{idx}")
        key = f"{name}::{meta['target_path']}" if rule.get("per_target") else name
        attempt = int(counts.get(key, 0)) + 1
        counts[key] = attempt
        seq = rule.get("sequence")
        if isinstance(seq, list) and seq:
            chosen = dict(seq[min(attempt - 1, len(seq) - 1)])
            return name, chosen
        return name, dict(rule)
    return "default", dict(scenario.get("default") or {})


def _write_text_file(path: str, content: str) -> None:
    """Create parent directories and write UTF-8 text atomically."""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    tmp = f"{path}.{os.getpid()}.tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(content)
    os.replace(tmp, path)


def _write_auto_questions(target_path: str, prompt: str) -> None:
    """Append valid v2 stub question items for concepts referenced in prompt."""
    existing: List[Dict[str, Any]] = []
    if os.path.exists(target_path):
        with open(target_path, "r", encoding="utf-8") as fh:
            loaded = json.load(fh)
            if isinstance(loaded, list):
                existing = loaded
    cids = list(dict.fromkeys(_CONCEPT_ID_RE.findall(prompt))) or ["concept-default"]
    existing_ids = {str(item.get("id")) for item in existing}
    for cid in cids:
        qid = f"q-{cid}-1"
        if qid in existing_ids:
            continue
        existing.append(
            {
                "id": qid,
                "type": "single_choice",
                "chapter": cid,
                "concepts": [cid],
                "stem": [{"text": f"Stub question for {cid}"}],
                "options": [
                    {"id": "a", "content": [{"text": "Option A"}]},
                    {"id": "b", "content": [{"text": "Option B"}]},
                ],
                "grading": {"correct_option": "a"},
                "analysis": [{"text": f"Explanation for {cid}."}],
            }
        )
    _write_text_file(
        target_path, json.dumps(existing, ensure_ascii=False, indent=2) + "\n"
    )


def _write_author_or_revise(stage: str, target: str, prompt: str) -> None:
    """Write a draft with concept anchors, or preserve anchors when revising."""
    if stage == "revise" and os.path.exists(target):
        with open(target, "r", encoding="utf-8") as fh:
            existing = fh.read()
        _write_text_file(target, existing.rstrip() + "\n\n<!-- revised -->\n")
        return
    cids = list(dict.fromkeys(_CONCEPT_ID_RE.findall(prompt))) or ["concept-1"]
    sections = [
        f"## {cid}\n<!-- concepts: {cid} -->\n\n### 例题\n"
        + ("教学讲解与完整例题分析内容。" * 18)
        + "\n\n### 常见错误\n避免概念混淆。\n"
        for cid in cids
    ]
    _write_text_file(target, "# Stub Lesson\n\n" + "\n".join(sections) + "\n")


def _apply_side_effects(
    scenario: Mapping[str, Any],
    action: Mapping[str, Any],
    meta: Mapping[str, Any],
    prompt: str,
) -> None:
    """Apply explicit file_writes and default stage file artifacts."""
    for item in action.get("file_writes") or ():
        _write_text_file(str(item["path"]), str(item["content"]))
    if action.get("skip_auto_side_effects") or not scenario.get(
        "auto_side_effects", True
    ):
        return
    target = str(meta["target_path"] or "")
    stage = str(meta["stage"])
    if not target:
        return
    if stage == "research":
        body = f"# Research Notes\n\nVerified reference material for {target}.\n"
        _write_text_file(target, body + ("Detailed technical evidence. " * 14) + "\n")
    elif stage in ("author", "revise"):
        _write_author_or_revise(stage, target, prompt)
    elif stage in ("review_fact", "review_lang"):
        _write_text_file(target, f"# Review Report ({stage})\n\nChecked {target}.\n")
    elif stage == "questions":
        _write_auto_questions(target, prompt)


def _default_payload(flags: Mapping[str, Any], meta: Mapping[str, Any]) -> Dict[str, Any]:
    """Build a schema-valid default payload matching REVIEW_SCHEMA or SUMMARY_SCHEMA."""
    schema_raw = str(flags.get("json_schema") or "")
    if '"passed"' in schema_raw or meta["stage"] in ("review_fact", "review_lang"):
        return {
            "passed": True,
            "blocking_issues": [],
            "revision_instructions": [],
            "summary": f"stub {meta['stage']} passed",
        }
    return {"ok": True, "summary": f"stub {meta['stage']} ok"}


def _emit_output(
    action: Mapping[str, Any],
    flags: Mapping[str, Any],
    meta: Mapping[str, Any],
    call_index: int,
) -> int:
    """Write configured stdout/stderr response format and return exit code."""
    mode = str(action.get("mode") or "envelope")
    payload = action.get("payload")
    if payload is None:
        payload = _default_payload(flags, meta)
    if mode == "usage_error":
        sys.stderr.write(str(action.get("stderr") or "flag provided but not defined\n"))
        return 2
    if mode == "exit_error":
        sys.stderr.write(str(action.get("stderr") or "stub transient failure\n"))
        return int(action.get("exit_code", 1))
    if mode == "invalid_json":
        sys.stdout.write(str(action.get("stdout") or "not valid json {{{"))
        return 0
    if mode == "envelope_error":
        env_obj = {
            "conversation_id": f"stub-{call_index}",
            "status": str(action.get("status") or "ERROR"),
            "error": str(action.get("error") or "stub backend error"),
        }
        sys.stdout.write(json.dumps(env_obj, ensure_ascii=False) + "\n")
        return 0
    return _emit_structured_mode(mode, action, payload, call_index)


def _emit_structured_mode(
    mode: str, action: Mapping[str, Any], payload: Any, call_index: int
) -> int:
    """Emit envelope, response-fallback, ANSI-wrapped, raw, or bad-schema output."""
    if mode == "schema_mismatch":
        payload = action.get("bad_payload", {"unexpected_key": 123})
    if mode == "raw_json":
        sys.stdout.write(json.dumps(payload, ensure_ascii=False) + "\n")
        return 0
    if mode == "ansi_raw":
        sys.stdout.write(f"\x1b[36m{json.dumps(payload, ensure_ascii=False)}\x1b[0m\n")
        return 0
    envelope: Dict[str, Any] = {
        "conversation_id": f"stub-{call_index}",
        "status": "SUCCESS",
        "duration_seconds": 0.01,
        "num_turns": 1,
    }
    if mode == "response_json":
        envelope["response"] = json.dumps(payload, ensure_ascii=False)
    else:
        envelope["response"] = json.dumps(payload, ensure_ascii=False)
        envelope["structured_output"] = payload
    rendered = json.dumps(envelope, ensure_ascii=False)
    if mode == "ansi_envelope":
        rendered = f"\x1b[32m{rendered}\x1b[0m"
    sys.stdout.write(rendered + "\n")
    return 0


def _start_call(
    lock_path: str,
    state_path: str,
    scenario: Mapping[str, Any],
    meta: Mapping[str, Any],
    flags: Mapping[str, Any],
) -> Tuple[int, int, int, str, Dict[str, Any]]:
    """Register invocation start, update peak concurrency, and match scenario rule."""
    def _enter(state: Dict[str, Any]) -> Tuple[int, int, int, str, Dict[str, Any]]:
        call_index = int(state.get("total_calls", 0)) + 1
        state["total_calls"] = call_index
        active = int(state.get("active", 0)) + 1
        state["active"] = active
        peak = max(int(state.get("peak_active", 0)), active)
        state["peak_active"] = peak
        state.setdefault("pids", []).append(os.getpid())
        rule_name, action = _select_action(scenario, meta, flags, state)
        return call_index, active, peak, rule_name, action

    return _with_state_lock(lock_path, state_path, _enter)


def _finish_call(lock_path: str, state_path: str) -> None:
    """Decrement active subprocess counter on process exit."""
    def _leave(state: Dict[str, Any]) -> None:
        state["active"] = max(0, int(state.get("active", 1)) - 1)

    _with_state_lock(lock_path, state_path, _leave)


def _load_scenario() -> Tuple[Dict[str, Any], str, str, str]:
    """Load scenario JSON and resolve lock, state, and trace file paths."""
    scenario_path = os.environ.get("STUB_SCENARIO_FILE")
    if not scenario_path:
        raise RuntimeError("STUB_SCENARIO_FILE environment variable is required")
    with open(scenario_path, "r", encoding="utf-8") as fh:
        scenario = json.load(fh)
    base_dir = os.path.dirname(os.path.abspath(scenario_path))
    lock_path = str(scenario.get("lock_file") or os.path.join(base_dir, "stub.lock"))
    state_path = str(scenario.get("state_file") or os.path.join(base_dir, "state.json"))
    trace_path = str(scenario.get("trace_file") or os.path.join(base_dir, "trace.jsonl"))
    return scenario, lock_path, state_path, trace_path


def _collect_env(scenario: Mapping[str, Any]) -> Dict[str, Optional[str]]:
    """Capture relevant environment variables for trace assertions."""
    keys = ["HOME", "SSH_CONNECTION", "AGY_ULTRA_HOME", "STUB_SCENARIO_FILE"]
    for extra in scenario.get("record_env_keys") or ():
        if extra not in keys:
            keys.append(str(extra))
    return {k: os.environ.get(k) for k in keys}


def _execute_action(
    scenario: Mapping[str, Any],
    action: Mapping[str, Any],
    flags: Mapping[str, Any],
    meta: Mapping[str, Any],
    call_index: int,
) -> int:
    """Run optional delay/timeout sleep, apply file side effects, and emit output."""
    if action.get("mode") == "sleep_timeout":
        if action.get("ignore_sigterm"):
            signal.signal(signal.SIGTERM, signal.SIG_IGN)
        time.sleep(float(action.get("sleep_seconds", 30.0)))
        return 0
    delay = float(action.get("delay_seconds", scenario.get("default_delay", 0.0)))
    if delay > 0:
        time.sleep(delay)
    mode = str(action.get("mode") or "envelope")
    if mode not in ("exit_error", "usage_error", "invalid_json", "envelope_error"):
        _apply_side_effects(scenario, action, meta, str(flags["prompt"]))
    return _emit_output(action, flags, meta, call_index)


def _build_trace_entry(
    call_index: int, args: Sequence[str], meta: Mapping[str, Any],
    flags: Mapping[str, Any], stdin_info: Tuple[bool, bool],
    scenario: Mapping[str, Any], rule_name: str,
    timing: Tuple[float, float], conc: Tuple[int, int], exit_code: int,
) -> Dict[str, Any]:
    """Build one structured trace dictionary for JSONL logging."""
    return {
        "call_index": call_index, "pid": os.getpid(), "argv": list(args),
        "cwd": os.getcwd(), "stage": meta["stage"], "target_path": meta["target_path"],
        "lesson_key": meta["lesson_key"],
        "manifest_exists_at_start": meta["manifest_exists_at_start"],
        "model": flags["model"], "prompt": flags["prompt"],
        "json_schema": flags["json_schema"], "stdin_is_devnull": stdin_info[0],
        "stdin_eof": stdin_info[1], "env": _collect_env(scenario),
        "rule_name": rule_name, "start_ts": timing[0], "end_ts": timing[1],
        "active_at_start": conc[0], "peak_active_so_far": conc[1],
        "exit_code": exit_code,
    }


def main(argv: Optional[Sequence[str]] = None) -> int:
    """Run one stub CLI invocation, recording full trace and peak concurrency."""
    args = list(sys.argv[1:] if argv is None else argv)
    scenario, lock_path, state_path, trace_path = _load_scenario()
    flags = _parse_flags(args)
    meta = _infer_prompt_meta(str(flags["prompt"]))
    stdin_info = _inspect_stdin()
    start_ts = time.time()
    call_index, active_now, peak_now, rule_name, action = _start_call(
        lock_path, state_path, scenario, meta, flags
    )
    if not action.get("ignore_sigterm"):
        signal.signal(signal.SIGTERM, lambda _s, _f: sys.exit(143))
    exit_code = 1
    try:
        exit_code = _execute_action(scenario, action, flags, meta, call_index)
        return exit_code
    except SystemExit as exc:
        exit_code = int(exc.code) if isinstance(exc.code, int) else 1
        raise
    finally:
        _finish_call(lock_path, state_path)
        entry = _build_trace_entry(
            call_index, args, meta, flags, stdin_info, scenario, rule_name,
            (start_ts, time.time()), (active_now, peak_now), exit_code,
        )
        _append_trace(lock_path, trace_path, entry)


if __name__ == "__main__":
    sys.exit(main())
