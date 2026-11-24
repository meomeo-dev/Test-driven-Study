"""Offline unit tests for language-track profiles, cross-unit DAG, vocab hook, and PATH."""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
import tempfile
import unittest
from typing import Any, Dict, List

_SCRIPTS_DIR = os.path.dirname(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
)
if _SCRIPTS_DIR not in sys.path:
    sys.path.insert(0, _SCRIPTS_DIR)

from curriculum_workflow.io_store import (  # noqa: E402
    ProgressStore,
    atomic_write_json,
    atomic_write_text,
    load_json,
    resolve_exec_env,
)
from curriculum_workflow.planning import (  # noqa: E402
    allocate_concept_quota,
    assert_acyclic_manifest,
    build_lesson_ctx,
    plan_lesson_concepts,
    upsert_unit_in_manifest,
)
from curriculum_workflow.prompts import (  # noqa: E402
    build_author_prompt,
    build_questions_prompt,
    build_research_prompt,
    build_review_prompts,
    build_vocab_author_prompt,
)
from curriculum_workflow.stages import (  # noqa: E402
    RuntimeDeps,
    author_unit_questions,
    author_unit_vocabulary,
    run_one_lesson,
)
from curriculum_workflow.tests import REPO_ROOT, SCRIPTS_DIR  # noqa: E402
from curriculum_workflow.track_profiles import (  # noqa: E402
    LANGUAGE_RESEARCH_ROLES,
    STEM_RESEARCH_ROLES,
    get_research_roles,
)


class _RecordingBackend:
    """Minimal AgentBackend test double recording prompts and applying side effects."""

    def __init__(self, handler: Any = None) -> None:
        self.calls: List[Dict[str, Any]] = []
        self._handler = handler

    def completion_instruction(self, _schema: Any) -> str:
        return "Return JSON."

    async def invoke(
        self, prompt: str, schema: Any, *, role: str, model: str
    ) -> Dict[str, Any]:
        self.calls.append({"role": role, "model": model, "prompt": prompt})
        if self._handler:
            self._handler(role, prompt)
        return {"ok": True, "summary": f"ok:{role}"}


class TestLanguageTrackProfilesAndPrompts(unittest.TestCase):
    """Tests for language-track research roles, quotas, effort-lab, and prompts."""

    def test_research_roles_split_by_track(self) -> None:
        self.assertEqual(get_research_roles("language"), LANGUAGE_RESEARCH_ROLES)
        self.assertEqual(get_research_roles("stem"), STEM_RESEARCH_ROLES)
        self.assertIn("CEFR", LANGUAGE_RESEARCH_ROLES[0][2])

    def test_skill_focus_explicit_quota_and_self_check(self) -> None:
        rd_q = allocate_concept_quota(45, "language", skill_focus="reading_comprehension")
        self.assertGreaterEqual(rd_q["question_quota"].get("reading_comprehension", 0), 2)

        explicit = allocate_concept_quota(
            60,
            "language",
            recommended_quota={
                "writing_full": 1,
                "writing_short": 1,
                "cloze": 1,
                "translation": 2,
            },
        )
        self.assertEqual(explicit["question_quota"]["writing"], 2)
        self.assertEqual(
            explicit["writing_subtypes"], {"full_essay": 1, "short_essay": 1}
        )
        self.assertGreater(explicit["planned_item_design_min"], 35.0)

        oral = allocate_concept_quota(
            40,
            "language",
            skill_focus="oral_self_check",
            effort_lab={"shadowing": 8, "mock_recordings": 12, "rubric_audit": 6},
        )
        self.assertTrue(oral["zero_item_self_check"])
        self.assertEqual(oral["question_quota"], {})
        self.assertEqual(oral["practice_design_min"], 0.0)
        self.assertEqual(oral["effort_lab"]["shadowing"], 8)

    def test_language_prompts_include_cefr_study_translation_and_effort_lab(self) -> None:
        meta = {
            "lesson_number": 5,
            "lesson_id": "oral-shopping-roleplay",
            "concept_id": "oral-shopping-roleplay",
            "unit_slug": "everyday-shopping",
            "unit_title": "第11单元：生活采购与日常消费",
            "lesson_title": "口语购物演练（自评）",
            "summary": "完成 45 秒日常口语演练。",
            "cefr_level": "A2",
            "skill_focus": "oral_self_check",
            "duration_minutes": 40,
            "topic_1": "点餐结构",
            "topic_2": "示范脚本",
            "topic_3": "核对清单",
            "effort_lab": {"shadowing": 8, "mock_recordings": 12},
        }
        ctx = build_lesson_ctx(
            meta,
            "beginner-english",
            "/tmp/res",
            "/tmp/pkg",
            {
                "track": "language",
                "split_concepts": False,
                "syllabus_description": "通用日常与职场英语",
                "unit_map": {"everyday-shopping": "everyday-shopping"},
            },
            {},
        )
        r_prompt = build_research_prompt(
            ctx, 0, "英语课程与语法专家", "CEFR 规则", "/tmp/n.md", "Done."
        )
        a_prompt = build_author_prompt(ctx, "/tmp/n.md", "Done.")
        f_prompt, l_prompt = build_review_prompts(ctx, "Done.")
        q_prompt = build_questions_prompt(
            "/tmp/pkg/questions/everyday-shopping.json",
            ctx["concepts"],
            "Done.",
            track="language",
            course_description="通用日常与职场英语",
        )
        v_prompt = build_vocab_author_prompt(
            "/tmp/pkg", "assets/vocabulary/english.json",
            "everyday-shopping", "生活采购", "/tmp/q.json", 10, "Done.",
        )
        self.assertIn("通用日常生活与现代职场", r_prompt)
        self.assertIn("<!-- effort-lab: shadowing=8, mock_recordings=12 -->", a_prompt)
        self.assertIn("事实复核员", f_prompt)
        self.assertNotIn("虚构单号/公式", f_prompt)
        self.assertIn("语言审查员", l_prompt)
        self.assertIn("study_translation", q_prompt)
        self.assertIn("design-course-vocabulary", v_prompt)


class TestManifestDagAndStages(unittest.TestCase):
    """Tests for cross-unit DAG validation, self-check skip, vocab hook, and dry-run."""

    def test_declarative_cross_unit_prereqs_and_validation(self) -> None:
        manifest: Dict[str, Any] = {
            "protocol_version": 2,
            "course_id": "demo-english",
            "version": "2.5.0",
            "units": [
                {
                    "id": "base",
                    "title": "Base",
                    "question_file": "questions/base.json",
                    "lessons": [],
                    "concepts": [
                        {"id": "c-base-a", "title": "A", "estimated_minutes": 30},
                        {"id": "c-base-b", "title": "B", "estimated_minutes": 30},
                    ],
                }
            ],
        }
        meta = {
            "lesson_number": 1,
            "lesson_id": "new-node",
            "concept_id": "new-node",
            "unit_slug": "u-new",
            "unit_title": "New",
            "lesson_title": "New Node",
            "summary": "Custom summary.",
            "duration_minutes": 45,
            "topic_1": "t1",
            "topic_2": "t2",
            "topic_3": "t3",
            "prerequisites": [{"all_of": ["c-base-a"]}, {"all_of": ["c-base-b"]}],
        }
        ctx = build_lesson_ctx(
            meta, "demo-english", "/tmp/r", "/tmp/p",
            {"track": "language", "unit_map": {"u-new": "u-new"}},
            {"base": manifest["units"][0]},
        )
        upsert_unit_in_manifest(manifest, "u-new", "New", [ctx])
        node = manifest["units"][1]["concepts"][0]
        self.assertEqual(node["summary"], "Custom summary.")
        self.assertEqual(len(node["prerequisites"]), 2)
        assert_acyclic_manifest(manifest)

        # Containing group rejected
        node["prerequisites"] = [{"all_of": ["c-base-a"]}, {"all_of": ["c-base-a", "c-base-b"]}]
        with self.assertRaises(ValueError):
            assert_acyclic_manifest(manifest)

        # Unknown prerequisite rejected
        node["prerequisites"] = [{"all_of": ["missing-id"]}]
        with self.assertRaises(ValueError):
            assert_acyclic_manifest(manifest)

    def test_self_check_skips_questions_and_vocab_hook_triggers_for_new_unit(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            pkg = tmp
            os.makedirs(f"{pkg}/questions", exist_ok=True)
            os.makedirs(f"{pkg}/assets/vocabulary", exist_ok=True)
            q_path = f"{pkg}/questions/u11.json"
            vocab_path = f"{pkg}/assets/vocabulary/english.json"
            atomic_write_json(vocab_path, [{"id": "old-1", "unit_id": "intro"}])

            def _handler(role: str, _prompt: str) -> None:
                if role.startswith("Questions-"):
                    atomic_write_json(q_path, [{"id": "u11-q1", "concepts": ["c-graded"]}])

            backend = _RecordingBackend(_handler)
            unit = {"id": "u11", "title": "Unit 11", "question_file": "questions/u11.json"}
            manifest = {"vocabulary_file": "assets/vocabulary/english.json"}
            ctxs = [
                {
                    "track": "language",
                    "course_description": "General English",
                    "pkg_lesson_path": f"{pkg}/lessons/c-graded.md",
                    "concepts": [
                        {
                            "id": "c-graded",
                            "title": "Graded",
                            "practice_design_min": 25.0,
                            "question_quota": {"listening": 1, "cloze": 1},
                            "vocab_target": 6,
                        }
                    ],
                },
                {
                    "track": "language",
                    "course_description": "General English",
                    "pkg_lesson_path": f"{pkg}/lessons/c-oral.md",
                    "concepts": [
                        {
                            "id": "c-oral",
                            "title": "Oral",
                            "practice_design_min": 0.0,
                            "question_quota": {},
                            "zero_item_self_check": True,
                            "vocab_target": 0,
                        }
                    ],
                },
            ]

            async def _exercise() -> None:
                deps = RuntimeDeps(backend=backend, validate_sem=asyncio.Semaphore(2))
                await author_unit_questions(pkg, unit, ctxs, "m", deps)
                await author_unit_vocabulary(pkg, manifest, unit, ctxs, "m", deps)

            asyncio.run(_exercise())
            self.assertEqual([c["role"] for c in backend.calls], ["Questions-u11", "Vocab-u11"])
            self.assertIn("c-graded", backend.calls[0]["prompt"])
            self.assertNotIn("c-oral", backend.calls[0]["prompt"])

    def test_run_one_lesson_reuses_promoted_final_without_reinvoking_agents(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            final_p = f"{tmp}/res/l1/lesson_final.md"
            pkg_p = f"{tmp}/pkg/lessons/l1.md"
            body = "# Approved Lesson\n\n" + ("Grounded English lesson content. " * 12)
            atomic_write_text(final_p, body)
            atomic_write_text(pkg_p, body)
            backend = _RecordingBackend()
            ctx = {
                "course_id": "beginner-english",
                "lesson_id": "l1",
                "lesson_slug": "l1",
                "lesson_number": 1,
                "unit_id": "u11",
                "force_research": False,
                "ingest_archived": False,
                "final_path": final_p,
                "pkg_lesson_path": pkg_p,
            }

            async def _run() -> Any:
                deps = RuntimeDeps(backend=backend, validate_sem=asyncio.Semaphore(1))
                return await run_one_lesson(ctx, ProgressStore(f"{tmp}/progress.json"), f"{tmp}/pkg", deps)

            out = asyncio.run(_run())
            self.assertTrue(out.approved)
            self.assertEqual(out.status, "REVIEW_APPROVED")
            self.assertEqual(backend.calls, [])

    def test_resolve_exec_env_and_dry_run_with_run_workflow_config(self) -> None:
        env = resolve_exec_env(["node", "-v"], {"PATH": "/usr/bin:/bin"})
        if os.path.isdir("/opt/homebrew/bin") or os.path.isdir("/usr/local/bin"):
            self.assertIsNotNone(env)
            assert env is not None
            self.assertTrue(
                "/opt/homebrew/bin" in env["PATH"] or "/usr/local/bin" in env["PATH"]
            )

        cli_script = os.path.join(SCRIPTS_DIR, "curriculum_batch_workflow.py")
        cfg_path = os.path.join(
            REPO_ROOT, "docs/research/beginner-english-a2-expansion/workflow-config.json"
        )
        res = subprocess.run(
            [sys.executable, cli_script, "--config", cfg_path, "--dry-run", "--json"],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(res.returncode, 0, msg=res.stderr)
        data = json.loads(res.stdout)
        self.assertTrue(data["ok"])
        lessons = data["courses"][0]["dry_run_plan"]["selected_lessons"]
        self.assertEqual(len(lessons), 30)
        self.assertEqual(sum(x["estimated_minutes"] for x in lessons), 1380)


if __name__ == "__main__":
    unittest.main()
