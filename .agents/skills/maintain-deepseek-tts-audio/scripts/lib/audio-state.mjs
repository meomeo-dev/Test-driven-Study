// 句库与音频目录的比对：每条句子的每套音色对应一个文件，音频清单（manifest）逐个文件记下
// 合成时用的原文、voice_id、格式与设置指纹。文件缺失、没有记录、指纹变了或被改动过的要合成；
// 输出目录里不对应任何句子的音频文件（四种扩展名都算，换格式后旧文件也能清理）是过期文件。清单格式见 references/project-config.md。

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { failure } from "./cli.mjs";
import { OUTPUT_FORMATS, renderPath } from "./config.mjs";
import { PCM_FORMAT, billableLength } from "./deepseek.mjs";
import { listFiles, writeAtomic } from "./files.mjs";

export const MANIFEST_SCHEMA = "maintain-deepseek-tts-audio/manifest-v1";
const AUDIO_EXTENSIONS = OUTPUT_FORMATS.map((format) => `.${format}`);

export function emptyManifest(set) {
  return { schema: MANIFEST_SCHEMA, set: set.name, files: {} };
}

export function readManifest(set) {
  if (!existsSync(set.manifestPath)) return emptyManifest(set);
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(set.manifestPath, "utf8"));
  } catch (error) {
    throw failure(`音频清单 ${set.manifestFile} 不是合法 JSON：${error.message}`);
  }
  if (manifest?.schema !== MANIFEST_SCHEMA || typeof manifest.files !== "object" || manifest.files === null) {
    throw failure(`音频清单 ${set.manifestFile} 不是 ${MANIFEST_SCHEMA} 格式；移走它后重跑会把现有文件按未记录处理`);
  }
  return manifest;
}

/** 键排序后原子写入，差异只体现真实变化。 */
export function writeManifest(set, manifest) {
  const files = Object.fromEntries(Object.keys(manifest.files).sort().map((rel) => [rel, manifest.files[rel]]));
  const body = { schema: MANIFEST_SCHEMA, set: set.name, files };
  writeAtomic(set.manifestPath, `${JSON.stringify(body, null, 2)}\n`);
}

/** 影响音频内容的全部设置的摘要；接口地址不影响内容，不计入。 */
export function fingerprintOf(config, set, phrase, voiceId) {
  const payload = {
    text: phrase.text,
    voiceId,
    filterMarkdown: config.provider.filterMarkdown,
    source: PCM_FORMAT,
    format: set.format,
    postprocess: phrase.profile ? config.postprocess[phrase.profile] : null,
  };
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex").slice(0, 16);
}

/** 句库组期望存在的全部文件（全部音色），每项带期望指纹。 */
export function expectedFiles(config, set, phrases) {
  const expected = [];
  for (const [voice, voiceId] of Object.entries(set.voices)) {
    for (const phrase of phrases) {
      const rel = renderPath(set, phrase, voice);
      expected.push({ set: set.name, voice, voiceId, phrase, rel, path: join(set.outputDir, rel), fingerprint: fingerprintOf(config, set, phrase, voiceId) });
    }
  }
  const manifestRel = set.manifestPath.startsWith(`${set.outputDir}/`) ? set.manifestPath.slice(set.outputDir.length + 1) : null;
  if (manifestRel && expected.some((item) => item.rel === manifestRel)) {
    throw failure(`句库组 ${set.name} 的 pathTemplate 与音频清单路径冲突`);
  }
  return expected;
}

function changedFields(record, item) {
  const fields = [];
  if (record.text !== item.phrase.text) fields.push("text");
  if (record.voiceId !== item.voiceId) fields.push("voiceId");
  return fields.length ? fields : ["settings"];
}

/** 一个文件的状态：ok、missing、unrecorded、outdated 或 modified。 */
export function fileStatus(item, record) {
  const size = existsSync(item.path) ? statSync(item.path).size : 0;
  if (size === 0) return { status: "missing" };
  if (!record) return { status: "unrecorded" };
  if (record.fingerprint !== item.fingerprint) return { status: "outdated", changed: changedFields(record, item) };
  if (record.bytes !== size) return { status: "modified" };
  return { status: "ok" };
}

/**
 * 比对一个句库组。options.voices 限定要合成的音色，options.force 列出整套重合成的音色；
 * 过期文件总是按全部音色计算，避免只处理一套音色时把另一套误判为过期。
 */
export function planSet(config, set, phrases, options = {}) {
  const manifest = readManifest(set);
  const expected = expectedFiles(config, set, phrases);
  const expectedRels = new Set(expected.map((item) => item.rel));
  const voices = options.voices?.length ? options.voices : Object.keys(set.voices);
  const jobs = [];
  const counts = { expected: expected.length, ok: 0, missing: 0, unrecorded: 0, outdated: 0, modified: 0, forced: 0 };
  for (const item of expected) {
    const state = fileStatus(item, manifest.files[item.rel]);
    counts[state.status] += 1;
    if (!voices.includes(item.voice)) continue;
    const forced = options.force?.includes(item.voice) && state.status === "ok";
    if (forced) counts.forced += 1;
    if (state.status !== "ok" || forced) jobs.push({ ...item, reason: forced ? "forced" : state.status, changed: state.changed });
  }
  const stale = listFiles(set.outputDir, AUDIO_EXTENSIONS).filter((rel) => !expectedRels.has(rel));
  const staleRecords = Object.keys(manifest.files).filter((rel) => !expectedRels.has(rel));
  return { set, manifest, expected, jobs, stale, staleRecords, counts };
}

/** 按官方口径估算的计费字符（汉字 2 个，其他 1 个）；实际计费以服务端为准。 */
export function billableCharacters(jobs) {
  return jobs.reduce((sum, job) => sum + billableLength(job.phrase.text), 0);
}

/** 合成成功后写入的清单记录。 */
export function recordFor(item, set, bytes) {
  const record = { voice: item.voice, key: item.phrase.key, text: item.phrase.text, voiceId: item.voiceId, format: set.format, fingerprint: item.fingerprint, bytes };
  if (item.phrase.group) record.group = item.phrase.group;
  if (item.phrase.profile) record.profile = item.phrase.profile;
  return record;
}

/**
 * 校验文件头：wav 要有 RIFF/WAVE 且 RIFF 长度与文件大小一致；mp3 以 ID3 标签或 MPEG 帧同步
 * 开头；ogg 以 OggS 开头；pcm 没有文件头，只要求字节数为偶数（16 位样本）。
 */
export function audioHeaderValid(path, format) {
  const data = readFileSync(path);
  if (format === "wav") {
    return data.length >= 44 && data.toString("latin1", 0, 4) === "RIFF" && data.toString("latin1", 8, 12) === "WAVE" && data.readUInt32LE(4) === data.length - 8;
  }
  if (format === "mp3") return data.toString("latin1", 0, 3) === "ID3" || (data[0] === 0xff && (data[1] & 0xe0) === 0xe0);
  if (format === "ogg") return data.toString("latin1", 0, 4) === "OggS";
  return data.length % 2 === 0;
}
