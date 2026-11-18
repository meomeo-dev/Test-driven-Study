// 纯函数与单次请求：文件名键、凭据文件解析、计费字符、请求构造、HTTP 状态分类、中途断开、
// 重试退避、WAV 头与 ffmpeg 编码。

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { test } from "node:test";
import { envFileHint, inspectEnvFile, parseEnvValue } from "../scripts/lib/credentials.mjs";
import { SynthesisError, billableLength, buildRequest, synthesize, synthesizeOnce } from "../scripts/lib/deepseek.mjs";
import { encodeAudio, ffmpegAvailable, missingEncoders, wavFromPcm } from "../scripts/lib/encode.mjs";
import { phraseKey } from "../scripts/lib/phrase-key.mjs";

const PARAMS = { endpoint: "http://x", apiKey: "secret-k", voiceId: "stella", text: "你好", filterMarkdown: false };
const ONCE = { timeoutMs: 1000 };

const reply = (status, body, headers = {}) => async () => new Response(body, { status, headers });
const errorJson = (message) => JSON.stringify({ error: { message, type: "x", param: null, code: null } });

async function failureOf(promise) {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof SynthesisError, String(error));
    return error;
  }
  assert.fail("没有抛出错误");
}

test("phraseKey 与 FNV-1a 64 位标准测试向量一致", () => {
  assert.equal(phraseKey(""), "cbf29ce484222325");
  assert.equal(phraseKey("a"), "af63dc4c8601ec8c");
  assert.equal(phraseKey("foobar"), "85944171f73967e8");
  assert.match(phraseKey("我想喝水"), /^[0-9a-f]{16}$/);
});

test("parseEnvValue 支持注释、export、引号与同名覆盖", () => {
  const content = ["# comment", "export OTHER=1", "KEY=first", "KEY = 'second value'", 'QUOTED="a # b"', "TRAIL=plain # note"].join("\n");
  assert.equal(parseEnvValue(content, "KEY"), "second value");
  assert.equal(parseEnvValue(content, "QUOTED"), "a # b");
  assert.equal(parseEnvValue(content, "TRAIL"), "plain");
  assert.equal(parseEnvValue(content, "MISSING"), undefined);
  assert.equal(parseEnvValue("\uFEFFKEY=v\n", "KEY"), "v");
});

test("凭据文件诊断只列变量名与格式问题，不含任何值", () => {
  const content = ["\uFEFF# 说明", "OTHER_KEY=secret-1", "# KEY=secret-2", "Key=secret-3", "ALT: secret-4", "secret-5", "KEY=secret-6", "KEY="].join("\n");
  const summary = inspectEnvFile(content, "KEY");
  assert.deepEqual(summary, { bom: true, names: ["OTHER_KEY", "Key", "KEY", "KEY"], colonNames: ["ALT"], occurrences: 2, lastEmpty: true, lastRawFilled: false, commented: 1, otherLines: 1 });
  const hint = envFileHint(summary, "KEY");
  assert.doesNotMatch(hint, /secret/);
  const quoted = inspectEnvFile("KEY=\"\"secret-7\"\n", "KEY");
  assert.equal(quoted.lastEmpty && quoted.lastRawFilled, true);
  const quotedHint = envFileHint(quoted, "KEY");
  assert.match(quotedHint, /引号/);
  assert.doesNotMatch(quotedHint, /secret/);
  for (const part of ["OTHER_KEY", "出现 2 次", "大小写不同：Key", "冒号格式：ALT", "被注释掉 1 次", "1 行不是", "BOM"]) assert.ok(hint.includes(part), part);
});

test("计费字符：汉字算 2 个，字母、数字、空格与标点算 1 个", () => {
  assert.equal(billableLength("我想喝水"), 8);
  assert.equal(billableLength("你好，DeepSeek 1"), 4 + 1 + 8 + 1 + 1);
});

test("buildRequest 写 Bearer 鉴权头，固定请求 pcm 并显式传 filter_markdown", () => {
  const { url, init } = buildRequest(PARAMS);
  assert.equal(url, "http://x");
  assert.equal(init.headers.Authorization, "Bearer secret-k");
  assert.deepEqual(JSON.parse(init.body), { text: "你好", voice_id: "stella", format: "pcm", filter_markdown: false });
});

test("超过 10,000 计费字符时不发请求，按 text 失败", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return new Response(new Uint8Array(2));
  };
  const error = await failureOf(synthesizeOnce({ ...PARAMS, text: "长".repeat(5001) }, { ...ONCE, fetchImpl }));
  assert.equal(error.category, "text");
  assert.equal(calls, 0);
  assert.equal((await synthesizeOnce({ ...PARAMS, text: "长".repeat(5000) }, { ...ONCE, fetchImpl })).length, 2);
});

test("HTTP 状态按类别报告，message 里的 Key 被遮盖", async () => {
  const classify = async (status, message, headers) => {
    const error = await failureOf(synthesizeOnce(PARAMS, { ...ONCE, fetchImpl: reply(status, errorJson(message), headers) }));
    assert.ok(!error.message.includes("secret-k"), error.message);
    assert.equal(error.httpStatus, status);
    return error.category;
  };
  assert.equal(await classify(401, "Authentication Fails, key secret-k is invalid"), "auth");
  assert.equal(await classify(402, "Insufficient Balance"), "balance");
  assert.equal(await classify(429, "Too many requests"), "rate-limit");
  assert.equal(await classify(400, "Content Exists Risk"), "text");
  assert.equal(await classify(413, "Request body too large"), "text");
  assert.equal(await classify(400, "Invalid voice_id 'nova': supported values are 'stella' (default), 'tide' (request_id: r)"), "voice");
  assert.equal(await classify(400, "No readable text to synthesize (request_id: r)"), "text");
  assert.equal(await classify(422, "Invalid voice_id: nova"), "voice");
  assert.equal(await classify(422, "Invalid format"), "request");
  assert.equal(await classify(503, "busy"), "server");
  assert.equal(await classify(504, "timeout"), "server");
});

test("Retry-After 存在时按它等待，不存在时不给等待时长", async () => {
  const withHeader = await failureOf(synthesizeOnce(PARAMS, { ...ONCE, fetchImpl: reply(429, "", { "Retry-After": "3" }) }));
  assert.equal(withHeader.retryAfterMs, 3000);
  const without = await failureOf(synthesizeOnce(PARAMS, { ...ONCE, fetchImpl: reply(429, "") }));
  assert.equal(without.retryAfterMs, undefined);
});

test("没有 Retry-After 的限流按 1、2 秒指数退避，用尽后抛出 rate-limit", async () => {
  const delays = [];
  const error = await failureOf(synthesize(PARAMS, { ...ONCE, maxRetries: 2, fetchImpl: reply(429, ""), sleep: async (ms) => delays.push(ms) }));
  assert.equal(error.category, "rate-limit");
  assert.deepEqual(delays, [1000, 2000]);
});

/** 先写出两个字节再出错的响应体，等同于连接在音频中途断开。 */
function interruptedResponse() {
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array([1, 2]));
      controller.error(new TypeError("terminated"));
    },
  });
  return new Response(body);
}

test("音频返回到一半断开按 interrupted 报告，重试后成功", async () => {
  const error = await failureOf(synthesizeOnce(PARAMS, { ...ONCE, fetchImpl: async () => interruptedResponse() }));
  assert.equal(error.category, "interrupted");
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return calls === 1 ? interruptedResponse() : new Response(new Uint8Array([1, 2, 3, 4]));
  };
  const audio = await synthesize(PARAMS, { ...ONCE, maxRetries: 1, fetchImpl, sleep: async () => {} });
  assert.equal(audio.length, 4);
  assert.equal(calls, 2);
});

test("HTTP 200 的空回包、奇数字节与 JSON 回包按 protocol 报告", async () => {
  const category = async (body, headers) => (await failureOf(synthesizeOnce(PARAMS, { ...ONCE, fetchImpl: reply(200, body, headers) }))).category;
  assert.equal(await category(new Uint8Array(0)), "protocol");
  assert.equal(await category(new Uint8Array(3)), "protocol");
  assert.equal(await category(errorJson("odd"), { "Content-Type": "application/json" }), "protocol");
});

test("网络错误按退避重试，用尽后抛出 network", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    throw new TypeError("fetch failed", { cause: { code: "ECONNREFUSED" } });
  };
  const error = await failureOf(synthesize(PARAMS, { ...ONCE, maxRetries: 2, fetchImpl, sleep: async () => {} }));
  assert.equal(error.category, "network");
  assert.equal(calls, 3);
});

test("wavFromPcm 写出 24 kHz、16 位、单声道的 WAV 头，长度字段等于实际字节数", () => {
  const wav = wavFromPcm(Buffer.alloc(100));
  assert.equal(wav.length, 144);
  assert.equal(wav.toString("latin1", 0, 4), "RIFF");
  assert.equal(wav.readUInt32LE(4), 136);
  assert.equal(wav.toString("latin1", 8, 16), "WAVEfmt ");
  assert.equal(wav.readUInt16LE(22), 1);
  assert.equal(wav.readUInt32LE(24), 24000);
  assert.equal(wav.readUInt16LE(34), 16);
  assert.equal(wav.readUInt32LE(40), 100);
  assert.deepEqual(encodeAudio(Buffer.alloc(4), "pcm"), Buffer.alloc(4));
});

/** 0.6 秒静音 + 0.5 秒 440 Hz 正弦 + 0.6 秒静音，24 kHz、16 位、单声道。 */
function paddedTone() {
  const rate = 24000;
  const samples = Math.round(rate * 1.7);
  const pcm = Buffer.alloc(samples * 2);
  for (let index = Math.round(rate * 0.6); index < Math.round(rate * 1.1); index += 1) {
    pcm.writeInt16LE(Math.round(12000 * Math.sin((2 * Math.PI * 440 * index) / rate)), index * 2);
  }
  return pcm;
}

const noFfmpeg = !ffmpegAvailable() && "本机没有 ffmpeg";

test("ffmpeg 去掉首尾静音并降采样后 WAV 变短，头里是新的采样率", { skip: noFfmpeg }, () => {
  const pcm = paddedTone();
  const output = encodeAudio(pcm, "wav", { trimSilence: true, sampleRate: 16000 });
  assert.equal(output.readUInt32LE(24), 16000);
  assert.equal(output.readUInt32LE(4), output.length - 8);
  assert.ok(output.length - 44 < pcm.length * 0.5, `${output.length} vs ${pcm.length}`);
});

test("ffmpeg 编码 mp3 与 ogg", { skip: noFfmpeg || (missingEncoders(["mp3", "ogg"]).length > 0 && "缺少编码器") }, () => {
  const mp3 = encodeAudio(paddedTone(), "mp3", { bitrate: "32k" });
  assert.ok(mp3.toString("latin1", 0, 3) === "ID3" || (mp3[0] === 0xff && (mp3[1] & 0xe0) === 0xe0));
  const ogg = encodeAudio(paddedTone(), "ogg", null);
  assert.equal(ogg.toString("latin1", 0, 4), "OggS");
  const probe = execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-f", "null", "-"], { input: ogg });
  assert.equal(probe.length, 0);
});
