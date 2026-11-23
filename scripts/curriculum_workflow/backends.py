"""Agent backends, agy-ultra CLI resolution, JSON extraction, and schema validation."""

from __future__ import annotations

import asyncio
import dataclasses
import json
import os
import pwd
import random
import re
import shutil
from typing import (
    Any, Awaitable, Callable, Dict, List, Mapping, Optional, Protocol, Sequence, Tuple,
)

from .config import (
    CliConfig, DEFAULT_CLI_BIN, DEFAULT_RUN_WORKFLOW_MODEL,
    RetryConfig, VALID_RUN_WORKFLOW_MODELS,
)
from .io_store import CommandResult, run_cmd_async

REVIEW_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "required": ["passed", "blocking_issues", "revision_instructions", "summary"],
    "properties": {
        "passed": {"type": "boolean"},
        "summary": {"type": "string"},
        "blocking_issues": {"type": "array", "items": {"type": "string"}},
        "revision_instructions": {"type": "array", "items": {"type": "string"}},
    },
}
SUMMARY_SCHEMA: Dict[str, Any] = {
    "type": "object",
    "required": ["ok", "summary"],
    "additionalProperties": False,
    "properties": {"ok": {"type": "boolean"}, "summary": {"type": "string"}},
}

_ANSI_RE = re.compile(r"\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07]*\x07)")
_FENCE_RE = re.compile(
    r"```(?:json)?[ \t]*\r?\n(.*?)\r?\n[ \t]*```", re.IGNORECASE | re.DOTALL
)
_ENVELOPE_KEYS = ("status", "structured_output", "conversation_id")
_FALLBACK_AGY_PATHS = ("/opt/homebrew/bin/agy", "/usr/local/bin/agy")


class BackendError(RuntimeError):
    """Retryable failure returned by an agent backend invocation."""


class BackendConfigError(BackendError):
    """Non-retryable binary, configuration, or CLI usage error."""


class SchemaValidationError(BackendError):
    """Structured output failed JSON Schema validation."""


class AgentBackend(Protocol):
    """Interface implemented by standalone CLI and run_workflow backends."""

    def completion_instruction(self, schema: Mapping[str, Any]) -> str:
        """Return backend-appropriate output completion guidance for prompts."""

    async def invoke(
        self, prompt: str, schema: Mapping[str, Any], *,
        role: str, model: Optional[str] = None,
    ) -> Any:
        """Invoke an agent turn and return a schema-validated payload."""


def strip_ansi(text: str) -> str:
    """Remove ANSI escape sequences from terminal output."""
    return _ANSI_RE.sub("", text)


def extract_json_value(text: str) -> Any:
    """Extract a JSON value from plain text, fenced code blocks, or prose."""
    cleaned = strip_ansi(text).strip()
    if not cleaned:
        raise ValueError("empty output")
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    for match in _FENCE_RE.finditer(cleaned):
        try:
            return json.loads(match.group(1).strip())
        except json.JSONDecodeError:
            continue
    decoder = json.JSONDecoder()
    for idx, ch in enumerate(cleaned):
        if ch not in "{[":
            continue
        try:
            val, _ = decoder.raw_decode(cleaned, idx)
            return val
        except json.JSONDecodeError:
            continue
    raise ValueError("no valid JSON value found in output")


def _matches_type(value: Any, expected: str) -> bool:
    """Strictly check JSON Schema primitive type, separating bool from int/number."""
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    if expected == "string":
        return isinstance(value, str)
    if expected == "boolean":
        return isinstance(value, bool)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if expected == "null":
        return value is None
    return True


def _enum_contains(value: Any, allowed: Sequence[Any]) -> bool:
    """Check enum membership while preventing bool/int equality collisions."""
    return any(type(value) is type(item) and value == item for item in allowed)


def _validate_object(
    value: Mapping[str, Any], schema: Mapping[str, Any], path: str
) -> List[str]:
    """Validate object required keys, properties, and additionalProperties."""
    errors: List[str] = []
    props = schema.get("properties") or {}
    for req in schema.get("required") or ():
        if req not in value:
            errors.append(f"{path}: missing required key {req!r}")
    add_props = schema.get("additionalProperties", True)
    for key, subval in value.items():
        subpath = f"{path}.{key}"
        if key in props:
            errors.extend(validate_json_schema(subval, props[key], subpath))
        elif add_props is False:
            errors.append(f"{subpath}: unexpected additional property")
        elif isinstance(add_props, Mapping):
            errors.extend(validate_json_schema(subval, add_props, subpath))
    return errors


def _validate_array(
    value: List[Any], schema: Mapping[str, Any], path: str
) -> List[str]:
    """Validate array item schemas and length bounds."""
    errors: List[str] = []
    if "minItems" in schema and len(value) < int(schema["minItems"]):
        errors.append(f"{path}: fewer than {schema['minItems']} items")
    if "maxItems" in schema and len(value) > int(schema["maxItems"]):
        errors.append(f"{path}: more than {schema['maxItems']} items")
    item_schema = schema.get("items")
    if isinstance(item_schema, Mapping):
        for idx, item in enumerate(value):
            errors.extend(validate_json_schema(item, item_schema, f"{path}[{idx}]"))
    return errors


def validate_json_schema(
    value: Any, schema: Mapping[str, Any], path: str = "$"
) -> List[str]:
    """Recursively validate value against a JSON Schema subset."""
    expected = schema.get("type")
    if isinstance(expected, str) and not _matches_type(value, expected):
        return [f"{path}: expected {expected}, got {type(value).__name__}"]
    if "enum" in schema and not _enum_contains(value, schema["enum"]):
        return [f"{path}: value {value!r} not in enum {schema['enum']!r}"]
    if isinstance(value, dict):
        return _validate_object(value, schema, path)
    if isinstance(value, list):
        return _validate_array(value, schema, path)
    return []


def assert_valid_schema(value: Any, schema: Mapping[str, Any]) -> None:
    """Raise SchemaValidationError if value violates schema."""
    errors = validate_json_schema(value, schema)
    if errors:
        raise SchemaValidationError("; ".join(errors))


def _unwrap_cli_envelope(parsed: Any, schema: Mapping[str, Any]) -> Any:
    """Unwrap an agy JSON envelope when present, else pass raw JSON through."""
    props = schema.get("properties") or {}
    is_envelope = isinstance(parsed, dict) and any(
        k in parsed and k not in props for k in _ENVELOPE_KEYS
    )
    if not is_envelope:
        return parsed
    if parsed.get("error"):
        raise BackendError(f"CLI envelope error: {parsed['error']}")
    status = parsed.get("status")
    has_status_meta = "status" in parsed or "conversation_id" in parsed
    if has_status_meta and status != "SUCCESS":
        raise BackendError(f"CLI envelope status={status!r}")
    if parsed.get("structured_output") is not None:
        so = parsed["structured_output"]
        if isinstance(so, str) and schema.get("type") != "string":
            return extract_json_value(so)
        return so
    response = parsed.get("response")
    if isinstance(response, str):
        return extract_json_value(response)
    if response is not None:
        return response
    raise SchemaValidationError(
        "CLI envelope missing both structured_output and response"
    )


def parse_cli_output(stdout: str, schema: Mapping[str, Any]) -> Any:
    """Parse CLI stdout envelope or raw JSON and strictly validate against schema."""
    parsed = extract_json_value(stdout)
    payload = _unwrap_cli_envelope(parsed, schema)
    assert_valid_schema(payload, schema)
    return payload


def _default_pw_dir() -> str:
    """Return the real OS user home directory from the password database."""
    return pwd.getpwuid(os.getuid()).pw_dir


def _resolve_ultra_home(
    cli_cfg: CliConfig,
    run_env: Dict[str, str],
    exists_fn: Callable[[str], bool],
    pw_dir_fn: Callable[[], str],
) -> None:
    """Ensure HOME points to a directory containing .gemini/<app_data_dir>."""
    if cli_cfg.cli_home:
        run_env["HOME"] = cli_cfg.cli_home
        return
    if run_env.get("AGY_ULTRA_HOME"):
        run_env["HOME"] = run_env["AGY_ULTRA_HOME"]
        return
    cur_home = run_env.get("HOME", "")
    profile = os.path.join(cur_home, ".gemini", cli_cfg.app_data_dir)
    if cur_home and exists_fn(profile):
        return
    real_home = pw_dir_fn()
    if real_home:
        run_env["HOME"] = real_home


def _resolve_custom_binary(
    cli_bin: str,
    which_fn: Callable[[str], Optional[str]],
    exists_fn: Callable[[str], bool],
) -> str:
    """Resolve an explicit non-default CLI binary path or command name."""
    if os.path.sep in cli_bin or cli_bin.startswith("."):
        if not exists_fn(cli_bin):
            raise BackendConfigError(f"CLI binary not found: {cli_bin}")
        return cli_bin
    found = which_fn(cli_bin)
    if not found:
        raise BackendConfigError(f"CLI binary not found on PATH: {cli_bin}")
    return found


def resolve_cli_invocation(
    cli_cfg: CliConfig,
    *,
    env: Optional[Mapping[str, str]] = None,
    which_fn: Callable[[str], Optional[str]] = shutil.which,
    exists_fn: Callable[[str], bool] = os.path.exists,
    pw_dir_fn: Callable[[], str] = _default_pw_dir,
) -> Tuple[List[str], Dict[str, str]]:
    """Resolve executable prefix argv and environment for agy-ultra or custom CLI."""
    run_env = dict(os.environ if env is None else env)
    if cli_cfg.cli_bin != DEFAULT_CLI_BIN:
        resolved = _resolve_custom_binary(cli_cfg.cli_bin, which_fn, exists_fn)
        if cli_cfg.cli_home:
            run_env["HOME"] = cli_cfg.cli_home
        return [resolved], run_env
    _resolve_ultra_home(cli_cfg, run_env, exists_fn, pw_dir_fn)
    ultra_bin = which_fn(DEFAULT_CLI_BIN)
    if ultra_bin:
        return [ultra_bin], run_env
    agy_bin = which_fn("agy") or next(
        (p for p in _FALLBACK_AGY_PATHS if exists_fn(p)), None
    )
    if not agy_bin:
        raise BackendConfigError(
            "neither 'agy-ultra' nor 'agy' executable found on PATH or standard paths"
        )
    if not run_env.get("SSH_CONNECTION"):
        run_env["SSH_CONNECTION"] = "1"
    return [agy_bin, f"--app_data_dir={cli_cfg.app_data_dir}"], run_env


def build_cli_command(
    cli_cfg: CliConfig,
    prompt: str,
    schema: Mapping[str, Any],
    *,
    env: Optional[Mapping[str, str]] = None,
    which_fn: Callable[[str], Optional[str]] = shutil.which,
    exists_fn: Callable[[str], bool] = os.path.exists,
    pw_dir_fn: Callable[[], str] = _default_pw_dir,
) -> Tuple[List[str], Dict[str, str]]:
    """Construct complete headless agy-ultra argv and subprocess environment."""
    prefix, run_env = resolve_cli_invocation(
        cli_cfg, env=env, which_fn=which_fn, exists_fn=exists_fn, pw_dir_fn=pw_dir_fn
    )
    compact = json.dumps(schema, ensure_ascii=False, separators=(",", ":"))
    argv = list(prefix) + [
        "--model", cli_cfg.model,
        "--output-format", "json",
        "--json-schema", compact,
    ]
    if cli_cfg.dangerously_skip_permissions:
        argv.append("--dangerously-skip-permissions")
    if cli_cfg.effort:
        argv.extend(["--effort", cli_cfg.effort])
    for add_dir in cli_cfg.add_dirs:
        argv.extend(["--add-dir", add_dir])
    argv.extend(["--print-timeout", f"{int(cli_cfg.timeout_seconds)}s"])
    argv.extend(cli_cfg.extra_args)
    argv.extend(["-p", prompt])
    return argv, run_env


def _format_retry_prompt(prompt: str, feedback: Optional[str]) -> str:
    """Append concise schema or parsing failure feedback on retry attempts."""
    if not feedback:
        return prompt
    return (
        f"{prompt}\n\n"
        f"[Previous attempt failed output validation: {feedback}. "
        f"Return ONLY a single valid JSON value strictly matching the schema.]"
    )


class AgyUltraCliBackend:
    """Headless agy-ultra CLI backend with semaphore bounds and retry/backoff."""

    def __init__(
        self,
        cli_cfg: CliConfig,
        retry_cfg: RetryConfig,
        *,
        agent_sem: Optional[asyncio.Semaphore] = None,
        cmd_runner: Callable[..., Awaitable[CommandResult]] = run_cmd_async,
        sleep_fn: Callable[[float], Awaitable[None]] = asyncio.sleep,
        rng_fn: Callable[[float, float], float] = random.uniform,
        log_fn: Optional[Callable[[str], None]] = None,
        which_fn: Callable[[str], Optional[str]] = shutil.which,
        exists_fn: Callable[[str], bool] = os.path.exists,
        pw_dir_fn: Callable[[], str] = _default_pw_dir,
    ) -> None:
        self.cli_cfg = cli_cfg
        self.retry_cfg = retry_cfg
        self.agent_sem = agent_sem
        self._cmd_runner = cmd_runner
        self._sleep_fn = sleep_fn
        self._rng_fn = rng_fn
        self._log_fn = log_fn or (lambda _msg: None)
        self._which_fn = which_fn
        self._exists_fn = exists_fn
        self._pw_dir_fn = pw_dir_fn

    def completion_instruction(self, schema: Mapping[str, Any]) -> str:
        """Instruct headless CLI agent to emit strictly schema-compliant JSON."""
        keys = ", ".join(schema.get("required") or ())
        return (
            f"完成后不要调用任何 finish 工具，仅返回严格符合 JSON Schema "
            f"（必需字段：{keys}）的纯 JSON 对象。"
        )

    def _backoff_seconds(self, attempt: int) -> float:
        """Compute bounded exponential backoff with symmetric jitter."""
        base = self.retry_cfg.initial_backoff_seconds * (2 ** (attempt - 1))
        capped = min(self.retry_cfg.max_backoff_seconds, base)
        jitter = self.retry_cfg.jitter_ratio
        factor = 1.0 + self._rng_fn(-jitter, jitter) if jitter > 0 else 1.0
        return max(0.0, capped * factor)

    async def _run_attempt(
        self, eff_cfg: CliConfig, prompt: str, schema: Mapping[str, Any], role: str
    ) -> Any:
        """Execute one leaf CLI invocation and parse/validate structured output."""
        argv, run_env = build_cli_command(
            eff_cfg, prompt, schema,
            which_fn=self._which_fn, exists_fn=self._exists_fn,
            pw_dir_fn=self._pw_dir_fn,
        )
        try:
            res = await self._cmd_runner(
                argv, cwd=eff_cfg.cwd or os.getcwd(), env=run_env,
                timeout=float(eff_cfg.timeout_seconds), semaphore=self.agent_sem,
            )
        except FileNotFoundError as exc:
            raise BackendConfigError(
                f"[{role}] CLI executable not found: {argv[0]}"
            ) from exc
        if res.timed_out:
            raise BackendError(f"[{role}] CLI timed out after {eff_cfg.timeout_seconds}s")
        detail = (res.stderr or res.stdout).strip()[:400]
        if res.returncode == 2:
            raise BackendConfigError(f"[{role}] CLI usage error (exit 2): {detail}")
        if res.returncode != 0:
            raise BackendError(f"[{role}] CLI exited {res.returncode}: {detail}")
        return parse_cli_output(res.stdout, schema)

    async def invoke(
        self, prompt: str, schema: Mapping[str, Any], *,
        role: str, model: Optional[str] = None,
    ) -> Any:
        """Invoke agy-ultra with retries, exponential backoff, and schema feedback."""
        eff_cfg = dataclasses.replace(self.cli_cfg, model=model) if model else self.cli_cfg
        feedback: Optional[str] = None
        last_exc: Optional[Exception] = None
        for attempt in range(1, self.retry_cfg.max_attempts + 1):
            try:
                return await self._run_attempt(
                    eff_cfg, _format_retry_prompt(prompt, feedback), schema, role
                )
            except BackendConfigError:
                raise
            except (ValueError, BackendError) as exc:
                last_exc = exc
                is_parse = isinstance(exc, (ValueError, SchemaValidationError))
                feedback = str(exc) if is_parse else None
                if attempt >= self.retry_cfg.max_attempts:
                    break
                delay = self._backoff_seconds(attempt)
                self._log_fn(
                    f"[{role}] attempt {attempt}/{self.retry_cfg.max_attempts} "
                    f"failed ({exc}); retrying in {delay:.2f}s"
                )
                await self._sleep_fn(delay)
        raise BackendError(
            f"[{role}] failed after {self.retry_cfg.max_attempts} attempts: {last_exc}"
        ) from last_exc


class RunWorkflowBackend:
    """Adapter wrapping the internal run_workflow agent(...) primitive."""

    def __init__(
        self,
        agent_fn: Callable[..., Awaitable[Any]],
        *,
        default_model: str = DEFAULT_RUN_WORKFLOW_MODEL,
        agent_sem: Optional[asyncio.Semaphore] = None,
    ) -> None:
        if default_model not in VALID_RUN_WORKFLOW_MODELS:
            raise BackendConfigError(
                f"invalid run_workflow_model {default_model!r}; "
                f"expected one of {VALID_RUN_WORKFLOW_MODELS}"
            )
        self._agent_fn = agent_fn
        self.default_model = default_model
        self.agent_sem = agent_sem

    def resolve_model(self, requested: Optional[str]) -> str:
        """Use requested tier when valid for run_workflow, else default_model."""
        if requested in VALID_RUN_WORKFLOW_MODELS:
            return str(requested)
        return self.default_model

    def completion_instruction(self, schema: Mapping[str, Any]) -> str:
        """Instruct run_workflow agent to finalize via its finish tool."""
        return "完成后调用 finish，严格按要求的 JSON Schema 返回结构化结论。"

    async def invoke(
        self, prompt: str, schema: Mapping[str, Any], *,
        role: str, model: Optional[str] = None,
    ) -> Any:
        """Run one run_workflow agent turn bounded by agent_sem and validate output."""
        tier = self.resolve_model(model)
        if self.agent_sem is None:
            result = await self._agent_fn(prompt, schema, role=role, model=tier)
        else:
            async with self.agent_sem:
                result = await self._agent_fn(prompt, schema, role=role, model=tier)
        assert_valid_schema(result, schema)
        return result
