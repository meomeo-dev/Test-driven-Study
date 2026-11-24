"""Syllabus resolution, quota planning, and cycle-safe deterministic manifest assembly."""

from __future__ import annotations

import os
import re
from typing import Any, Dict, List, Mapping, Optional, Sequence, Set, Tuple

from .config import DEFAULT_MODEL
from .dag_validation import (
    _prereq_ids,
    _would_create_cycle,
    assert_acyclic_concepts,
    assert_acyclic_manifest,
)
from .io_store import atomic_write_json, has_real_content, load_json
from .track_profiles import DESIGN_ITEM_MINUTES, allocate_concept_quota

SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
UNIT_PREFIX_RE = re.compile(r"^第\s*\d+\s*单元[：:]\s*")


def to_slug(raw: Any, max_len: int = 64) -> str:
    """Normalize an arbitrary identifier into a valid manifest slug."""
    cleaned = re.sub(r"[^a-z0-9]+", "-", str(raw).strip().lower()).strip("-")
    slug = cleaned[:max_len].strip("-")
    if not slug or not SLUG_RE.match(slug):
        raise ValueError(f"cannot normalize {raw!r} to valid manifest slug")
    return slug


def clamp_minutes(raw: Any, default: int = 60) -> int:
    """Bound concept estimated_minutes to the manifest schema range 1..600."""
    try:
        return max(1, min(600, int(raw)))
    except (TypeError, ValueError):
        return max(1, min(600, default))


def detect_track(course_id: str, cfg: Mapping[str, Any]) -> str:
    """Classify course domain track to guide v2 question-type quotas."""
    if cfg.get("track") in ("language", "stem"):
        return str(cfg["track"])
    cid = course_id.lower()
    return "language" if ("english" in cid or "chinese" in cid) else "stem"


def _normalize_prereq_groups(raw: Any) -> List[Dict[str, List[str]]]:
    """Normalize declarative DNF prerequisite groups from syllabus metadata."""
    if not isinstance(raw, Sequence) or isinstance(raw, (str, bytes)):
        return []
    groups: List[Dict[str, List[str]]] = []
    for entry in raw:
        if isinstance(entry, Mapping) and isinstance(entry.get("all_of"), list):
            members = [to_slug(m) for m in entry["all_of"] if str(m).strip()]
            if members:
                groups.append({"all_of": members})
    return groups


def _attach_concept_meta(
    concept: Dict[str, Any], meta: Optional[Mapping[str, Any]]
) -> Dict[str, Any]:
    """Attach optional declarative summary, prerequisites, and metadata."""
    if not meta:
        return concept
    if meta.get("summary"):
        concept["summary"] = str(meta["summary"]).strip()
    if meta.get("skill_focus"):
        concept["skill_focus"] = str(meta["skill_focus"]).strip()
    if meta.get("cefr_level"):
        concept["cefr_level"] = str(meta["cefr_level"]).strip()
    prereqs = _normalize_prereq_groups(meta.get("prerequisites"))
    if prereqs:
        concept["prerequisites"] = prereqs
    if meta.get("vocab_target") is not None:
        concept["vocab_target"] = max(0, int(meta["vocab_target"]))
    return concept


def plan_lesson_concepts(
    l_id: str,
    l_slug: str,
    l_title: str,
    duration_min: Any,
    track: str,
    cfg: Mapping[str, Any],
    meta: Optional[Mapping[str, Any]] = None,
) -> List[Dict[str, Any]]:
    """Split a lesson's duration_minutes into 1-2 micro-concepts with quotas."""
    cmap = cfg.get("concept_map") or {}
    total = clamp_minutes(duration_min)
    explicit_cid = (meta or {}).get("concept_id")
    has_lab = bool((meta or {}).get("effort_lab"))
    single = (
        l_id in cmap
        or bool(explicit_cid)
        or has_lab
        or not cfg.get("split_concepts", True)
        or total < 45
    )
    if single:
        cid = to_slug(cmap.get(l_id) or explicit_cid or f"concept-{l_slug}")
        quota = allocate_concept_quota(
            total,
            track,
            skill_focus=(meta or {}).get("skill_focus"),
            recommended_quota=(meta or {}).get("recommended_quota"),
            effort_lab=(meta or {}).get("effort_lab"),
        )
        return [_attach_concept_meta({"id": cid, "title": l_title[:80], **quota}, meta)]
    m1 = total // 2
    specs = (
        (to_slug(f"c-{l_slug}-core"), f"{l_title[:66]}（核心概念）", m1),
        (to_slug(f"c-{l_slug}-apply"), f"{l_title[:66]}（综合应用）", total - m1),
    )
    return [
        {"id": cid, "title": title, **allocate_concept_quota(mins, track)}
        for cid, title, mins in specs
    ]


def resolve_syllabus_path(course_id: str, cfg: Mapping[str, Any]) -> str:
    """Locate syllabus JSON via explicit arg, courses_root, courses/, or research/."""
    if cfg.get("syllabus_file"):
        path = str(cfg["syllabus_file"])
        if not os.path.exists(path):
            raise FileNotFoundError(f"syllabus_file not found: {path}")
        return path
    candidates: List[str] = []
    if cfg.get("courses_root"):
        candidates.append(
            os.path.join(str(cfg["courses_root"]), course_id, "syllabus_180h.json")
        )
    candidates.extend(
        [
            os.path.join("courses", course_id, "syllabus_180h.json"),
            os.path.join("docs", "research", course_id, "syllabus_180h.json"),
        ]
    )
    if cfg.get("research_dir"):
        candidates.append(
            os.path.join(str(cfg["research_dir"]), "syllabus_180h.json")
        )
    for cand in candidates:
        if os.path.exists(cand):
            return cand
    raise FileNotFoundError(f"syllabus_180h.json not found for {course_id}")


def resolve_unit_target(
    meta: Mapping[str, Any],
    unit_map: Mapping[str, Any],
    existing_units: Mapping[str, Any],
) -> Tuple[str, str]:
    """Map syllabus unit_slug and unit_title to validated package unit ID/title."""
    raw_slug = str(meta.get("unit_slug") or f"unit-{meta['lesson_number']}")
    raw_title = UNIT_PREFIX_RE.sub(
        "", str(meta.get("unit_title") or raw_slug)
    ).strip()
    if raw_slug in unit_map:
        mapped = unit_map[raw_slug]
        if isinstance(mapped, Mapping):
            uid = to_slug(mapped["id"])
            title = str(mapped.get("title") or raw_title)
            return uid, title
        uid = to_slug(mapped)
        title = str(existing_units.get(uid, {}).get("title") or raw_title)
        return uid, title
    uid = to_slug(raw_slug)
    if existing_units and uid not in existing_units:
        raise ValueError(
            f"unit_slug {raw_slug!r} not in {sorted(existing_units)}; "
            f"pass unit_map"
        )
    title = str(existing_units.get(uid, {}).get("title") or raw_title)
    return uid, title


def select_syllabus_lessons(
    syllabus: Mapping[str, Any], start_lesson: int, end_lesson: int
) -> List[Dict[str, Any]]:
    """Filter lessons in [start_lesson, end_lesson] in canonical deterministic order."""
    selected = [
        dict(lesson)
        for lesson in syllabus.get("lessons", [])
        if start_lesson <= int(lesson["lesson_number"]) <= end_lesson
    ]
    selected.sort(
        key=lambda item: (int(item["lesson_number"]), str(item["lesson_id"]))
    )
    return selected


def build_lesson_ctx(
    meta: Mapping[str, Any],
    course_id: str,
    research_root: str,
    package_dir: str,
    cfg: Mapping[str, Any],
    existing_units: Mapping[str, Any],
) -> Dict[str, Any]:
    """Build pure lesson context and upfront budget without writing disk files."""
    l_id, title = str(meta["lesson_id"]), str(meta["lesson_title"]).strip()
    l_slug = to_slug(l_id)
    u_id, u_title = resolve_unit_target(meta, cfg.get("unit_map") or {}, existing_units)
    track, est = detect_track(course_id, cfg), clamp_minutes(meta.get("duration_minutes"))
    concepts = plan_lesson_concepts(l_id, l_slug, title, est, track, cfg, meta=meta)
    base = f"{research_root}/{l_id}"
    return {
        "course_id": course_id, "lesson_id": l_id, "lesson_slug": l_slug,
        "lesson_number": int(meta["lesson_number"]), "lesson_title": title,
        "unit_id": u_id, "unit_title": u_title, "estimated_minutes": est,
        "track": track, "concepts": concepts, "budget_file": f"{base}/budget_plan.json",
        "course_description": str(cfg.get("syllabus_description") or ""),
        "cefr_level": str(meta.get("cefr_level") or ""),
        "skill_focus": str(meta.get("skill_focus") or ""),
        "budget_payload": {
            "lesson_id": l_id, "duration_minutes": est,
            "track": track, "concepts": concepts,
        },
        "topics": [str(meta.get(f"topic_{i}", "")) for i in (1, 2, 3)],
        "notes": [f"{base}/topic_{i}__subagent_{i}/research_notes.md" for i in (1, 2, 3)],
        "reviews": [f"{base}/review/fact_check.md", f"{base}/review/language_precision.md"],
        "draft_path": f"{base}/lesson_draft.md", "final_path": f"{base}/lesson_final.md",
        "pkg_lesson_path": f"{package_dir}/lessons/{l_slug}.md",
        "ingest_archived": bool(cfg.get("ingest_archived", False)),
        "force_research": bool(cfg.get("force_research", False)),
        "model": str(cfg.get("model") or DEFAULT_MODEL),
        "max_revisions": int(cfg.get("max_revisions", 3)),
    }


def write_budget_plan(ctx: Mapping[str, Any]) -> None:
    """Persist budget_plan.json atomically once a lesson is scheduled to run."""
    atomic_write_json(str(ctx["budget_file"]), ctx["budget_payload"])


def build_base_manifest(
    course_id: str,
    syllabus: Mapping[str, Any],
    package_dir: str,
    cfg: Mapping[str, Any],
) -> Dict[str, Any]:
    """Load existing v2 manifest or initialize a golden-template-aligned manifest."""
    manifest_path = f"{package_dir}/course.json"
    if os.path.exists(manifest_path):
        manifest = load_json(manifest_path)
    elif cfg.get("base_manifest") and os.path.exists(str(cfg["base_manifest"])):
        manifest = load_json(str(cfg["base_manifest"]))
    else:
        title = str(
            cfg.get("target_title") or syllabus.get("course_title") or course_id
        )
        manifest = {
            "protocol_version": 2,
            "course_id": to_slug(cfg.get("target_course_id") or course_id),
            "version": str(cfg.get("version") or "2.0.0"),
            "title": title,
            "language": str(cfg.get("language") or "zh-CN"),
            "description": str(
                syllabus.get("description") or f"{title}（v2 课程包）。"
            ),
            "units": [],
        }
    manifest["protocol_version"] = 2
    manifest["version"] = str(
        cfg.get("version") or manifest.get("version") or "2.0.0"
    )
    return manifest


def existing_concept_effort(
    existing: Sequence[Mapping[str, Any]]
) -> Dict[str, float]:
    """Estimate current question-bank design minutes per concept."""
    totals: Dict[str, float] = {}
    for item in existing:
        tags = item.get("concepts") or []
        weight = DESIGN_ITEM_MINUTES.get(str(item.get("type")), 2.0) / max(
            1, len(tags)
        )
        for tag in tags:
            totals[str(tag)] = totals.get(str(tag), 0.0) + weight
    return totals


def is_lesson_done(
    prev: Mapping[str, Any],
    ctx: Mapping[str, Any],
    package_dir: str,
    cfg: Mapping[str, Any],
) -> bool:
    """Return True only when lesson passed review, effort gate, and course:check."""
    prev_pkg = prev.get("package_dir")
    same_pkg = bool(prev_pkg) and (
        os.path.normpath(str(prev_pkg)) == os.path.normpath(package_dir)
    )
    return (
        not cfg.get("force_recheck")
        and prev.get("status") == "COMPLETED"
        and prev.get("effort_audit") == "PASSED"
        and prev.get("course_check") == "PASSED"
        and same_pkg
        and has_real_content(str(ctx["pkg_lesson_path"]), 120)
    )


def group_approved_by_unit(
    approved_ctxs: Sequence[Mapping[str, Any]],
    manifest: Mapping[str, Any],
) -> Dict[str, Tuple[str, List[Dict[str, Any]]]]:
    """Group approved lessons by unit in canonical manifest + lesson_number order."""
    ordered = sorted(
        (dict(c) for c in approved_ctxs),
        key=lambda c: (int(c["lesson_number"]), str(c["lesson_slug"])),
    )
    grouped: Dict[str, Tuple[str, List[Dict[str, Any]]]] = {}
    for ctx in ordered:
        uid = str(ctx["unit_id"])
        if uid not in grouped:
            grouped[uid] = (str(ctx["unit_title"]), [])
        grouped[uid][1].append(ctx)
    existing_order = [str(u["id"]) for u in manifest.get("units", [])]
    result: Dict[str, Tuple[str, List[Dict[str, Any]]]] = {}
    for uid in existing_order:
        if uid in grouped:
            result[uid] = grouped[uid]
    for uid, pair in grouped.items():
        if uid not in result:
            result[uid] = pair
    return result


def validate_distinct_question_files(units: Sequence[Mapping[str, Any]]) -> None:
    """Raise ValueError if two manifest units target the same question_file path."""
    seen: Dict[str, str] = {}
    for unit in units:
        uid = str(unit["id"])
        qfile = str(unit.get("question_file") or f"questions/{uid}.json")
        key = os.path.normpath(qfile)
        if key in seen and seen[key] != uid:
            raise ValueError(
                f"duplicate question_file {qfile!r} across units "
                f"{seen[key]!r} and {uid!r}"
            )
        seen[key] = uid


def _ensure_unit(
    manifest: Dict[str, Any], unit_id: str, unit_title: str
) -> Dict[str, Any]:
    """Return existing unit dict or append a fresh canonical unit entry."""
    units = manifest.setdefault("units", [])
    unit = next((u for u in units if u["id"] == unit_id), None)
    if unit is None:
        unit = {
            "id": unit_id,
            "title": unit_title,
            "question_file": f"questions/{unit_id}.json",
            "lessons": [],
            "concepts": [],
        }
        units.append(unit)
    unit["question_file"] = unit.get("question_file") or f"questions/{unit_id}.json"
    return unit


def _merge_unit_entries(
    unit: Mapping[str, Any], sorted_ctxs: Sequence[Mapping[str, Any]]
) -> Tuple[List[Dict[str, Any]], List[str], Dict[str, Dict[str, Any]], List[str]]:
    """Merge sorted lessons and concepts into unit maps while preserving order."""
    lessons_by_id = {str(x["id"]): dict(x) for x in unit.get("lessons") or ()}
    ordered_cids = [str(x["id"]) for x in unit.get("concepts") or ()]
    concepts_by_id = {str(x["id"]): dict(x) for x in unit.get("concepts") or ()}
    touched: List[str] = []
    for ctx in sorted_ctxs:
        l_slug = str(ctx["lesson_slug"])
        lessons_by_id[l_slug] = {
            "id": l_slug,
            "title": str(ctx["lesson_title"]),
            "file": f"lessons/{l_slug}.md",
        }
        for cs in ctx["concepts"]:
            cid = str(cs["id"])
            summary = str(cs.get("summary") or f"掌握{cs['title']}的核心概念与应用。")
            node = concepts_by_id.get(
                cid,
                {"id": cid, "title": str(cs["title"]), "summary": summary},
            )
            if cs.get("summary"):
                node["summary"] = summary
            node["estimated_minutes"] = int(cs["estimated_minutes"])
            node["lesson"] = l_slug
            if cs.get("prerequisites"):
                node["prerequisites"] = [
                    {"all_of": list(g["all_of"])} for g in cs["prerequisites"]
                ]
            if cid not in concepts_by_id:
                ordered_cids.append(cid)
            concepts_by_id[cid] = node
            touched.append(cid)
    return list(lessons_by_id.values()), ordered_cids, concepts_by_id, touched


def upsert_unit_in_manifest(
    manifest: Dict[str, Any],
    unit_id: str,
    unit_title: str,
    approved_ctxs: Sequence[Mapping[str, Any]],
) -> Dict[str, Any]:
    """Register approved lessons/concepts deterministically without prereq cycles."""
    unit = _ensure_unit(manifest, unit_id, unit_title)
    sorted_ctxs = sorted(
        approved_ctxs,
        key=lambda c: (int(c["lesson_number"]), str(c["lesson_slug"])),
    )
    lessons, ordered_cids, concepts_by_id, touched = _merge_unit_entries(
        unit, sorted_ctxs
    )
    pos = {cid: idx for idx, cid in enumerate(ordered_cids)}
    for cid in touched:
        node = concepts_by_id[cid]
        idx = pos[cid]
        if "prerequisites" not in node and idx > 0:
            candidate = ordered_cids[idx - 1]
            if not _would_create_cycle(concepts_by_id, cid, candidate):
                node["prerequisites"] = [{"all_of": [candidate]}]
    unit["lessons"] = lessons
    unit["concepts"] = [concepts_by_id[cid] for cid in ordered_cids]
    assert_acyclic_concepts(unit["concepts"])
    return unit
