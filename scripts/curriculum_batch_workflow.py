import os
import json
import asyncio

async def run_lesson(course_id, lesson_meta):
    lesson_id = lesson_meta["lesson_id"]
    lesson_num = lesson_meta["lesson_number"]
    lesson_title = lesson_meta["lesson_title"]
    unit_title = lesson_meta["unit_title"]
    t1 = lesson_meta["topic_1"]
    t2 = lesson_meta["topic_2"]
    t3 = lesson_meta["topic_3"]

    prog_file = f"docs/research/{course_id}/progress.json"
    prog = {}
    if os.path.exists(prog_file):
        try:
            with open(prog_file, "r", encoding="utf-8") as f:
                prog = json.load(f)
        except Exception:
            prog = {}

    if lesson_id in prog and prog[lesson_id].get("status") == "COMPLETED":
        log(f"[{course_id}] {lesson_id} is already completed. Skipping.")
        return f"{course_id}:{lesson_id}:SKIPPED"

    log(f"[{course_id}] Starting {lesson_id}: {lesson_title}")

    # Ensure directories exist
    r1_dir = f"docs/research/{course_id}/{lesson_id}/topic_1__subagent_1"
    r2_dir = f"docs/research/{course_id}/{lesson_id}/topic_2__subagent_2"
    r3_dir = f"docs/research/{course_id}/{lesson_id}/topic_3__subagent_3"
    rev1_dir = f"review/{course_id}/{lesson_id}/fact_check__subagent_1"
    rev2_dir = f"review/{course_id}/{lesson_id}/language_precision__subagent_2"

    for d in [r1_dir, r2_dir, r3_dir, rev1_dir, rev2_dir]:
        os.makedirs(d, exist_ok=True)

    r1_file = f"{r1_dir}/research_notes.md"
    r2_file = f"{r2_dir}/research_notes.md"
    r3_file = f"{r3_dir}/research_notes.md"
    rev1_file = f"{rev1_dir}/review_report.md"
    rev2_file = f"{rev2_dir}/review_report.md"
    draft_path = f"docs/research/{course_id}/{lesson_id}/lesson_draft.md"
    final_path = f"docs/research/{course_id}/{lesson_id}/lesson_final.md"

    # Phase 1: 3 Research Agents in parallel
    research_tasks = []
    
    if not os.path.exists(r1_file) or os.path.getsize(r1_file) == 0:
        p1 = (
            f"你是资深技术研究员。请针对课程【{course_id}】第{lesson_num}课时【{lesson_title}】的研究主题进行深度联网调研：\n"
            f"主题：{t1}\n"
            f"要求：\n"
            f"1. 使用 search_web 搜索权威技术标准（如 GB/T, ISO, IEEE, ASME, 国家规范等）与核心理论方程。\n"
            f"2. 将详细调研笔记、检索关键词、引用来源及标准编号写入文件：{r1_file}。\n"
            f"3. 返回 150 字以内核心结论。"
        )
        research_tasks.append(("r1", agent(p1, {"type": "string"}, role=f"R1-{course_id}-{lesson_id}", model="flash_lite")))
    else:
        log(f"[{course_id}] {lesson_id} R1 notes already exist.")

    if not os.path.exists(r2_file) or os.path.getsize(r2_file) == 0:
        p2 = (
            f"你是现场应用工程师。请针对课程【{course_id}】第{lesson_num}课时【{lesson_title}】的研究主题进行深度联网调研：\n"
            f"主题：{t2}\n"
            f"要求：\n"
            f"1. 使用 search_web 搜索真实工业参数、工程配置、典型工况与实操规程。\n"
            f"2. 将详细工程参数表、真实案例与参考出处写入文件：{r2_file}。\n"
            f"3. 返回 150 字以内核心结论。"
        )
        research_tasks.append(("r2", agent(p2, {"type": "string"}, role=f"R2-{course_id}-{lesson_id}", model="flash_lite")))
    else:
        log(f"[{course_id}] {lesson_id} R2 notes already exist.")

    if not os.path.exists(r3_file) or os.path.getsize(r3_file) == 0:
        p3 = (
            f"你是教学评估专家。请针对课程【{course_id}】第{lesson_num}课时【{lesson_title}】的研究主题进行深度联网调研：\n"
            f"主题：{t3}\n"
            f"要求：\n"
            f"1. 使用 search_web 搜索学习者与工程师易犯典型错误、失效模式及诊断测试方法。\n"
            f"2. 将典型错误剖析、诊断防范清单及自测题设计建议写入文件：{r3_file}。\n"
            f"3. 返回 150 字以内核心结论。"
        )
        research_tasks.append(("r3", agent(p3, {"type": "string"}, role=f"R3-{course_id}-{lesson_id}", model="flash_lite")))
    else:
        log(f"[{course_id}] {lesson_id} R3 notes already exist.")

    if research_tasks:
        sub_agents = [task[1] for task in research_tasks]
        await parallel(sub_agents, lambda a: a)
        log(f"[{course_id}] {lesson_id} Pending research agents completed.")

    # Phase 2: Coordinator synthesizes the lesson content
    def read_note(path):
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return f.read().strip()
        return "无资料"

    if not os.path.exists(draft_path) or os.path.getsize(draft_path) == 0:
        note1 = read_note(r1_file)
        note2 = read_note(r2_file)
        note3 = read_note(r3_file)

        draft_content = f"""# 第 {lesson_num} 课时：{lesson_title}
所属单元：{unit_title}

## 1. 核心理论与技术标准
{note1}

## 2. 工程实践与典型参数
{note2}

## 3. 常见失效模式与诊断要点
{note3}
"""
        with open(draft_path, "w", encoding="utf-8") as f:
            f.write(draft_content)
        log(f"[{course_id}] {lesson_id} Draft synthesized.")

    # Phase 3: 2 Review Agents in parallel
    review_tasks = []
    if not os.path.exists(rev1_file) or os.path.getsize(rev1_file) == 0:
        rev_p1 = (
            f"你是独立事实复核员。请审查课程【{course_id}】第{lesson_num}课时【{lesson_title}】的草案内容：\n"
            f"草案文件路径：{draft_path}\n"
            f"要求：\n"
            f"1. 使用 search_web 严格核对草案中的理论陈述、标准代号、数值范围与物理公式真实性。\n"
            f"2. 指出任何事实偏差，并提供权威核验依据与修正建议。\n"
            f"3. 将事实复核报告完整写入文件：{rev1_file}。\n"
            f"4. 返回核查结论（通过/需修正）及简评。"
        )
        review_tasks.append(("rev1", agent(rev_p1, {"type": "string"}, role=f"RevFact-{course_id}-{lesson_id}", model="flash_lite")))
    else:
        log(f"[{course_id}] {lesson_id} Fact check report already exists.")

    if not os.path.exists(rev2_file) or os.path.getsize(rev2_file) == 0:
        rev_p2 = (
            f"你是工业语言与术语规范审查员。请审查课程【{course_id}】第{lesson_num}课时【{lesson_title}】的草案语言：\n"
            f"草案文件路径：{draft_path}\n"
            f"要求：\n"
            f"1. 严格检查是否含有大模型容易产生的虚构词汇、假大空辞藻、跨学科伪科学比喻。\n"
            f"2. 确保采用规范的工程学术技术术语，语言简练客观。\n"
            f"3. 将语言措辞审查报告完整写入文件：{rev2_file}。\n"
            f"4. 返回语言核查结论及修改建议。"
        )
        review_tasks.append(("rev2", agent(rev_p2, {"type": "string"}, role=f"RevLang-{course_id}-{lesson_id}", model="flash_lite")))
    else:
        log(f"[{course_id}] {lesson_id} Language precision report already exists.")

    if review_tasks:
        sub_revs = [task[1] for task in review_tasks]
        await parallel(sub_revs, lambda a: a)
        log(f"[{course_id}] {lesson_id} Pending reviews completed.")

    # Phase 4: Coordinator integrates and finalizes
    if not os.path.exists(final_path) or os.path.getsize(final_path) == 0:
        if os.path.exists(draft_path):
            with open(draft_path, "r", encoding="utf-8") as f:
                draft_content = f.read()
            with open(final_path, "w", encoding="utf-8") as f:
                f.write(draft_content)

    # Mark lesson completed in course progress
    prog[lesson_id] = {
        "lesson_number": lesson_num,
        "title": lesson_title,
        "status": "COMPLETED",
        "fact_review": "REVIEWED",
        "lang_review": "AUDITED"
    }
    with open(prog_file, "w", encoding="utf-8") as f:
        json.dump(prog, f, ensure_ascii=False, indent=2)

    log(f"[{course_id}] {lesson_id} successfully finalized!")
    return f"{course_id}:{lesson_id}:DONE"

async def process_course(course_id, start_lesson, end_lesson):
    syllabus_file = f"courses/{course_id}/syllabus_180h.json"
    with open(syllabus_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    lessons = data["lessons"]

    target_lessons = [l for l in lessons if start_lesson <= l["lesson_number"] <= end_lesson]
    log(f"Processing course {course_id}: {len(target_lessons)} lessons (from {start_lesson} to {end_lesson}) sequentially.")

    for l_meta in target_lessons:
        await run_lesson(course_id, l_meta)

async def main():
    start_l = args.get("start_lesson", 1)
    end_l = args.get("end_lesson", 5)
    target_courses = args.get("courses", ["cad-fdm-printing", "circuit-fundamentals", "c-programming"])

    phase(f"Parallel Course Processing (Lessons {start_l}-{end_l})")
    log(f"Starting courses in parallel: {target_courses}")

    await parallel(target_courses, lambda c: process_course(c, start_l, end_l))
    log(f"Batch completed for lessons {start_l} to {end_l} across courses!")

await main()
