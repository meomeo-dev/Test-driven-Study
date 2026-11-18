#!/usr/bin/env node
// 删除不在句库中的音频文件，默认只预览
//
// Skill: maintain-deepseek-tts-audio。遵守工具箱标准：--help 必备、默认文本输出、--json 给机器、
// 退出码只用 0（成功）/ 1（失败）/ 2（用法错误）/ 3（未就绪）。

import { rmSync } from "node:fs";
import { join } from "node:path";
import { writeManifest } from "./lib/audio-state.mjs";
import { EXIT, runTool, startIfEntry } from "./lib/cli.mjs";
import { removeEmptyDirs } from "./lib/files.mjs";
import { planAll } from "./lib/planning.mjs";

const HELP = `prune-audio: 删除不在句库中的音频文件，默认只预览

用法:
  node <skill-root>/scripts/prune-audio.mjs --root <项目根> [--config <文件>] [--set <名称>]
       [--apply] [--json]

选项:
  --root <目录>     使用者项目根目录（必填）
  --config <文件>   配置文件，相对 --root；默认 deepseek-tts.config.json
  --set <名称>      只处理这个句库组；可重复；默认全部
  --apply           真正删除；不加时只列出将删除的文件（dry-run）
  --json            以 JSON 输出结果
  --verbose         向 stderr 打印进度
  -h, --help        显示本帮助

过期文件指 outputDir 下扩展名为 .wav、.pcm、.mp3 或 .ogg、却不对应句库任何句子与任何已配置音色的
文件（句子改了或删了、音色从配置里删了）。--apply 同时删掉音频清单里对应的记录和因此变空的
子目录。outputDir 只应存放本 Skill 生成的音频。不联网。

退出码: 0 预览或删除完成；1 配置或句库有误；2 用法错误；3 缺配置或句库文件。

示例:
  node <skill-root>/scripts/prune-audio.mjs --root .
  node <skill-root>/scripts/prune-audio.mjs --root . --set zh --apply
`;

const OPTIONS = {
  apply: { type: "boolean", default: false },
};

function pruneSet(plan) {
  for (const rel of plan.stale) rmSync(join(plan.set.outputDir, rel), { force: true });
  for (const rel of plan.staleRecords) delete plan.manifest.files[rel];
  if (plan.staleRecords.length) writeManifest(plan.set, plan.manifest);
  return removeEmptyDirs(plan.set.outputDir);
}

export function run(values) {
  const { plans } = planAll(values);
  const sets = plans.map((plan) => {
    const removedDirs = values.apply ? pruneSet(plan) : [];
    return { set: plan.set.name, outputDir: plan.set.outputDirRel, files: plan.stale, records: plan.staleRecords, removedDirs };
  });
  const verb = values.apply ? "已删除" : "将删除";
  const lines = [];
  for (const item of sets) {
    lines.push(`句库组 ${item.set}：${verb} ${item.files.length} 个文件、${item.records.length} 条清单记录（${item.outputDir}）`);
    for (const rel of item.files) lines.push(`  - ${rel}`);
    for (const dir of item.removedDirs) lines.push(`  - ${dir}/（空目录）`);
  }
  if (!values.apply && sets.some((item) => item.files.length || item.records.length)) lines.push("确认无误后加 --apply 删除。");
  return { exitCode: EXIT.OK, data: { ok: true, tool: "prune-audio", applied: values.apply, sets }, text: lines.join("\n") };
}

export const main = (argv = process.argv.slice(2)) => runTool({ help: HELP, options: OPTIONS, run }, argv);

startIfEntry(import.meta.url, main);
