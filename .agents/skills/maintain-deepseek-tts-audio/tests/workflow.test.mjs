// 比对、合成、核对、清理的完整流程，以及成功、鉴权失败、余额不足、限流、音色不存在、
// 输入超长、内容审核与中途断开等接口应答。全部请求打到本进程内的模拟服务。

import assert from "node:assert/strict";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { wavFromPcm } from "../scripts/lib/encode.mjs";
import { phraseKey } from "../scripts/lib/phrase-key.mjs";
import { TEST_KEY, cleanupProjects, json, makeProject, runTool, toolEnv, writeJson } from "./helpers.mjs";
import { CONTENT_RISK_MARKER, fakePcm, startMockServer } from "./mock-deepseek-server.mjs";

after(cleanupProjects);

const PHRASES = ["我想喝水", "请帮我叫护士", "谢谢"];
const audioPath = (root, voice, text) => join(root, "static/audio/zh", voice, `${phraseKey(text)}.wav`);
const manifestOf = (root) => JSON.parse(readFileSync(join(root, "static/audio/zh/manifest.json"), "utf8"));

function assertNoKey(...results) {
  for (const result of results) {
    assert.ok(!result.stdout.includes(TEST_KEY) && !result.stderr.includes(TEST_KEY), "输出里出现了 API Key");
  }
}

describe("成功应答下的完整流程", () => {
  let mock;
  let root;
  before(async () => {
    mock = await startMockServer();
    root = makeProject({ endpoint: mock.url, phrases: PHRASES });
  });
  after(() => mock.close());

  test("首次比对：每句两套音色都缺失，计费字符按汉字 2 个估算", async () => {
    const result = await runTool("plan-audio", ["--root", root, "--json"]);
    assert.equal(result.code, 0);
    const [set] = json(result).sets;
    assert.equal(set.toSynthesize, 6);
    assert.deepEqual(set.reasons, { missing: 6 });
    assert.equal(set.billableCharacters, 2 * 2 * (4 + 6 + 2));
  });

  test("dry-run 不联网也不写文件", async () => {
    const result = await runTool("synthesize-audio", ["--root", root, "--dry-run", "--json"]);
    assert.equal(result.code, 0);
    assert.equal(json(result).jobs.length, 6);
    assert.equal(mock.requests.length, 0);
    assert.ok(!existsSync(join(root, "static/audio/zh")));
  });

  test("合成全部缺失项，写入带正确长度的 WAV 与清单，不输出 Key", async () => {
    const result = await runTool("synthesize-audio", ["--root", root, "--json"]);
    assertNoKey(result);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(mock.requests.length, 6);
    assert.ok(mock.requests.every((request) => request.hasKey && request.format === "pcm" && request.filterMarkdown === false));
    assert.deepEqual(readFileSync(audioPath(root, "female", "我想喝水")), wavFromPcm(fakePcm("stella", "我想喝水")));
    const record = manifestOf(root).files[`female/${phraseKey("我想喝水")}.wav`];
    assert.equal(record.text, "我想喝水");
    assert.equal(record.voiceId, "stella");
    assert.equal(record.format, "wav");
  });

  test("核对通过；再次比对没有要合成的条目", async () => {
    assert.equal((await runTool("verify-audio", ["--root", root])).code, 0);
    const [set] = json(await runTool("plan-audio", ["--root", root, "--json"])).sets;
    assert.equal(set.toSynthesize, 0);
  });

  test("新增两句后只补这两句的两套音色", async () => {
    writeJson(join(root, "content/phrases.json"), [...PHRASES, "我有点冷", "麻烦开一下灯"]);
    const before = mock.requests.length;
    const result = await runTool("synthesize-audio", ["--root", root, "--json"]);
    assert.equal(result.code, 0, result.stderr);
    assert.equal(mock.requests.length - before, 4);
    assert.deepEqual(new Set(mock.requests.slice(before).map((request) => request.text)), new Set(["我有点冷", "麻烦开一下灯"]));
    assert.equal((await runTool("verify-audio", ["--root", root])).code, 0);
  });

  test("删除句子后核对失败，prune 预览不删除，--apply 删除文件与记录", async () => {
    writeJson(join(root, "content/phrases.json"), ["我想喝水", "请帮我叫护士", "我有点冷", "麻烦开一下灯"]);
    const verify = await runTool("verify-audio", ["--root", root, "--json"]);
    assert.equal(verify.code, 1);
    assert.equal(json(verify).sets[0].problems.stale.length, 2);
    const preview = await runTool("prune-audio", ["--root", root, "--json"]);
    assert.equal(preview.code, 0);
    assert.equal(json(preview).sets[0].files.length, 2);
    assert.ok(existsSync(audioPath(root, "male", "谢谢")));
    const applied = await runTool("prune-audio", ["--root", root, "--apply"]);
    assert.equal(applied.code, 0);
    assert.ok(!existsSync(audioPath(root, "male", "谢谢")));
    assert.ok(!(`male/${phraseKey("谢谢")}.wav` in manifestOf(root).files));
    assert.equal((await runTool("verify-audio", ["--root", root])).code, 0);
  });

  test("换一套音色只重合成这一套", async () => {
    const configPath = join(root, "deepseek-tts.config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    config.sets[0].voices.male = "stella";
    writeFileSync(configPath, JSON.stringify(config));
    const [set] = json(await runTool("plan-audio", ["--root", root, "--json"])).sets;
    assert.equal(set.toSynthesize, 4);
    assert.ok(set.jobs.every((job) => job.voice === "male" && job.reason === "outdated" && job.changed.includes("voiceId")));
    assert.equal((await runTool("verify-audio", ["--root", root])).code, 1);
    assert.equal((await runTool("synthesize-audio", ["--root", root])).code, 0);
    assert.equal((await runTool("verify-audio", ["--root", root])).code, 0);
  });

  test("改 filterMarkdown 后整组标为 outdated(settings)", async () => {
    const configPath = join(root, "deepseek-tts.config.json");
    const config = JSON.parse(readFileSync(configPath, "utf8"));
    config.provider.filterMarkdown = true;
    writeFileSync(configPath, JSON.stringify(config));
    const [set] = json(await runTool("plan-audio", ["--root", root, "--json"])).sets;
    assert.equal(set.toSynthesize, 8);
    assert.ok(set.jobs.every((job) => job.reason === "outdated" && job.changed.includes("settings")));
    config.provider.filterMarkdown = false;
    writeFileSync(configPath, JSON.stringify(config));
  });

  test("--force 整套重合成，--limit 控制条数", async () => {
    const before = mock.requests.length;
    const result = await runTool("synthesize-audio", ["--root", root, "--force", "female", "--limit", "3", "--json"]);
    assert.equal(result.code, 0);
    assert.equal(mock.requests.length - before, 3);
    assert.equal(json(result).deferred, 1);
  });

  test("文件被改动后核对报 modified；WAV 头被截断后报 invalid-audio", async () => {
    const file = audioPath(root, "female", "我想喝水");
    writeFileSync(file, Buffer.from("RIFF replaced by hand"));
    const modified = json(await runTool("verify-audio", ["--root", root, "--json"]));
    assert.deepEqual(modified.sets[0].problems.modified, [`female/${phraseKey("我想喝水")}.wav`]);
    const other = audioPath(root, "female", "我有点冷");
    const original = readFileSync(other);
    const truncated = Buffer.concat([original.subarray(0, original.length - 2), Buffer.from([0, 0])]);
    truncated.writeUInt32LE(0xffffffff, 4);
    writeFileSync(other, truncated);
    const invalid = json(await runTool("verify-audio", ["--root", root, "--json"]));
    assert.deepEqual(invalid.sets[0].problems["invalid-audio"], [`female/${phraseKey("我有点冷")}.wav`]);
  });
});

test("换文件格式后旧格式的文件按过期文件列出并可清理", async () => {
  const mock = await startMockServer();
  const root = makeProject({ endpoint: mock.url, phrases: ["你好"], voices: { female: "stella" } });
  assert.equal((await runTool("synthesize-audio", ["--root", root])).code, 0);
  const configPath = join(root, "deepseek-tts.config.json");
  const config = JSON.parse(readFileSync(configPath, "utf8"));
  config.sets[0].pathTemplate = "{voice}/{key}.pcm";
  writeFileSync(configPath, JSON.stringify(config));
  const [set] = json(await runTool("plan-audio", ["--root", root, "--json"])).sets;
  assert.deepEqual(set.stale, [`female/${phraseKey("你好")}.wav`]);
  assert.equal((await runTool("synthesize-audio", ["--root", root])).code, 0);
  assert.equal((await runTool("prune-audio", ["--root", root, "--apply"])).code, 0);
  await mock.close();
  assert.equal((await runTool("verify-audio", ["--root", root])).code, 0);
  assert.deepEqual(readFileSync(join(root, "static/audio/zh/female", `${phraseKey("你好")}.pcm`)), fakePcm("stella", "你好"));
});

describe("错误应答", () => {
  let mock;
  before(async () => {
    mock = await startMockServer();
  });
  after(() => mock.close());

  for (const [key, category] of [["invalid-key", "auth"], ["no-balance-key", "balance"]]) {
    test(`${category}：第一条失败后停止派发，退出码 1`, async () => {
      const root = makeProject({ endpoint: mock.url, phrases: PHRASES });
      const before = mock.requests.length;
      const result = await runTool("synthesize-audio", ["--root", root, "--concurrency", "1", "--json"], toolEnv({ DEEPSEEK_API_KEY: key }));
      assert.equal(result.code, 1);
      assert.equal(mock.requests.length - before, 1);
      const results = json(result).results;
      assert.equal(results[0].category, category);
      assert.equal(results.filter((item) => item.status === "skipped").length, 5);
      assert.ok(!result.stdout.includes(key) && !result.stderr.includes(key));
    });
  }

  test("音色不存在：只停这一套音色，另一套照常合成", async () => {
    const root = makeProject({ endpoint: mock.url, phrases: PHRASES, voices: { female: "nova", male: "tide" } });
    const result = await runTool("synthesize-audio", ["--root", root, "--concurrency", "1", "--json"]);
    assert.equal(result.code, 1);
    const results = json(result).results;
    assert.deepEqual(results.filter((item) => item.voice === "female").map((item) => item.status), ["failed", "skipped", "skipped"]);
    assert.equal(results.find((item) => item.status === "failed").category, "voice");
    assert.ok(results.filter((item) => item.voice === "male").every((item) => item.status === "synthesized"));
    assert.equal(Object.keys(manifestOf(root).files).length, 3);
  });

  test("输入超长不发请求，未通过审核的句子只记这一条失败", async () => {
    const tooLong = "长".repeat(5001);
    const flagged = `${CONTENT_RISK_MARKER}这句不能读`;
    const root = makeProject({ endpoint: mock.url, phrases: ["你好", tooLong, flagged], voices: { female: "stella" } });
    const before = mock.requests.length;
    const result = await runTool("synthesize-audio", ["--root", root, "--concurrency", "1", "--json"]);
    assert.equal(result.code, 1);
    const sent = mock.requests.slice(before);
    assert.equal(sent.length, 2);
    assert.ok(!sent.some((request) => request.text === tooLong));
    const byText = Object.fromEntries(json(result).results.map((item) => [item.text, item]));
    assert.equal(byText[tooLong].category, "text");
    assert.match(byText[tooLong].error, /10000/);
    assert.equal(byText[flagged].category, "text");
    assert.match(byText[flagged].error, /HTTP 400/);
    assert.equal(byText["你好"].status, "synthesized");
  });

  test("没有 API Key：未就绪，退出码 3，不发请求", async () => {
    const root = makeProject({ endpoint: mock.url, phrases: PHRASES });
    const before = mock.requests.length;
    const result = await runTool("synthesize-audio", ["--root", root], toolEnv());
    assert.equal(result.code, 3);
    assert.match(result.stderr, /DEEPSEEK_API_KEY/);
    assert.equal(mock.requests.length, before);
  });
});

describe("限流与中途断开", () => {
  test("HTTP 429 按 Retry-After 重试后成功", async () => {
    const mock = await startMockServer({ rateLimitFirst: 2 });
    const root = makeProject({ endpoint: mock.url, phrases: ["我想喝水"], voices: { female: "stella" } });
    const result = await runTool("synthesize-audio", ["--root", root, "--concurrency", "1", "--verbose"]);
    await mock.close();
    assert.equal(result.code, 0, result.stderr);
    assert.equal(mock.requests.length, 3);
    assert.match(result.stderr, /rate-limit/);
  });

  test("重试次数用完后记为失败", async () => {
    const mock = await startMockServer({ rateLimitFirst: 10 });
    const root = makeProject({ endpoint: mock.url, phrases: ["我想喝水"], voices: { female: "stella" }, config: { request: { concurrency: 1, timeoutSeconds: 10, maxRetries: 1 } } });
    const result = await runTool("synthesize-audio", ["--root", root, "--json"]);
    await mock.close();
    assert.equal(result.code, 1);
    assert.equal(json(result).results[0].category, "rate-limit");
    assert.equal(mock.requests.length, 2);
  });

  test("音频中途断开时重试，不写半个文件", async () => {
    const mock = await startMockServer({ interruptFirst: 1 });
    const root = makeProject({ endpoint: mock.url, phrases: ["我想喝水"], voices: { female: "stella" }, config: { request: { concurrency: 1, timeoutSeconds: 10, maxRetries: 0 } } });
    const failed = await runTool("synthesize-audio", ["--root", root, "--json"]);
    assert.equal(failed.code, 1);
    assert.equal(json(failed).results[0].category, "interrupted");
    assert.ok(!existsSync(audioPath(root, "female", "我想喝水")));
    const retried = await runTool("synthesize-audio", ["--root", root, "--json"]);
    await mock.close();
    assert.equal(retried.code, 0, retried.stderr);
    assert.deepEqual(readFileSync(audioPath(root, "female", "我想喝水")), wavFromPcm(fakePcm("stella", "我想喝水")));
  });
});
