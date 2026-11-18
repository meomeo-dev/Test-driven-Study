// 读取并校验使用者项目的配置文件与句库文件。格式说明见 references/project-config.md。
// 校验失败按「失败」（退出码 1）报告；文件缺失或音色未填按「未就绪」（退出码 3）报告。
// 文件格式由句库组 pathTemplate 的扩展名决定：wav、pcm 不经 ffmpeg，mp3、ogg 由 ffmpeg 编码。

import { existsSync, readFileSync } from "node:fs";
import { extname, isAbsolute, relative, resolve } from "node:path";
import { failure, notReady } from "./cli.mjs";
import { phraseKey } from "./phrase-key.mjs";

export const CONFIG_SCHEMA = "maintain-deepseek-tts-audio/config-v1";
export const DEFAULT_CONFIG_FILE = "deepseek-tts.config.json";
export const DEFAULT_ENDPOINT = "https://api.deepseek.com/v1/tools/tts";
export const DEFAULT_CREDENTIALS = Object.freeze({ env: "DEEPSEEK_API_KEY", file: ".env.deepseek-tts" });
export const DEFAULT_REQUEST = Object.freeze({ concurrency: 4, timeoutSeconds: 120, maxRetries: 3 });
export const KEY_SCHEMES = Object.freeze(["fnv1a64", "id"]);
/** 输出文件格式（pathTemplate 的扩展名）；ENCODED_FORMATS 需要 ffmpeg 编码，可设码率。 */
export const OUTPUT_FORMATS = Object.freeze(["wav", "pcm", "mp3", "ogg"]);
export const ENCODED_FORMATS = Object.freeze(["mp3", "ogg"]);
/** 处理设置可选的采样率；接口返回 24000 Hz，只降不升。 */
export const SAMPLE_RATES = Object.freeze([8000, 12000, 16000, 24000]);

const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SEGMENT_RE = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const PLACEHOLDERS = new Set(["voice", "key", "group", "set"]);

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

function check(condition, where, message) {
  if (!condition) throw failure(`配置 ${where} ${message}`);
}

/** 项目内路径：相对 root 解析，不允许越出 root。 */
function insideRoot(root, value, where) {
  check(typeof value === "string" && value.trim() !== "", where, "必须是非空字符串");
  const absolute = resolve(root, value);
  const rel = relative(root, absolute);
  check(rel !== "" && !rel.startsWith("..") && !isAbsolute(rel), where, "必须是项目根目录内的相对路径");
  return { absolute, rel };
}

function readJson(path, label) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw failure(`${label} 不是合法 JSON：${error.message}`);
  }
}

function normalizeProvider(provider = {}) {
  check(isObject(provider), "provider", "必须是对象");
  const endpoint = provider.endpoint ?? DEFAULT_ENDPOINT;
  check(/^https?:\/\//.test(endpoint), "provider.endpoint", "必须是 http(s) 地址");
  // 句库是要逐字朗读的纯文本，默认不让服务端按 Markdown 改写；接口自身的默认值是 true。
  const filterMarkdown = provider.filterMarkdown ?? false;
  check(typeof filterMarkdown === "boolean", "provider.filterMarkdown", "必须是布尔值");
  return { endpoint, filterMarkdown };
}

function normalizeCredentials(credentials = {}) {
  check(isObject(credentials), "credentials", "必须是对象");
  const env = credentials.env ?? DEFAULT_CREDENTIALS.env;
  const file = credentials.file === undefined ? DEFAULT_CREDENTIALS.file : credentials.file;
  check(/^[A-Z_][A-Z0-9_]*$/.test(env), "credentials.env", "必须是大写环境变量名");
  check(file === null || typeof file === "string", "credentials.file", "必须是路径或 null");
  return { env, file };
}

function normalizeRequest(request = {}) {
  check(isObject(request), "request", "必须是对象");
  const result = { ...DEFAULT_REQUEST, ...request };
  for (const name of ["concurrency", "timeoutSeconds"]) {
    check(Number.isInteger(result[name]) && result[name] > 0, `request.${name}`, "必须是正整数");
  }
  check(Number.isInteger(result.maxRetries) && result.maxRetries >= 0, "request.maxRetries", "必须是非负整数");
  return result;
}

function normalizeProfile(name, profile) {
  const where = `postprocess.${name}`;
  check(NAME_RE.test(name), where, "的名称只能用字母、数字、- 与 _");
  check(isObject(profile), where, "必须是对象");
  const result = { trimSilence: profile.trimSilence ?? false };
  check(typeof result.trimSilence === "boolean", `${where}.trimSilence`, "必须是布尔值");
  if (profile.bitrate !== undefined) {
    check(/^\d+k$/.test(profile.bitrate), `${where}.bitrate`, "必须形如 48k");
    result.bitrate = profile.bitrate;
  }
  if (profile.sampleRate !== undefined) {
    check(SAMPLE_RATES.includes(profile.sampleRate), `${where}.sampleRate`, `只能是 ${SAMPLE_RATES.join("、")}`);
    result.sampleRate = profile.sampleRate;
  }
  check(result.trimSilence || result.bitrate || result.sampleRate, where, "至少要有一项处理");
  return result;
}

function normalizePostprocess(postprocess) {
  if (postprocess === undefined || postprocess === null) return {};
  check(isObject(postprocess), "postprocess", "必须是对象");
  return Object.fromEntries(Object.entries(postprocess).map(([name, profile]) => [name, normalizeProfile(name, profile)]));
}

function normalizeTemplate(template, where) {
  check(typeof template === "string" && template !== "", where, "必须是字符串");
  check(!isAbsolute(template) && !template.split("/").includes(".."), where, "必须是相对路径且不含 ..");
  for (const [, name] of template.matchAll(/\{([^}]*)\}/g)) {
    check(PLACEHOLDERS.has(name), where, `不认识占位符 {${name}}`);
  }
  check(template.includes("{voice}") && template.includes("{key}"), where, "必须包含 {voice} 与 {key}");
  const format = extname(template).slice(1);
  check(OUTPUT_FORMATS.includes(format), where, `必须以 ${OUTPUT_FORMATS.map((item) => `.${item}`).join("、")} 结尾`);
  return { template, format };
}

function normalizeVoices(voices, where) {
  check(isObject(voices) && Object.keys(voices).length > 0, where, "必须是非空对象");
  for (const [name, voiceId] of Object.entries(voices)) {
    check(NAME_RE.test(name), `${where}.${name}`, "的名称只能用字母、数字、- 与 _");
    check(typeof voiceId === "string", `${where}.${name}`, "必须是 voice_id 字符串（未选时写空字符串）");
  }
  return { ...voices };
}

/** 处理设置能否用于这个格式：码率只对编码格式有意义。 */
export function checkProfileFits(profileName, profile, format, where) {
  if (profile.bitrate && !ENCODED_FORMATS.includes(format)) {
    throw failure(`${where} 用了处理设置 ${profileName}，它写了 bitrate，但 ${format} 不压缩；去掉 bitrate 或改用 .mp3、.ogg`);
  }
}

function normalizeSet(root, raw, index, postprocess) {
  const where = `sets[${index}]`;
  check(isObject(raw), where, "必须是对象");
  check(typeof raw.name === "string" && NAME_RE.test(raw.name), `${where}.name`, "只能用字母、数字、- 与 _");
  const phrases = insideRoot(root, raw.phrases, `${where}.phrases`);
  const output = insideRoot(root, raw.outputDir, `${where}.outputDir`);
  const manifestValue = raw.manifest ?? `${output.rel}/manifest.json`;
  const manifest = insideRoot(root, manifestValue, `${where}.manifest`);
  const keyScheme = raw.keyScheme ?? "fnv1a64";
  check(KEY_SCHEMES.includes(keyScheme), `${where}.keyScheme`, `只能是 ${KEY_SCHEMES.join("、")}`);
  const { template, format } = normalizeTemplate(raw.pathTemplate ?? "{voice}/{key}.wav", `${where}.pathTemplate`);
  const defaultProfile = raw.defaultProfile ?? null;
  if (defaultProfile !== null) {
    check(postprocess[defaultProfile], `${where}.defaultProfile`, "必须是 postprocess 中的名称");
    checkProfileFits(defaultProfile, postprocess[defaultProfile], format, `配置 ${where}.defaultProfile`);
  }
  return {
    name: raw.name, keyScheme, defaultProfile, format,
    phrasesPath: phrases.absolute, phrasesFile: phrases.rel,
    outputDir: output.absolute, outputDirRel: output.rel,
    manifestPath: manifest.absolute, manifestFile: manifest.rel,
    pathTemplate: template,
    voices: normalizeVoices(raw.voices, `${where}.voices`),
  };
}

/** 读配置文件并展开默认值。configOption 缺省为 <root>/deepseek-tts.config.json。 */
export function loadConfig(root, configOption) {
  const configPath = resolve(root, configOption ?? DEFAULT_CONFIG_FILE);
  if (!existsSync(configPath)) {
    throw notReady(`缺配置文件 ${relative(root, configPath) || configPath}；先运行 init-project 生成骨架`);
  }
  return parseConfig(root, readJson(configPath, "配置文件"), configPath);
}

/** 校验已解析的配置对象并展开默认值。 */
export function parseConfig(root, raw, configPath) {
  check(isObject(raw), "", "顶层必须是对象");
  check(raw.schema === CONFIG_SCHEMA, "schema", `必须是 ${CONFIG_SCHEMA}`);
  const provider = normalizeProvider(raw.provider);
  const postprocess = normalizePostprocess(raw.postprocess);
  check(Array.isArray(raw.sets) && raw.sets.length > 0, "sets", "必须是非空数组");
  const sets = raw.sets.map((set, index) => normalizeSet(root, set, index, postprocess));
  const names = sets.map((set) => set.name);
  check(new Set(names).size === names.length, "sets", "的 name 不能重复");
  return {
    root, configPath, provider, postprocess, sets,
    credentials: normalizeCredentials(raw.credentials),
    request: normalizeRequest(raw.request),
  };
}

/** 按 --set 选出要处理的句库组；未给出时返回全部。 */
export function selectSets(config, names) {
  if (!names?.length) return config.sets;
  const unknown = names.filter((name) => !config.sets.some((set) => set.name === name));
  if (unknown.length) throw failure(`配置里没有句库组：${unknown.join("、")}`);
  return config.sets.filter((set) => names.includes(set.name));
}

/** 合成前确认每套音色都填了 voice_id。 */
export function requireVoiceIds(set, voiceNames = Object.keys(set.voices)) {
  const empty = voiceNames.filter((voice) => !set.voices[voice]?.trim());
  if (empty.length) throw notReady(`句库组 ${set.name} 的音色未填：${empty.join("、")}（配置 sets[].voices）`);
}

function phraseItem(item, index, set) {
  const where = `句库 ${set.phrasesFile} 第 ${index + 1} 项`;
  const entry = typeof item === "string" ? { text: item } : item;
  if (!isObject(entry)) throw failure(`${where} 必须是字符串或对象`);
  if (typeof entry.text !== "string" || entry.text.trim() === "") throw failure(`${where} 的 text 为空`);
  if (set.keyScheme === "id") {
    if (typeof entry.id !== "string" || !SEGMENT_RE.test(entry.id)) throw failure(`${where} 的 id 缺失或含非法字符`);
  } else if (entry.id !== undefined) {
    throw failure(`${where} 写了 id，但 keyScheme 是 ${set.keyScheme}；改用 keyScheme "id" 或删除 id`);
  }
  return entry;
}

function phraseGroup(entry, where, set) {
  const usesGroup = set.pathTemplate.includes("{group}");
  if (!usesGroup && entry.group !== undefined) throw failure(`${where} 写了 group，但 pathTemplate 没有 {group}`);
  if (!usesGroup) return null;
  if (typeof entry.group !== "string" || !SEGMENT_RE.test(entry.group)) throw failure(`${where} 的 group 缺失或含非法字符`);
  return entry.group;
}

function phraseProfile(entry, where, set, postprocess) {
  const profile = entry.profile ?? set.defaultProfile;
  if (profile === null || profile === undefined) return null;
  if (!postprocess[profile]) throw failure(`${where} 的 profile「${profile}」不在配置 postprocess 中`);
  checkProfileFits(profile, postprocess[profile], set.format, where);
  return profile;
}

/** 读句库：返回去重后的条目 [{ text, key, group, profile }]。 */
export function loadPhrases(set, postprocess) {
  if (!existsSync(set.phrasesPath)) throw notReady(`缺句库文件 ${set.phrasesFile}`);
  const raw = readJson(set.phrasesPath, `句库 ${set.phrasesFile}`);
  if (!Array.isArray(raw)) throw failure(`句库 ${set.phrasesFile} 顶层必须是数组`);
  const byIdentity = new Map();
  raw.forEach((item, index) => {
    const entry = phraseItem(item, index, set);
    const where = `句库 ${set.phrasesFile} 第 ${index + 1} 项`;
    const key = set.keyScheme === "id" ? entry.id : phraseKey(entry.text);
    const phrase = { text: entry.text, key, group: phraseGroup(entry, where, set), profile: phraseProfile(entry, where, set, postprocess) };
    const identity = `${phrase.group ?? ""}/${key}`;
    const previous = byIdentity.get(identity);
    if (previous && (previous.text !== phrase.text || previous.profile !== phrase.profile)) {
      throw failure(`${where} 与前面的条目映射到同一个文件（key ${key}），但文本或 profile 不同`);
    }
    byIdentity.set(identity, phrase);
  });
  return [...byIdentity.values()];
}

/** 由路径模板得到某条句子某套音色的相对路径（相对 outputDir）。 */
export function renderPath(set, phrase, voice) {
  const values = { voice, key: phrase.key, group: phrase.group ?? "", set: set.name };
  return set.pathTemplate.replace(/\{(voice|key|group|set)\}/g, (_, name) => values[name]);
}
