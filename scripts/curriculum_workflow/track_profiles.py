"""Track-specific research roles, skill-focused v2 quotas, and self-check budgets."""

from __future__ import annotations

from typing import Any, Dict, List, Mapping, Optional, Tuple

DESIGN_ITEM_MINUTES: Dict[str, float] = {
    "listening": 5.0,
    "reading_comprehension": 5.0,
    "cloze": 3.5,
    "translation": 3.2,
    "writing": 5.5,
    "writing_sentence": 4.8,
    "writing_short": 10.2,
    "writing_full": 19.1,
    "numeric": 2.6,
    "multiple_choice": 2.3,
    "single_choice": 2.0,
    "true_false": 1.5,
}

STEM_RESEARCH_ROLES: Tuple[Tuple[str, str, str], ...] = (
    ("R1", "资深技术研究员", "权威标准与核心规则"),
    ("R2", "现场应用工程师", "真实参数与操作规范"),
    ("R3", "教学评估专家", "常见误区与练习设计"),
)

LANGUAGE_RESEARCH_ROLES: Tuple[Tuple[str, str, str], ...] = (
    ("R1", "英语课程与语法专家", "CEFR A1-A2 语法规则、核心句型结构与语用规范"),
    ("R2", "日常与职场语料编纂师", "真实生活与办公高频情景对话、实用词块与地道例句"),
    ("R3", "语言测评与纠偏专家", "中文母语常见负迁移错误、易混辨析与听说读写练习设计"),
)

_WRITING_ALIAS_MAP: Dict[str, str] = {
    "writing_sentence": "sentence_making",
    "writing_short": "short_essay",
    "writing_full": "full_essay",
}

_LANGUAGE_SKILL_HEAVY: Dict[str, List[Tuple[str, int]]] = {
    "grammar_core": [
        ("listening", 1),
        ("reading_comprehension", 1),
        ("cloze", 1),
        ("translation", 1),
        ("writing_sentence", 1),
    ],
    "listening_speaking": [
        ("listening", 2),
        ("cloze", 1),
        ("translation", 2),
    ],
    "reading_comprehension": [
        ("reading_comprehension", 2),
        ("cloze", 1),
        ("translation", 1),
    ],
    "writing_application": [
        ("writing_short", 1),
        ("writing_sentence", 1),
        ("cloze", 1),
        ("translation", 1),
    ],
}


def get_research_roles(track: str) -> Tuple[Tuple[str, str, str], ...]:
    """Return domain-aligned R1-R3 specialist roles for language or stem tracks."""
    return LANGUAGE_RESEARCH_ROLES if track == "language" else STEM_RESEARCH_ROLES


def _normalize_effort_lab(raw: Optional[Mapping[str, Any]]) -> Dict[str, int]:
    """Filter positive integer step durations for a zero-item self-check concept."""
    if not isinstance(raw, Mapping):
        return {}
    out: Dict[str, int] = {}
    for key, val in raw.items():
        try:
            mins = int(val)
        except (TypeError, ValueError):
            continue
        if mins > 0:
            out[str(key).strip()] = mins
    return out


def _build_self_check_quota(est_min: int, lab: Dict[str, int]) -> Dict[str, Any]:
    """Allocate lecture reading and anchored effort-lab minutes for a 0-item concept."""
    lab_sum = sum(lab.values())
    lec_min = round(max(6.0, est_min - lab_sum), 1)
    read_units = max(550, int((lec_min / 1.8) * 250))
    return {
        "estimated_minutes": est_min,
        "lecture_design_min": lec_min,
        "practice_design_min": 0.0,
        "planned_item_design_min": 0.0,
        "target_read_units": read_units,
        "min_examples": 2,
        "question_quota": {},
        "zero_item_self_check": True,
        "effort_lab": lab,
    }


def _normalize_explicit_quota(
    raw: Mapping[str, Any],
) -> Tuple[Dict[str, int], Dict[str, int], float]:
    """Fold writing subtype aliases into canonical v2 types plus subtype breakdown."""
    quota: Dict[str, int] = {}
    writing_subtypes: Dict[str, int] = {}
    covered = 0.0
    for raw_key, raw_cnt in raw.items():
        key = str(raw_key).strip()
        cnt = int(raw_cnt)
        if cnt <= 0:
            continue
        weight = DESIGN_ITEM_MINUTES.get(key, 2.0)
        covered += weight * cnt
        if key in _WRITING_ALIAS_MAP:
            sub = _WRITING_ALIAS_MAP[key]
            writing_subtypes[sub] = writing_subtypes.get(sub, 0) + cnt
            quota["writing"] = quota.get("writing", 0) + cnt
        else:
            quota[key] = quota.get(key, 0) + cnt
    return quota, writing_subtypes, covered


def _default_heavy_quota(
    est_min: int, track: str, skill_focus: Optional[str]
) -> List[Tuple[str, int]]:
    """Select seed heavy v2 question types for a graded concept."""
    if track == "language" and skill_focus in _LANGUAGE_SKILL_HEAVY:
        return list(_LANGUAGE_SKILL_HEAVY[skill_focus])
    if track == "language":
        heavy = (
            [("listening", 1), ("cloze", 1), ("translation", 1)]
            if est_min >= 25
            else [("cloze", 1)]
        )
        if est_min >= 45:
            heavy.append(("writing", 1))
        return heavy
    heavy = [("numeric", 2), ("cloze", 1)]
    if est_min >= 45:
        heavy.append(("reading_comprehension", 1))
    return heavy


def allocate_concept_quota(
    est_min: int,
    track: str,
    *,
    skill_focus: Optional[str] = None,
    recommended_quota: Optional[Mapping[str, Any]] = None,
    effort_lab: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    """Decompose concept estimated_minutes into lecture effort and typed v2 quotas."""
    lab = _normalize_effort_lab(effort_lab)
    if lab or skill_focus == "oral_self_check":
        if not lab:
            lab_total = max(10, int(round(est_min * 0.8)))
            lab = {"shadowing": lab_total // 4, "practice": lab_total - lab_total // 4}
        return _build_self_check_quota(est_min, lab)

    lec_min = round(est_min * 0.35, 1)
    prac_min = round(est_min - lec_min, 1)
    read_equiv_units = max(550, int((lec_min / 1.8) * 250))

    if isinstance(recommended_quota, Mapping) and recommended_quota:
        quota, writing_subtypes, covered = _normalize_explicit_quota(recommended_quota)
    else:
        heavy = _default_heavy_quota(est_min, track, skill_focus)
        quota, writing_subtypes, covered = _normalize_explicit_quota(dict(heavy))
        cycle = ("single_choice", "multiple_choice", "true_false")
        idx = 0
        while covered < prac_min or sum(quota.values()) < 3:
            qt = cycle[idx % len(cycle)]
            quota[qt] = quota.get(qt, 0) + 1
            covered += DESIGN_ITEM_MINUTES[qt]
            idx += 1

    result: Dict[str, Any] = {
        "estimated_minutes": est_min,
        "lecture_design_min": lec_min,
        "practice_design_min": prac_min,
        "planned_item_design_min": round(covered, 1),
        "target_read_units": read_equiv_units,
        "min_examples": max(1, est_min // 15),
        "question_quota": quota,
    }
    if writing_subtypes:
        result["writing_subtypes"] = writing_subtypes
    return result
