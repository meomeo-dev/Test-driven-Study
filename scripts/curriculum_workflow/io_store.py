"""Atomic file persistence, synchronized progress store, and async subprocess IO."""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import tempfile
import weakref
from dataclasses import dataclass
from typing import Any, Dict, Mapping, Optional, Sequence, Tuple

NO_DATA_MARKER = "无资料"
_FALLBACK_BIN_DIRS = ("/opt/homebrew/bin", "/usr/local/bin")

_LockMap = Dict[str, asyncio.Lock]
_LOOP_FILE_LOCKS: "weakref.WeakKeyDictionary[asyncio.AbstractEventLoop, _LockMap]" = (
    weakref.WeakKeyDictionary()
)


@dataclass
class CommandResult:
    """Captured result from an asynchronous subprocess invocation."""

    returncode: int
    stdout: str
    stderr: str
    timed_out: bool = False


def read_text(path: str) -> str:
    """Return UTF-8 text if path exists, else empty string."""
    if not os.path.exists(path):
        return ""
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


def has_real_content(path: str, min_bytes: int = 120) -> bool:
    """Return True when path holds substantive text without placeholder markers."""
    text = read_text(path).strip()
    return len(text.encode("utf-8")) >= min_bytes and NO_DATA_MARKER not in text


def load_json(path: str, default: Any = None) -> Any:
    """Load UTF-8 JSON file if present, returning default (or {}) otherwise."""
    if not os.path.exists(path):
        return {} if default is None else default
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def atomic_write_text(path: str, content: str) -> None:
    """Atomically write UTF-8 text using temp file in target dir, fsync, os.replace."""
    abs_path = os.path.abspath(path)
    parent = os.path.dirname(abs_path) or "."
    os.makedirs(parent, exist_ok=True)
    prefix = f".{os.path.basename(abs_path)}."
    fd, tmp_path = tempfile.mkstemp(prefix=prefix, suffix=".tmp", dir=parent)
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(content)
            fh.flush()
            os.fsync(fh.fileno())
        os.replace(tmp_path, abs_path)
    except BaseException:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass
        raise


def atomic_write_json(path: str, data: Any) -> None:
    """Atomically serialize formatted UTF-8 JSON with trailing newline."""
    rendered = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    atomic_write_text(path, rendered)


save_json = atomic_write_json


def _lock_for_path(abs_path: str) -> asyncio.Lock:
    """Return a per-event-loop asyncio.Lock shared for the given canonical path."""
    loop = asyncio.get_running_loop()
    per_loop = _LOOP_FILE_LOCKS.get(loop)
    if per_loop is None:
        per_loop = {}
        _LOOP_FILE_LOCKS[loop] = per_loop
    lock = per_loop.get(abs_path)
    if lock is None:
        lock = asyncio.Lock()
        per_loop[abs_path] = lock
    return lock


def build_progress_entry(
    ctx: Mapping[str, Any],
    status: str,
    package_dir: str,
    extra: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    """Construct a normalized progress.json record for a single lesson."""
    entry: Dict[str, Any] = {
        "lesson_number": int(ctx["lesson_number"]),
        "lesson_slug": str(ctx["lesson_slug"]),
        "unit_id": str(ctx["unit_id"]),
        "concepts": [str(c["id"]) for c in ctx["concepts"]],
        "estimated_minutes": int(ctx["estimated_minutes"]),
        "title": str(ctx["lesson_title"]),
        "status": status,
        "package_dir": package_dir,
    }
    if extra:
        entry.update(extra)
    return entry


class ProgressStore:
    """Lock-synchronized, atomically persisted store for course progress.json."""

    def __init__(self, path: str) -> None:
        self.path = os.path.abspath(path)

    def read_sync(self) -> Dict[str, Any]:
        """Synchronously load current progress dict without locking."""
        data = load_json(self.path, default={})
        return dict(data) if isinstance(data, dict) else {}

    async def read(self) -> Dict[str, Any]:
        """Load current progress dict under the per-file asyncio.Lock."""
        async with _lock_for_path(self.path):
            return self.read_sync()

    async def update_one(
        self, lesson_id: str, entry: Mapping[str, Any]
    ) -> Dict[str, Any]:
        """Atomically upsert one lesson entry under the per-file lock."""
        return await self.update_many({lesson_id: entry})

    async def update_many(
        self, updates: Mapping[str, Mapping[str, Any]]
    ) -> Dict[str, Any]:
        """Atomically apply a batch of lesson updates in one read-modify-write."""
        async with _lock_for_path(self.path):
            prog = self.read_sync()
            for lesson_id, entry in updates.items():
                prog[str(lesson_id)] = dict(entry)
            atomic_write_json(self.path, prog)
            return prog


async def terminate_process(
    proc: asyncio.subprocess.Process, grace_seconds: float = 2.0
) -> Tuple[bytes, bytes]:
    """Terminate an async subprocess, escalating to kill after grace_seconds."""
    if proc.returncode is None:
        try:
            proc.terminate()
        except ProcessLookupError:
            pass
    try:
        return await asyncio.wait_for(proc.communicate(), timeout=grace_seconds)
    except asyncio.TimeoutError:
        if proc.returncode is None:
            try:
                proc.kill()
            except ProcessLookupError:
                pass
        return await proc.communicate()


def resolve_exec_env(
    cmd: Sequence[str], env: Optional[Mapping[str, str]]
) -> Optional[Dict[str, str]]:
    """Augment PATH with standard Homebrew dirs when node/go is not in current PATH."""
    if not cmd or os.path.isabs(cmd[0]) or cmd[0] not in ("node", "go"):
        return dict(env) if env is not None else None
    merged = dict(env) if env is not None else dict(os.environ)
    cur_path = merged.get("PATH", "")
    if shutil.which(cmd[0], path=cur_path):
        return merged if env is not None else None
    extras = [
        d for d in _FALLBACK_BIN_DIRS
        if os.path.isdir(d) and d not in cur_path.split(os.pathsep)
    ]
    if not extras:
        return merged if env is not None else None
    merged["PATH"] = os.pathsep.join(extras + ([cur_path] if cur_path else []))
    return merged


async def _exec_subprocess(
    cmd: Sequence[str],
    cwd: Optional[str],
    env: Optional[Mapping[str, str]],
    timeout: Optional[float],
    stdin_data: Optional[bytes],
    grace_seconds: float,
) -> CommandResult:
    """Spawn subprocess without shell, apply timeout, and return decoded output."""
    stdin_pipe = (
        asyncio.subprocess.PIPE
        if stdin_data is not None
        else asyncio.subprocess.DEVNULL
    )
    resolved_env = resolve_exec_env(cmd, env)
    proc = await asyncio.create_subprocess_exec(
        *cmd,
        stdin=stdin_pipe,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
        cwd=cwd,
        env=resolved_env,
    )
    timed_out = False
    try:
        out_b, err_b = await asyncio.wait_for(
            proc.communicate(input=stdin_data), timeout=timeout
        )
    except asyncio.TimeoutError:
        timed_out = True
        out_b, err_b = await terminate_process(proc, grace_seconds=grace_seconds)
    except asyncio.CancelledError:
        await terminate_process(proc, grace_seconds=grace_seconds)
        raise
    return CommandResult(
        returncode=-1 if timed_out else int(proc.returncode or 0),
        stdout=out_b.decode("utf-8", errors="replace"),
        stderr=err_b.decode("utf-8", errors="replace"),
        timed_out=timed_out,
    )


async def run_cmd_async(
    cmd: Sequence[str],
    *,
    cwd: Optional[str] = None,
    env: Optional[Mapping[str, str]] = None,
    timeout: Optional[float] = None,
    stdin_data: Optional[bytes] = None,
    semaphore: Optional[asyncio.Semaphore] = None,
    grace_seconds: float = 2.0,
) -> CommandResult:
    """Run an argv command asynchronously, optionally bounded by a semaphore."""
    if semaphore is None:
        return await _exec_subprocess(
            cmd, cwd, env, timeout, stdin_data, grace_seconds
        )
    async with semaphore:
        return await _exec_subprocess(
            cmd, cwd, env, timeout, stdin_data, grace_seconds
        )
