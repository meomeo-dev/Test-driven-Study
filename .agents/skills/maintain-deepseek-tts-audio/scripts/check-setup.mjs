#!/usr/bin/env node
// 只读核对配置、句库、凭据、文件权限、Git 忽略与 ffmpeg 是否就绪
//
// Skill: maintain-deepseek-tts-audio。遵守工具箱标准：--help 必备、默认文本输出、--json 给机器、
// 退出码只用 0（成功）/ 1（失败）/ 2（用法错误）/ 3（未就绪）。

import { existsSync } from "node:fs";
import { relative } from "node:path";
import { readManifest } from "./lib/audio-state.mjs";
import { EXIT, ToolError, requireRoot, runTool, startIfEntry } from "./lib/cli.mjs";
import { loadConfig, loadPhrases } from "./lib/config.mjs";
import { describeCredential } from "./lib/credentials.mjs";
import { DOCUMENTED_VOICES } from "./lib/deepseek.mjs";
import { ffmpegAvailable, missingEncoders, needsFfmpeg } from "./lib/encode.mjs";

const HELP = `check-setup: 只读核对配置、句库、凭据、文件权限、Git 忽略与 ffmpeg 是否就绪

用法:
  node <skill-root>/scripts/check-setup.mjs --root <项目根> [--config <文件>] [--json]

选项:
  --root <目录>     使用者项目根目录（必填）
  --config <文件>   配置文件，相对 --root；默认 deepseek-tts.config.json
  --json            以 JSON 输出结果
  --verbose         向 stderr 打印进度
  -h, --help        显示本帮助

逐项给出 ok、warn、fail 或 not-ready：配置与句库能否解析、每套音色是否填了 voice_id（不在文档
列出的 stella、tide 之中时警告）、API Key 来自环境变量还是凭据文件、凭据文件权限是否为仅所有者
可读写、是否被 Git 忽略、要用的 ffmpeg 与编码器是否存在。凭据文件里找不到 Key 时列出文件里的变量名与
格式问题（冒号写法、被注释、同名空值、BOM）。只报告变量名、计数与文件路径，不读出也不打印
API Key 的值；不联网，不验证 Key 是否有效。

退出码: 0 全部就绪；1 有 fail 项（配置有误、凭据文件权限过宽或未被 Git 忽略）；2 用法错误；
3 有 not-ready 项（缺文件、音色未填、没有 API Key、缺 ffmpeg 或编码器）。

示例:
  node <skill-root>/scripts/check-setup.mjs --root .
  node <skill-root>/scripts/check-setup.mjs --root . --json
`;

const item = (id, status, message) => ({ id, status, message });

function checkVoices(set) {
  const entries = Object.entries(set.voices);
  const empty = entries.filter(([, voiceId]) => !voiceId.trim()).map(([voice]) => voice);
  if (empty.length) return [item(`set:${set.name}:voices`, "not-ready", `音色未填：${empty.join("、")}（配置 sets[].voices）`)];
  const checks = [item(`set:${set.name}:voices`, "ok", entries.map(([voice, voiceId]) => `${voice}=${voiceId}`).join("，"))];
  const unknown = entries.filter(([, voiceId]) => !DOCUMENTED_VOICES.includes(voiceId)).map(([voice, voiceId]) => `${voice}=${voiceId}`);
  if (unknown.length) {
    checks.push(item(`set:${set.name}:voice-ids`, "warn", `${unknown.join("、")} 不在文档列出的音色（${DOCUMENTED_VOICES.join("、")}）中；先用 preview-voice 试一句`));
  }
  return checks;
}

function checkSets(config) {
  const checks = [];
  const ffmpegFormats = new Set();
  for (const set of config.sets) {
    try {
      const phrases = loadPhrases(set, config.postprocess);
      if (phrases.some((phrase) => needsFfmpeg(set.format, phrase.profile))) ffmpegFormats.add(set.format);
      checks.push(item(`set:${set.name}:phrases`, "ok", `句库 ${set.phrasesFile}：${phrases.length} 句，格式 ${set.format}`));
      readManifest(set);
    } catch (error) {
      if (!(error instanceof ToolError)) throw error;
      checks.push(item(`set:${set.name}:phrases`, error.exitCode === EXIT.NOT_READY ? "not-ready" : "fail", error.message));
    }
    checks.push(...checkVoices(set));
    if (!existsSync(set.outputDir)) checks.push(item(`set:${set.name}:output`, "warn", `输出目录 ${set.outputDirRel} 还不存在，首次合成时创建`));
  }
  return { checks, ffmpegFormats: [...ffmpegFormats] };
}

function checkCredential(config) {
  const info = describeCredential(config);
  const checks = [];
  const fileRel = info.file.path;
  if (info.source === "env") checks.push(item("credential", "ok", `API Key 来自环境变量 ${info.name}`));
  else if (info.source === "file") checks.push(item("credential", "ok", `API Key 来自凭据文件 ${fileRel}`));
  else checks.push(item("credential", "not-ready", `环境变量 ${info.name} 未设置${fileRel ? `，凭据文件 ${fileRel} ${info.file.exists ? `没有 ${info.name} 的值${info.file.hint ? `（${info.file.hint}）` : ""}` : "不存在（init-project 可生成模板）"}` : ""}`));
  if (!info.file.exists) return checks;
  checks.push(info.file.ownerOnly
    ? item("credential-file:mode", "ok", `凭据文件 ${fileRel} 权限仅所有者可读写`)
    : item("credential-file:mode", "fail", `凭据文件 ${fileRel} 权限过宽；运行 init-project 修正为 600`));
  const git = {
    ignored: item("credential-file:git", "ok", `凭据文件 ${fileRel} 已被 Git 忽略`),
    "not-ignored": item("credential-file:git", "fail", `凭据文件 ${fileRel} 没有被 Git 忽略；在它所在仓库的 .gitignore 中忽略它`),
    tracked: item("credential-file:git", "fail", `凭据文件 ${fileRel} 已被 Git 跟踪；git rm --cached 后加入 .gitignore，并作废旧 Key`),
    "no-git": item("credential-file:git", "warn", "不是 Git 仓库或没有 git，跳过忽略检查"),
  }[info.file.git];
  checks.push(git);
  return checks;
}

function checkFfmpeg(formats) {
  if (formats.length === 0) return [];
  if (!ffmpegAvailable()) return [item("ffmpeg", "not-ready", `格式 ${formats.join("、")} 或处理设置要用 ffmpeg，本机找不到（macOS 可用 brew install ffmpeg）`)];
  const missing = missingEncoders(formats);
  if (missing.length) return [item("ffmpeg", "not-ready", `本机 ffmpeg 缺少编码器 ${missing.join("、")}`)];
  return [item("ffmpeg", "ok", "ffmpeg 与所需编码器可用")];
}

function collect(root, values) {
  let config;
  try {
    config = loadConfig(root, values.config);
  } catch (error) {
    if (!(error instanceof ToolError)) throw error;
    return [item("config", error.exitCode === EXIT.NOT_READY ? "not-ready" : "fail", error.message)];
  }
  const checks = [item("config", "ok", `配置 ${relative(root, config.configPath)}：${config.sets.length} 个句库组，filter_markdown ${config.provider.filterMarkdown}`)];
  if (!config.provider.endpoint.startsWith("https://")) checks.push(item("endpoint", "warn", `接口地址不是 https：${config.provider.endpoint}（只应用于本地模拟服务）`));
  const sets = checkSets(config);
  checks.push(...sets.checks, ...checkCredential(config), ...checkFfmpeg(sets.ffmpegFormats));
  return checks;
}

export function run(values) {
  const checks = collect(requireRoot(values), values);
  const has = (status) => checks.some((check) => check.status === status);
  const exitCode = has("fail") ? EXIT.FAIL : has("not-ready") ? EXIT.NOT_READY : EXIT.OK;
  const mark = { ok: "✓", warn: "!", fail: "✗", "not-ready": "…" };
  const text = checks.map((check) => `${mark[check.status]} ${check.status} ${check.message}`).join("\n");
  return { exitCode, data: { ok: exitCode === EXIT.OK, tool: "check-setup", checks }, text };
}

export const main = (argv = process.argv.slice(2)) => runTool({ help: HELP, options: {}, run }, argv);

startIfEntry(import.meta.url, main);
