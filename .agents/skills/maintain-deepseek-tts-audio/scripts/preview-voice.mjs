#!/usr/bin/env node
// 用已配置的音色或指定 voice_id 合成一句试听，写到仓库之外
//
// Skill: maintain-deepseek-tts-audio。遵守工具箱标准：--help 必备、默认文本输出、--json 给机器、
// 退出码只用 0（成功）/ 1（失败）/ 2（用法错误）/ 3（未就绪）。

import { tmpdir } from "node:os";
import { isAbsolute, join, resolve } from "node:path";
import { EXIT, failure, notReady, requireRoot, runTool, startIfEntry, usageError } from "./lib/cli.mjs";
import { OUTPUT_FORMATS, checkProfileFits, loadConfig, selectSets } from "./lib/config.mjs";
import { readApiKey } from "./lib/credentials.mjs";
import { synthesize } from "./lib/deepseek.mjs";
import { encodeAudio, ffmpegAvailable, missingEncoders, needsFfmpeg } from "./lib/encode.mjs";
import { writeAtomic } from "./lib/files.mjs";

const HELP = `preview-voice: 用已配置的音色或指定 voice_id 合成一句试听，写到仓库之外

用法:
  node <skill-root>/scripts/preview-voice.mjs --root <项目根> --text "<句子>"
       (--voice <音色名> | --voice-id <voice_id>) [--set <名称>] [--format <格式>]
       [--profile <名称>] [--out <文件>] [--dry-run] [--json]

选项:
  --root <目录>         使用者项目根目录（必填）
  --config <文件>       配置文件，相对 --root；默认 deepseek-tts.config.json
  --text <句子>         要试听的句子（必填）
  --voice <音色名>      用配置里这套音色的 voice_id
  --voice-id <id>       直接试一个 voice_id（例如 stella、tide）
  --set <名称>          取音色与格式的句库组；默认第一个
  --format <格式>       wav、pcm、mp3 或 ogg；默认取句库组的格式
  --profile <名称>      按配置 postprocess 的这个处理设置处理后再写出（要 ffmpeg）
  --out <文件>          输出文件；默认系统临时目录下 maintain-deepseek-tts-audio/preview-<音色>-<时间>.<格式>
  --now <ISO 时间>      默认文件名里的时间，用于复现；默认当前时间
  --dry-run             只打印将使用的 voice_id、格式与输出路径，不联网
  --json                以 JSON 输出结果
  --verbose             向 stderr 打印重试
  -h, --help            显示本帮助

需要网络、按计费字符收费；API Key 读自环境变量或配置声明的凭据文件，输出不含密钥。试听文件
不写进句库的输出目录，也不进音频清单；macOS 可用 afplay <文件> 播放。

退出码: 0 已写出试听文件；1 合成失败；2 用法错误；3 缺配置、音色、API Key、ffmpeg 或编码器。

示例:
  node <skill-root>/scripts/preview-voice.mjs --root . --text "我想喝水" --voice female
  node <skill-root>/scripts/preview-voice.mjs --root . --text "我想喝水" --voice-id tide --format mp3
`;

const OPTIONS = {
  text: { type: "string" },
  voice: { type: "string" },
  "voice-id": { type: "string" },
  format: { type: "string" },
  profile: { type: "string" },
  out: { type: "string" },
  now: { type: "string" },
  "dry-run": { type: "boolean", default: false },
};

function chooseVoice(set, values) {
  const voiceId = values["voice-id"];
  if (voiceId && values.voice) throw usageError("--voice 与 --voice-id 只能给一个");
  if (voiceId) return { label: voiceId, voiceId };
  if (!values.voice) throw usageError("缺少 --voice <音色名> 或 --voice-id <voice_id>");
  if (!(values.voice in set.voices)) throw usageError(`句库组 ${set.name} 没有音色 ${values.voice}（已有 ${Object.keys(set.voices).join("、")}）`);
  const configured = set.voices[values.voice].trim();
  if (!configured) throw notReady(`句库组 ${set.name} 的音色 ${values.voice} 未填 voice_id`);
  return { label: values.voice, voiceId: configured };
}

function chooseFormat(set, values) {
  const format = values.format ?? set.format;
  if (!OUTPUT_FORMATS.includes(format)) throw usageError(`--format 只能是 ${OUTPUT_FORMATS.join("、")}`);
  return format;
}

function chooseProfile(config, values, format) {
  if (!values.profile) return null;
  const profile = config.postprocess[values.profile];
  if (!profile) throw usageError(`配置 postprocess 中没有 ${values.profile}`);
  checkProfileFits(values.profile, profile, format, "--profile");
  return profile;
}

function outputPath(values, root, label, format) {
  if (values.out) return isAbsolute(values.out) ? values.out : resolve(root, values.out);
  const now = values.now ? new Date(values.now) : new Date();
  if (Number.isNaN(now.getTime())) throw usageError("--now 必须是 ISO 时间，例如 2026-11-17T10:00:00Z");
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const safeLabel = label.replace(/[^A-Za-z0-9_-]/g, "_");
  return join(tmpdir(), "maintain-deepseek-tts-audio", `preview-${safeLabel}-${stamp}.${format}`);
}

function requireFfmpeg(format, profile) {
  if (!needsFfmpeg(format, profile)) return;
  if (!ffmpegAvailable()) throw notReady(`格式 ${format} 或 --profile 要用 ffmpeg，本机找不到 ffmpeg`);
  const missing = missingEncoders([format]);
  if (missing.length) throw notReady(`本机 ffmpeg 缺少编码器 ${missing.join("、")}`);
}

export async function run(values) {
  const root = requireRoot(values);
  if (!values.text?.trim()) throw usageError("缺少 --text <句子>");
  const config = loadConfig(root, values.config);
  const set = values.set?.length ? selectSets(config, values.set.slice(0, 1))[0] : config.sets[0];
  const { label, voiceId } = chooseVoice(set, values);
  const format = chooseFormat(set, values);
  const profile = chooseProfile(config, values, format);
  const out = outputPath(values, root, label, format);
  const info = { tool: "preview-voice", set: set.name, voiceId, format, out, profile: values.profile ?? null };
  if (values["dry-run"]) return { exitCode: EXIT.OK, data: { ok: true, dryRun: true, ...info }, text: `将用 ${voiceId} 合成 ${format}，写到 ${out}` };
  const apiKey = readApiKey(config);
  requireFfmpeg(format, profile);
  let audio;
  try {
    const pcm = await synthesize(
      { endpoint: config.provider.endpoint, apiKey, voiceId, text: values.text, filterMarkdown: config.provider.filterMarkdown },
      { timeoutMs: config.request.timeoutSeconds * 1000, maxRetries: config.request.maxRetries, onRetry: (error, attempt) => values.verbose && console.error(`… 第 ${attempt} 次重试：${error.message}`) },
    );
    audio = encodeAudio(pcm, format, profile);
  } catch (error) {
    const category = error.category ?? "postprocess";
    throw failure(`合成失败 ${category}：${error.message}`, { category });
  }
  writeAtomic(out, audio);
  return { exitCode: EXIT.OK, data: { ok: true, ...info, bytes: audio.length }, text: `已写 ${out}（${voiceId}，${format}，${audio.length} 字节）；macOS 可用 afplay 播放` };
}

export const main = (argv = process.argv.slice(2)) => runTool({ help: HELP, options: OPTIONS, run }, argv);

startIfEntry(import.meta.url, main);
