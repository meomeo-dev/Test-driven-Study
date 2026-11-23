"""Configuration models, env/file/CLI merging, and collision validation."""

from __future__ import annotations

import json
import os
from dataclasses import asdict, dataclass, field
from typing import Any, Dict, Mapping, Optional, Tuple

DEFAULT_BACKEND = "cli"
DEFAULT_CLI_BIN = "agy-ultra"
DEFAULT_APP_DATA_DIR = "antigravity-cli-ultra"
DEFAULT_MODEL = "gemini-4-hydrogen-high"
DEFAULT_RUN_WORKFLOW_MODEL = "inherit"

VALID_BACKENDS = ("cli", "run_workflow")
VALID_RUN_WORKFLOW_MODELS = ("inherit", "flash_lite", "flash", "pro")
VALID_TRACKS = ("language", "stem")

_CLI_FLAT_MAP = {
    "cli_bin": "cli_bin",
    "app_data_dir": "app_data_dir",
    "cli_home": "cli_home",
    "cli_timeout": "timeout_seconds",
    "dangerously_skip_permissions": "dangerously_skip_permissions",
    "add_dirs": "add_dirs",
    "extra_args": "extra_args",
    "cwd": "cwd",
    "effort": "effort",
}
_CONCURRENCY_KEYS = (
    "max_courses",
    "max_lessons_per_course",
    "max_units_per_course",
    "max_agents",
    "max_subprocesses",
)
_RETRY_KEYS = (
    "max_attempts",
    "initial_backoff_seconds",
    "max_backoff_seconds",
    "jitter_ratio",
)


@dataclass
class ConcurrencyConfig:
    """Bounded concurrency limits forming a deadlock-free semaphore DAG."""

    max_courses: int = 2
    max_lessons_per_course: int = 3
    max_units_per_course: int = 3
    max_agents: int = 6
    max_subprocesses: int = 4

    def validate(self) -> None:
        """Verify all concurrency limits are positive integers."""
        for name in _CONCURRENCY_KEYS:
            val = getattr(self, name)
            if isinstance(val, bool) or not isinstance(val, int) or val < 1:
                raise ValueError(f"{name} must be an integer >= 1, got {val!r}")


@dataclass
class RetryConfig:
    """Exponential backoff retry configuration for transient agent failures."""

    max_attempts: int = 3
    initial_backoff_seconds: float = 2.0
    max_backoff_seconds: float = 30.0
    jitter_ratio: float = 0.25

    def validate(self) -> None:
        """Verify retry attempt count, backoff bounds, and jitter ratio."""
        if isinstance(self.max_attempts, bool) or self.max_attempts < 1:
            raise ValueError(f"max_attempts must be >= 1, got {self.max_attempts!r}")
        if self.initial_backoff_seconds < 0:
            raise ValueError("initial_backoff_seconds must be >= 0")
        if self.max_backoff_seconds < self.initial_backoff_seconds:
            raise ValueError("max_backoff_seconds must be >= initial_backoff_seconds")
        if not 0.0 <= self.jitter_ratio <= 1.0:
            raise ValueError("jitter_ratio must be in [0.0, 1.0]")


@dataclass
class CliConfig:
    """Settings for invoking the headless agy-ultra / agy CLI backend."""

    cli_bin: str = DEFAULT_CLI_BIN
    app_data_dir: str = DEFAULT_APP_DATA_DIR
    cli_home: Optional[str] = None
    model: str = DEFAULT_MODEL
    timeout_seconds: int = 600
    dangerously_skip_permissions: bool = True
    add_dirs: Tuple[str, ...] = ()
    extra_args: Tuple[str, ...] = ()
    cwd: Optional[str] = None
    effort: Optional[str] = None

    def validate(self) -> None:
        """Verify CLI binary, app_data_dir, model, and timeout settings."""
        if not str(self.cli_bin).strip():
            raise ValueError("cli_bin must not be empty")
        if not str(self.app_data_dir).strip():
            raise ValueError("app_data_dir must not be empty")
        if not str(self.model).strip():
            raise ValueError("cli.model must not be empty")
        if isinstance(self.timeout_seconds, bool) or self.timeout_seconds < 1:
            raise ValueError("timeout_seconds must be >= 1")


@dataclass
class WorkflowConfig:
    """Top-level configuration for batch curriculum generation and validation."""

    courses: Tuple[str, ...] = ("beginner-english",)
    start_lesson: int = 1
    end_lesson: int = 5
    backend: str = DEFAULT_BACKEND
    model: str = DEFAULT_MODEL
    run_workflow_model: str = DEFAULT_RUN_WORKFLOW_MODEL
    cli: CliConfig = field(default_factory=CliConfig)
    concurrency: ConcurrencyConfig = field(default_factory=ConcurrencyConfig)
    retry: RetryConfig = field(default_factory=RetryConfig)
    courses_root: Optional[str] = None
    syllabus_file: Optional[str] = None
    base_manifest: Optional[str] = None
    package_dir: Optional[str] = None
    research_dir: Optional[str] = None
    target_course_id: Optional[str] = None
    target_title: Optional[str] = None
    version: Optional[str] = None
    language: Optional[str] = None
    track: Optional[str] = None
    split_concepts: bool = True
    concept_map: Dict[str, str] = field(default_factory=dict)
    unit_map: Dict[str, Any] = field(default_factory=dict)
    ingest_archived: bool = False
    force_research: bool = False
    force_recheck: bool = False
    strict_effort: bool = False
    max_revisions: int = 3
    package_on_partial_failure: bool = True
    validate_timeout_seconds: int = 180
    dry_run: bool = False
    course_overrides: Dict[str, Dict[str, Any]] = field(default_factory=dict)

    def for_course(self, course_id: str) -> Dict[str, Any]:
        """Return effective per-course settings dict merged with course_overrides."""
        keys = (
            "courses_root", "syllabus_file", "base_manifest", "package_dir",
            "research_dir", "target_course_id", "target_title", "version",
            "language", "track", "split_concepts", "ingest_archived",
            "force_research", "force_recheck", "strict_effort",
            "max_revisions", "model",
        )
        base: Dict[str, Any] = {k: getattr(self, k) for k in keys}
        base["concept_map"] = dict(self.concept_map)
        base["unit_map"] = dict(self.unit_map)
        override = self.course_overrides.get(course_id)
        if override:
            base.update(override)
        return base

    def resolve_course_paths(self, course_id: str) -> Tuple[str, str]:
        """Compute (package_dir, research_root) for a course."""
        c_cfg = self.for_course(course_id)
        target_id = _simple_slug(c_cfg.get("target_course_id") or course_id)
        pkg_dir = c_cfg.get("package_dir") or f"var/generated-courses/{target_id}"
        res_dir = c_cfg.get("research_dir") or f"docs/research/{course_id}"
        return str(pkg_dir), str(res_dir)

    def validate(self) -> None:
        """Validate scalar bounds, nested configs, and cross-course path collisions."""
        if self.backend not in VALID_BACKENDS:
            raise ValueError(f"backend must be one of {VALID_BACKENDS}")
        if self.run_workflow_model not in VALID_RUN_WORKFLOW_MODELS:
            raise ValueError(
                f"run_workflow_model must be one of {VALID_RUN_WORKFLOW_MODELS}"
            )
        if not self.courses:
            raise ValueError("courses must contain at least one course ID")
        if self.start_lesson < 1 or self.end_lesson < self.start_lesson:
            raise ValueError("invalid lesson range: require 1 <= start <= end")
        if self.max_revisions < 0 or self.validate_timeout_seconds < 1:
            raise ValueError("invalid max_revisions or validate_timeout_seconds")
        if self.track is not None and self.track not in VALID_TRACKS:
            raise ValueError(f"track must be one of {VALID_TRACKS} or None")
        self.cli.validate()
        self.concurrency.validate()
        self.retry.validate()
        _validate_course_collisions(self)

    def to_dict(self) -> Dict[str, Any]:
        """Return a JSON-serializable representation of this configuration."""
        data = asdict(self)
        data["courses"] = list(self.courses)
        data["cli"]["add_dirs"] = list(self.cli.add_dirs)
        data["cli"]["extra_args"] = list(self.cli.extra_args)
        return data


def _simple_slug(raw: Any) -> str:
    """Normalize course identifier to a lowercase alphanumeric-hyphen slug."""
    chars = []
    prev_dash = True
    for ch in str(raw).strip().lower():
        if ch.isalnum() and ch.isascii():
            chars.append(ch)
            prev_dash = False
        elif not prev_dash:
            chars.append("-")
            prev_dash = True
    slug = "".join(chars).strip("-")[:64].strip("-")
    if not slug:
        raise ValueError(f"cannot normalize {raw!r} to slug")
    return slug


def _record_unique(seen: Dict[str, str], path: str, label: str, cid: str) -> None:
    """Register normalized path and raise ValueError on cross-course collision."""
    key = os.path.normpath(os.path.abspath(path))
    if key in seen:
        raise ValueError(
            f"duplicate {label} {path!r} for {seen[key]!r} and {cid!r}"
        )
    seen[key] = cid


def _validate_course_collisions(cfg: WorkflowConfig) -> None:
    """Reject duplicate course IDs, package_dir, research_dir, or syllabus_file."""
    seen_ids: Dict[str, str] = {}
    seen_pkgs: Dict[str, str] = {}
    seen_res: Dict[str, str] = {}
    seen_syl: Dict[str, str] = {}
    for cid in cfg.courses:
        if cid in seen_ids:
            raise ValueError(f"duplicate course ID in batch: {cid!r}")
        seen_ids[cid] = cid
        pkg_dir, res_dir = cfg.resolve_course_paths(cid)
        _record_unique(seen_pkgs, pkg_dir, "package_dir", cid)
        _record_unique(seen_res, res_dir, "research_dir", cid)
        syl = cfg.for_course(cid).get("syllabus_file")
        if syl:
            _record_unique(seen_syl, str(syl), "syllabus_file", cid)


def load_config_file(path: str) -> Dict[str, Any]:
    """Load a JSON configuration object from disk."""
    with open(path, "r", encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, dict):
        raise ValueError(f"config file {path!r} must contain a JSON object")
    return data


def _env_overrides(env: Mapping[str, str]) -> Dict[str, Any]:
    """Extract workflow settings from environment variables."""
    out: Dict[str, Any] = {}
    str_keys = (
        ("CURRICULUM_WORKFLOW_BACKEND", "backend"),
        ("CURRICULUM_WORKFLOW_MODEL", "model"),
        ("CURRICULUM_WORKFLOW_RUN_WORKFLOW_MODEL", "run_workflow_model"),
        ("AGY_ULTRA_BIN", "cli_bin"),
        ("CURRICULUM_WORKFLOW_CLI_BIN", "cli_bin"),
        ("AGY_ULTRA_APP_DATA_DIR", "app_data_dir"),
        ("AGY_ULTRA_HOME", "cli_home"),
    )
    for env_key, dst in str_keys:
        if env.get(env_key):
            out[dst] = env[env_key]
    int_keys = (
        ("CURRICULUM_WORKFLOW_TIMEOUT", "cli_timeout"),
        ("CURRICULUM_WORKFLOW_MAX_COURSES", "max_courses"),
        ("CURRICULUM_WORKFLOW_MAX_LESSONS", "max_lessons_per_course"),
        ("CURRICULUM_WORKFLOW_MAX_UNITS", "max_units_per_course"),
        ("CURRICULUM_WORKFLOW_MAX_AGENTS", "max_agents"),
        ("CURRICULUM_WORKFLOW_MAX_SUBPROCESSES", "max_subprocesses"),
        ("CURRICULUM_WORKFLOW_MAX_ATTEMPTS", "max_attempts"),
    )
    for env_key, dst in int_keys:
        if env.get(env_key):
            out[dst] = int(env[env_key])
    return out


def _normalize_courses(raw: Any) -> Tuple[str, ...]:
    """Normalize a string or sequence of course identifiers into a tuple."""
    if raw is None:
        return ("beginner-english",)
    if isinstance(raw, str):
        return tuple(x.strip() for x in raw.split(",") if x.strip())
    return tuple(str(x).strip() for x in raw if str(x).strip())


def _canonicalize_layer(incoming: Optional[Mapping[str, Any]]) -> Dict[str, Any]:
    """Fold flat CLI/concurrency/retry aliases into canonical nested sections."""
    if not incoming:
        return {}
    out: Dict[str, Any] = {"cli": {}, "concurrency": {}, "retry": {}}
    for key in ("cli", "concurrency", "retry"):
        if isinstance(incoming.get(key), Mapping):
            out[key].update(
                {k: v for k, v in incoming[key].items() if v is not None}
            )
    for key, val in incoming.items():
        if val is None or key in ("cli", "concurrency", "retry"):
            continue
        if key in _CLI_FLAT_MAP:
            out["cli"][_CLI_FLAT_MAP[key]] = val
        elif key in _CONCURRENCY_KEYS:
            out["concurrency"][key] = val
        elif key in _RETRY_KEYS:
            out["retry"][key] = val
        else:
            out[key] = val
        if key == "model" and "model" not in out["cli"]:
            out["cli"]["model"] = val
    return out


def _merge_layers(*layers: Optional[Mapping[str, Any]]) -> Dict[str, Any]:
    """Merge canonicalized configuration layers from lowest to highest priority."""
    merged: Dict[str, Any] = {"cli": {}, "concurrency": {}, "retry": {}}
    for layer in layers:
        canon = _canonicalize_layer(layer)
        for key, val in canon.items():
            if key in ("cli", "concurrency", "retry"):
                merged[key].update(val)
            else:
                merged[key] = val
    return merged


def _build_subconfigs(
    raw: Mapping[str, Any], model: str
) -> Tuple[CliConfig, ConcurrencyConfig, RetryConfig]:
    """Instantiate CliConfig, ConcurrencyConfig, and RetryConfig from merged raw."""
    c_raw = raw["cli"]
    cli_cfg = CliConfig(
        cli_bin=str(c_raw.get("cli_bin", DEFAULT_CLI_BIN)),
        app_data_dir=str(c_raw.get("app_data_dir", DEFAULT_APP_DATA_DIR)),
        cli_home=c_raw.get("cli_home"),
        model=str(c_raw.get("model", model)),
        timeout_seconds=int(c_raw.get("timeout_seconds", 600)),
        dangerously_skip_permissions=bool(
            c_raw.get("dangerously_skip_permissions", True)
        ),
        add_dirs=tuple(str(d) for d in c_raw.get("add_dirs", ())),
        extra_args=tuple(str(a) for a in c_raw.get("extra_args", ())),
        cwd=c_raw.get("cwd"),
        effort=c_raw.get("effort"),
    )
    conc = ConcurrencyConfig(
        **{k: int(v) for k, v in raw["concurrency"].items() if k in _CONCURRENCY_KEYS}
    )
    retry_raw = raw["retry"]
    retry = RetryConfig(
        max_attempts=int(retry_raw.get("max_attempts", 3)),
        initial_backoff_seconds=float(
            retry_raw.get("initial_backoff_seconds", 2.0)
        ),
        max_backoff_seconds=float(retry_raw.get("max_backoff_seconds", 30.0)),
        jitter_ratio=float(retry_raw.get("jitter_ratio", 0.25)),
    )
    return cli_cfg, conc, retry


def _course_option_kwargs(raw: Mapping[str, Any]) -> Dict[str, Any]:
    """Extract course-level optional fields for WorkflowConfig construction."""
    return {
        "courses_root": raw.get("courses_root"),
        "syllabus_file": raw.get("syllabus_file"),
        "base_manifest": raw.get("base_manifest"),
        "package_dir": raw.get("package_dir"),
        "research_dir": raw.get("research_dir"),
        "target_course_id": raw.get("target_course_id"),
        "target_title": raw.get("target_title"),
        "version": raw.get("version"),
        "language": raw.get("language"),
        "track": raw.get("track") or None,
        "split_concepts": bool(raw.get("split_concepts", True)),
        "concept_map": dict(raw.get("concept_map") or {}),
        "unit_map": dict(raw.get("unit_map") or {}),
        "ingest_archived": bool(raw.get("ingest_archived", False)),
        "force_research": bool(raw.get("force_research", False)),
        "force_recheck": bool(raw.get("force_recheck", False)),
        "strict_effort": bool(raw.get("strict_effort", False)),
        "max_revisions": int(raw.get("max_revisions", 3)),
        "package_on_partial_failure": bool(
            raw.get("package_on_partial_failure", True)
        ),
        "validate_timeout_seconds": int(raw.get("validate_timeout_seconds", 180)),
        "dry_run": bool(raw.get("dry_run", False)),
        "course_overrides": dict(raw.get("course_overrides") or {}),
    }


def build_workflow_config(
    *,
    cli_overrides: Optional[Mapping[str, Any]] = None,
    file_config: Optional[Mapping[str, Any]] = None,
    env: Optional[Mapping[str, str]] = None,
) -> WorkflowConfig:
    """Merge defaults < env < file_config < cli_overrides into WorkflowConfig."""
    raw = _merge_layers(
        _env_overrides(os.environ if env is None else env),
        file_config,
        cli_overrides,
    )
    model = str(raw.get("model") or raw["cli"].get("model") or DEFAULT_MODEL)
    cli_cfg, conc_cfg, retry_cfg = _build_subconfigs(raw, model)
    cfg = WorkflowConfig(
        courses=_normalize_courses(raw.get("courses")),
        start_lesson=int(raw.get("start_lesson", 1)),
        end_lesson=int(raw.get("end_lesson", 5)),
        backend=str(raw.get("backend") or DEFAULT_BACKEND),
        model=cli_cfg.model,
        run_workflow_model=str(
            raw.get("run_workflow_model") or DEFAULT_RUN_WORKFLOW_MODEL
        ),
        cli=cli_cfg,
        concurrency=conc_cfg,
        retry=retry_cfg,
        **_course_option_kwargs(raw),
    )
    cfg.validate()
    return cfg


def config_from_mapping(
    data: Optional[Mapping[str, Any]] = None,
    *,
    env: Optional[Mapping[str, str]] = None,
) -> WorkflowConfig:
    """Construct a validated WorkflowConfig from a mapping (e.g. run_workflow args)."""
    return build_workflow_config(file_config=data, env=env)
