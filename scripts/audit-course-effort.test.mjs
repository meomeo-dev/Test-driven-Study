import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";
import { main } from "./audit-course-effort.mjs";
import { attributeLesson, auditCourseEffort, calcItemEffort } from "./lib/effort-audit.mjs";

function makeTempCourse(manifest, lessons, questionFiles) {
  const dir = mkdtempSync(join(tmpdir(), "effort-audit-"));
  mkdirSync(join(dir, "lessons"), { recursive: true });
  mkdirSync(join(dir, "questions"), { recursive: true });
  writeFileSync(join(dir, "course.json"), JSON.stringify(manifest, null, 2));
  for (const [name, md] of Object.entries(lessons)) {
    writeFileSync(join(dir, "lessons", name), md);
  }
  for (const [name, items] of Object.entries(questionFiles)) {
    writeFileSync(join(dir, "questions", name), JSON.stringify(items, null, 2));
  }
  return dir;
}

test("golden-course-template passes default quality gate (errorCount=0)", () => {
  const res = auditCourseEffort(resolve("courses/golden-course-template"));
  assert.equal(res.ok, true);
  assert.equal(res.errorCount, 0);
  assert.equal(res.declaredMinutes, 65);
  assert.ok(res.ratio >= 0.7 && res.ratio <= 1.6, `unexpected template ratio ${res.ratio}`);
});

test("recalibrated beginner-english passes strict gate while under-stuffed course fails inflated hours", () => {
  const be = auditCourseEffort(resolve("courses/beginner-english"), { strict: true });
  assert.equal(be.ok, true, JSON.stringify(be.issues));
  assert.equal(be.errorCount, 0);
  assert.equal(be.warningCount, 0);
  assert.ok(be.ratio >= 0.7 && be.ratio <= 1.4, `expected balanced ratio, got ${be.ratio}`);

  const dir = makeTempCourse(
    {
      protocol_version: 2,
      course_id: "inflated-fixture",
      version: "1.0.0",
      title: "虚高课时测试",
      language: "zh-CN",
      units: [
        {
          id: "u1",
          title: "U1",
          question_file: "questions/u1.json",
          lessons: [{ id: "l1", title: "L1", file: "lessons/l1.md" }],
          concepts: [{ id: "c1", title: "C1", estimated_minutes: 120, lesson: "l1" }],
        },
      ],
    },
    { "l1.md": "# L1\n\n简短讲义三十字内容。" },
    {
      "u1.json": [
        {
          id: "q1",
          type: "single_choice",
          stem: "Q1",
          options: [{ sign: "A", text: "1" }, { sign: "B", text: "2" }],
          answer: "A",
          analysis: [{ type: "text", text: "解析" }],
          concepts: ["c1"],
        },
      ],
    },
  );
  try {
    const res = auditCourseEffort(dir);
    assert.equal(res.ok, false);
    assert.ok(
      res.issues.some((i) => i.target === "u1/c1" && i.rule === "SEVERE_UNDER_STUFFED_CONCEPT"),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("attributeLesson conserves total reading minutes across shared N:1 concepts", () => {
  const md = [
    "# 单元总述",
    "前言简介一段话共三十个中文字。",
    "## 知识点甲",
    "这里是知识点甲的详细讲解与例题示例内容。",
    "## 知识点乙\n<!-- concepts: c-a, c-b -->",
    "这里是知识点甲和知识点乙共读的一节示例内容。",
  ].join("\n\n");
  const concepts = [
    { id: "c-a", title: "知识点甲" },
    { id: "c-b", title: "知识点乙" },
  ];
  const { perConcept, totalReadMin } = attributeLesson(md, concepts);
  const sum = perConcept["c-a"].readMin + perConcept["c-b"].readMin;
  assert.ok(Math.abs(sum - totalReadMin) < 1e-9, `conservation failed: ${sum} != ${totalReadMin}`);
});

test("multi-tag items split additively across concepts without inflating unit totals", () => {
  const prose = "核心原理与工程参数解析及常见错误对照示例。".repeat(30);
  const items = Array.from({ length: 4 }, (_, i) => ({
    id: `q-${i + 1}`,
    type: "reading_comprehension",
    concepts: i < 2 ? ["c1", "c2"] : i === 2 ? ["c1"] : ["c2"],
    stem: "阅读：",
    passage: "Read this short engineering notice carefully. " .repeat(8),
    sub_questions: [
      { id: "s1", type: "single_choice", stem: "Q1", options: [{ id: "a", text: "A" }, { id: "b", text: "B" }], grading: { choice_ids: ["a"] } },
      { id: "s2", type: "true_false", stem: "Q2", grading: { value: true }, analysis: "ok" },
    ],
    analysis: "ok",
  }));
  const dir = makeTempCourse(
    {
      protocol_version: 2, course_id: "multi-tag", version: "1.0.0", title: "Test", language: "zh-CN",
      units: [{
        id: "u1", title: "U1", question_file: "questions/u1.json",
        lessons: [{ id: "l1", title: "L1", file: "lessons/l1.md" }],
        concepts: [
          { id: "c1", title: "C1", estimated_minutes: 15, lesson: "l1" },
          { id: "c2", title: "C2", estimated_minutes: 15, lesson: "l1" },
        ],
      }],
    },
    { "l1.md": `# L1\n\n## C1\n${prose}\n\n## C2\n${prose}\n` },
    { "u1.json": items },
  );
  try {
    const res = auditCourseEffort(dir, { strict: true });
    assert.equal(res.ok, true, JSON.stringify(res.issues));
    const directSum = res.units[0].concepts.reduce((s, c) => s + c.designMinutes, 0);
    assert.ok(Math.abs(directSum - res.units[0].designMinutes) < 0.05);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("zero-item anchored lab passes while placeholder lesson fails", async () => {
  const dir = makeTempCourse(
    {
      protocol_version: 2, course_id: "lab-check", version: "1.0.0", title: "Lab", language: "zh-CN",
      units: [{
        id: "u1", title: "U1",
        lessons: [{ id: "l1", title: "L1", file: "lessons/l1.md" }],
        concepts: [{ id: "c1", title: "硬件实验", estimated_minutes: 45, lesson: "l1" }],
      }],
    },
    {
      "l1.md": "# 硬件实验\n\n## 硬件实验\n<!-- effort-lab: wiring=15, testing=30 -->\n1. 接线\n2. 测试\n\n- 完成万用表读数\n- 拍照核验\n",
    },
    {},
  );
  try {
    const res = auditCourseEffort(dir, { strict: true });
    assert.equal(res.ok, true, JSON.stringify(res.issues));
    assert.equal(res.units[0].concepts[0].labMinutes, 45);
    writeFileSync(join(dir, "lessons", "l1.md"), "# 硬件实验\n\n## 硬件实验\n无资料\n");
    assert.equal(await main([dir]), 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("heavy v2 writing/listening effort exceeds lightweight objective effort", () => {
  const tf = calcItemEffort({ type: "true_false", stem: "判断", grading: { value: true } });
  const essay = calcItemEffort({ type: "writing", subtype: "full_essay", min_words: 110, max_words: 160 });
  assert.ok(essay.totalMin > tf.totalMin * 8);
});
