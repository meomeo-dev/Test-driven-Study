"""Bounded-concurrency orchestrator with deterministic ordering and error isolation."""

from __future__ import annotations

import asyncio
import os
from dataclasses import asdict, dataclass, field
from typing import Any, Awaitable, Callable, Dict, List, Mapping, Optional, Sequence, Tuple

from .backends import AgentBackend, AgyUltraCliBackend, BackendConfigError
from .config import WorkflowConfig
from .io_store import (
    CommandResult,
    ProgressStore,
    atomic_write_json,
    atomic_write_text,
    build_progress_entry,
    load_json,
    run_cmd_async,
)
from .planning import (
    build_base_manifest,
    build_lesson_ctx,
    group_approved_by_unit,
    is_lesson_done,
    resolve_syllabus_path,
    select_syllabus_lessons,
    upsert_unit_in_manifest,
    validate_distinct_question_files,
    write_budget_plan,
)
from .stages import (
    LessonOutcome,
    RuntimeDeps,
    author_unit_questions,
    run_one_lesson,
    validate_package,
)


@dataclass
class CourseOutcome:
    """Structured execution outcome for one course in a batch run."""

    course_id: str
    package_dir: str
    research_root: str
    ok: bool
    completed: int = 0
    skipped: int = 0
    failed: int = 0
    lessons: List[LessonOutcome] = field(default_factory=list)
    validation: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    dry_run_plan: Optional[Dict[str, Any]] = None


@dataclass
class BatchResult:
    """Aggregate result across all courses processed by run_batch."""

    ok: bool
    exit_code: int
    courses: List[CourseOutcome] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        """Serialize batch outcome to a JSON-compatible dictionary."""
        return asdict(self)


def _format_validation_log(course_id: str, validation: Mapping[str, Any]) -> str:
    """Format concise verification log line from validation gate payloads."""
    tts = validation.get("tts") or {}
    effort = validation.get("effort") or {}
    vocab = validation.get("vocabulary")
    vocab_part = (
        f" | vocab={vocab.get('issueCount', 0)}"
        if isinstance(vocab, Mapping)
        else ""
    )
    return (
        f"[{course_id}] Verified: {validation.get('course_check', '')} "
        f"| tts={tts.get('issueCount', '?')}{vocab_part} "
        f"| effort eta={effort.get('ratio', '?')} "
        f"({effort.get('designMinutes', '?')}m/{effort.get('declaredMinutes', '?')}m)"
    )


def _commit_manifest_once(
    package_dir: str,
    manifest: Dict[str, Any],
    approved_by_unit: Mapping[str, Tuple[str, List[Dict[str, Any]]]],
) -> List[Tuple[Dict[str, Any], List[Dict[str, Any]]]]:
    """Upsert approved units, check unique question files, and write manifest once."""
    unit_tasks: List[Tuple[Dict[str, Any], List[Dict[str, Any]]]] = []
    for unit_id, (unit_title, ctxs) in approved_by_unit.items():
        unit = upsert_unit_in_manifest(manifest, unit_id, unit_title, ctxs)
        unit_tasks.append((unit, ctxs))
    validate_distinct_question_files(manifest.get("units", []))
    atomic_write_json(f"{package_dir}/course.json", manifest)
    readme_path = f"{package_dir}/README.md"
    if not os.path.exists(readme_path):
        atomic_write_text(
            readme_path,
            f"# {manifest['title']}\n\n{manifest['description']}\n",
        )
    return unit_tasks


async def _author_units_concurrently(
    package_dir: str,
    unit_tasks: Sequence[Tuple[Dict[str, Any], List[Dict[str, Any]]]],
    model: str,
    unit_sem: asyncio.Semaphore,
    deps: RuntimeDeps,
) -> None:
    """Fan out unit question authoring under unit_sem without fail-fast cancels."""

    async def _one(unit: Dict[str, Any], ctxs: List[Dict[str, Any]]) -> None:
        async with unit_sem:
            await author_unit_questions(package_dir, unit, ctxs, model, deps)

    results = await asyncio.gather(
        *(_one(unit, ctxs) for unit, ctxs in unit_tasks),
        return_exceptions=True,
    )
    errors = [
        f"{unit['id']}: {res}"
        for (unit, _), res in zip(unit_tasks, results)
        if isinstance(res, BaseException)
    ]
    if errors:
        raise RuntimeError(
            "unit question authoring failed: " + "; ".join(errors)
        )


def _validation_progress_updates(
    approved_by_unit: Mapping[str, Tuple[str, List[Dict[str, Any]]]],
    status: str,
    package_dir: str,
    extra: Mapping[str, Any],
) -> Dict[str, Dict[str, Any]]:
    """Build batch progress updates for all approved lessons in canonical order."""
    updates: Dict[str, Dict[str, Any]] = {}
    for _, ctxs in approved_by_unit.values():
        for ctx in ctxs:
            updates[str(ctx["lesson_id"])] = build_progress_entry(
                ctx, status, package_dir, extra
            )
    return updates


async def package_and_verify(
    course_id: str,
    package_dir: str,
    manifest: Dict[str, Any],
    approved_by_unit: Mapping[str, Tuple[str, List[Dict[str, Any]]]],
    progress_store: ProgressStore,
    course_cfg: Mapping[str, Any],
    unit_sem: asyncio.Semaphore,
    deps: RuntimeDeps,
) -> Dict[str, Any]:
    """Commit manifest once, author unit questions in parallel, validate, flush."""
    try:
        unit_tasks = _commit_manifest_once(package_dir, manifest, approved_by_unit)
        await _author_units_concurrently(
            package_dir, unit_tasks, str(course_cfg["model"]), unit_sem, deps
        )
        validation = await validate_package(package_dir, manifest, course_cfg, deps)
    except Exception as exc:
        updates = _validation_progress_updates(
            approved_by_unit, "FAILED_VALIDATION", package_dir, {"error": str(exc)}
        )
        await progress_store.update_many(updates)
        raise
    deps.log_fn(_format_validation_log(course_id, validation))
    extra: Dict[str, Any] = {
        "fact_review": "PASSED",
        "lang_review": "PASSED",
        "tts_audit": "PASSED",
        "effort_audit": "PASSED",
        "course_check": "PASSED",
    }
    if validation.get("vocabulary") is not None:
        extra["vocabulary_audit"] = "PASSED"
    updates = _validation_progress_updates(
        approved_by_unit, "COMPLETED", package_dir, extra
    )
    await progress_store.update_many(updates)
    return validation


def _plan_dry_run_items(
    ctxs: Sequence[Mapping[str, Any]],
    prog: Mapping[str, Any],
    package_dir: str,
    course_cfg: Mapping[str, Any],
) -> Tuple[List[LessonOutcome], List[Dict[str, Any]], int]:
    """Classify lessons for dry-run reporting without modifying files."""
    lessons: List[LessonOutcome] = []
    plan_items: List[Dict[str, Any]] = []
    skipped = 0
    for ctx in ctxs:
        done = is_lesson_done(
            prog.get(str(ctx["lesson_id"]), {}), ctx, package_dir, course_cfg
        )
        status = "SKIPPED" if done else "DRY_RUN"
        skipped += 1 if done else 0
        lessons.append(
            LessonOutcome(
                str(ctx["lesson_id"]), int(ctx["lesson_number"]),
                str(ctx["unit_id"]), status, approved=False, skipped=done,
            )
        )
        plan_items.append(
            {
                "lesson_id": ctx["lesson_id"],
                "lesson_number": ctx["lesson_number"],
                "unit_id": ctx["unit_id"],
                "status": status,
                "estimated_minutes": ctx["estimated_minutes"],
                "concepts": [c["id"] for c in ctx["concepts"]],
            }
        )
    return lessons, plan_items, skipped


def _build_dry_run_outcome(
    course_id: str,
    syllabus_path: str,
    package_dir: str,
    research_root: str,
    ctxs: Sequence[Mapping[str, Any]],
    prog: Mapping[str, Any],
    course_cfg: Mapping[str, Any],
    config: WorkflowConfig,
) -> CourseOutcome:
    """Build read-only dry-run plan and outcome without touching disk or LLMs."""
    lessons, plan_items, skipped = _plan_dry_run_items(
        ctxs, prog, package_dir, course_cfg
    )
    plan = {
        "course_id": course_id,
        "syllabus_path": syllabus_path,
        "package_dir": package_dir,
        "research_root": research_root,
        "backend": config.backend,
        "model": course_cfg["model"],
        "selected_lessons": plan_items,
    }
    return CourseOutcome(
        course_id=course_id,
        package_dir=package_dir,
        research_root=research_root,
        ok=True,
        skipped=skipped,
        lessons=lessons,
        dry_run_plan=plan,
    )


async def _run_lessons_concurrently(
    ctxs: Sequence[Dict[str, Any]],
    prog: Mapping[str, Any],
    progress_store: ProgressStore,
    package_dir: str,
    course_cfg: Mapping[str, Any],
    lesson_sem: asyncio.Semaphore,
    deps: RuntimeDeps,
) -> Tuple[List[LessonOutcome], List[Dict[str, Any]]]:
    """Schedule non-completed lessons under lesson_sem and preserve syllabus order."""
    outcomes: List[Optional[LessonOutcome]] = [None] * len(ctxs)
    scheduled: List[Tuple[int, Dict[str, Any]]] = []
    for idx, ctx in enumerate(ctxs):
        l_id = str(ctx["lesson_id"])
        if is_lesson_done(prog.get(l_id, {}), ctx, package_dir, course_cfg):
            deps.log_fn(f"[{ctx['course_id']}] {l_id} already verified.")
            outcomes[idx] = LessonOutcome(
                l_id, int(ctx["lesson_number"]), str(ctx["unit_id"]),
                "SKIPPED", approved=False, skipped=True,
            )
            continue
        write_budget_plan(ctx)
        scheduled.append((idx, ctx))

    async def _one(ctx: Dict[str, Any]) -> LessonOutcome:
        async with lesson_sem:
            return await run_one_lesson(ctx, progress_store, package_dir, deps)

    ran = await asyncio.gather(*(_one(ctx) for _, ctx in scheduled))
    approved: List[Dict[str, Any]] = []
    for (idx, ctx), out in zip(scheduled, ran):
        outcomes[idx] = out
        if out.approved:
            approved.append(ctx)
    return [o for o in outcomes if o is not None], approved


def _apply_packaging_status(
    outcomes: List[LessonOutcome],
    approved_ids: Sequence[str],
    status: str,
    error: Optional[str] = None,
) -> None:
    """Update LessonOutcome statuses for approved lessons after packaging."""
    target = set(approved_ids)
    for out in outcomes:
        if out.lesson_id in target:
            out.status = status
            if error:
                out.error = error


async def _run_packaging_stage(
    course_id: str,
    package_dir: str,
    manifest: Dict[str, Any],
    outcomes: List[LessonOutcome],
    approved_ctxs: List[Dict[str, Any]],
    progress_store: ProgressStore,
    course_cfg: Mapping[str, Any],
    config: WorkflowConfig,
    deps: RuntimeDeps,
) -> Tuple[int, int, Optional[Dict[str, Any]], Optional[str]]:
    """Run package_and_verify and return (completed, added_fail, validation, err)."""
    approved_by_unit = group_approved_by_unit(approved_ctxs, manifest)
    unit_sem = asyncio.Semaphore(config.concurrency.max_units_per_course)
    approved_ids = [str(c["lesson_id"]) for c in approved_ctxs]
    try:
        validation = await package_and_verify(
            course_id, package_dir, manifest, approved_by_unit,
            progress_store, course_cfg, unit_sem, deps,
        )
    except Exception as exc:
        err = str(exc)
        _apply_packaging_status(outcomes, approved_ids, "FAILED_VALIDATION", err)
        return 0, len(approved_ctxs), None, err
    _apply_packaging_status(outcomes, approved_ids, "COMPLETED")
    return len(approved_ctxs), 0, validation, None


async def _finalize_course(
    course_id: str,
    package_dir: str,
    research_root: str,
    manifest: Dict[str, Any],
    outcomes: List[LessonOutcome],
    approved_ctxs: List[Dict[str, Any]],
    progress_store: ProgressStore,
    course_cfg: Mapping[str, Any],
    config: WorkflowConfig,
    deps: RuntimeDeps,
) -> CourseOutcome:
    """Decide packaging eligibility and construct the final CourseOutcome."""
    skipped = sum(1 for o in outcomes if o.skipped)
    failed = sum(1 for o in outcomes if not o.skipped and not o.approved)
    should_pkg = bool(approved_ctxs) and (
        failed == 0 or config.package_on_partial_failure
    )
    completed, validation, pkg_error = 0, None, None
    if should_pkg:
        completed, add_fail, validation, pkg_error = await _run_packaging_stage(
            course_id, package_dir, manifest, outcomes, approved_ctxs,
            progress_store, course_cfg, config, deps,
        )
        failed += add_fail
    elif failed > 0:
        pkg_error = f"[{course_id}] {failed} lesson(s) failed before packaging"
    return CourseOutcome(
        course_id=course_id, package_dir=package_dir, research_root=research_root,
        ok=(failed == 0 and pkg_error is None), completed=completed,
        skipped=skipped, failed=failed, lessons=outcomes,
        validation=validation, error=pkg_error,
    )


async def process_course(
    course_id: str,
    config: WorkflowConfig,
    deps: RuntimeDeps,
) -> CourseOutcome:
    """Execute one course from syllabus loading through bounded packaging."""
    course_cfg = config.for_course(course_id)
    package_dir, research_root = config.resolve_course_paths(course_id)
    syllabus_path = resolve_syllabus_path(course_id, course_cfg)
    syllabus = load_json(syllabus_path)
    selected = select_syllabus_lessons(
        syllabus, config.start_lesson, config.end_lesson
    )
    manifest = build_base_manifest(course_id, syllabus, package_dir, course_cfg)
    existing_units = {str(u["id"]): u for u in manifest.get("units", [])}
    progress_store = ProgressStore(f"{research_root}/progress.json")
    prog = await progress_store.read()
    ctxs = [
        build_lesson_ctx(
            meta, course_id, research_root, package_dir, course_cfg, existing_units
        )
        for meta in selected
    ]
    if config.dry_run:
        return _build_dry_run_outcome(
            course_id, syllabus_path, package_dir, research_root,
            ctxs, prog, course_cfg, config,
        )
    lesson_sem = asyncio.Semaphore(config.concurrency.max_lessons_per_course)
    outcomes, approved_ctxs = await _run_lessons_concurrently(
        ctxs, prog, progress_store, package_dir, course_cfg, lesson_sem, deps
    )
    return await _finalize_course(
        course_id, package_dir, research_root, manifest,
        outcomes, approved_ctxs, progress_store, course_cfg, config, deps,
    )


def _create_default_backend(
    config: WorkflowConfig,
    agent_sem: asyncio.Semaphore,
    log_fn: Callable[[str], None],
    cli_cmd_runner: Callable[..., Awaitable[CommandResult]],
) -> AgentBackend:
    """Create the default AgentBackend from WorkflowConfig."""
    if config.backend == "cli":
        return AgyUltraCliBackend(
            config.cli,
            config.retry,
            agent_sem=agent_sem,
            cmd_runner=cli_cmd_runner,
            log_fn=log_fn,
        )
    raise BackendConfigError(
        "backend='run_workflow' requires injecting a RunWorkflowBackend instance"
    )


async def _run_bounded_course(
    cid: str,
    config: WorkflowConfig,
    course_sem: asyncio.Semaphore,
    deps: RuntimeDeps,
) -> CourseOutcome:
    """Execute one course under course_sem with per-course error isolation."""
    async with course_sem:
        try:
            return await process_course(cid, config, deps)
        except Exception as exc:
            pkg_dir, res_dir = config.resolve_course_paths(cid)
            deps.log_fn(f"[{cid}] course failed: {exc}")
            return CourseOutcome(
                course_id=cid,
                package_dir=pkg_dir,
                research_root=res_dir,
                ok=False,
                error=str(exc),
            )


async def run_batch(
    config: WorkflowConfig,
    *,
    backend: Optional[AgentBackend] = None,
    log_fn: Optional[Callable[[str], None]] = None,
    phase_fn: Optional[Callable[[str], None]] = None,
    cmd_runner: Callable[..., Awaitable[CommandResult]] = run_cmd_async,
    cli_cmd_runner: Callable[..., Awaitable[CommandResult]] = run_cmd_async,
) -> BatchResult:
    """Execute a multi-course batch run under a deadlock-free semaphore DAG."""
    config.validate()
    log = log_fn or print
    phase = phase_fn or (lambda title: log(f"=== {title} ==="))
    course_sem = asyncio.Semaphore(config.concurrency.max_courses)
    agent_sem = asyncio.Semaphore(config.concurrency.max_agents)
    validate_sem = asyncio.Semaphore(config.concurrency.max_subprocesses)
    active = backend or _create_default_backend(config, agent_sem, log, cli_cmd_runner)
    deps = RuntimeDeps(
        backend=active, validate_sem=validate_sem, log_fn=log,
        validate_timeout=config.validate_timeout_seconds, cmd_runner=cmd_runner,
    )
    mode = "Dry-Run" if config.dry_run else f"Backend={config.backend}"
    phase(
        f"Budget-Aligned v2 Workflow ({mode}, "
        f"Lessons {config.start_lesson}-{config.end_lesson})"
    )
    coros = [_run_bounded_course(cid, config, course_sem, deps) for cid in config.courses]
    outcomes = list(await asyncio.gather(*coros))
    ok = all(c.ok and c.failed == 0 for c in outcomes)
    return BatchResult(ok=ok, exit_code=0 if ok else 1, courses=outcomes)
