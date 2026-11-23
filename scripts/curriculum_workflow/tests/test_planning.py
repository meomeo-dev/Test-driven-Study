"""Offline unit tests for syllabus planning, manifest ordering, cycles, and collisions."""

from __future__ import annotations

import copy
import os
import sys
import tempfile
import unittest
from typing import Any, Dict, List

_SCRIPTS_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)

from curriculum_workflow.config import build_workflow_config  # noqa: E402
from curriculum_workflow.io_store import atomic_write_json, atomic_write_text
from curriculum_workflow.planning import (
    DESIGN_ITEM_MINUTES,
    allocate_concept_quota,
    assert_acyclic_concepts,
    build_lesson_ctx,
    clamp_minutes,
    detect_track,
    group_approved_by_unit,
    is_lesson_done,
    plan_lesson_concepts,
    resolve_syllabus_path,
    resolve_unit_target,
    select_syllabus_lessons,
    to_slug,
    upsert_unit_in_manifest,
    validate_distinct_question_files,
)


def _sample_meta(
    lesson_number: int,
    lesson_id: str,
    unit_slug: str = "unit-a",
    unit_title: str = "第 1 单元：基础",
    duration: int = 60,
) -> Dict[str, Any]:
    """Build a minimal syllabus lesson metadata dictionary."""
    return {
        "lesson_number": lesson_number,
        "lesson_id": lesson_id,
        "lesson_title": f"Lesson {lesson_number} Title",
        "unit_slug": unit_slug,
        "unit_title": unit_title,
        "duration_minutes": duration,
        "topic_1": "Topic 1",
        "topic_2": "Topic 2",
        "topic_3": "Topic 3",
    }


def _make_ctxs(
    metas: List[Dict[str, Any]],
    root: str,
    existing_units: Dict[str, Any],
    cfg: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """Build pure lesson contexts for a list of syllabus metadata entries."""
    return [
        build_lesson_ctx(
            meta, "demo-english", f"{root}/res", f"{root}/pkg", cfg, existing_units
        )
        for meta in metas
    ]


class TestSlugClampTrackQuota(unittest.TestCase):
    """Tests for slug normalization, minute clamping, track detection, and quotas."""

    def test_to_slug_normalizes_and_rejects_empty(self) -> None:
        self.assertEqual(to_slug("  Lesson_01: Intro! "), "lesson-01-intro")
        self.assertEqual(to_slug("a" * 80, max_len=10), "a" * 10)
        self.assertEqual(to_slug("abc-def-ghi", max_len=4), "abc")
        with self.assertRaises(ValueError):
            to_slug("   ")
        with self.assertRaises(ValueError):
            to_slug("纯中文无字母")

    def test_clamp_minutes_bounds_and_fallbacks(self) -> None:
        self.assertEqual(clamp_minutes(-5), 1)
        self.assertEqual(clamp_minutes(0), 1)
        self.assertEqual(clamp_minutes(45), 45)
        self.assertEqual(clamp_minutes("90"), 90)
        self.assertEqual(clamp_minutes(999), 600)
        self.assertEqual(clamp_minutes(None, default=30), 30)
        self.assertEqual(clamp_minutes("bad", default=900), 600)

    def test_detect_track_explicit_and_inferred(self) -> None:
        self.assertEqual(detect_track("math-101", {"track": "language"}), "language")
        self.assertEqual(detect_track("beginner-english", {"track": "stem"}), "stem")
        self.assertEqual(detect_track("beginner-english", {}), "language")
        self.assertEqual(detect_track("elementary-chinese", {}), "language")
        self.assertEqual(detect_track("physics-lab", {}), "stem")

    def test_allocate_concept_quota_language_and_stem(self) -> None:
        lang_short = allocate_concept_quota(20, "language")
        self.assertIn("cloze", lang_short["question_quota"])
        self.assertNotIn("listening", lang_short["question_quota"])
        self.assertGreaterEqual(sum(lang_short["question_quota"].values()), 3)

        lang_long = allocate_concept_quota(60, "language")
        for qt in ("listening", "cloze", "translation", "writing"):
            self.assertIn(qt, lang_long["question_quota"])
        covered = sum(
            DESIGN_ITEM_MINUTES[k] * v for k, v in lang_long["question_quota"].items()
        )
        self.assertGreaterEqual(covered, lang_long["practice_design_min"])
        self.assertGreaterEqual(lang_long["target_read_units"], 550)

        stem_long = allocate_concept_quota(50, "stem")
        self.assertEqual(stem_long["question_quota"]["numeric"], 2)
        self.assertIn("reading_comprehension", stem_long["question_quota"])

    def test_plan_lesson_concepts_split_single_and_mapped(self) -> None:
        split = plan_lesson_concepts(
            "L01", "l01", "Foundations", 60, "language", {"split_concepts": True}
        )
        self.assertEqual([c["id"] for c in split], ["c-l01-core", "c-l01-apply"])
        self.assertEqual(sum(c["estimated_minutes"] for c in split), 60)

        short = plan_lesson_concepts(
            "L02", "l02", "Short", 30, "stem", {"split_concepts": True}
        )
        self.assertEqual([c["id"] for c in short], ["concept-l02"])

        no_split = plan_lesson_concepts(
            "L03", "l03", "Single", 60, "stem", {"split_concepts": False}
        )
        self.assertEqual([c["id"] for c in no_split], ["concept-l03"])

        mapped = plan_lesson_concepts(
            "L04", "l04", "Mapped", 60, "stem", {"concept_map": {"L04": "Custom_ID"}}
        )
        self.assertEqual([c["id"] for c in mapped], ["custom-id"])


class TestSyllabusAndUnitMapping(unittest.TestCase):
    """Tests for unit_map, syllabus lookup, ordering, purity, and resume checks."""

    def test_resolve_unit_target_mappings_and_errors(self) -> None:
        meta = _sample_meta(1, "L01", "raw-unit", "第 2 单元：进阶表达")
        existing = {"u-core": {"id": "u-core", "title": "Core Unit"}}

        uid, title = resolve_unit_target(meta, {"raw-unit": "u-core"}, existing)
        self.assertEqual((uid, title), ("u-core", "Core Unit"))

        uid2, title2 = resolve_unit_target(
            meta, {"raw-unit": {"id": "U_Custom", "title": "Custom Title"}}, existing
        )
        self.assertEqual((uid2, title2), ("u-custom", "Custom Title"))

        uid3, title3 = resolve_unit_target(meta, {}, {})
        self.assertEqual((uid3, title3), ("raw-unit", "进阶表达"))

        with self.assertRaises(ValueError):
            resolve_unit_target(meta, {}, existing)

    def test_resolve_syllabus_path_and_missing(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            explicit = os.path.join(tmp, "explicit.json")
            atomic_write_json(explicit, {"lessons": []})
            self.assertEqual(
                resolve_syllabus_path("c1", {"syllabus_file": explicit}), explicit
            )
            courses_root = os.path.join(tmp, "courses")
            by_root = os.path.join(courses_root, "c2", "syllabus_180h.json")
            atomic_write_json(by_root, {"lessons": []})
            self.assertEqual(
                resolve_syllabus_path("c2", {"courses_root": courses_root}), by_root
            )
            with self.assertRaises(FileNotFoundError):
                resolve_syllabus_path("missing", {"syllabus_file": f"{tmp}/nope.json"})

    def test_select_syllabus_lessons_sorts_canonically(self) -> None:
        syllabus = {
            "lessons": [
                _sample_meta(3, "L03"),
                _sample_meta(1, "L01-b"),
                _sample_meta(1, "L01-a"),
                _sample_meta(2, "L02"),
                _sample_meta(5, "L05"),
            ]
        }
        selected = select_syllabus_lessons(syllabus, 1, 3)
        self.assertEqual(
            [x["lesson_id"] for x in selected], ["L01-a", "L01-b", "L02", "L03"]
        )

    def test_build_lesson_ctx_is_pure_and_is_lesson_done(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            pkg = os.path.join(tmp, "pkg")
            res = os.path.join(tmp, "res")
            ctx = build_lesson_ctx(
                _sample_meta(1, "L01"), "demo-english", res, pkg, {}, {}
            )
            self.assertFalse(os.path.exists(ctx["budget_file"]))
            prev = {
                "status": "COMPLETED",
                "effort_audit": "PASSED",
                "course_check": "PASSED",
                "package_dir": pkg,
            }
            self.assertFalse(is_lesson_done(prev, ctx, pkg, {}))
            atomic_write_text(ctx["pkg_lesson_path"], "substantive content " * 20)
            self.assertTrue(is_lesson_done(prev, ctx, pkg, {}))
            self.assertFalse(is_lesson_done(prev, ctx, pkg, {"force_recheck": True}))
            self.assertFalse(is_lesson_done(prev, ctx, f"{tmp}/other", {}))


class TestManifestOrderingCyclesAndCollisions(unittest.TestCase):
    """Tests for deterministic ordering, cycle-safe re-runs, and collision checks."""

    def test_canonical_ordering_independent_of_completion_order(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            metas = [
                _sample_meta(1, "L01", "unit-a", "Unit A", 40),
                _sample_meta(2, "L02", "unit-b", "Unit B", 40),
                _sample_meta(3, "L03", "unit-a", "Unit A", 40),
            ]
            ctxs = _make_ctxs(metas, tmp, {}, {"split_concepts": False})
            m_seq: Dict[str, Any] = {
                "units": [
                    {"id": "unit-b", "title": "Unit B", "lessons": [], "concepts": []}
                ]
            }
            m_rev = copy.deepcopy(m_seq)

            for manifest, order in ((m_seq, ctxs), (m_rev, list(reversed(ctxs)))):
                grouped = group_approved_by_unit(order, manifest)
                self.assertEqual(list(grouped.keys()), ["unit-b", "unit-a"])
                for uid, (utitle, uctxs) in grouped.items():
                    upsert_unit_in_manifest(manifest, uid, utitle, uctxs)
            self.assertEqual(m_seq, m_rev)
            unit_a = next(u for u in m_seq["units"] if u["id"] == "unit-a")
            self.assertEqual([x["id"] for x in unit_a["lessons"]], ["l01", "l03"])
            self.assertEqual(
                [c["id"] for c in unit_a["concepts"]], ["concept-l01", "concept-l03"]
            )
            self.assertNotIn("prerequisites", unit_a["concepts"][0])
            self.assertEqual(
                unit_a["concepts"][1]["prerequisites"], [{"all_of": ["concept-l01"]}]
            )

    def test_idempotent_rerun_no_prerequisite_cycles(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            metas = [
                _sample_meta(1, "L01", "unit-a", "Unit A", 30),
                _sample_meta(2, "L02", "unit-a", "Unit A", 30),
                _sample_meta(3, "L03", "unit-a", "Unit A", 30),
            ]
            ctxs = _make_ctxs(metas, tmp, {}, {"split_concepts": False})
            manifest: Dict[str, Any] = {"units": []}
            upsert_unit_in_manifest(manifest, "unit-a", "Unit A", ctxs)
            snapshot = copy.deepcopy(manifest)

            # Re-run ONLY lesson 1 in an already populated unit (old bug site).
            upsert_unit_in_manifest(manifest, "unit-a", "Unit A", [ctxs[0]])
            self.assertEqual(manifest, snapshot)
            unit_a = manifest["units"][0]
            self.assertNotIn("prerequisites", unit_a["concepts"][0])
            assert_acyclic_concepts(unit_a["concepts"])

            # Re-run all lessons in reverse order -> identical, still acyclic.
            upsert_unit_in_manifest(manifest, "unit-a", "Unit A", list(reversed(ctxs)))
            self.assertEqual(manifest, snapshot)

    def test_cycle_detection_and_reverse_existing_prereq_safety(self) -> None:
        with self.assertRaises(ValueError):
            assert_acyclic_concepts([{"id": "a", "prerequisites": ["a"]}])
        with self.assertRaises(ValueError):
            assert_acyclic_concepts([
                {"id": "a", "prerequisites": [{"all_of": ["b"]}]},
                {"id": "b", "prerequisites": [{"any_of": ["a"]}]},
            ])
        with self.assertRaises(ValueError):
            assert_acyclic_concepts([
                {"id": "a", "prerequisites": ["b"]},
                {"id": "b", "prerequisites": ["c"]},
                {"id": "c", "prerequisites": ["a"]},
            ])
        # Existing manifest where c1 depends on c2; touching c2 must not link c2 -> c1.
        with tempfile.TemporaryDirectory() as tmp:
            ctx2 = build_lesson_ctx(
                _sample_meta(2, "L02", "unit-a", "Unit A", 30),
                "demo", f"{tmp}/res", f"{tmp}/pkg", {"split_concepts": False}, {},
            )
            manifest = {
                "units": [
                    {
                        "id": "unit-a",
                        "title": "Unit A",
                        "lessons": [],
                        "concepts": [
                            {"id": "c1", "prerequisites": [{"all_of": ["concept-l02"]}]},
                            {"id": "concept-l02"},
                        ],
                    }
                ]
            }
            unit = upsert_unit_in_manifest(manifest, "unit-a", "Unit A", [ctx2])
            self.assertNotIn("prerequisites", unit["concepts"][1])
            assert_acyclic_concepts(unit["concepts"])

    def test_rejects_duplicate_package_dir_and_course_ids(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                build_workflow_config(
                    file_config={"courses": ["dup", "dup"]}, env={}
                )
            with self.assertRaises(ValueError):
                build_workflow_config(
                    file_config={
                        "courses": ["course-a", "course-b"],
                        "package_dir": f"{tmp}/shared-pkg",
                    },
                    env={},
                )
            with self.assertRaises(ValueError):
                build_workflow_config(
                    file_config={
                        "courses": ["course-a", "course_a"],
                        "course_overrides": {
                            "course-a": {"research_dir": f"{tmp}/r1"},
                            "course_a": {"research_dir": f"{tmp}/r2"},
                        },
                    },
                    env={},
                )

    def test_rejects_duplicate_research_dir_and_syllabus_file(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaises(ValueError):
                build_workflow_config(
                    file_config={
                        "courses": ["c1", "c2"],
                        "research_dir": f"{tmp}/shared-res",
                        "course_overrides": {
                            "c1": {"package_dir": f"{tmp}/p1"},
                            "c2": {"package_dir": f"{tmp}/p2"},
                        },
                    },
                    env={},
                )
            with self.assertRaises(ValueError):
                build_workflow_config(
                    file_config={
                        "courses": ["c1", "c2"],
                        "syllabus_file": f"{tmp}/same.json",
                    },
                    env={},
                )

    def test_rejects_duplicate_question_files(self) -> None:
        validate_distinct_question_files([
            {"id": "u1", "question_file": "questions/u1.json"},
            {"id": "u2", "question_file": "questions/u2.json"},
        ])
        with self.assertRaises(ValueError):
            validate_distinct_question_files([
                {"id": "u1", "question_file": "questions/shared.json"},
                {"id": "u2", "question_file": "./questions/shared.json"},
            ])


if __name__ == "__main__":
    unittest.main()
