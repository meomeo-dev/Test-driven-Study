"""Pure prompt builders aligned with design-course-package, tts, and vocabulary."""

from __future__ import annotations

import json
from typing import Any, Mapping, Sequence, Tuple

from .io_store import NO_DATA_MARKER

RESEARCH_ROLES: Tuple[Tuple[str, str, str], ...] = (
    ("R1", "资深技术研究员", "权威标准与核心规则"),
    ("R2", "现场应用工程师", "真实参数与操作规范"),
    ("R3", "教学评估专家", "常见误区与练习设计"),
)


def build_research_prompt(
    ctx: Mapping[str, Any],
    idx: int,
    role_zh: str,
    focus: str,
    note_path: str,
    completion_instruction: str,
) -> str:
    """Build research prompt for one R1-R3 specialist subagent."""
    return (
        f"你是{role_zh}。针对【{ctx['course_id']}】第{ctx['lesson_number']}讲"
        f"「{ctx['lesson_title']}」调研：\n"
        f"主题：{ctx['topics'][idx]}\n"
        f"侧重：{focus}。使用 search_web，严禁编造或写 `{NO_DATA_MARKER}`，"
        f"写入 `{note_path}`。\n"
        f"{completion_instruction}"
    )


def build_author_prompt(
    ctx: Mapping[str, Any],
    sources: str,
    completion_instruction: str,
) -> str:
    """Build lesson synthesis prompt meeting concept anchor and reading budgets."""
    sec_spec = [
        {
            "id": c["id"],
            "title": c["title"],
            "min_read_units": c["target_read_units"],
            "min_examples": c["min_examples"],
        }
        for c in ctx["concepts"]
    ]
    spec_json = json.dumps(sec_spec, ensure_ascii=False, indent=2)
    return (
        f"你是课程讲义主笔。请基于 `{sources}`，参照 "
        f"`.agents/skills/design-course-package/SKILL.md`，撰写第"
        f"{ctx['lesson_number']}讲（总预算 {ctx['estimated_minutes']} 分钟）至 "
        f"`{ctx['draft_path']}`：\n"
        f"1. 一级标题 `# {ctx['lesson_title']}`。\n"
        f"2. 为下列每个知识点写 `## <title>` 小节并在标题下一行加 "
        f"`<!-- concepts: <id> -->` 锚点：\n"
        f"{spec_json}\n"
        f"3. 每节等效阅读量（中文字数 + 3×英文词数）须达 `min_read_units`，"
        f"含 `### 例题` 与 `### 常见错误`，严禁 `{NO_DATA_MARKER}`。\n"
        f"{completion_instruction}"
    )


def build_review_prompts(
    ctx: Mapping[str, Any], completion_instruction: str
) -> Tuple[str, str]:
    """Construct Fact Check and Language Precision reviewer prompts."""
    req = json.dumps(
        [
            {"id": c["id"], "min_read_units": c["target_read_units"]}
            for c in ctx["concepts"]
        ],
        ensure_ascii=False,
    )
    fact_prompt = (
        f"你是事实复核员。核查 `{ctx['draft_path']}` 准确性，确认无 "
        f"`{NO_DATA_MARKER}` 及虚构单号/公式，核对每个知识点小节都有 "
        f"`<!-- concepts: <id> -->` 锚点且等效阅读量（中文字数 + 3×英文词数）"
        f"达标（{req}）。写报告至 `{ctx['reviews'][0]}`。\n"
        f"{completion_instruction}"
    )
    lang_prompt = (
        f"你是语言审查员。审查 `{ctx['draft_path']}` 术语准确性、"
        f"Markdown 清晰度及教学可读性，写报告至 `{ctx['reviews'][1]}`。\n"
        f"{completion_instruction}"
    )
    return fact_prompt, lang_prompt


def build_revise_prompt(
    ctx: Mapping[str, Any],
    blocking: Sequence[str],
    instructions: Sequence[str],
    completion_instruction: str,
) -> str:
    """Build revision prompt applying reviewer blocking fixes to lesson_draft.md."""
    blk_json = json.dumps(list(blocking), ensure_ascii=False)
    ins_json = json.dumps(list(instructions), ensure_ascii=False)
    return (
        f"按审查阻断项修改 `{ctx['draft_path']}`：\n"
        f"阻断：{blk_json}\n"
        f"指令：{ins_json}\n"
        f"保留全部 `<!-- concepts: ... -->` 锚点并消除 `{NO_DATA_MARKER}` "
        f"后覆写 `{ctx['draft_path']}`。\n"
        f"{completion_instruction}"
    )


def build_questions_prompt(
    q_path: str,
    specs: Sequence[Mapping[str, Any]],
    completion_instruction: str,
) -> str:
    """Build v2 question-authoring prompt enforcing quotas, schemas, and TTS rules."""
    specs_json = json.dumps(list(specs), ensure_ascii=False, indent=2)
    return (
        f"你是 v2 题库作者。请阅读 `{q_path}`（非空保留原题并追加），按 "
        f"`.agents/skills/design-course-package/SKILL.md`、"
        f"`contracts/course/v2/items.schema.json`、"
        f"`courses/golden-course-template/questions/extended-practice.json` 与 "
        f"`.agents/skills/design-course-tts/SKILL.md`，\n"
        f"严格按下列每个知识点的分题型配额 `question_quota` 与 "
        f"`practice_design_min` 命题并写入 `{q_path}`：\n"
        f"{specs_json}\n"
        f"1. 每题含唯一 id、`chapter`（用知识点 title）与 "
        f"`concepts: [concept_id]`；严禁用轻量单选替代重题型配额。\n"
        f"2. `true_false` 须用 `grading.value` + `analysis`；`numeric` 须含 "
        f"`value` + `absolute_tolerance`；解析禁用 `选项 a/b/c/d`。\n"
        f"3. 英文 TTS 严禁 `tts: true`、中英混杂切片、首尾空白/引号、裸大写/"
        f"冒号时刻（需写 `tts.text`）；纯中文不加英文 TTS；阅读/听力按需配齐 "
        f"`study_translation`。\n"
        f"{completion_instruction}"
    )


def build_tts_repair_prompt(
    package_dir: str, audit_output: str, completion_instruction: str
) -> str:
    """Build repair prompt for audit-course-tts.mjs failures."""
    return (
        f"按 `.agents/skills/design-course-tts/SKILL.md` 修复 "
        f"`{package_dir}` 题库或词表中的语音设计问题：\n{audit_output}\n"
        f"{completion_instruction}"
    )


def build_vocab_repair_prompt(
    package_dir: str,
    vocab_file: str,
    audit_output: str,
    completion_instruction: str,
) -> str:
    """Build repair prompt for audit-course-vocabulary.mjs --strict failures."""
    return (
        f"按 `.agents/skills/design-course-vocabulary/SKILL.md` 与 "
        f"`.agents/skills/design-course-tts/SKILL.md` 修复 "
        f"`{package_dir}/{vocab_file}` 生词本审计问题（仅 `word` 词条配 `pos`，"
        f"按需写极简中文 `grammar_note`，保持双语例句与 `question_ids` 覆盖）：\n"
        f"{audit_output}\n{completion_instruction}"
    )


def build_effort_repair_prompt(
    package_dir: str, audit_output: str, completion_instruction: str
) -> str:
    """Build repair prompt for audit-course-effort.mjs failures."""
    return (
        f"按 `.agents/skills/design-course-package/SKILL.md` 扩充 "
        f"`{package_dir}` 欠载的讲义小节或题型密度以通过课时门：\n{audit_output}\n"
        f"{completion_instruction}"
    )
