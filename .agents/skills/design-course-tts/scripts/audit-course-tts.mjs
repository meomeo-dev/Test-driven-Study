#!/usr/bin/env node
// 审计课程题库 JSON 的声明式 TTS 与本地拼音音频设计。

import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { auditItems } from "./lib/audit.mjs";
import { EXIT, notReady, runTool, startIfEntry, usageError } from "./lib/cli.mjs";

const HELP = `audit-course-tts: 审计课程题库 JSON 的声明式 TTS 与本地音频设计

用法:
  node <skill-root>/scripts/audit-course-tts.mjs <课程目录> [--json]
  node <skill-root>/scripts/audit-course-tts.mjs --file <题库文件.json> [--json]

选项:
  --file <路径>   只审计单个 questions JSON 文件（与 <课程目录> 二选一）
  --json          以 JSON 输出完整审计结果
  --verbose       向 stderr 输出扫描进度
  -h, --help      显示本帮助

检查项:
- error: uniformOptionAudio（同组选项全有/全无）、禁止 tts: true 简写、blank 与 TTS 共存、
  听力题干泄露 TTS、TTS 切片首尾空白/外围引号、英文缺 voice、中英混排、不可直读符号与
  writing 缺 sample_response_tts。
- warning: 过长或含换行的粗粒度 TTS 切片、未配语音的纯英文题干/小题/选项与解析英文漏配。
不联网、不写文件。

退出码: 0 无设计问题；1 发现 error 或 warning；2 用法错误；3 路径或 JSON 读取失败。

示例:
  node <skill-root>/scripts/audit-course-tts.mjs courses/elementary-chinese
  node <skill-root>/scripts/audit-course-tts.mjs courses/beginner-english --json
  node <skill-root>/scripts/audit-course-tts.mjs --file courses/step-up-english-1/questions/extended-practice.json
`;

function resolvePath(raw) {
  return isAbsolute(raw) ? raw : resolve(process.cwd(), raw);
}

function readJson(filePath) {
  if (!existsSync(filePath)) {
    throw notReady(`文件不存在：${filePath}`);
  }
  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (error) {
    throw notReady(`读取文件失败：${filePath} (${error.message})`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw notReady(`JSON 解析失败：${filePath} (${error.message})`);
  }
}

function collectQuestionFiles(values, positionals) {
  if (values.file && positionals.length > 0) {
    throw usageError("不能同时传入 <课程目录> 与 --file");
  }
  if (!values.file && positionals.length === 0) {
    throw usageError("请传入 <课程目录> 或 --file <题库文件.json>");
  }
  if (positionals.length > 1) {
    throw usageError("只接受一个 <课程目录> 位置参数");
  }
  if (values.file) {
    return [{ rel: values.file, abs: resolvePath(values.file) }];
  }
  const dir = resolvePath(positionals[0]);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw notReady(`课程目录不存在：${dir}`);
  }
  const manifestPath = join(dir, "course.json");
  const manifest = readJson(manifestPath);
  if (!Array.isArray(manifest.units)) {
    throw notReady(`无效的 course.json（缺少 units 数组）：${manifestPath}`);
  }
  return manifest.units
    .filter((u) => typeof u.question_file === "string" && u.question_file)
    .map((u) => ({ rel: u.question_file, abs: join(dir, u.question_file) }));
}

function formatText(filesCount, itemsCount, issues, errorCount, warningCount) {
  if (issues.length === 0) {
    return `✓ 已检查 ${filesCount} 个题库文件（共 ${itemsCount} 题），未发现 TTS 设计问题`;
  }
  const header = `✗ 已检查 ${filesCount} 个题库文件（共 ${itemsCount} 题），` +
    `发现 ${errorCount} 个 error、${warningCount} 个 warning：`;
  const lines = issues.map(
    (it) => `  [${it.severity}:${it.rule}] ${it.file} :: ${it.itemId} (${it.path}) - ${it.message}`,
  );
  return [header, ...lines].join("\n");
}

export function run(values, positionals) {
  const targets = collectQuestionFiles(values, positionals);
  const issues = [];
  let itemsCount = 0;
  for (const target of targets) {
    if (values.verbose) console.error(`扫描 ${target.rel}`);
    const items = readJson(target.abs);
    if (!Array.isArray(items)) {
      throw notReady(`题库文件不是 JSON 数组：${target.abs}`);
    }
    itemsCount += items.length;
    issues.push(...auditItems(items, target.rel));
  }
  const errorCount = issues.filter((it) => it.severity === "error").length;
  const warningCount = issues.length - errorCount;
  const ok = issues.length === 0;
  return {
    exitCode: ok ? EXIT.OK : EXIT.FAIL,
    data: {
      ok,
      tool: "audit-course-tts",
      filesChecked: targets.length,
      itemsChecked: itemsCount,
      issueCount: issues.length,
      errorCount,
      warningCount,
      issues,
    },
    text: formatText(targets.length, itemsCount, issues, errorCount, warningCount),
  };
}

export const main = (argv = process.argv.slice(2)) =>
  runTool(
    {
      help: HELP,
      options: { file: { type: "string" } },
      allowPositionals: true,
      run,
    },
    argv,
  );

startIfEntry(import.meta.url, main);
