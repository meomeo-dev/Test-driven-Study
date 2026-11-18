#!/usr/bin/env node
// 调用 DeepSeek 语音合成只合成缺失或过期的音频并更新音频清单
//
// Skill: maintain-deepseek-tts-audio。遵守工具箱标准：--help 必备、默认文本输出、--json 给机器、
// 退出码只用 0（成功）/ 1（失败）/ 2（用法错误）/ 3（未就绪）。

import { billableCharacters, recordFor, writeManifest } from "./lib/audio-state.mjs";
import { EXIT, notReady, positiveInteger, progress, runTool, startIfEntry } from "./lib/cli.mjs";
import { requireVoiceIds } from "./lib/config.mjs";
import { readApiKey } from "./lib/credentials.mjs";
import { ABORT_ALL, ABORT_VOICE, synthesize } from "./lib/deepseek.mjs";
import { encodeAudio, ffmpegAvailable, missingEncoders, needsFfmpeg } from "./lib/encode.mjs";
import { writeAtomic } from "./lib/files.mjs";
import { jobView, planAll } from "./lib/planning.mjs";

const HELP = `synthesize-audio: 调用 DeepSeek 语音合成只合成缺失或过期的音频并更新音频清单

用法:
  node <skill-root>/scripts/synthesize-audio.mjs --root <项目根> [--config <文件>] [--set <名称>]
       [--voice <音色名>] [--force <音色名|all>] [--limit <条数>] [--concurrency <并发>]
       [--dry-run] [--json]

选项:
  --root <目录>          使用者项目根目录（必填）
  --config <文件>        配置文件，相对 --root；默认 deepseek-tts.config.json
  --set <名称>           只处理这个句库组；可重复；默认全部
  --voice <音色名>       只合成这几套音色（逗号分隔或重复）
  --force <音色名|all>   这几套音色整套重新合成（同名音色在服务端更新后用）
  --limit <条数>         本次最多合成这么多条，其余留到下次（控制费用）
  --concurrency <并发>   同时进行的请求数；默认取配置 request.concurrency
  --dry-run              只列出将要合成的条目，不联网、不写文件
  --json                 以 JSON 输出结果
  --verbose              向 stderr 打印每条的进度与重试
  -h, --help             显示本帮助

需要网络、按计费字符收费；API Key 读自环境变量或配置声明的凭据文件，输出不含密钥。
mp3、ogg 格式与处理设置（postprocess）用到 ffmpeg。每合成成功一条就更新一次音频清单；部分
失败时重跑只补没成功的。鉴权失败或余额不足时停止派发其余请求；音色不存在时停止该音色的其余
请求；限流、服务端错误、网络错误与中途断开按退避重试（配置 request.maxRetries）。单句超过
10,000 计费字符时不发送，直接记失败。

退出码: 0 全部成功或无需合成；1 有条目失败或被跳过；2 用法错误；3 缺配置、句库、音色、API Key、
ffmpeg 或编码器。

示例:
  node <skill-root>/scripts/plan-audio.mjs --root .
  node <skill-root>/scripts/synthesize-audio.mjs --root . --dry-run
  node <skill-root>/scripts/synthesize-audio.mjs --root . --limit 20
  node <skill-root>/scripts/synthesize-audio.mjs --root . --set zh --force female
`;

const OPTIONS = {
  voice: { type: "string", multiple: true },
  force: { type: "string", multiple: true },
  limit: { type: "string" },
  concurrency: { type: "string" },
  "dry-run": { type: "boolean", default: false },
};

/** 合成前的就绪检查：voice_id、API Key、ffmpeg 与编码器。 */
function prepare(config, plans, jobs) {
  for (const plan of plans) {
    const voices = [...new Set(jobs.filter((job) => job.set === plan.set.name).map((job) => job.voice))];
    requireVoiceIds(plan.set, voices);
  }
  const apiKey = readApiKey(config);
  const formats = [...new Set(jobs.filter((job) => needsFfmpeg(job.format, job.phrase.profile)).map((job) => job.format))];
  if (formats.length && !ffmpegAvailable()) {
    throw notReady(`格式 ${formats.join("、")} 或处理设置要用 ffmpeg，本机找不到 ffmpeg（macOS 可用 brew install ffmpeg）`);
  }
  const missing = missingEncoders(formats);
  if (missing.length) throw notReady(`本机 ffmpeg 缺少编码器 ${missing.join("、")}`);
  return apiKey;
}

/** 合成一条并写文件，返回写入的字节数。 */
async function synthesizeJob(job, context) {
  const { config, apiKey, values } = context;
  const params = {
    endpoint: config.provider.endpoint, apiKey, voiceId: job.voiceId,
    text: job.phrase.text, filterMarkdown: config.provider.filterMarkdown,
  };
  const onRetry = (error, attempt, delay) =>
    progress(values, `… ${job.voice} ${job.rel} 第 ${attempt} 次重试（${error.category}：${error.message}，等 ${delay} 毫秒）`);
  const pcm = await synthesize(params, {
    timeoutMs: config.request.timeoutSeconds * 1000, maxRetries: config.request.maxRetries, onRetry,
  });
  const profile = job.phrase.profile ? config.postprocess[job.phrase.profile] : null;
  const audio = encodeAudio(pcm, job.format, profile);
  writeAtomic(job.path, audio);
  return audio.length;
}

function skipReason(job, state) {
  if (state.abortAll) return `已停止：${state.abortAll}`;
  return state.blockedVoices.get(`${job.set}/${job.voice}`);
}

/** 以固定并发跑完全部任务；单条失败不中断其余，按错误类别决定是否停止派发。 */
async function runJobs(jobs, context, concurrency) {
  const state = { next: 0, abortAll: null, blockedVoices: new Map() };
  const results = [];
  const worker = async () => {
    while (state.next < jobs.length) {
      const job = jobs[state.next++];
      const skipped = skipReason(job, state);
      if (skipped) {
        results.push({ job, status: "skipped", reason: skipped });
        continue;
      }
      try {
        const bytes = await synthesizeJob(job, context);
        const plan = context.plansByName.get(job.set);
        plan.manifest.files[job.rel] = recordFor(job, plan.set, bytes);
        writeManifest(plan.set, plan.manifest);
        results.push({ job, status: "synthesized", bytes });
        progress(context.values, `✓ ${job.set} ${job.voice} ${job.rel}「${job.phrase.text}」`);
      } catch (error) {
        const category = error.category ?? "postprocess";
        results.push({ job, status: "failed", category, error: error.message });
        console.error(`✗ ${job.set} ${job.voice} ${job.rel}「${job.phrase.text}」${category}：${error.message}`);
        if (ABORT_ALL.has(category)) state.abortAll ??= `${category}（${error.message}）`;
        if (ABORT_VOICE.has(category)) state.blockedVoices.set(`${job.set}/${job.voice}`, `音色 ${job.voice} 已停止：${error.message}`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, worker));
  return results;
}

/** 删掉清单里已不在句库中的记录；文件本身由 prune-audio 清理。 */
function dropStaleRecords(plans) {
  for (const plan of plans) {
    if (!plan.staleRecords.length) continue;
    for (const rel of plan.staleRecords) delete plan.manifest.files[rel];
    writeManifest(plan.set, plan.manifest);
  }
}

function report(results, deferred) {
  const count = (status) => results.filter((result) => result.status === status).length;
  const lines = [`合成 ${count("synthesized")} 条，失败 ${count("failed")} 条，跳过 ${count("skipped")} 条，留到下次 ${deferred} 条`];
  for (const result of results.filter((item) => item.status !== "synthesized")) {
    lines.push(`  ✗ ${result.job.voice} ${result.job.rel} ${result.category ?? "skipped"}：${result.error ?? result.reason}`);
  }
  if (count("failed")) lines.push("失败原因与处理见 references/error-handling.md；修正后重跑本命令只补没成功的条目。");
  return lines;
}

export async function run(values) {
  const { config, plans } = planAll(values);
  const limit = positiveInteger(values.limit, "--limit");
  const concurrency = positiveInteger(values.concurrency, "--concurrency") ?? config.request.concurrency;
  const allJobs = plans.flatMap((plan) => plan.jobs.map((job) => ({ ...job, format: plan.set.format })));
  const jobs = limit ? allJobs.slice(0, limit) : allJobs;
  const deferred = allJobs.length - jobs.length;
  const base = { tool: "synthesize-audio", billableCharacters: billableCharacters(jobs), deferred };
  if (values["dry-run"]) {
    const text = [`将合成 ${jobs.length} 条，计费字符约 ${base.billableCharacters}，留到下次 ${deferred} 条`, ...jobs.map((job) => `  + ${job.voice} ${job.rel} ${job.reason}「${job.phrase.text}」`)].join("\n");
    return { exitCode: EXIT.OK, data: { ok: true, dryRun: true, ...base, jobs: jobs.map(jobView) }, text };
  }
  if (jobs.length === 0) {
    dropStaleRecords(plans);
    return { exitCode: EXIT.OK, data: { ok: true, ...base, results: [] }, text: "没有要合成的条目" };
  }
  const apiKey = prepare(config, plans, jobs);
  dropStaleRecords(plans);
  const context = { config, apiKey, values, plansByName: new Map(plans.map((plan) => [plan.set.name, plan])) };
  const results = await runJobs(jobs, context, concurrency);
  const ok = results.every((result) => result.status === "synthesized");
  const data = {
    ok, ...base,
    results: results.map((result) => ({ ...jobView(result.job), status: result.status, bytes: result.bytes, category: result.category, error: result.error ?? result.reason })),
  };
  return { exitCode: ok ? EXIT.OK : EXIT.FAIL, data, text: report(results, deferred).join("\n") };
}

export const main = (argv = process.argv.slice(2)) => runTool({ help: HELP, options: OPTIONS, run }, argv);

startIfEntry(import.meta.url, main);
