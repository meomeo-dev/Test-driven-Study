// 测试共用：建临时项目、运行工具（子进程，异步，模拟服务在本进程内照常应答）。

import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const TEST_KEY = "test-key-Zq81-not-real";

/** 只保留 PATH 与测试需要的变量，避免读到开发机上真实的 API Key。 */
export function toolEnv(extra = {}) {
  return { PATH: process.env.PATH, HOME: tmpdir(), ...extra };
}

export function runTool(name, args, env = toolEnv({ DEEPSEEK_API_KEY: TEST_KEY })) {
  const script = join(SKILL_ROOT, "scripts", `${name}.mjs`);
  return new Promise((resolve) => {
    execFile(process.execPath, [script, ...args], { env, maxBuffer: 16 * 1024 * 1024 }, (error, stdout, stderr) => {
      resolve({ code: error ? error.code : 0, stdout, stderr });
    });
  });
}

export function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const createdRoots = [];

/** 新建临时目录并登记，测试结束时由 cleanupProjects 删除。 */
export function makeTempDir() {
  const root = mkdtempSync(join(tmpdir(), "deepseek-tts-test-"));
  createdRoots.push(root);
  return root;
}

export function cleanupProjects() {
  for (const root of createdRoots.splice(0)) rmSync(root, { recursive: true, force: true });
}

/** 虚构项目：一个句库组，两套音色，句库与配置都写在临时目录。 */
export function makeProject({ endpoint, phrases, voices, set = {}, config = {} }) {
  const root = makeTempDir();
  writeJson(join(root, "content/phrases.json"), phrases);
  writeJson(join(root, "deepseek-tts.config.json"), {
    schema: "maintain-deepseek-tts-audio/config-v1",
    provider: { endpoint },
    credentials: { env: "DEEPSEEK_API_KEY", file: null },
    request: { concurrency: 2, timeoutSeconds: 10, maxRetries: 3 },
    sets: [{
      name: "zh", phrases: "content/phrases.json", outputDir: "static/audio/zh",
      voices: voices ?? { female: "stella", male: "tide" },
      ...set,
    }],
    ...config,
  });
  return root;
}

export const json = (result) => JSON.parse(result.stdout);
