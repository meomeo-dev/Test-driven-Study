import json
import os
import re
import subprocess

SLUG_RE = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")
NO_DATA_MARKER = "无资料"
UNIT_PREFIX_RE = re.compile(r"^第\s*\d+\s*单元[：:]\s*")
DESIGN_ITEM_MINUTES = {
    "listening": 5.0, "reading_comprehension": 5.0, "cloze": 3.5,
    "translation": 3.2, "writing": 5.5, "numeric": 2.6,
    "multiple_choice": 2.3, "single_choice": 2.0, "true_false": 1.5,
}
REVIEW_SCHEMA = {
    "type": "object", "additionalProperties": False,
    "required": ["passed", "blocking_issues", "revision_instructions", "summary"],
    "properties": {
        "passed": {"type": "boolean"}, "summary": {"type": "string"},
        "blocking_issues": {"type": "array", "items": {"type": "string"}},
        "revision_instructions": {"type": "array", "items": {"type": "string"}},
    },
}
SUMMARY_SCHEMA = {
    "type": "object", "required": ["ok", "summary"], "additionalProperties": False,
    "properties": {"ok": {"type": "boolean"}, "summary": {"type": "string"}},
}


def to_slug(raw, max_len=64):
    """Normalize an arbitrary identifier into a valid manifest slug."""
    slug = re.sub(r"[^a-z0-9]+", "-", str(raw).strip().lower()).strip("-")[:max_len].strip("-")
    if not slug or not SLUG_RE.match(slug):
        raise ValueError(f"cannot normalize {raw!r} to valid manifest slug")
    return slug


def clamp_minutes(raw, default=60):
    """Bound concept estimated_minutes to the manifest schema range 1..600."""
    try:
        return max(1, min(600, int(raw)))
    except (TypeError, ValueError):
        return max(1, min(600, default))


def read_text(path):
    """Return UTF-8 text if path exists, else empty string."""
    if not os.path.exists(path):
        return ""
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def has_real_content(path, min_bytes=120):
    """Return True when path holds substantive text without placeholder markers."""
    text = read_text(path).strip()
    return len(text.encode("utf-8")) >= min_bytes and NO_DATA_MARKER not in text


def load_json(path, default=None):
    """Load JSON file if present, returning default otherwise."""
    if not os.path.exists(path):
        return {} if default is None else default
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    """Write formatted UTF-8 JSON to path, creating parent directories."""
    os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def run_cli(cmd):
    """Execute subprocess command and return (returncode, stdout, stderr)."""
    proc = subprocess.run(cmd, capture_output=True, text=True, check=False)
    return proc.returncode, proc.stdout, proc.stderr


def detect_track(course_id, cfg):
    """Classify course domain track to guide v2 question-type quotas."""
    if cfg.get("track") in ("language", "stem"):
        return cfg["track"]
    cid = course_id.lower()
    return "language" if ("english" in cid or "chinese" in cid) else "stem"


def allocate_concept_quota(est_min, track):
    """Decompose concept estimated_minutes into lecture effort and typed question quotas."""
    lec_min = round(est_min * 0.35, 1)
    prac_min = round(est_min - lec_min, 1)
    read_equiv_units = max(550, int((lec_min / 1.8) * 250))
    quota = {}
    if track == "language":
        heavy = [("listening", 1), ("cloze", 1), ("translation", 1)] if est_min >= 25 else [("cloze", 1)]
        if est_min >= 45:
            heavy.append(("writing", 1))
    else:
        heavy = [("numeric", 2), ("cloze", 1)]
        if est_min >= 45:
            heavy.append(("reading_comprehension", 1))
    for qtype, cnt in heavy:
        quota[qtype] = cnt
    covered = sum(DESIGN_ITEM_MINUTES[k] * v for k, v in quota.items())
    cycle = ["single_choice", "multiple_choice", "true_false"]
    idx = 0
    while covered < prac_min or sum(quota.values()) < 3:
        qt = cycle[idx % len(cycle)]
        quota[qt] = quota.get(qt, 0) + 1
        covered += DESIGN_ITEM_MINUTES[qt]
        idx += 1
    return {
        "estimated_minutes": est_min, "lecture_design_min": lec_min,
        "practice_design_min": prac_min, "planned_item_design_min": round(covered, 1),
        "target_read_units": read_equiv_units, "min_examples": max(1, est_min // 15),
        "question_quota": quota,
    }


def plan_lesson_concepts(l_id, l_slug, l_title, duration_min, track, cfg):
    """Split a lesson's duration_minutes into 1-2 micro-concepts with upfront quotas."""
    cmap = cfg.get("concept_map", {})
    total = clamp_minutes(duration_min)
    if l_id in cmap or not cfg.get("split_concepts", True) or total < 45:
        cid = to_slug(cmap.get(l_id) or f"concept-{l_slug}")
        return [{"id": cid, "title": l_title[:80], **allocate_concept_quota(total, track)}]
    m1 = total // 2
    specs = [
        (to_slug(f"c-{l_slug}-core"), f"{l_title[:66]}（核心概念）", m1),
        (to_slug(f"c-{l_slug}-apply"), f"{l_title[:66]}（综合应用）", total - m1),
    ]
    return [{"id": cid, "title": title, **allocate_concept_quota(m, track)} for cid, title, m in specs]


def resolve_syllabus_path(course_id, cfg):
    """Locate syllabus JSON via explicit arg, courses/<id>/, or docs/research/<id>/."""
    if cfg.get("syllabus_file"):
        return cfg["syllabus_file"]
    for cand in (f"courses/{course_id}/syllabus_180h.json", f"docs/research/{course_id}/syllabus_180h.json"):
        if os.path.exists(cand):
            return cand
    raise FileNotFoundError(f"syllabus_180h.json not found for {course_id}")


def resolve_unit_target(meta, unit_map, existing_units):
    """Map syllabus unit_slug and unit_title to validated package unit ID and title."""
    raw_slug = meta.get("unit_slug") or f"unit-{meta['lesson_number']}"
    raw_title = UNIT_PREFIX_RE.sub("", meta.get("unit_title") or raw_slug).strip()
    if raw_slug in unit_map:
        mapped = unit_map[raw_slug]
        if isinstance(mapped, dict):
            return to_slug(mapped["id"]), mapped.get("title") or raw_title
        uid = to_slug(mapped)
        return uid, existing_units.get(uid, {}).get("title") or raw_title
    uid = to_slug(raw_slug)
    if existing_units and uid not in existing_units:
        raise ValueError(f"unit_slug {raw_slug!r} not in {sorted(existing_units)}; pass unit_map")
    return uid, existing_units.get(uid, {}).get("title") or raw_title


def build_lesson_ctx(meta, course_id, research_root, package_dir, cfg, existing_units):
    """Normalize syllabus lesson metadata into concrete paths and upfront budgets."""
    l_id, title = meta["lesson_id"], meta["lesson_title"].strip()
    l_slug = to_slug(l_id)
    u_id, u_title = resolve_unit_target(meta, cfg.get("unit_map", {}), existing_units)
    track, est = detect_track(course_id, cfg), clamp_minutes(meta.get("duration_minutes"))
    concepts = plan_lesson_concepts(l_id, l_slug, title, est, track, cfg)
    base = f"{research_root}/{l_id}"
    budget_file = f"{base}/budget_plan.json"
    save_json(budget_file, {"lesson_id": l_id, "duration_minutes": est, "track": track, "concepts": concepts})
    return {
        "course_id": course_id, "lesson_id": l_id, "lesson_slug": l_slug,
        "lesson_number": int(meta["lesson_number"]), "lesson_title": title,
        "unit_id": u_id, "unit_title": u_title, "estimated_minutes": est,
        "track": track, "concepts": concepts, "budget_file": budget_file,
        "topics": [meta.get(f"topic_{i}", "") for i in (1, 2, 3)],
        "notes": [f"{base}/topic_{i}__subagent_{i}/research_notes.md" for i in (1, 2, 3)],
        "reviews": [f"{base}/review/fact_check.md", f"{base}/review/language_precision.md"],
        "draft_path": f"{base}/lesson_draft.md", "final_path": f"{base}/lesson_final.md",
        "pkg_lesson_path": f"{package_dir}/lessons/{l_slug}.md",
        "ingest_archived": bool(cfg.get("ingest_archived", False)),
        "force_research": bool(cfg.get("force_research", False)),
        "model": cfg.get("model", "flash"), "max_revisions": int(cfg.get("max_revisions", 3)),
    }


async def research_lesson(ctx):
    """Run missing R1-R3 research agents in parallel unless valid source exists."""
    for p in ctx["notes"] + ctx["reviews"] + [ctx["draft_path"], ctx["pkg_lesson_path"]]:
        os.makedirs(os.path.dirname(p), exist_ok=True)
    if ctx["ingest_archived"] and has_real_content(ctx["final_path"], min_bytes=400):
        log(f"[{ctx['course_id']}] {ctx['lesson_id']} reusing valid archived material")
        return
    roles = [("R1", "资深技术研究员", "权威标准与核心规则"), ("R2", "现场应用工程师", "真实参数与操作规范"), ("R3", "教学评估专家", "常见误区与练习设计")]
    tasks = []
    for idx, (tag, role_zh, focus) in enumerate(roles):
        note_path = ctx["notes"][idx]
        if not ctx["force_research"] and has_real_content(note_path, min_bytes=200):
            continue
        prompt = (
            f"你是{role_zh}。针对【{ctx['course_id']}】第{ctx['lesson_number']}讲「{ctx['lesson_title']}」调研：\n"
            f"主题：{ctx['topics'][idx]}\n侧重：{focus}。使用 search_web，严禁编造或写 `{NO_DATA_MARKER}`，"
            f"写入 `{note_path}` 后调用 finish。"
        )
        tasks.append(agent(prompt, SUMMARY_SCHEMA, role=f"{tag}-{ctx['lesson_slug']}", model=ctx["model"]))
    if tasks:
        await parallel(tasks, lambda a: a)


async def author_lesson(ctx):
    """Synthesize lesson_draft.md meeting the concept section and character budget."""
    total_units = sum(c["target_read_units"] for c in ctx["concepts"])
    if has_real_content(ctx["draft_path"], min_bytes=max(300, total_units)) and not ctx["force_research"]:
        return
    archived = ctx["final_path"] if (ctx["ingest_archived"] and has_real_content(ctx["final_path"], 400)) else ""
    sources = archived or ", ".join(p for p in ctx["notes"] if has_real_content(p, 80))
    if not sources:
        raise RuntimeError(f"[{ctx['course_id']}] {ctx['lesson_id']} lacks valid source notes")
    sec_spec = [{"id": c["id"], "title": c["title"], "min_read_units": c["target_read_units"], "min_examples": c["min_examples"]} for c in ctx["concepts"]]
    prompt = (
        f"你是课程讲义主笔。请基于 `{sources}`，参照 `.agents/skills/design-course-package/SKILL.md`，"
        f"撰写第{ctx['lesson_number']}讲（总预算 {ctx['estimated_minutes']} 分钟）至 `{ctx['draft_path']}`：\n"
        f"1. 一级标题 `# {ctx['lesson_title']}`。\n"
        f"2. 为下列每个知识点写 `## <title>` 小节并在标题下一行加 `<!-- concepts: <id> -->` 锚点：\n"
        f"{json.dumps(sec_spec, ensure_ascii=False, indent=2)}\n"
        f"3. 每节等效阅读量（中文字数 + 3×英文词数）须达 `min_read_units`，含 `### 例题` 与 `### 常见错误`，严禁 `{NO_DATA_MARKER}`。完成后 finish。"
    )
    res = await agent(prompt, SUMMARY_SCHEMA, role=f"Author-{ctx['lesson_slug']}", model=ctx["model"])
    if not res.get("ok") or not has_real_content(ctx["draft_path"], 200):
        raise RuntimeError(f"[{ctx['course_id']}] {ctx['lesson_id']} draft synthesis failed")


def build_review_prompts(ctx):
    """Construct structured prompts for Fact Check and Language Precision reviewers."""
    req = json.dumps([{"id": c["id"], "min_read_units": c["target_read_units"]} for c in ctx["concepts"]], ensure_ascii=False)
    fact_p = (
        f"你是事实复核员。核查 `{ctx['draft_path']}` 准确性，确认无 `{NO_DATA_MARKER}` 及虚构单号/公式，"
        f"核对每个知识点小节都有 `<!-- concepts: <id> -->` 锚点且等效阅读量（中文字数 + 3×英文词数）达标（{req}）。"
        f"写报告至 `{ctx['reviews'][0]}`，通过 finish 返回结构化结论。"
    )
    lang_p = (
        f"你是语言审查员。审查 `{ctx['draft_path']}` 术语准确性、Markdown 清晰度及教学可读性，"
        f"写报告至 `{ctx['reviews'][1]}`，通过 finish 返回结构化结论。"
    )
    return fact_p, lang_p


async def revise_draft(ctx, blocking, instructions):
    """Apply concrete reviewer fixes directly to lesson_draft.md."""
    prompt = (
        f"按审查阻断项修改 `{ctx['draft_path']}`：\n"
        f"阻断：{json.dumps(blocking, ensure_ascii=False)}\n指令：{json.dumps(instructions, ensure_ascii=False)}\n"
        f"保留全部 `<!-- concepts: ... -->` 锚点并消除 `{NO_DATA_MARKER}` 后覆写 `{ctx['draft_path']}`，最后 finish。"
    )
    await agent(prompt, SUMMARY_SCHEMA, role=f"Revise-{ctx['lesson_slug']}", model=ctx["model"])


async def review_and_promote(ctx):
    """Enforce dual-review pass gate before promoting draft to final and package lesson."""
    fact_p, lang_p = build_review_prompts(ctx)
    fact_v = lang_v = None
    for attempt in range(ctx["max_revisions"] + 1):
        fact_v, lang_v = await parallel([
            agent(fact_p, REVIEW_SCHEMA, role=f"RevFact-{ctx['lesson_slug']}", model=ctx["model"]),
            agent(lang_p, REVIEW_SCHEMA, role=f"RevLang-{ctx['lesson_slug']}", model=ctx["model"]),
        ], lambda a: a)
        ok = fact_v["passed"] and lang_v["passed"] and not (fact_v["blocking_issues"] or lang_v["blocking_issues"])
        if ok and has_real_content(ctx["draft_path"], 200):
            content = read_text(ctx["draft_path"])
            for out_path in (ctx["final_path"], ctx["pkg_lesson_path"]):
                with open(out_path, "w", encoding="utf-8") as f:
                    f.write(content)
            return True, fact_v, lang_v
        if attempt < ctx["max_revisions"]:
            await revise_draft(ctx, fact_v["blocking_issues"] + lang_v["blocking_issues"], fact_v["revision_instructions"] + lang_v["revision_instructions"])
    return False, fact_v, lang_v


def upsert_unit_in_manifest(manifest, unit_id, unit_title, approved_ctxs):
    """Register approved lessons and micro-concepts cleanly into a v2 manifest unit."""
    units = manifest.setdefault("units", [])
    unit = next((u for u in units if u["id"] == unit_id), None)
    if unit is None:
        unit = {"id": unit_id, "title": unit_title, "question_file": f"questions/{unit_id}.json", "lessons": [], "concepts": []}
        units.append(unit)
    unit["question_file"] = unit.get("question_file") or f"questions/{unit_id}.json"
    lessons_by_id = {x["id"]: x for x in unit.setdefault("lessons", [])}
    concepts_by_id = {x["id"]: x for x in unit.setdefault("concepts", [])}
    prev_cid = unit["concepts"][-1]["id"] if unit["concepts"] else None
    for ctx in approved_ctxs:
        lessons_by_id[ctx["lesson_slug"]] = {"id": ctx["lesson_slug"], "title": ctx["lesson_title"], "file": f"lessons/{ctx['lesson_slug']}.md"}
        for cs in ctx["concepts"]:
            cid = cs["id"]
            node = concepts_by_id.get(cid, {"id": cid, "title": cs["title"], "summary": f"掌握{cs['title']}的核心概念与应用。"})
            node["estimated_minutes"], node["lesson"] = cs["estimated_minutes"], ctx["lesson_slug"]
            if "prerequisites" not in node and prev_cid and prev_cid != cid:
                node["prerequisites"] = [{"all_of": [prev_cid]}]
            concepts_by_id[cid], prev_cid = node, cid
    unit["lessons"], unit["concepts"] = list(lessons_by_id.values()), list(concepts_by_id.values())
    return unit


def build_base_manifest(course_id, syllabus, package_dir, cfg):
    """Load existing v2 manifest or initialize a golden-template-aligned manifest."""
    manifest_path = f"{package_dir}/course.json"
    if os.path.exists(manifest_path):
        manifest = load_json(manifest_path)
    elif cfg.get("base_manifest") and os.path.exists(cfg["base_manifest"]):
        manifest = load_json(cfg["base_manifest"])
    else:
        title = cfg.get("target_title") or syllabus.get("course_title") or course_id
        manifest = {
            "protocol_version": 2, "course_id": to_slug(cfg.get("target_course_id") or course_id),
            "version": cfg.get("version") or "2.0.0", "title": title, "language": cfg.get("language") or "zh-CN",
            "description": syllabus.get("description") or f"{title}（v2 课程包）。", "units": [],
        }
    manifest["protocol_version"] = 2
    manifest["version"] = cfg.get("version") or manifest.get("version") or "2.0.0"
    return manifest


def existing_concept_effort(existing):
    """Estimate current question-bank design minutes per concept from existing items."""
    totals = {}
    for item in existing:
        tags = item.get("concepts") or []
        w = DESIGN_ITEM_MINUTES.get(item.get("type"), 2.0) / max(1, len(tags))
        for t in tags:
            totals[t] = totals.get(t, 0.0) + w
    return totals


async def author_unit_questions(package_dir, unit, approved_ctxs, model):
    """Author v2 questions per concept matching upfront practice_design_min and quotas."""
    q_path = f"{package_dir}/{unit['question_file']}"
    existing = load_json(q_path, default=[])
    have_effort = existing_concept_effort(existing)
    specs = [
        {**cs, "lesson_file": ctx["pkg_lesson_path"]}
        for ctx in approved_ctxs for cs in ctx["concepts"]
        if have_effort.get(cs["id"], 0.0) < cs["practice_design_min"] * 0.7
    ]
    if not specs and existing:
        return
    save_json(q_path, existing)
    prompt = (
        f"你是 v2 题库作者。请阅读 `{q_path}`（非空保留原题并追加），按 `.agents/skills/design-course-package/SKILL.md`、"
        f"`contracts/course/v2/items.schema.json`、`courses/golden-course-template/questions/extended-practice.json` 与 `.agents/skills/design-course-tts/SKILL.md`，\n"
        f"严格按下列每个知识点的分题型配额 `question_quota` 与 `practice_design_min` 命题并写入 `{q_path}`：\n"
        f"{json.dumps(specs, ensure_ascii=False, indent=2)}\n"
        f"1. 每题含唯一 id、`chapter`（用知识点 title）与 `concepts: [concept_id]`；严禁用轻量单选替代重题型配额。\n"
        f"2. `true_false` 须用 `grading.value` + `analysis`；`numeric` 须含 `value` + `absolute_tolerance`；解析禁用 `选项 a/b/c/d`。\n"
        f"3. 英文 TTS 严禁 `tts: true`、中英混杂切片、首尾空白/引号、裸大写/冒号时刻（需写 `tts.text`）；纯中文不加英文 TTS。\n"
        f"4. 完成后调用 finish。"
    )
    res = await agent(prompt, SUMMARY_SCHEMA, role=f"Questions-{unit['id']}", model=model)
    if not res.get("ok") or not load_json(q_path, default=[]):
        raise RuntimeError(f"failed authoring questions at {q_path}")


async def run_audit_with_repair(cmd, repair_role, repair_prompt_fn, model):
    """Run a JSON audit gate script with one bounded repair pass before failing."""
    for attempt in range(2):
        code, out, err = run_cli(cmd)
        data = json.loads(out) if out.strip().startswith("{") else {"ok": False, "raw": err or out}
        if code == 0 and data.get("ok"):
            return data
        if attempt == 1:
            raise RuntimeError(f"{cmd[1]} failed:\n{out or err}")
        await agent(repair_prompt_fn(out or err), SUMMARY_SCHEMA, role=repair_role, model=model)
    return {}


async def validate_package(package_dir, cfg):
    """Run TTS audit, effort-budget quality gate, and go course:check."""
    model, slug = cfg.get("model", "flash"), os.path.basename(package_dir)
    tts = await run_audit_with_repair(
        ["node", ".agents/skills/design-course-tts/scripts/audit-course-tts.mjs", package_dir, "--json"], f"FixTTS-{slug}",
        lambda out: f"按 `.agents/skills/design-course-tts/SKILL.md` 修复 `{package_dir}/questions/*.json` 中的问题：\n{out}\n完成后 finish。", model,
    )
    effort_cmd = ["node", "scripts/audit-course-effort.mjs", package_dir, "--json"] + (["--strict"] if cfg.get("strict_effort") else [])
    effort = await run_audit_with_repair(
        effort_cmd, f"FixEffort-{slug}",
        lambda out: f"按 `.agents/skills/design-course-package/SKILL.md` 扩充 `{package_dir}` 欠载的讲义小节或题型密度以通过课时门：\n{out}\n完成后 finish。", model,
    )
    code_c, out_c, err_c = run_cli(["go", "run", "./cmd/course", "check", package_dir])
    if code_c != 0:
        raise RuntimeError(f"course:check failed for {package_dir}:\n{out_c}\n{err_c}")
    return tts, effort, out_c.strip()


def update_progress(prog_file, ctx, status, package_dir, extra=None):
    """Persist lesson state and planned concept IDs into progress.json."""
    prog = load_json(prog_file, default={})
    entry = {
        "lesson_number": ctx["lesson_number"], "lesson_slug": ctx["lesson_slug"],
        "unit_id": ctx["unit_id"], "concepts": [c["id"] for c in ctx["concepts"]],
        "estimated_minutes": ctx["estimated_minutes"], "title": ctx["lesson_title"],
        "status": status, "package_dir": package_dir,
    }
    if extra:
        entry.update(extra)
    prog[ctx["lesson_id"]] = entry
    save_json(prog_file, prog)


def is_lesson_done(prev, ctx, package_dir, cfg):
    """Return True only when lesson passed review, effort gate, and course:check."""
    return (
        not cfg.get("force_recheck") and prev.get("status") == "COMPLETED"
        and prev.get("effort_audit") == "PASSED" and prev.get("course_check") == "PASSED"
        and prev.get("package_dir") == package_dir and has_real_content(ctx["pkg_lesson_path"], 120)
    )


async def run_one_lesson(ctx, prog_file, package_dir):
    """Execute research, budget-guided synthesis, and dual-review gate for one lesson."""
    await research_lesson(ctx)
    await author_lesson(ctx)
    ok, fact_v, lang_v = await review_and_promote(ctx)
    if not ok:
        update_progress(prog_file, ctx, "FAILED_REVIEW", package_dir, {
            "fact_review": "PASSED" if fact_v["passed"] else "FAILED",
            "lang_review": "PASSED" if lang_v["passed"] else "FAILED",
            "blocking_issues": fact_v["blocking_issues"] + lang_v["blocking_issues"],
        })
        return False
    update_progress(prog_file, ctx, "REVIEW_APPROVED", package_dir, {"fact_review": "PASSED", "lang_review": "PASSED"})
    return True


async def package_and_verify(course_id, package_dir, manifest, approved_by_unit, prog_file, cfg):
    """Register units/concepts, author quota-matched questions, validate all gates, record COMPLETED."""
    try:
        for unit_id, (unit_title, ctxs) in approved_by_unit.items():
            unit = upsert_unit_in_manifest(manifest, unit_id, unit_title, ctxs)
            save_json(f"{package_dir}/course.json", manifest)
            await author_unit_questions(package_dir, unit, ctxs, cfg.get("model", "flash"))
        readme_path = f"{package_dir}/README.md"
        if not os.path.exists(readme_path):
            with open(readme_path, "w", encoding="utf-8") as f:
                f.write(f"# {manifest['title']}\n\n{manifest['description']}\n")
        tts, effort, check_out = await validate_package(package_dir, cfg)
    except Exception as exc:
        for _, ctxs in approved_by_unit.values():
            for ctx in ctxs:
                update_progress(prog_file, ctx, "FAILED_VALIDATION", package_dir, {"error": str(exc)})
        raise
    log(f"[{course_id}] Verified: {check_out} | tts={tts['issueCount']} | effort η={effort['ratio']} ({effort['designMinutes']}m/{effort['declaredMinutes']}m)")
    for _, ctxs in approved_by_unit.values():
        for ctx in ctxs:
            update_progress(prog_file, ctx, "COMPLETED", package_dir, {
                "fact_review": "PASSED", "lang_review": "PASSED",
                "tts_audit": "PASSED", "effort_audit": "PASSED", "course_check": "PASSED",
            })


async def process_course(course_id, cfg):
    """Process selected syllabus lessons from upfront budget decomposition through verification."""
    syllabus = load_json(resolve_syllabus_path(course_id, cfg))
    start_l, end_l = int(cfg.get("start_lesson", 1)), int(cfg.get("end_lesson", 5))
    target_id = to_slug(cfg.get("target_course_id") or course_id)
    package_dir = cfg.get("package_dir") or f"var/generated-courses/{target_id}"
    research_root = cfg.get("research_dir") or f"docs/research/{course_id}"
    prog = load_json(f"{research_root}/progress.json", default={})
    manifest = build_base_manifest(course_id, syllabus, package_dir, cfg)
    existing_units = {u["id"]: u for u in manifest.get("units", [])}
    approved_by_unit, failed = {}, 0
    for meta in [l for l in syllabus["lessons"] if start_l <= int(l["lesson_number"]) <= end_l]:
        ctx = build_lesson_ctx(meta, course_id, research_root, package_dir, cfg, existing_units)
        if is_lesson_done(prog.get(ctx["lesson_id"], {}), ctx, package_dir, cfg):
            log(f"[{course_id}] {ctx['lesson_id']} already verified.")
            continue
        if await run_one_lesson(ctx, f"{research_root}/progress.json", package_dir):
            approved_by_unit.setdefault(ctx["unit_id"], (ctx["unit_title"], []))[1].append(ctx)
        else:
            failed += 1
    if approved_by_unit:
        await package_and_verify(course_id, package_dir, manifest, approved_by_unit, f"{research_root}/progress.json", cfg)
    elif failed:
        raise RuntimeError(f"[{course_id}] {failed} lesson(s) failed review")
    return {"course_id": course_id, "package_dir": package_dir, "failed": failed}


async def main():
    """Run quota-driven batch curriculum generation and v2 quality-gated packaging."""
    cfg = dict(args) if isinstance(args, dict) else {}
    target_courses = cfg.get("courses", ["beginner-english"])
    phase(f"Budget-Aligned v2 Workflow (Lessons {cfg.get('start_lesson', 1)}-{cfg.get('end_lesson', 5)})")
    results = await parallel(target_courses, lambda cid: process_course(cid, cfg))
    for r in results:
        log(f"Finished: {r}")


await main()
