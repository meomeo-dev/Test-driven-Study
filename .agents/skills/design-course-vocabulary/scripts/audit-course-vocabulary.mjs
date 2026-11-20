#!/usr/bin/env node
import { readFileSync } from "node:fs";
import path from "node:path";
import { auditVocabularyEntries } from "./lib/audit.mjs";
import { EXIT, ToolError, runTool, startIfEntry, usageError } from "./lib/cli.mjs";

const HELP = `usage: audit-course-vocabulary.mjs [<course-dir> | --file <vocab.json>] [options]

audit-course-vocabulary: 审计课程包生词本（vocabulary_file）的分类、词性、极简语法注解、例句配对与题号覆盖

参数:
  <course-dir>    课程包目录（包含 course.json，如 courses/beginner-english）
  --file <path>   仅审计单个独立词表 JSON 文件

选项:
  --strict        将警告（如 word 缺 pos、多词加冗余 pos、单元零词汇）视为失败
  --json          输出机器可读 JSON 审计结果
  --verbose       附带显示全部词条统计与逐条警告
  -h, --help      显示帮助

退出码: 0 通过；1 存在审计错误（或 --strict 下的警告）；2 用法错误；3 路径或 JSON 读取失败
`;

function readJson(filePath, label) {
  let raw;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch (error) {
    throw new ToolError(`读取 ${label} 失败（${filePath}）：${error.message}`, EXIT.NOT_READY);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new ToolError(`解析 ${label} JSON 失败（${filePath}）：${error.message}`, EXIT.NOT_READY);
  }
}

export function auditCourseVocabulary({ courseDir, filePath, strict = false }) {
  if (filePath) {
    const entries = readJson(filePath, filePath);
    const { issues, stats } = auditVocabularyEntries(entries, {
      file: path.basename(filePath),
    });
    return buildResult({ target: filePath, vocabularyFile: filePath, issues, stats, strict });
  }

  const manifestPath = path.join(courseDir, "course.json");
  const manifest = readJson(manifestPath, "course.json");
  if (!manifest.vocabulary_file) {
    throw new ToolError(`${manifestPath} 未声明 vocabulary_file`, EXIT.NOT_READY);
  }

  const unitQuestionMap = new Map();
  for (const unit of manifest.units ?? []) {
    const qSet = new Set();
    if (unit.question_file) {
      const items = readJson(path.join(courseDir, unit.question_file), unit.question_file);
      if (Array.isArray(items)) {
        for (const item of items) if (item?.id) qSet.add(item.id);
      }
    }
    unitQuestionMap.set(unit.id, qSet);
  }

  const vocabFullPath = path.join(courseDir, manifest.vocabulary_file);
  const entries = readJson(vocabFullPath, manifest.vocabulary_file);
  const { issues, stats } = auditVocabularyEntries(entries, {
    file: manifest.vocabulary_file,
    unitQuestionMap,
  });

  return buildResult({
    target: `${manifest.course_id}@${manifest.version}`,
    vocabularyFile: manifest.vocabulary_file,
    issues,
    stats,
    strict,
  });
}

function buildResult({ target, vocabularyFile, issues, stats, strict }) {
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const ok = errorCount === 0 && (!strict || warningCount === 0);
  return {
    ok,
    exitCode: ok ? EXIT.OK : EXIT.FAIL,
    data: {
      ok,
      tool: "audit-course-vocabulary",
      target,
      vocabularyFile,
      ...stats,
      issueCount: issues.length,
      errorCount,
      warningCount,
      issues,
    },
  };
}

function formatText(data, verbose) {
  const mark = data.ok ? "✓" : "✗";
  const header = `${mark} ${data.target} (${data.vocabularyFile}): ${data.entries} 词条 | pos=${data.withPos}, grammar_note=${data.withGrammarNote}, example=${data.withExample} | error=${data.errorCount}, warning=${data.warningCount}`;
  if (data.issues.length === 0) return header;
  const shown = verbose ? data.issues : data.issues.slice(0, 20);
  const lines = shown.map(
    (i) => `  [${i.severity.toUpperCase()}] ${i.rule} (${i.id ?? i.file}:${i.path}): ${i.message}`,
  );
  if (!verbose && data.issues.length > shown.length) {
    lines.push(`  ... 其余 ${data.issues.length - shown.length} 条可用 --verbose 或 --json 查看`);
  }
  return [header, ...lines].join("\n");
}

export async function main(argv) {
  return runTool(
    {
      help: HELP,
      allowPositionals: true,
      options: {
        file: { type: "string" },
        strict: { type: "boolean", default: false },
      },
      async run(values, positionals) {
        if (values.file && positionals.length > 0) {
          throw usageError("不可同时传入课程目录与 --file");
        }
        if (!values.file && positionals.length !== 1) {
          throw usageError("请提供 1 个课程目录（或使用 --file <vocab.json>）");
        }
        const res = auditCourseVocabulary({
          courseDir: positionals[0],
          filePath: values.file,
          strict: Boolean(values.strict),
        });
        return {
          exitCode: res.exitCode,
          data: res.data,
          text: formatText(res.data, Boolean(values.verbose)),
        };
      },
    },
    argv,
  );
}

startIfEntry(import.meta.url, main);
