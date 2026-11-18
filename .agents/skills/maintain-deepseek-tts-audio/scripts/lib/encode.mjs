// 把接口返回的 PCM 写成句库组要的文件格式，并按处理设置用 ffmpeg 加工。
// - wav：工具按实际字节数写 44 字节的 WAV 头；pcm：原样写出。两者不需要 ffmpeg。
// - mp3、ogg（Opus）：ffmpeg 编码，需要 libmp3lame 或 libopus 编码器。
// - 处理设置：trimSilence 去首尾静音（峰值低于 -40 dB 判为静音，首尾各留 30 毫秒，避免切掉
//   轻声的起音）、sampleRate 降采样、bitrate 只用于 mp3 与 ogg。wav、pcm 经 ffmpeg 加工时输出
//   原始 PCM，再由本模块写 WAV 头，因为 ffmpeg 往管道写 WAV 时无法回填长度字段。

import { spawnSync } from "node:child_process";
import { PCM_FORMAT } from "./deepseek.mjs";

const EDGE = "silenceremove=start_periods=1:start_threshold=-40dB:start_silence=0.03:detection=peak";
export const TRIM_FILTER = `${EDGE},areverse,${EDGE},areverse`;
const MAX_BUFFER = 64 * 1024 * 1024;
const WAV_HEADER_BYTES = 44;

/** 编码格式到 ffmpeg 编码器与容器。 */
export const ENCODERS = Object.freeze({
  mp3: { encoder: "libmp3lame", muxer: "mp3" },
  ogg: { encoder: "libopus", muxer: "ogg" },
});

/** 这个格式与处理设置是否要用 ffmpeg。 */
export function needsFfmpeg(format, profile) {
  return Boolean(ENCODERS[format] || profile);
}

export function ffmpegAvailable() {
  const result = spawnSync("ffmpeg", ["-hide_banner", "-version"], { stdio: "ignore" });
  return !result.error && result.status === 0;
}

/** 本机 ffmpeg 缺少的编码器名称（例如 libopus）；ffmpeg 不存在时返回全部所需编码器。 */
export function missingEncoders(formats) {
  const needed = [...new Set(formats.filter((format) => ENCODERS[format]).map((format) => ENCODERS[format].encoder))];
  if (needed.length === 0) return [];
  const result = spawnSync("ffmpeg", ["-hide_banner", "-encoders"], { encoding: "utf8", maxBuffer: MAX_BUFFER });
  if (result.error || result.status !== 0) return needed;
  return needed.filter((encoder) => !new RegExp(`\\s${encoder}\\s`).test(result.stdout));
}

/** 按 PCM_FORMAT 与给定采样率写一个 WAV 文件（RIFF 头里的长度按实际字节数填写）。 */
export function wavFromPcm(pcm, sampleRate = PCM_FORMAT.sampleRate) {
  const { channels, bitsPerSample } = PCM_FORMAT;
  const blockAlign = (channels * bitsPerSample) / 8;
  const header = Buffer.alloc(WAV_HEADER_BYTES);
  header.write("RIFF", 0, "latin1");
  header.writeUInt32LE(WAV_HEADER_BYTES - 8 + pcm.length, 4);
  header.write("WAVE", 8, "latin1");
  header.write("fmt ", 12, "latin1");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * blockAlign, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write("data", 36, "latin1");
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export function ffmpegArgs(format, profile) {
  const { sampleRate, channels } = PCM_FORMAT;
  const args = ["-hide_banner", "-loglevel", "error", "-f", "s16le", "-ar", String(sampleRate), "-ac", String(channels), "-i", "pipe:0"];
  if (profile?.trimSilence) args.push("-af", TRIM_FILTER);
  if (profile?.sampleRate) args.push("-ar", String(profile.sampleRate));
  const encoded = ENCODERS[format];
  if (!encoded) return [...args, "-f", "s16le", "pipe:1"];
  args.push("-c:a", encoded.encoder);
  if (profile?.bitrate) args.push("-b:a", profile.bitrate);
  return [...args, "-f", encoded.muxer, "pipe:1"];
}

function runFfmpeg(pcm, format, profile) {
  const result = spawnSync("ffmpeg", ffmpegArgs(format, profile), { input: pcm, maxBuffer: MAX_BUFFER });
  if (result.error) throw new Error(`ffmpeg 无法运行：${result.error.message}`);
  if (result.status !== 0) throw new Error(`ffmpeg 处理失败：${result.stderr.toString().trim().slice(0, 200)}`);
  if (result.stdout.length === 0) throw new Error("ffmpeg 处理后没有音频（可能整段都被判为静音）");
  return result.stdout;
}

/** PCM → 目标格式的文件字节。失败时抛出带原因的 Error，由调用方记为 postprocess 失败。 */
export function encodeAudio(pcm, format, profile = null) {
  if (!needsFfmpeg(format, profile)) return format === "wav" ? wavFromPcm(pcm) : pcm;
  const output = runFfmpeg(pcm, format, profile);
  if (format === "wav") return wavFromPcm(output, profile?.sampleRate ?? PCM_FORMAT.sampleRate);
  return output;
}
