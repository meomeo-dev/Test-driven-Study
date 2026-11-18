#!/usr/bin/env node
// 核对每条句子的每套音色都有与当前设置一致的音频，且没有多余文件
//
// Skill: maintain-deepseek-tts-audio。遵守工具箱标准：--help 必备、默认文本输出、--json 给机器、
// 退出码只用 0（成功）/ 1（失败）/ 2（用法错误）/ 3（未就绪）。

import { audioHeaderValid, fileStatus } from "./lib/audio-state.mjs";
import { EXIT, runTool, startIfEntry } from "./lib/cli.mjs";
import { planAll } from "./lib/planning.mjs";

const HELP = `verify-audio: 核对每条句子的每套音色都有与当前设置一致的音频，且没有多余文件

用法:
  node <skill-root>/scripts/verify-audio.mjs --root <项目根> [--config <文件>] [--set <名称>] [--json]

选项:
  --root <目录>     使用者项目根目录（必填）
  --config <文件>   配置文件，相对 --root；默认 deepseek-tts.config.json
  --set <名称>      只核对这个句库组；可重复；默认全部
  --json            以 JSON 输出结果
  --verbose         向 stderr 打印进度
  -h, --help        显示本帮助

逐项核对：文件存在且非空（missing）、清单有记录（unrecorded）、记录的原文、voice_id、格式与
设置和当前配置一致（outdated）、文件大小与记录一致（modified）、文件头与格式相符（invalid-audio：
wav 查 RIFF 头与长度字段，mp3、ogg 查文件头，pcm 查字节数为偶数）、outputDir 下没有不在句库中
的文件（stale）。不联网、不写文件。

退出码: 0 齐全且一致；1 有任何一项不符或配置有误；2 用法错误；3 缺配置或句库文件。

示例:
  node <skill-root>/scripts/verify-audio.mjs --root .
  node <skill-root>/scripts/verify-audio.mjs --root . --set zh --json
`;

const CATEGORIES = ["missing", "unrecorded", "outdated", "modified", "invalid-audio", "stale"];

function verifySet(plan) {
  const problems = Object.fromEntries(CATEGORIES.map((category) => [category, []]));
  for (const item of plan.expected) {
    const state = fileStatus(item, plan.manifest.files[item.rel]);
    if (state.status !== "ok") problems[state.status].push(item.rel);
    else if (!audioHeaderValid(item.path, plan.set.format)) problems["invalid-audio"].push(item.rel);
  }
  problems.stale = plan.stale;
  const count = CATEGORIES.reduce((sum, category) => sum + problems[category].length, 0);
  return { set: plan.set.name, expected: plan.expected.length, ok: count === 0, problems };
}

function render(result) {
  if (result.ok) return `✓ 句库组 ${result.set}：${result.expected} 个文件齐全且与配置一致，没有多余文件`;
  const lines = [`✗ 句库组 ${result.set}：期望 ${result.expected} 个文件，有问题的如下`];
  for (const category of CATEGORIES) {
    for (const rel of result.problems[category]) lines.push(`  ${category} ${rel}`);
  }
  return lines.join("\n");
}

export function run(values) {
  const { plans } = planAll(values);
  const sets = plans.map(verifySet);
  const ok = sets.every((result) => result.ok);
  const hint = ok ? "" : "\n补齐与更新：synthesize-audio；清理多余文件：prune-audio。";
  return { exitCode: ok ? EXIT.OK : EXIT.FAIL, data: { ok, tool: "verify-audio", sets }, text: sets.map(render).join("\n") + hint };
}

export const main = (argv = process.argv.slice(2)) => runTool({ help: HELP, options: {}, run }, argv);

startIfEntry(import.meta.url, main);
