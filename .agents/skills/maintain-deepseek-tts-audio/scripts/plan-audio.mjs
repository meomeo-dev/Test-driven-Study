#!/usr/bin/env node
// 比对句库与现有音频，列出要合成的条目与不在句库中的文件，不联网不写文件
//
// Skill: maintain-deepseek-tts-audio。遵守工具箱标准：--help 必备、默认文本输出、--json 给机器、
// 退出码只用 0（成功）/ 1（失败）/ 2（用法错误）/ 3（未就绪）。

import { billableCharacters } from "./lib/audio-state.mjs";
import { EXIT, runTool, startIfEntry } from "./lib/cli.mjs";
import { jobView, planAll } from "./lib/planning.mjs";

const HELP = `plan-audio: 比对句库与现有音频，列出要合成的条目与不在句库中的文件，不联网不写文件

用法:
  node <skill-root>/scripts/plan-audio.mjs --root <项目根> [--config <文件>] [--set <名称>]
       [--voice <音色名>] [--force <音色名|all>] [--list] [--json]

选项:
  --root <目录>        使用者项目根目录（必填）
  --config <文件>      配置文件，相对 --root；默认 deepseek-tts.config.json
  --set <名称>         只看这个句库组；可重复；默认全部
  --voice <音色名>     只列这几套音色要合成的条目（逗号分隔或重复）；过期文件仍按全部音色计算
  --force <音色名|all> 把这几套音色的全部条目都算作要合成（换了同名音色的新版本时用）
  --list               列出全部条目；默认每组最多列 30 条
  --json               以 JSON 输出全部条目
  --verbose            向 stderr 打印进度
  -h, --help           显示本帮助

原因: missing 文件缺失或为空；unrecorded 有文件但清单没有记录；outdated 原文、voice_id、
格式或设置变了；modified 文件大小与清单记录不同；forced 由 --force 指定。

退出码: 0 比对完成（不论有没有要合成的条目）；1 配置或句库有误；2 用法错误；3 缺配置或句库文件。

示例:
  node <skill-root>/scripts/plan-audio.mjs --root .
  node <skill-root>/scripts/plan-audio.mjs --root . --set zh --force female --json
`;

const OPTIONS = {
  voice: { type: "string", multiple: true },
  force: { type: "string", multiple: true },
  list: { type: "boolean", default: false },
};

const PREVIEW_LIMIT = 30;

function summaryOf(plan) {
  const reasons = {};
  for (const job of plan.jobs) reasons[job.reason] = (reasons[job.reason] ?? 0) + 1;
  return {
    set: plan.set.name, phrases: plan.phraseCount, voices: Object.keys(plan.set.voices),
    outputDir: plan.set.outputDirRel, toSynthesize: plan.jobs.length, reasons,
    billableCharacters: billableCharacters(plan.jobs), stale: plan.stale, staleRecords: plan.staleRecords,
    jobs: plan.jobs.map(jobView),
  };
}

function renderSummary(summary, listAll) {
  const reasons = Object.entries(summary.reasons).map(([reason, count]) => `${reason} ${count}`).join("，");
  const lines = [
    `句库组 ${summary.set}：${summary.phrases} 句 × ${summary.voices.length} 套音色（${summary.voices.join("、")}），输出 ${summary.outputDir}`,
    `  要合成 ${summary.toSynthesize} 条${reasons ? `（${reasons}）` : ""}，计费字符约 ${summary.billableCharacters}`,
    `  不在句库中的文件 ${summary.stale.length} 个；清单中多余的记录 ${summary.staleRecords.length} 条`,
  ];
  const shown = listAll ? summary.jobs : summary.jobs.slice(0, PREVIEW_LIMIT);
  for (const job of shown) lines.push(`  + ${job.voice} ${job.file} ${job.reason}${job.changed ? `(${job.changed.join(",")})` : ""}「${job.text}」`);
  if (shown.length < summary.jobs.length) lines.push(`  … 另有 ${summary.jobs.length - shown.length} 条，加 --list 或 --json 查看全部`);
  const staleShown = listAll ? summary.stale : summary.stale.slice(0, PREVIEW_LIMIT);
  for (const rel of staleShown) lines.push(`  - ${rel}（不在句库中，prune-audio 可清理）`);
  if (staleShown.length < summary.stale.length) lines.push(`  … 另有 ${summary.stale.length - staleShown.length} 个过期文件`);
  return lines.join("\n");
}

export function run(values) {
  const { plans } = planAll(values);
  const sets = plans.map(summaryOf);
  const text = sets.map((summary) => renderSummary(summary, values.list)).join("\n");
  return { exitCode: EXIT.OK, data: { ok: true, tool: "plan-audio", sets }, text };
}

export const main = (argv = process.argv.slice(2)) => runTool({ help: HELP, options: OPTIONS, run }, argv);

startIfEntry(import.meta.url, main);
