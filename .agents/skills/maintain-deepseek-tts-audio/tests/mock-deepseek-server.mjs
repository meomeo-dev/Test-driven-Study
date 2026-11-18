#!/usr/bin/env node
// 测试用的本地模拟服务：按 DeepSeek 语音合成整段接口的形态应答，不联网、不计费。
//
//   成功：HTTP 200，响应体分两段写出音频；pcm 为原始 16 位 PCM，wav 前加 WAV 头。
//   鉴权失败：Authorization 不是 Bearer <Key>，或 Key 为 invalid-key 时 HTTP 401。
//   余额不足：Key 为 no-balance-key 时 HTTP 402。
//   限流：前 rateLimitFirst 个请求返回 HTTP 429，Retry-After 为 0。
//   请求体超过 64 KiB：HTTP 413。
//   没有可朗读文本、音色不存在、文本含 CONTENT_RISK_MARKER（模拟未通过内容审核）、计费字符超过 10,000：
//   HTTP 400；format、filter_markdown 取值不对时 HTTP 422。
//   中途断开：前 interruptFirst 个本应成功的请求只写出一半音频就断开连接。
//   音色不存在与没有可朗读文本的状态码和 message 按 2026-11-17 的真实应答模拟；401、402、413 取自通用
//   错误码页；超长与 422 的状态码、错误回包 {"error":{"message"}} 的形状与 Retry-After 头官方没有公开，
//   这里是假设，用来验证工具的分类与重试。
//
// 每个请求记一条日志（voice_id、原文、format、filter_markdown、是否带 Key、应答类型），不记 Key 的值。
// 命令行：node tests/mock-deepseek-server.mjs [--port 0] [--rate-limit-first 0] [--interrupt-first 0] [--log <文件>]
// 启动后在 stdout 打印接口地址，收到 SIGTERM 或 SIGINT 时退出。

import { appendFileSync, realpathSync } from "node:fs";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export const MOCK_PATH = "/v1/tools/tts";
export const MOCK_VOICES = Object.freeze(["stella", "tide"]);
export const CONTENT_RISK_MARKER = "【模拟审核拦截】";
const MAX_BODY_BYTES = 64 * 1024;
const MAX_BILLABLE = 10_000;
const HAN = /\p{Script=Han}/u;

/** 模拟 PCM：「voice_id|原文」的 UTF-8 字节，补齐为偶数长度；测试据此确认写入的是哪条句子与音色。 */
export function fakePcm(voiceId, text) {
  const bytes = Buffer.from(`${voiceId}|${text}`);
  return bytes.length % 2 === 0 ? bytes : Buffer.concat([bytes, Buffer.from([0])]);
}

function wavHeader(length) {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0, "latin1");
  header.writeUInt32LE(36 + length, 4);
  header.write("WAVEfmt ", 8, "latin1");
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(24_000, 24);
  header.writeUInt32LE(48_000, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36, "latin1");
  header.writeUInt32LE(length, 40);
  return header;
}

const billable = (text) => [...text].reduce((sum, char) => sum + (HAN.test(char) ? 2 : 1), 0);

function errorBody(message, type) {
  return JSON.stringify({ error: { message, type, param: null, code: null } });
}

function respondError(res, status, message, type, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(errorBody(message, type));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function bearerKey(headers) {
  const match = /^Bearer (.+)$/.exec(String(headers.authorization ?? ""));
  return match ? match[1].trim() : "";
}

/** 按请求决定应答类型；返回 { outcome, status, message }。 */
function decide(state, key, raw, params) {
  if (!key || key === "invalid-key") return { outcome: "auth", status: 401, message: "Authentication Fails, your api key is invalid" };
  if (key === "no-balance-key") return { outcome: "balance", status: 402, message: "Insufficient Balance" };
  if (state.served < state.rateLimitFirst) return { outcome: "rate-limit", status: 429, message: "Too many concurrent requests" };
  if (raw.length > MAX_BODY_BYTES) return { outcome: "too-large", status: 413, message: "Request body too large" };
  if (params === null) return { outcome: "bad-json", status: 400, message: "Invalid JSON body" };
  const text = params.text;
  if (typeof text !== "string" || text.replace(/[\s\p{P}*#_`>~-]/gu, "") === "") return { outcome: "no-text", status: 400, message: "No readable text to synthesize (request_id: mock)" };
  const voiceId = params.voice_id ?? "stella";
  if (!MOCK_VOICES.includes(voiceId)) return { outcome: "voice", status: 400, message: `Invalid voice_id '${voiceId}': supported values are 'stella' (default), 'tide' (request_id: mock)` };
  if (!["wav", "pcm"].includes(params.format ?? "wav")) return { outcome: "format", status: 422, message: "Invalid format" };
  if (params.filter_markdown !== undefined && typeof params.filter_markdown !== "boolean") return { outcome: "filter", status: 422, message: "filter_markdown must be a boolean" };
  if (billable(text) > MAX_BILLABLE) return { outcome: "too-long", status: 400, message: "Text exceeds 10000 billable characters" };
  if (text.includes(CONTENT_RISK_MARKER)) return { outcome: "content-risk", status: 400, message: "Content Exists Risk" };
  if (state.interrupted < state.interruptFirst) return { outcome: "interrupted" };
  return { outcome: "ok" };
}

function parseParams(raw) {
  try {
    const parsed = JSON.parse(raw.toString("utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function sendAudio(res, params, { interrupt }) {
  const pcm = fakePcm(params.voice_id ?? "stella", params.text);
  const format = params.format ?? "wav";
  const body = format === "wav" ? Buffer.concat([wavHeader(pcm.length), pcm]) : pcm;
  const half = Math.max(1, Math.floor(body.length / 2));
  res.writeHead(200, { "Content-Type": format === "wav" ? "audio/wav" : "application/octet-stream" });
  res.write(body.subarray(0, half));
  if (interrupt) {
    setImmediate(() => res.destroy());
    return;
  }
  setImmediate(() => res.end(body.subarray(half)));
}

async function handle(state, req, res) {
  if (req.method !== "POST" || req.url !== MOCK_PATH) return respondError(res, 404, "Not Found", "not_found");
  const raw = await readBody(req);
  const key = bearerKey(req.headers);
  const params = parseParams(raw);
  const decision = decide(state, key, raw, params);
  state.served += 1;
  const entry = { voiceId: params?.voice_id, text: params?.text, format: params?.format, filterMarkdown: params?.filter_markdown, hasKey: Boolean(key), outcome: decision.outcome };
  state.requests.push(entry);
  if (state.logFile) appendFileSync(state.logFile, `${JSON.stringify(entry)}\n`);
  if (decision.outcome === "interrupted") {
    state.interrupted += 1;
    return sendAudio(res, params, { interrupt: true });
  }
  if (decision.outcome === "ok") return sendAudio(res, params, { interrupt: false });
  const headers = decision.status === 429 ? { "Retry-After": "0" } : {};
  return respondError(res, decision.status, decision.message, decision.outcome, headers);
}

/** 启动服务；返回 { url, requests, close() }。 */
export function startMockServer({ port = 0, rateLimitFirst = 0, interruptFirst = 0, logFile } = {}) {
  const state = { served: 0, interrupted: 0, rateLimitFirst, interruptFirst, logFile, requests: [] };
  const server = createServer((req, res) => {
    handle(state, req, res).catch((error) => respondError(res, 500, error.message, "server_error"));
  });
  return new Promise((resolve) => {
    server.listen(port, "127.0.0.1", () => {
      const url = `http://127.0.0.1:${server.address().port}${MOCK_PATH}`;
      resolve({ url, requests: state.requests, close: () => new Promise((done) => server.close(done)) });
    });
  });
}

function isEntryPoint() {
  const entry = process.argv[1];
  if (!entry) return false;
  let real = entry;
  try {
    real = realpathSync(entry);
  } catch {
    real = entry;
  }
  return [entry, real].some((path) => pathToFileURL(path).href === import.meta.url);
}

if (isEntryPoint()) {
  const { values } = parseArgs({
    options: {
      port: { type: "string", default: "0" },
      "rate-limit-first": { type: "string", default: "0" },
      "interrupt-first": { type: "string", default: "0" },
      log: { type: "string" },
    },
  });
  const mock = await startMockServer({
    port: Number(values.port), rateLimitFirst: Number(values["rate-limit-first"]),
    interruptFirst: Number(values["interrupt-first"]), logFile: values.log,
  });
  console.log(mock.url);
  const stop = () => mock.close().then(() => process.exit(0));
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}
