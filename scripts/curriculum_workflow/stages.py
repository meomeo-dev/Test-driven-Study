"""Async lesson stages, question authoring, and multi-gate package validation."""

from __future__ import annotations

import asyncio
import json
import os
from dataclasses import dataclass
from typing import Any, Awaitable, Callable, Dict, List, Mapping, Optional, Sequence, Tuple

from .backends import AgentBackend, REVIEW_SCHEMA, SUMMARY_SCHEMA
from .config import DEFAULT_MODEL
from .io_store import (
    CommandResult,
    ProgressStore,
    atomic_write_json,
    atomic_write_text,
    build_progress_entry,
    has_real_content,
    load_json,
    read_text,
    run_cmd_async,
)
from .planning import existing_concept_effort
from .prompts import (
    RESEARCH_ROLES,
    build_author_prompt,
    build_effort_repair_prompt,
    build_questions_prompt,
    build_research_prompt,
    build_review_prompts,
    build_revise_prompt,
    build_tts_repair_prompt,
    build_vocab_repair_prompt,
)

TTS_AUDIT_SCRIPT = ".agents/skills/design-course-tts/scripts/audit-course-tts.mjs"
VOCAB_AUDIT_SCRIPT = (
    ".agents/skills/design-course-vocabulary/scripts/audit-course-vocabulary.mjs"
)
EFFORT_AUDIT_SCRIPT = "scripts/audit-course-effort.mjs"


@dataclass
class RuntimeDeps:
    """Injected runtime dependencies shared across stage coroutines."""

    backend: AgentBackend
    validate_sem: asyncio.Semaphore
    log_fn: Callable[[str], None] = print
    validate_timeout: int = 180
    cmd_runner: Callable[..., Awaitable[CommandResult]] = run_cmd_async


@dataclass
class LessonOutcome:
    """Structured per-lesson execution outcome for reporting and error isolation."""

    lesson_id: str
    lesson_number: int
    unit_id: str
    status: str
    approved: bool = False
    skipped: bool = False
    error: Optional[str] = None


def _ensure_lesson_dirs(ctx: Mapping[str, Any]) -> None:
    """Create parent directories for notes, reviews, draft, and packaged lesson."""
    targets = (
        list(ctx["notes"])
        + list(ctx["reviews"])
        + [ctx["draft_path"], ctx["final_path"], ctx["pkg_lesson_path"]]
    )
    for path in targets:
        os.makedirs(os.path.dirname(str(path)) or ".", exist_ok=True)


async def research_lesson(ctx: Mapping[str, Any], deps: RuntimeDeps) -> None:
    """Run missing R1-R3 research agents concurrently without fail-fast cancels."""
    _ensure_lesson_dirs(ctx)
    if ctx["ingest_archived"] and has_real_content(ctx["final_path"], min_bytes=400):
        deps.log_fn(
            f"[{ctx['course_id']}] {ctx['lesson_id']} reusing archived material"
        )
        return
    instr = deps.backend.completion_instruction(SUMMARY_SCHEMA)
    pending: List[Tuple[str, Awaitable[Any]]] = []
    for idx, (tag, role_zh, focus) in enumerate(RESEARCH_ROLES):
        note_path = str(ctx["notes"][idx])
        if not ctx["force_research"] and has_real_content(note_path, min_bytes=200):
            continue
        prompt = build_research_prompt(ctx, idx, role_zh, focus, note_path, instr)
        coro = deps.backend.invoke(
            prompt,
            SUMMARY_SCHEMA,
            role=f"{tag}-{ctx['lesson_slug']}",
            model=ctx["model"],
        )
        pending.append((tag, coro))
    if not pending:
        return
    results = await asyncio.gather(
        *(c for _, c in pending), return_exceptions=True
    )
    errors: List[str] = []
    for (tag, _), res in zip(pending, results):
        if isinstance(res, BaseException):
            errors.append(f"{tag}: {res}")
        elif not res.get("ok"):
            errors.append(f"{tag}: returned ok=False ({res.get('summary', '')})")
    if errors:
        raise RuntimeError(
            f"[{ctx['course_id']}] {ctx['lesson_id']} research failed: "
            + "; ".join(errors)
        )


async def author_lesson(ctx: Mapping[str, Any], deps: RuntimeDeps) -> None:
    """Synthesize lesson_draft.md meeting concept section and reading budgets."""
    total_units = sum(int(c["target_read_units"]) for c in ctx["concepts"])
    if (
        has_real_content(ctx["draft_path"], min_bytes=max(300, total_units))
        and not ctx["force_research"]
    ):
        return
    archived = (
        str(ctx["final_path"])
        if (ctx["ingest_archived"] and has_real_content(ctx["final_path"], 400))
        else ""
    )
    sources = archived or ", ".join(
        str(p) for p in ctx["notes"] if has_real_content(str(p), 80)
    )
    if not sources:
        raise RuntimeError(
            f"[{ctx['course_id']}] {ctx['lesson_id']} lacks valid source notes"
        )
    instr = deps.backend.completion_instruction(SUMMARY_SCHEMA)
    prompt = build_author_prompt(ctx, sources, instr)
    res = await deps.backend.invoke(
        prompt,
        SUMMARY_SCHEMA,
        role=f"Author-{ctx['lesson_slug']}",
        model=ctx["model"],
    )
    if not res.get("ok") or not has_real_content(ctx["draft_path"], 200):
        raise RuntimeError(
            f"[{ctx['course_id']}] {ctx['lesson_id']} draft synthesis failed"
        )


async def revise_draft(
    ctx: Mapping[str, Any],
    blocking: Sequence[str],
    instructions: Sequence[str],
    deps: RuntimeDeps,
) -> None:
    """Apply concrete reviewer fixes directly to lesson_draft.md."""
    instr = deps.backend.completion_instruction(SUMMARY_SCHEMA)
    prompt = build_revise_prompt(ctx, blocking, instructions, instr)
    await deps.backend.invoke(
        prompt,
        SUMMARY_SCHEMA,
        role=f"Revise-{ctx['lesson_slug']}",
        model=ctx["model"],
    )


async def _run_dual_review(
    ctx: Mapping[str, Any],
    fact_prompt: str,
    lang_prompt: str,
    deps: RuntimeDeps,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """Invoke Fact and Language reviewers concurrently and verify both settle."""
    results = await asyncio.gather(
        deps.backend.invoke(
            fact_prompt,
            REVIEW_SCHEMA,
            role=f"RevFact-{ctx['lesson_slug']}",
            model=ctx["model"],
        ),
        deps.backend.invoke(
            lang_prompt,
            REVIEW_SCHEMA,
            role=f"RevLang-{ctx['lesson_slug']}",
            model=ctx["model"],
        ),
        return_exceptions=True,
    )
    errs = [str(r) for r in results if isinstance(r, BaseException)]
    if errs:
        raise RuntimeError(
            f"[{ctx['course_id']}] {ctx['lesson_id']} review failed: "
            + "; ".join(errs)
        )
    return results[0], results[1]


async def review_and_promote(
    ctx: Mapping[str, Any], deps: RuntimeDeps
) -> Tuple[bool, Dict[str, Any], Dict[str, Any]]:
    """Enforce dual-review pass gate before promoting draft to final & package."""
    instr = deps.backend.completion_instruction(REVIEW_SCHEMA)
    fact_p, lang_p = build_review_prompts(ctx, instr)
    fact_v: Dict[str, Any] = {}
    lang_v: Dict[str, Any] = {}
    max_revs = int(ctx["max_revisions"])
    for attempt in range(max_revs + 1):
        fact_v, lang_v = await _run_dual_review(ctx, fact_p, lang_p, deps)
        no_blockers = not (
            fact_v["blocking_issues"] or lang_v["blocking_issues"]
        )
        ok = bool(fact_v["passed"] and lang_v["passed"] and no_blockers)
        if ok and has_real_content(ctx["draft_path"], 200):
            content = read_text(ctx["draft_path"])
            atomic_write_text(str(ctx["final_path"]), content)
            atomic_write_text(str(ctx["pkg_lesson_path"]), content)
            return True, fact_v, lang_v
        if attempt < max_revs:
            await revise_draft(
                ctx,
                list(fact_v["blocking_issues"]) + list(lang_v["blocking_issues"]),
                list(fact_v["revision_instructions"])
                + list(lang_v["revision_instructions"]),
                deps,
            )
    return False, fact_v, lang_v


async def _record_review_outcome(
    ctx: Mapping[str, Any],
    ok: bool,
    fact_v: Mapping[str, Any],
    lang_v: Mapping[str, Any],
    progress_store: ProgressStore,
    package_dir: str,
) -> LessonOutcome:
    """Persist REVIEW_APPROVED or FAILED_REVIEW and return LessonOutcome."""
    l_id, l_num, u_id = str(ctx["lesson_id"]), int(ctx["lesson_number"]), str(ctx["unit_id"])
    if not ok:
        extra = {
            "fact_review": "PASSED" if fact_v.get("passed") else "FAILED",
            "lang_review": "PASSED" if lang_v.get("passed") else "FAILED",
            "blocking_issues": list(fact_v.get("blocking_issues", []))
            + list(lang_v.get("blocking_issues", [])),
        }
        await progress_store.update_one(
            l_id, build_progress_entry(ctx, "FAILED_REVIEW", package_dir, extra)
        )
        return LessonOutcome(l_id, l_num, u_id, "FAILED_REVIEW", False, False)
    extra = {"fact_review": "PASSED", "lang_review": "PASSED"}
    await progress_store.update_one(
        l_id, build_progress_entry(ctx, "REVIEW_APPROVED", package_dir, extra)
    )
    return LessonOutcome(l_id, l_num, u_id, "REVIEW_APPROVED", True, False)


async def run_one_lesson(
    ctx: Mapping[str, Any],
    progress_store: ProgressStore,
    package_dir: str,
    deps: RuntimeDeps,
) -> LessonOutcome:
    """Run research -> author -> dual review for one lesson with error isolation."""
    l_id, l_num, u_id = str(ctx["lesson_id"]), int(ctx["lesson_number"]), str(ctx["unit_id"])
    stage = "RESEARCH"
    try:
        await research_lesson(ctx, deps)
        stage = "AUTHOR"
        await author_lesson(ctx, deps)
        stage = "REVIEW"
        ok, fact_v, lang_v = await review_and_promote(ctx, deps)
    except Exception as exc:
        status = f"FAILED_{stage}"
        entry = build_progress_entry(ctx, status, package_dir, {"error": str(exc)})
        await progress_store.update_one(l_id, entry)
        deps.log_fn(f"[{ctx['course_id']}] {l_id} {status}: {exc}")
        return LessonOutcome(l_id, l_num, u_id, status, False, False, str(exc))
    return await _record_review_outcome(
        ctx, ok, fact_v, lang_v, progress_store, package_dir
    )


async def author_unit_questions(
    package_dir: str,
    unit: Mapping[str, Any],
    approved_ctxs: Sequence[Mapping[str, Any]],
    model: str,
    deps: RuntimeDeps,
) -> None:
    """Author v2 questions per concept matching upfront practice_design_min."""
    q_path = f"{package_dir}/{unit['question_file']}"
    existing = load_json(q_path, default=[])
    have_effort = existing_concept_effort(existing)
    specs = [
        {**cs, "lesson_file": ctx["pkg_lesson_path"]}
        for ctx in approved_ctxs
        for cs in ctx["concepts"]
        if have_effort.get(str(cs["id"]), 0.0)
        < float(cs["practice_design_min"]) * 0.7
    ]
    if not specs and existing:
        return
    atomic_write_json(q_path, existing)
    instr = deps.backend.completion_instruction(SUMMARY_SCHEMA)
    prompt = build_questions_prompt(q_path, specs, instr)
    res = await deps.backend.invoke(
        prompt, SUMMARY_SCHEMA, role=f"Questions-{unit['id']}", model=model
    )
    if not res.get("ok") or not load_json(q_path, default=[]):
        raise RuntimeError(f"failed authoring questions at {q_path}")


def _parse_audit_json(res: CommandResult) -> Dict[str, Any]:
    """Parse JSON output emitted by a node audit script."""
    text = res.stdout.strip()
    if text.startswith("{"):
        try:
            parsed = json.loads(text)
            if isinstance(parsed, dict):
                return parsed
        except json.JSONDecodeError:
            pass
    return {"ok": False, "raw": res.stderr or res.stdout}


async def run_audit_with_repair(
    cmd: Sequence[str],
    repair_role: str,
    repair_prompt_fn: Callable[[str], str],
    model: str,
    deps: RuntimeDeps,
) -> Dict[str, Any]:
    """Run an async JSON audit gate with one bounded repair pass before failing."""
    for attempt in range(2):
        res = await deps.cmd_runner(
            cmd,
            timeout=float(deps.validate_timeout),
            semaphore=deps.validate_sem,
        )
        data = _parse_audit_json(res)
        if not res.timed_out and res.returncode == 0 and data.get("ok"):
            return data
        detail = res.stdout or res.stderr or (
            "audit command timed out" if res.timed_out else f"exit {res.returncode}"
        )
        if attempt == 1:
            raise RuntimeError(f"{cmd[1]} failed:\n{detail}")
        await deps.backend.invoke(
            repair_prompt_fn(detail),
            SUMMARY_SCHEMA,
            role=repair_role,
            model=model,
        )
    return {}


async def _run_vocab_audit(
    package_dir: str,
    manifest: Mapping[str, Any],
    slug: str,
    model: str,
    instr: str,
    deps: RuntimeDeps,
) -> Optional[Dict[str, Any]]:
    """Run strict vocabulary audit when manifest declares vocabulary_file."""
    vocab_file = str(manifest.get("vocabulary_file") or "").strip()
    if not vocab_file:
        return None
    return await run_audit_with_repair(
        ["node", VOCAB_AUDIT_SCRIPT, package_dir, "--strict", "--json"],
        f"FixVocab-{slug}",
        lambda out: build_vocab_repair_prompt(package_dir, vocab_file, out, instr),
        model,
        deps,
    )


async def _run_course_check(package_dir: str, deps: RuntimeDeps) -> str:
    """Execute go course:check under validate_sem and return trimmed stdout."""
    res = await deps.cmd_runner(
        ["go", "run", "./cmd/course", "check", package_dir],
        timeout=float(deps.validate_timeout),
        semaphore=deps.validate_sem,
    )
    if res.timed_out or res.returncode != 0:
        raise RuntimeError(
            f"course:check failed for {package_dir}:\n{res.stdout}\n{res.stderr}"
        )
    return res.stdout.strip()


async def validate_package(
    package_dir: str,
    manifest: Mapping[str, Any],
    cfg: Mapping[str, Any],
    deps: RuntimeDeps,
) -> Dict[str, Any]:
    """Run TTS, conditional strict vocabulary, effort, and go course:check gates."""
    model = str(cfg.get("model") or DEFAULT_MODEL)
    slug = os.path.basename(os.path.normpath(package_dir))
    instr = deps.backend.completion_instruction(SUMMARY_SCHEMA)
    tts = await run_audit_with_repair(
        ["node", TTS_AUDIT_SCRIPT, package_dir, "--json"],
        f"FixTTS-{slug}",
        lambda out: build_tts_repair_prompt(package_dir, out, instr),
        model,
        deps,
    )
    vocab = await _run_vocab_audit(package_dir, manifest, slug, model, instr, deps)
    effort_cmd = ["node", EFFORT_AUDIT_SCRIPT, package_dir, "--json"]
    if cfg.get("strict_effort"):
        effort_cmd.append("--strict")
    effort = await run_audit_with_repair(
        effort_cmd,
        f"FixEffort-{slug}",
        lambda out: build_effort_repair_prompt(package_dir, out, instr),
        model,
        deps,
    )
    check_out = await _run_course_check(package_dir, deps)
    return {
        "tts": tts,
        "vocabulary": vocab,
        "effort": effort,
        "course_check": check_out,
    }
