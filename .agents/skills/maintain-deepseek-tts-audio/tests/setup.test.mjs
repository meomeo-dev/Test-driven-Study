// 初始化、就绪检查、试听、配置校验与各工具的 --help。凭据文件一律用非 .env 开头的文件名。

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { chmodSync, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { wavFromPcm } from "../scripts/lib/encode.mjs";
import { TEST_KEY, cleanupProjects, json, makeProject, makeTempDir, runTool, toolEnv, writeJson } from "./helpers.mjs";
import { fakePcm, startMockServer } from "./mock-deepseek-server.mjs";

after(cleanupProjects);

const TOOLS = ["init-project", "check-setup", "plan-audio", "synthesize-audio", "prune-audio", "verify-audio", "preview-voice"];
const CREDENTIAL_FILE = "secrets/deepseek-tts.credentials";

function gitInit(root) {
  execFileSync("git", ["-c", "gc.auto=0", "-c", "maintenance.auto=false", "init", "-q"], { cwd: root });
}

const statusById = (result) => Object.fromEntries(json(result).checks.map((check) => [check.id, check.status]));

test("每个工具的 --help 退出 0 且含用法与示例", async () => {
  for (const name of TOOLS) {
    const result = await runTool(name, ["--help"], toolEnv());
    assert.equal(result.code, 0, name);
    assert.match(result.stdout, /用法:/, name);
    assert.match(result.stdout, /示例:/, name);
  }
});

test("缺 --root 是用法错误，退出码 2", async () => {
  const result = await runTool("plan-audio", [], toolEnv());
  assert.equal(result.code, 2);
});

describe("init-project 与 check-setup", () => {
  let root;
  before(() => {
    root = makeTempDir();
    gitInit(root);
  });

  test("dry-run 只列出将创建的文件", async () => {
    const result = await runTool("init-project", ["--root", root, "--dry-run", "--json"], toolEnv());
    assert.equal(result.code, 0);
    assert.deepEqual(json(result).actions.map((item) => item.action), ["would-create", "would-create"]);
    assert.ok(!existsSync(join(root, "deepseek-tts.config.json")));
  });

  test("生成配置骨架；凭据模板只含键名，权限 600，未被忽略时警告", async () => {
    writeJson(join(root, "deepseek-tts.config.json"), {
      ...JSON.parse(readFileSync(new URL("../templates/deepseek-tts.config.json.tpl", import.meta.url), "utf8")),
      credentials: { env: "DEEPSEEK_API_KEY", file: CREDENTIAL_FILE },
    });
    const result = await runTool("init-project", ["--root", root, "--json"], toolEnv());
    assert.equal(result.code, 0);
    const credential = join(root, CREDENTIAL_FILE);
    assert.equal(statSync(credential).mode & 0o777, 0o600);
    const lines = readFileSync(credential, "utf8").split("\n").filter((line) => line && !line.startsWith("#"));
    assert.deepEqual(lines, ["DEEPSEEK_API_KEY="]);
    assert.equal(json(result).git.status, "not-ignored");
  });

  test("check-setup：缺句库、没有 Key、未被 Git 忽略时报 fail（退出码 1）；模板音色已就绪", async () => {
    const result = await runTool("check-setup", ["--root", root, "--json"], toolEnv());
    assert.equal(result.code, 1);
    const status = statusById(result);
    assert.equal(status["set:main:voices"], "ok");
    assert.equal(status["set:main:phrases"], "not-ready");
    assert.equal(status.credential, "not-ready");
    assert.equal(status["credential-file:git"], "fail");
  });

  test("补齐后就绪；权限过宽时 fail，init-project 修正为 600", async () => {
    writeFileSync(join(root, ".gitignore"), `${CREDENTIAL_FILE}\n`);
    writeJson(join(root, "audio/phrases.json"), ["早上好"]);
    writeFileSync(join(root, CREDENTIAL_FILE), `DEEPSEEK_API_KEY="${TEST_KEY}"\n`);
    const ready = await runTool("check-setup", ["--root", root], toolEnv());
    assert.equal(ready.code, 0, ready.stdout);
    assert.ok(!ready.stdout.includes(TEST_KEY));
    chmodSync(join(root, CREDENTIAL_FILE), 0o644);
    assert.equal((await runTool("check-setup", ["--root", root], toolEnv())).code, 1);
    const fixed = await runTool("init-project", ["--root", root, "--json"], toolEnv());
    assert.equal(json(fixed).actions[1].action, "chmod");
    assert.equal((await runTool("check-setup", ["--root", root], toolEnv())).code, 0);
  });
});

test("凭据文件在项目之外：显示绝对路径，按它所在的仓库判断是否被 Git 忽略", async () => {
  const vault = makeTempDir();
  gitInit(vault);
  writeFileSync(join(vault, ".gitignore"), "deepseek-tts.credentials\n");
  const credential = join(vault, "deepseek-tts.credentials");
  writeFileSync(credential, `DEEPSEEK_API_KEY=${TEST_KEY}\n`, { mode: 0o600 });
  const root = makeProject({ endpoint: "http://127.0.0.1:9", phrases: ["好"], config: { credentials: { env: "DEEPSEEK_API_KEY", file: credential } } });
  const result = await runTool("check-setup", ["--root", root, "--json"], toolEnv());
  const checks = Object.fromEntries(json(result).checks.map((check) => [check.id, check]));
  assert.equal(checks["credential-file:git"].status, "ok");
  assert.ok(checks.credential.message.includes(credential));
  assert.ok(!result.stdout.includes(TEST_KEY));
});

test("凭据文件里的变量名不对时，check-setup 列出变量名，不输出值", async () => {
  const root = makeProject({ endpoint: "http://127.0.0.1:9", phrases: ["好"], config: { credentials: { env: "DEEPSEEK_API_KEY", file: CREDENTIAL_FILE } } });
  writeJson(join(root, CREDENTIAL_FILE), {});
  writeFileSync(join(root, CREDENTIAL_FILE), `DEEPSEEK_TTS_KEY=${TEST_KEY}\n`);
  chmodSync(join(root, CREDENTIAL_FILE), 0o600);
  const result = await runTool("check-setup", ["--root", root, "--json"], toolEnv());
  assert.equal(result.code, 3);
  const credential = json(result).checks.find((check) => check.id === "credential");
  assert.equal(credential.status, "not-ready");
  assert.match(credential.message, /文件里的变量名：DEEPSEEK_TTS_KEY/);
  assert.ok(!result.stdout.includes(TEST_KEY) && !result.stderr.includes(TEST_KEY));
});

test("check-setup：文档未列出的 voice_id 只警告；mp3 格式检查 ffmpeg", async () => {
  const root = makeProject({ endpoint: "http://127.0.0.1:9", phrases: ["好"], voices: { female: "stella", narrator: "nova" }, set: { pathTemplate: "{voice}/{key}.mp3" } });
  const result = await runTool("check-setup", ["--root", root, "--json"], toolEnv({ DEEPSEEK_API_KEY: TEST_KEY }));
  const status = statusById(result);
  assert.equal(status["set:zh:voice-ids"], "warn");
  assert.ok(["ok", "not-ready"].includes(status.ffmpeg));
  const noFfmpeg = await runTool("check-setup", ["--root", root, "--json"], { PATH: "/nonexistent", HOME: makeTempDir(), DEEPSEEK_API_KEY: TEST_KEY });
  assert.equal(statusById(noFfmpeg).ffmpeg, "not-ready");
  assert.equal(noFfmpeg.code, 3);
});

describe("配置校验", () => {
  test("缺配置文件：未就绪，退出码 3", async () => {
    const result = await runTool("plan-audio", ["--root", makeTempDir()], toolEnv());
    assert.equal(result.code, 3);
    assert.match(result.stderr, /init-project/);
  });

  test("路径模板的未知占位符、不支持的扩展名与越界路径按失败报告", async () => {
    const bad = makeProject({ endpoint: "http://127.0.0.1:9", phrases: ["好"], set: { pathTemplate: "{voice}/{name}.wav" } });
    assert.equal((await runTool("plan-audio", ["--root", bad], toolEnv())).code, 1);
    const flac = makeProject({ endpoint: "http://127.0.0.1:9", phrases: ["好"], set: { pathTemplate: "{voice}/{key}.flac" } });
    assert.equal((await runTool("plan-audio", ["--root", flac], toolEnv())).code, 1);
    const outside = makeProject({ endpoint: "http://127.0.0.1:9", phrases: ["好"], set: { outputDir: "../elsewhere" } });
    assert.equal((await runTool("plan-audio", ["--root", outside], toolEnv())).code, 1);
  });

  test("wav 句库组的处理设置写了 bitrate 按失败报告", async () => {
    const root = makeProject({
      endpoint: "http://127.0.0.1:9", phrases: ["好"],
      config: { postprocess: { small: { bitrate: "32k" } } }, set: { defaultProfile: "small" },
    });
    const result = await runTool("plan-audio", ["--root", root], toolEnv());
    assert.equal(result.code, 1);
    assert.match(result.stderr, /bitrate/);
  });

  test("keyScheme id 用句库条目的 id 作文件名，{group} 按分组分目录", async () => {
    const root = makeProject({
      endpoint: "http://127.0.0.1:9",
      phrases: [{ id: "greet-morning", text: "早上好", group: "daily" }, { id: "ask-water", text: "我想喝水", group: "needs" }],
      set: { keyScheme: "id", pathTemplate: "{group}/{voice}/{key}.wav" },
    });
    const [set] = json(await runTool("plan-audio", ["--root", root, "--json"], toolEnv())).sets;
    assert.deepEqual(set.jobs.map((job) => job.file).sort(), [
      "daily/female/greet-morning.wav", "daily/male/greet-morning.wav", "needs/female/ask-water.wav", "needs/male/ask-water.wav",
    ]);
  });

  test("同一 id 对应不同文本按失败报告", async () => {
    const root = makeProject({ endpoint: "http://127.0.0.1:9", phrases: [{ id: "a", text: "一" }, { id: "a", text: "二" }], set: { keyScheme: "id" } });
    assert.equal((await runTool("plan-audio", ["--root", root], toolEnv())).code, 1);
  });
});

describe("preview-voice", () => {
  let mock;
  before(async () => {
    mock = await startMockServer();
  });
  after(() => mock.close());

  test("dry-run 不联网；指定输出文件时写入试听音频", async () => {
    const root = makeProject({ endpoint: mock.url, phrases: ["好"] });
    const dry = await runTool("preview-voice", ["--root", root, "--text", "我想喝水", "--voice", "female", "--dry-run", "--json"]);
    assert.equal(dry.code, 0);
    assert.equal(mock.requests.length, 0);
    const out = join(makeTempDir(), "preview.wav");
    const result = await runTool("preview-voice", ["--root", root, "--text", "我想喝水", "--voice-id", "tide", "--out", out]);
    assert.equal(result.code, 0, result.stderr);
    assert.deepEqual(readFileSync(out), wavFromPcm(fakePcm("tide", "我想喝水")));
    assert.ok(!existsSync(join(root, "static")));
  });

  test("音色不存在时退出码 1 并给出类别", async () => {
    const root = makeProject({ endpoint: mock.url, phrases: ["好"] });
    const result = await runTool("preview-voice", ["--root", root, "--text", "好", "--voice-id", "nova", "--out", join(makeTempDir(), "x.wav")]);
    assert.equal(result.code, 1);
    assert.match(result.stderr, /voice/);
  });
});
