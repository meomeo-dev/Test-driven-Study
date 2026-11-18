// DeepSeek 语音合成整段接口：一段文本 → 24 kHz、16 位、单声道的原始 PCM。
// 接口形态、上限与错误判定见 references/deepseek-tts-api.md 与 references/error-handling.md。
// - 鉴权：请求头 Authorization: Bearer <API Key>；接口没有模型参数。
// - 请求：JSON { text, voice_id, format, filter_markdown }；本模块固定请求 pcm，WAV 头由
//   encode.mjs 按实际字节数写出，不依赖流式返回的 WAV 头。
// - 回包：音频边合成边写进响应体；中途断开的响应按失败处理（官方要求）。
// 错误信息只含 HTTP 状态与服务端 message 摘要（其中的 Key 被遮盖），不含密钥与回包原文。

/** 接口返回的 PCM 规格；写 WAV 头与 ffmpeg 读入都按它。 */
export const PCM_FORMAT = Object.freeze({ sampleRate: 24_000, channels: 1, bitsPerSample: 16 });
/** 单次请求上限：计费字符与请求体字节数。 */
export const MAX_BILLABLE_CHARACTERS = 10_000;
export const MAX_BODY_BYTES = 64 * 1024;
/** 2026-11-17 官方文档列出的音色；check-setup 对其他取值只给警告，以接口实际应答为准。 */
export const DOCUMENTED_VOICES = Object.freeze(["stella", "tide"]);

const MESSAGE_LIMIT = 160;
const MAX_RETRY_AFTER_MS = 60_000;
const HAN = /\p{Script=Han}/u;

/** 可重试的类别：限流、服务端错误、网络错误与中途断开。 */
export const RETRYABLE = new Set(["rate-limit", "server", "network", "interrupted"]);
/** 出现后其余请求也必然失败、应停止派发的类别。 */
export const ABORT_ALL = new Set(["auth", "balance"]);
/** 出现后同一音色的其余请求应停止派发的类别。 */
export const ABORT_VOICE = new Set(["voice"]);

export class SynthesisError extends Error {
  constructor(category, message, extra = {}) {
    super(message);
    this.category = category;
    Object.assign(this, extra);
  }
}

/** 计费字符：汉字算 2 个，英文字母、数字、空格与其他字符算 1 个（官方口径，标点按其他字符）。 */
export function billableLength(text) {
  let count = 0;
  for (const char of text) count += HAN.test(char) ? 2 : 1;
  return count;
}

/** 构造请求；format 固定为 pcm。 */
export function buildRequest({ endpoint, apiKey, voiceId, text, filterMarkdown }) {
  const body = JSON.stringify({ text, voice_id: voiceId, format: "pcm", filter_markdown: filterMarkdown });
  const headers = { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" };
  return { url: endpoint, init: { method: "POST", headers, body } };
}

/** 发送前检查单次上限，超出时不发请求、不计费。 */
export function checkInputLimits(text, body) {
  const characters = billableLength(text);
  if (characters > MAX_BILLABLE_CHARACTERS) {
    throw new SynthesisError("text", `计费字符 ${characters} 超过单次上限 ${MAX_BILLABLE_CHARACTERS}，没有发送；把这条句子拆短`);
  }
  const bytes = Buffer.byteLength(body);
  if (bytes > MAX_BODY_BYTES) {
    throw new SynthesisError("text", `请求体 ${bytes} 字节超过上限 ${MAX_BODY_BYTES}，没有发送；把这条句子拆短`);
  }
}

function summarize(message, apiKey) {
  if (typeof message !== "string" || message === "") return "";
  const masked = apiKey ? message.split(apiKey).join("***") : message;
  const oneLine = masked.replace(/\s+/g, " ").trim();
  return oneLine.length > MESSAGE_LIMIT ? `${oneLine.slice(0, MESSAGE_LIMIT)}…` : oneLine;
}

/** 从错误回包里取 message：{"error":{"message"}}、{"message"} 或纯文本。 */
function errorMessage(body) {
  try {
    const parsed = JSON.parse(body);
    const message = parsed?.error?.message ?? parsed?.message ?? parsed?.detail;
    return typeof message === "string" ? message : "";
  } catch {
    return body;
  }
}

/** 没有 Retry-After 时返回 undefined，由调用方指数退避（Number(null) 是 0，要先判空）。 */
function retryAfterMs(response) {
  const header = response.headers.get("retry-after");
  if (header === null) return undefined;
  const seconds = Number(header);
  return Number.isFinite(seconds) && seconds >= 0 ? Math.min(seconds * 1000, MAX_RETRY_AFTER_MS) : undefined;
}

/**
 * HTTP 状态到类别。音色不存在时实测返回 HTTP 400，message 形如 Invalid voice_id 'nova': supported
 * values are …（2026-11-17）；因此 400 与 422 的 message 提到 voice 时归为音色问题，其余 400 归为文本问题。
 */
export function categoryForStatus(status, message) {
  if (status === 401 || status === 403) return "auth";
  if (status === 402) return "balance";
  if (status === 429) return "rate-limit";
  if (status >= 500) return "server";
  if ((status === 400 || status === 422) && /voice/i.test(message)) return "voice";
  if (status === 400 || status === 413) return "text";
  return "request";
}

function httpError(response, body, apiKey) {
  const text = summarize(errorMessage(body), apiKey);
  const category = categoryForStatus(response.status, text);
  const extra = { httpStatus: response.status, retryAfterMs: retryAfterMs(response) };
  return new SynthesisError(category, text ? `HTTP ${response.status}（${text}）` : `HTTP ${response.status}`, extra);
}

function networkError(error, timeoutMs) {
  if (error.name === "TimeoutError") return new SynthesisError("network", `请求超时（${timeoutMs / 1000} 秒）`);
  return new SynthesisError("network", `连接失败（${error.cause?.code ?? error.message}）`);
}

async function readBody(response, timeoutMs) {
  try {
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    if (error.name === "TimeoutError") throw new SynthesisError("network", `接收音频超时（${timeoutMs / 1000} 秒）`);
    throw new SynthesisError("interrupted", "音频返回到一半连接断开，按失败处理（官方要求）", { httpStatus: response.status });
  }
}

/** 发一次请求，返回 PCM 字节。fetchImpl 可替换，便于测试。 */
export async function synthesizeOnce(params, { timeoutMs, fetchImpl = fetch }) {
  const { url, init } = buildRequest(params);
  checkInputLimits(params.text, init.body);
  let response;
  try {
    response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (error) {
    throw networkError(error, timeoutMs);
  }
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw httpError(response, body, params.apiKey);
  }
  const audio = await readBody(response, timeoutMs);
  if ((response.headers.get("content-type") ?? "").includes("json")) {
    const text = summarize(errorMessage(audio.toString("utf8")), params.apiKey);
    throw new SynthesisError("protocol", `HTTP 200 却返回 JSON${text ? `（${text}）` : ""}`);
  }
  if (audio.length === 0) throw new SynthesisError("protocol", "回包里没有音频（文本可能只有标点或 Markdown 符号）");
  if (audio.length % 2 !== 0) throw new SynthesisError("protocol", `PCM 字节数 ${audio.length} 为奇数，回包不完整`);
  return audio;
}

const defaultSleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** 限流、服务端、网络错误与中途断开按退避重试；其余错误立即抛出。 */
export async function synthesize(params, options) {
  const { maxRetries, sleep = defaultSleep, onRetry } = options;
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await synthesizeOnce(params, options);
    } catch (error) {
      if (!(error instanceof SynthesisError) || !RETRYABLE.has(error.category) || attempt >= maxRetries) throw error;
      const delay = error.retryAfterMs ?? Math.min(1000 * 2 ** attempt, 16_000);
      onRetry?.(error, attempt + 1, delay);
      await sleep(delay);
    }
  }
}
