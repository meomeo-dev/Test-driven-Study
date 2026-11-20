#!/usr/bin/env node
// 自底向上审计课程包（题目 + 讲义 -> 知识点 -> 单元 -> 课程）内容量与设计课时的匹配度。

import { existsSync, realpathSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { auditCourseEffort } from "./lib/effort-audit.mjs";

const EXIT = Object.freeze({ OK: 0, FAIL: 1, USAGE: 2, NOT_READY: 3 });

const HELP = `audit-course-effort: 自底向上审计课程内容量与设计课时匹配度

用法:
  node scripts/audit-course-effort.mjs <课程目录> [选项]

选项:
  --strict           严格模式：warning 也视为失败（退出码 1）
  --syllabus <路径>  对照 syllabus_180h.json 校验总声明学时是否匹配
  --json             输出完整 JSON 审计报告
  --verbose          在文本模式下逐知识点展开明细
  -h, --help         显示本帮助

退出码: 0 通过；1 质量门未通过；2 用法错误；3 路径或 JSON 读取失败。

示例:
  node scripts/audit-course-effort.mjs courses/golden-course-template
  node scripts/audit-course-effort.mjs courses/beginner-english --json
`;

function formatTextReport(res, verbose) {
  if (res.noConceptGraph) {
    return (
      `✓ ${res.courseId}@${res.version}: ${res.unitCount} 单元, ${res.itemCount} 题` +
      `（无知识点图谱，首次作答估算 ${res.firstPassMinutes}m，设计耗时 ${res.designMinutes}m）`
    );
  }
  const lines = [
    `${res.ok ? "✓" : "✗"} ${res.courseId}@${res.version}: ` +
      `声明 ${res.declaredMinutes}m (${res.declaredHours}h) vs ` +
      `设计估算 ${res.designMinutes}m (${res.designHours}h) | η=${res.ratio} ` +
      `(速通 ${res.firstPassMinutes}m) | error=${res.errorCount}, warning=${res.warningCount}`,
  ];
  for (const u of res.units) {
    lines.push(
      `  - [${u.id}] ${u.title}: ${u.declaredMinutes}m 声明 / ${u.designMinutes}m 估算 (η=${u.ratio}), ` +
        `${u.conceptCount} 知识点, ${u.itemCount} 题`,
    );
    if (verbose) {
      for (const c of u.concepts) {
        lines.push(
          `      * ${c.id}: ${c.declaredMinutes}m 声明 / ${c.designMinutes}m 估算 (η=${c.ratio}, ` +
            `讲义=${c.lectureMinutes}m, 题=${c.itemDesignMinutes}m, 实操=${c.labMinutes}m, 速通=${c.firstPassMinutes}m, ${c.itemCount}题)`,
        );
      }
    }
  }
  for (const i of res.issues) {
    lines.push(`  [${i.severity.toUpperCase()}] ${i.rule} (${i.target}): ${i.message}`);
  }
  return lines.join("\n");
}

export async function main(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      options: {
        strict: { type: "boolean", default: false },
        syllabus: { type: "string" },
        json: { type: "boolean", default: false },
        verbose: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
      allowPositionals: true,
      strict: true,
    });
  } catch (err) {
    console.error(`✗ ${err.message}\n运行 --help 查看用法。`);
    return EXIT.USAGE;
  }

  const { values, positionals } = parsed;
  if (values.help) {
    process.stdout.write(HELP);
    return EXIT.OK;
  }
  if (positionals.length !== 1) {
    console.error("✗ 请指定一个课程包目录（运行 --help 查看用法）。");
    return EXIT.USAGE;
  }

  const targetDir = resolve(positionals[0]);
  if (!existsSync(targetDir) || !statSync(targetDir).isDirectory()) {
    console.error(`✗ 课程目录不存在：${positionals[0]}`);
    return EXIT.NOT_READY;
  }
  if (values.syllabus && !existsSync(resolve(values.syllabus))) {
    console.error(`✗ 大纲文件不存在：${values.syllabus}`);
    return EXIT.NOT_READY;
  }

  let report;
  try {
    report = auditCourseEffort(targetDir, {
      strict: values.strict,
      syllabusPath: values.syllabus,
    });
  } catch (err) {
    console.error(`✗ 解析课程包失败：${err.message}`);
    return EXIT.NOT_READY;
  }

  if (values.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatTextReport(report, values.verbose));
  }
  return report.ok ? EXIT.OK : EXIT.FAIL;
}

const entry = process.argv[1];
if (entry) {
  let real = entry;
  try {
    real = realpathSync(entry);
  } catch {
    real = entry;
  }
  if ([entry, real].some((p) => pathToFileURL(p).href === import.meta.url)) {
    main().then((code) => {
      process.exitCode = code;
    });
  }
}
