#!/usr/bin/env node
// 生成项目配置骨架与只含键名的凭据模板，并把凭据文件权限设为 600
//
// Skill: maintain-deepseek-tts-audio。遵守工具箱标准：--help 必备、默认文本输出、--json 给机器、
// 退出码只用 0（成功）/ 1（失败）/ 2（用法错误）/ 3（未就绪）。

import { chmodSync, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { EXIT, requireRoot, runTool, startIfEntry } from "./lib/cli.mjs";
import { DEFAULT_CONFIG_FILE, loadConfig, parseConfig } from "./lib/config.mjs";
import { credentialFilePath, displayPath, gitIgnoreStatus, isOwnerOnly } from "./lib/credentials.mjs";

const HELP = `init-project: 生成项目配置骨架与只含键名的凭据模板，并把凭据文件权限设为 600

用法:
  node <skill-root>/scripts/init-project.mjs --root <项目根> [--config <文件>] [--dry-run] [--json]

选项:
  --root <目录>     使用者项目根目录（必填）
  --config <文件>   配置文件，相对 --root；默认 deepseek-tts.config.json
  --dry-run         只列出将创建或修正的文件，不写入
  --json            以 JSON 输出结果
  --verbose         向 stderr 打印进度
  -h, --help        显示本帮助

不覆盖已有文件：配置文件不存在时从模板生成；配置声明的凭据文件不存在时生成只含键名的模板
（权限 600），已存在时只把权限修正为 600。凭据文件没有被 Git 忽略时给出警告，已被 Git 跟踪时
以失败退出；本工具不修改 .gitignore。不联网，不读取凭据的值。

退出码: 0 完成；1 配置有误或凭据文件已被 Git 跟踪；2 用法错误。

示例:
  node <skill-root>/scripts/init-project.mjs --root . --dry-run
  node <skill-root>/scripts/init-project.mjs --root .
`;

const OPTIONS = {
  "dry-run": { type: "boolean", default: false },
};

const TEMPLATE_DIR = new URL("../templates/", import.meta.url);
const readTemplate = (name) => readFileSync(new URL(name, TEMPLATE_DIR), "utf8");

function ensureConfig(root, configPath, dryRun) {
  const rel = relative(root, configPath);
  if (existsSync(configPath)) return { config: loadConfig(root, rel), action: { file: rel, action: "unchanged" } };
  const text = readTemplate("deepseek-tts.config.json.tpl");
  if (!dryRun) writeFileSync(configPath, text, { flag: "wx" });
  return { config: parseConfig(root, JSON.parse(text), configPath), action: { file: rel, action: dryRun ? "would-create" : "created" } };
}

function ensureCredentialFile(config, dryRun) {
  const path = credentialFilePath(config);
  if (path === null) return { file: null, action: "skipped", note: `配置未声明凭据文件，只读环境变量 ${config.credentials.env}` };
  const rel = displayPath(config.root, path);
  if (!existsSync(path)) {
    const text = readTemplate("credentials.env.tpl").replaceAll("{{env}}", config.credentials.env);
    if (!dryRun) {
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, text, { flag: "wx", mode: 0o600 });
      chmodSync(path, 0o600); // umask 可能去掉了创建时的位，这里再设一次
    }
    return { file: rel, action: dryRun ? "would-create" : "created" };
  }
  if (isOwnerOnly(path)) return { file: rel, action: "unchanged" };
  const from = (statSync(path).mode & 0o777).toString(8);
  if (!dryRun) chmodSync(path, 0o600);
  return { file: rel, action: dryRun ? "would-chmod" : "chmod", note: `权限 ${from} → 600` };
}

function gitAdvice(config, credential) {
  if (!credential.file) return { status: "not-applicable" };
  const status = gitIgnoreStatus(resolve(config.root, credential.file));
  const advice = {
    tracked: `凭据文件已被 Git 跟踪：先 git rm --cached ${credential.file}，再把它写进 .gitignore，并到 DeepSeek 开放平台作废旧 Key`,
    "not-ignored": `凭据文件没有被 Git 忽略：在它所在仓库的 .gitignore 中忽略 ${credential.file}`,
    "no-git": "不是 Git 仓库或没有 git，跳过忽略检查",
  }[status];
  return { status, advice };
}

export function run(values) {
  const root = requireRoot(values);
  const dryRun = values["dry-run"];
  const configPath = resolve(root, values.config ?? DEFAULT_CONFIG_FILE);
  const { config, action } = ensureConfig(root, configPath, dryRun);
  const credential = ensureCredentialFile(config, dryRun);
  const git = gitAdvice(config, credential);
  const actions = [action, credential];
  const lines = actions.map((item) => `${item.action} ${item.file ?? "（无凭据文件）"}${item.note ? `：${item.note}` : ""}`);
  if (git.advice) lines.push(`${git.status === "tracked" ? "✗" : "!"} ${git.advice}`);
  lines.push("下一步：在配置里填句库路径，按需调整音色（模板已填 stella、tide），在凭据文件或环境变量里填 API Key，然后运行 check-setup。");
  const ok = git.status !== "tracked";
  return { exitCode: ok ? EXIT.OK : EXIT.FAIL, data: { ok, tool: "init-project", dryRun, actions, git }, text: lines.join("\n") };
}

export const main = (argv = process.argv.slice(2)) => runTool({ help: HELP, options: OPTIONS, run }, argv);

startIfEntry(import.meta.url, main);
