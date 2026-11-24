"""Pure prompt builders aligned with design-course-package, tts, and vocabulary."""

from __future__ import annotations

import json
from typing import Any, Dict, Mapping, Sequence, Tuple

from .io_store import NO_DATA_MARKER
from .track_profiles import STEM_RESEARCH_ROLES

RESEARCH_ROLES: Tuple[Tuple[str, str, str], ...] = STEM_RESEARCH_ROLES


def _format_effort_lab_anchor(lab: Mapping[str, int]) -> str:
    """Render an effort-lab HTML comment anchor from step duration pairs."""
    pairs = ", ".join(f"{k}={v}" for k, v in lab.items())
    return f"<!-- effort-lab: {pairs} -->"


def _theme_hint(ctx: Mapping[str, Any]) -> str:
    """Build optional course-level thematic scope line for language prompts."""
    desc = str(ctx.get("course_description") or "").strip()
    cefr = str(ctx.get("cefr_level") or "").strip()
    parts = [p for p in (f"目标级别：{cefr}" if cefr else "", desc) if p]
    return f"语境要求：{'；'.join(parts)}\n" if parts else ""


def build_research_prompt(
    ctx: Mapping[str, Any],
    idx: int,
    role_zh: str,
    focus: str,
    note_path: str,
    completion_instruction: str,
) -> str:
    """Build research prompt for one R1-R3 specialist subagent."""
    if ctx.get("track") == "language":
        return (
            f"你是{role_zh}。针对【{ctx['course_id']}】第{ctx['lesson_number']}讲"
            f"「{ctx['lesson_title']}」整理教学语料与语法笔记：\n"
            f"{_theme_hint(ctx)}"
            f"主题：{ctx['topics'][idx]}\n"
            f"侧重：{focus}。场景面向通用日常生活与现代职场（避免车间/工位术语），"
            f"必要时可用 search_web 核对地道搭配，严禁编造或写 `{NO_DATA_MARKER}`，"
            f"写入 `{note_path}`。\n"
            f"{completion_instruction}"
        )
    return (
        f"你是{role_zh}。针对【{ctx['course_id']}】第{ctx['lesson_number']}讲"
        f"「{ctx['lesson_title']}」调研：\n"
        f"主题：{ctx['topics'][idx]}\n"
        f"侧重：{focus}。使用 search_web，严禁编造或写 `{NO_DATA_MARKER}`，"
        f"写入 `{note_path}`。\n"
        f"{completion_instruction}"
    )


def _author_section_spec(ctx: Mapping[str, Any]) -> str:
    """Serialize per-concept author requirements including optional effort-lab."""
    rows = []
    for c in ctx["concepts"]:
        item: Dict[str, Any] = {
            "id": c["id"],
            "title": c["title"],
            "min_read_units": c["target_read_units"],
            "min_examples": c["min_examples"],
        }
        if c.get("effort_lab"):
            item["effort_lab_anchor"] = _format_effort_lab_anchor(c["effort_lab"])
        rows.append(item)
    return json.dumps(rows, ensure_ascii=False, indent=2)


def build_author_prompt(
    ctx: Mapping[str, Any],
    sources: str,
    completion_instruction: str,
) -> str:
    """Build lesson synthesis prompt meeting concept anchor and reading budgets."""
    spec_json = _author_section_spec(ctx)
    has_lab = any(c.get("effort_lab") for c in ctx["concepts"])
    if ctx.get("track") == "language":
        lab_rule = (
            "4. 零题口语自评小节须在 `<!-- concepts: <id> -->` 下方写入对应的 "
            "`effort_lab_anchor` 注释，并给出 >= 4 条编号实操步骤（`1.`..`4.`）"
            "与 >= 5 条 `-` 自评核对清单，以及两套完整口语示范脚本。\n"
            if has_lab
            else ""
        )
        return (
            f"你是英语课程讲义主笔。请基于 `{sources}`，参照 "
            f"`.agents/skills/design-course-package/SKILL.md`，撰写第"
            f"{ctx['lesson_number']}讲（总预算 {ctx['estimated_minutes']} 分钟）至 "
            f"`{ctx['draft_path']}`：\n"
            f"{_theme_hint(ctx)}"
            f"1. 一级标题 `# {ctx['lesson_title']}`；语境面向通用日常生活与职场沟通"
            f"（不引入车间/工厂术语）。\n"
            f"2. 为下列每个知识点写 `## <title>` 小节并在标题下一行加 "
            f"`<!-- concepts: <id> -->` 锚点：\n{spec_json}\n"
            f"3. 每节包含核心规则/句型表、自然双语情景对话、至少 `min_examples` 道"
            f" `### 例题` 与 `### 常见错误`（覆盖中文母语负迁移）；等效阅读量"
            f"（中文字数 + 3×英文词数）须达 `min_read_units`，严禁 `{NO_DATA_MARKER}`。\n"
            f"{lab_rule}{completion_instruction}"
        )
    return (
        f"你是课程讲义主笔。请基于 `{sources}`，参照 "
        f"`.agents/skills/design-course-package/SKILL.md`，撰写第"
        f"{ctx['lesson_number']}讲（总预算 {ctx['estimated_minutes']} 分钟）至 "
        f"`{ctx['draft_path']}`：\n"
        f"1. 一级标题 `# {ctx['lesson_title']}`。\n"
        f"2. 为下列每个知识点写 `## <title>` 小节并在标题下一行加 "
        f"`<!-- concepts: <id> -->` 锚点：\n{spec_json}\n"
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
            {
                "id": c["id"],
                "min_read_units": c["target_read_units"],
                **(
                    {"effort_lab_anchor": _format_effort_lab_anchor(c["effort_lab"])}
                    if c.get("effort_lab")
                    else {}
                ),
            }
            for c in ctx["concepts"]
        ],
        ensure_ascii=False,
    )
    if ctx.get("track") == "language":
        fact_prompt = (
            f"你是事实复核员。核查 `{ctx['draft_path']}` 的英语语法准确性、"
            f"CEFR 级别适配与例句地道度，确认无 `{NO_DATA_MARKER}`、无自相矛盾解释，"
            f"核对每个知识点小节都有 `<!-- concepts: <id> -->`（若需自评还须有 "
            f"`effort-lab` 锚点与编号步骤+清单）且等效阅读量（中文字数 + 3×英文词数）"
            f"达标（{req}）。写报告至 `{ctx['reviews'][0]}`。\n"
            f"{completion_instruction}"
        )
        lang_prompt = (
            f"你是语言审查员。审查 `{ctx['draft_path']}` 的英文对话自然度、"
            f"通用日常/职场语境一致性（无无关车间术语混入）、中文讲解清晰度及 "
            f"Markdown 结构可读性，写报告至 `{ctx['reviews'][1]}`。\n"
            f"{completion_instruction}"
        )
        return fact_prompt, lang_prompt
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
        f"保留全部 `<!-- concepts: ... -->` 与 `<!-- effort-lab: ... -->` 锚点并消除 "
        f"`{NO_DATA_MARKER}` 后覆写 `{ctx['draft_path']}`。\n"
        f"{completion_instruction}"
    )


def build_questions_prompt(
    q_path: str,
    specs: Sequence[Mapping[str, Any]],
    completion_instruction: str,
    *,
    track: str = "language",
    course_description: str = "",
) -> str:
    """Build v2 question-authoring prompt enforcing quotas, schemas, and TTS rules."""
    specs_json = json.dumps(list(specs), ensure_ascii=False, indent=2)
    extra_lang = ""
    if track == "language":
        theme_line = f"语境要求：{course_description}\n" if course_description else ""
        extra_lang = (
            f"{theme_line}"
            "4. 严格按 `writing_subtypes`（若有）设置 `writing.subtype`："
            "`sentence_making` 用字符串 `sample_response` + `sample_response_tts`；"
            "`short_essay`/`full_essay` 多段范文用 `ContentSegment[]` 按段配 `tts` "
            "并以 `\\n\\n` 分隔，且省略 `sample_response_tts`。\n"
            "5. 所有 `reading_comprehension` 与 `listening` 必须配齐 `study_translation`："
            "`material` 数组长度严格等于非空 `passage` 段数或 `transcript` 行数，"
            "英文小题与选项按原 ID 填入 `sub_questions` 译文映射；`listening` "
            "`dialogue` 用 `voice_male: \"tide\"` + `voice_female: \"stella\"`，"
            "父级 `listening.stem` 禁止 `tts`，`cloze.passage` 禁止内联 `tts` "
            "且必配填入完整句的 `passage_tts`。\n"
            "6. 遵循 `uniformOptionAudio`（同组选项 `tts` 全有或全无）；`en_to_zh` "
            "翻译配 `source_text_tts`，`zh_to_en` 配 `reference_translation_tts`；"
            "通用日常与职场场景出题，不引入车间术语。\n"
        )
    return (
        f"你是 v2 题库作者。请阅读 `{q_path}`（非空保留原题并追加），按 "
        f"`.agents/skills/design-course-package/SKILL.md`、"
        f"`contracts/course/v2/items.schema.json`、"
        f"`courses/golden-course-template/questions/extended-practice.json` 与 "
        f"`.agents/skills/design-course-tts/SKILL.md`（及 `references/study-transcripts.md`），\n"
        f"严格按下列每个知识点的分题型配额 `question_quota` 与 "
        f"`practice_design_min` 命题并写入 `{q_path}`：\n"
        f"{specs_json}\n"
        f"1. 每题含唯一 id、`chapter`（用知识点 title）与 "
        f"`concepts: [concept_id]`；严禁用轻量单选替代重题型配额。\n"
        f"2. `true_false` 须用 `grading.value` + `analysis`；`numeric` 须含 "
        f"`value` + `absolute_tolerance`；解析禁用 `选项 a/b/c/d`。\n"
        f"3. 英文 TTS 严禁 `tts: true`、中英混杂切片、首尾空白/引号、裸大写/"
        f"冒号时刻/段内换行（需写 `tts.text`）；纯中文不加英文 TTS。\n"
        f"{extra_lang}{completion_instruction}"
    )


def build_vocab_author_prompt(
    package_dir: str,
    vocab_file: str,
    unit_id: str,
    unit_title: str,
    q_path: str,
    target_count: int,
    completion_instruction: str,
) -> str:
    """Build proactive unit vocabulary authoring prompt aligned with vocab skill."""
    vocab_path = f"{package_dir}/{vocab_file}"
    return (
        f"你是课程生词本作者。请阅读 `{vocab_path}`（保留全部已有词条并在末尾追加）"
        f"与 `{q_path}`，严格参照 `.agents/skills/design-course-vocabulary/SKILL.md` "
        f"与 `.agents/skills/design-course-tts/SKILL.md`，为单元 `{unit_id}`"
        f"（{unit_title}）追加约 {target_count} 条高质量生词并写回 `{vocab_path}`：\n"
        f"1. 每条含课内唯一 kebab-case `id`、`unit_id: \"{unit_id}\"`、准确 `category`"
        f"（`word`/`word_group`/`phrase`/`collocation`/`idiom`/`function_phrase`）、"
        f"`term`、`meaning`、成对 `example` + `example_translation` 及本单元真实 `question_ids`。\n"
        f"2. 仅 `category == \"word\"` 填写 `pos`（9 类词性之一），多词类目省略 `pos`。\n"
        f"3. `grammar_note` 仅在确有易错复数/不可数/时态/介词搭配卡点时写 <= 120 字"
        f"极简中文提醒，普通词直接省略（禁写“无”/“不适用”）。\n"
        f"4. 干净词条省略 `term_tts`/`example_tts`；仅含 `…`/斜杠/括号/全大写时配 `*_tts.text`。\n"
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
