#!/usr/bin/env node
// 审计课程题库 JSON 的声明式 TTS 与本地拼音音频设计。

import { existsSync, readFileSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { auditItems, auditVocabulary } from "./lib/audit.mjs";
import { EXIT, notReady, runTool, startIfEntry, usageError } from "./lib/cli.mjs";

const HELP = `audit-course-tts: 审计课程题库与词表 JSON 的声明式 TTS 与本地音频设计

用法:
  node <skill-root>/scripts/audit-course-tts.mjs <课程目录> [--json]
  node <skill-root>/scripts/audit-course-tts.mjs --file <题库文件.json> [--json]

选项:
  --file <路径>   只审计单个 questions JSON 文件（与 <课程目录> 二选一）
  --json          以 JSON 输出完整审计结果
  --verbose       向 stderr 输出扫描进度
  -h, --help      显示本帮助

检查项:
- error: UNIFORM_OPTION_AUDIO（同组选项全有/全无）、TTS_BOOLEAN_SHORTHAND（禁止 tts: true/false）、
  INVALID_TTS_VOICE（仅支持 stella/tide）、EMPTY_TTS_TEXT（空朗读文本或孤立 example_tts）、
  BLANK_TTS_COOCCURRENCE（blank 与 TTS 共存 / cloze.passage 挂 TTS）、
  LISTENING_STEM_TTS_LEAK（听力题干泄露 TTS）、LISTENING_PASSAGE_INLINE_TTS / READING_FORBIDS_MEDIA、
  SEGMENT_WHITESPACE_BOUNDARY / SEGMENT_QUOTE_BOUNDARY（切片首尾空白与外围引号）、
  ENGLISH_TTS_MISSING_VOICE（英文缺 voice，含非 M/W 说话人、缺 voice_female 或非听力 transcript）、
  MIXED_ZH_EN_TTS（中英混排）、ALL_CAPS_TTS_WITHOUT_OVERRIDE（4+ 字母纯大写缺改写）、
  NON_SPEAKABLE_IN_TTS（不可直读符号/算符/下划线/IPA/单字母/中文内数字，及词表占位符 …/.../a/b/(sb.)）、
  SPEECH_TYPE_WITHOUT_AUDIO、TRANSCRIPT_TTS_DISABLED、CLOZE_PASSAGE_TTS_INCOMPLETE、
  WRITING_MISSING_SAMPLE_TTS、TRANSLATION_MISSING_SOURCE_TTS / TRANSLATION_MISSING_REFERENCE_TTS。
- warning: COARSE_TTS_SEGMENT（过长或含换行粗粒度切片 / writing 多段未拆分）、
  UNVOICED_ENGLISH_SENTENCE / UNVOICED_ENGLISH_SUBQUESTION / UNVOICED_ENGLISH_OPTIONS、
  PARTIAL_PASSAGE_TTS / PARTIAL_ANALYSIS_TTS（短文或解析英文漏配）、
  PINYIN_TTS_CONFLICT（pinyin 与 tts 重叠）、WRITING_REDUNDANT_SAMPLE_TTS /
  WRITING_UNNORMALIZED_NEWLINE、TRANSLATION_OFF_DIRECTION_TTS。
若 course.json 声明了 vocabulary_file，则自动一并审计该词表文件。不联网、不写文件。

退出码: 0 无设计问题；1 发现 error 或 warning；2 用法错误；3 路径或 JSON 读取失败。

示例:
  node <skill-root>/scripts/audit-course-tts.mjs courses/elementary-chinese
  node <skill-root>/scripts/audit-course-tts.mjs courses/beginner-english --json
  node <skill-root>/scripts/audit-course-tts.mjs --file courses/golden-course-template/questions/extended-practice.json
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

function collectCourseTargets(courseDir) {
  const dir = resolvePath(courseDir);
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    throw notReady(`课程目录不存在：${dir}`);
  }
  const manifestPath = join(dir, "course.json");
  const manifest = readJson(manifestPath);
  if (!Array.isArray(manifest.units)) {
    throw notReady(`无效的 course.json（缺少 units 数组）：${manifestPath}`);
  }
  const questionTargets = manifest.units
    .filter((u) => typeof u.question_file === "string" && u.question_file)
    .map((u) => ({ rel: u.question_file, abs: join(dir, u.question_file) }));
  let vocabTarget = null;
  if (manifest.vocabulary_file !== undefined && manifest.vocabulary_file !== null) {
    if (typeof manifest.vocabulary_file !== "string") {
      throw notReady(`无效的 course.json（vocabulary_file 必须为路径字符串）：${manifestPath}`);
    }
    if (manifest.vocabulary_file.trim() !== "") {
      vocabTarget = {
        rel: manifest.vocabulary_file,
        abs: join(dir, manifest.vocabulary_file),
      };
    }
  }
  return { questionTargets, vocabTarget };
}

function collectTargets(values, positionals) {
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
    return {
      questionTargets: [{ rel: values.file, abs: resolvePath(values.file) }],
      vocabTarget: null,
    };
  }
  return collectCourseTargets(positionals[0]);
}

function formatText(
  filesCount,
  itemsCount,
  vocabCount,
  vocabFile,
  issues,
  errorCount,
  warningCount,
) {
  const summary = vocabFile
    ? `已检查 ${filesCount} 个题库文件（共 ${itemsCount} 题）及词表 ${vocabFile}（${vocabCount} 条）`
    : `已检查 ${filesCount} 个题库文件（共 ${itemsCount} 题）`;
  if (issues.length === 0) {
    return `✓ ${summary}，未发现 TTS 设计问题`;
  }
  const header = `✗ ${summary}，发现 ${errorCount} 个 error、${warningCount} 个 warning：`;
  const lines = issues.map(
    (it) => `  [${it.severity}:${it.rule}] ${it.file} :: ${it.itemId} (${it.path}) - ${it.message}`,
  );
  return [header, ...lines].join("\n");
}

function buildResult(questionTargets, vocabTarget, verbose) {
  const issues = [];
  let itemsCount = 0;
  for (const target of questionTargets) {
    if (verbose) console.error(`扫描 ${target.rel}`);
    const items = readJson(target.abs);
    if (!Array.isArray(items)) {
      throw notReady(`题库文件不是 JSON 数组：${target.abs}`);
    }
    itemsCount += items.length;
    issues.push(...auditItems(items, target.rel));
  }
  let vocabCount = 0;
  if (vocabTarget) {
    if (verbose) console.error(`扫描 ${vocabTarget.rel}`);
    const entries = readJson(vocabTarget.abs);
    if (!Array.isArray(entries)) {
      throw notReady(`词表文件不是 JSON 数组：${vocabTarget.abs}`);
    }
    vocabCount = entries.length;
    issues.push(...auditVocabulary(entries, vocabTarget.rel));
  }
  const errorCount = issues.filter((it) => it.severity === "error").length;
  const warningCount = issues.length - errorCount;
  const ok = issues.length === 0;
  const data = {
    ok,
    tool: "audit-course-tts",
    filesChecked: questionTargets.length,
    itemsChecked: itemsCount,
    vocabularyChecked: vocabCount,
    ...(vocabTarget ? { vocabularyFile: vocabTarget.rel } : {}),
    issueCount: issues.length,
    errorCount,
    warningCount,
    issues,
  };
  return {
    exitCode: ok ? EXIT.OK : EXIT.FAIL,
    data,
    text: formatText(
      questionTargets.length,
      itemsCount,
      vocabCount,
      vocabTarget?.rel,
      issues,
      errorCount,
      warningCount,
    ),
  };
}

export function auditCourseTts(courseDir, options = {}) {
  const { questionTargets, vocabTarget } = collectCourseTargets(courseDir);
  return buildResult(questionTargets, vocabTarget, Boolean(options.verbose));
}

export function run(values, positionals) {
  const { questionTargets, vocabTarget } = collectTargets(values, positionals);
  return buildResult(questionTargets, vocabTarget, Boolean(values.verbose));
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
