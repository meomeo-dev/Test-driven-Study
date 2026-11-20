// 回归测试共用的命令封装与临时运行目录。
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const SKILL_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const TOOL = join(SKILL_ROOT, "scripts", "swarm-board.mjs");

export function board(...args) {
  const result = spawnSync(process.execPath, [TOOL, ...args], { encoding: "utf8" });
  return { code: result.status, stdout: result.stdout, stderr: result.stderr };
}

export function boardJson(...args) {
  const outcome = board(...args, "--json");
  assert.equal(outcome.code, 0, outcome.stderr);
  return JSON.parse(outcome.stdout);
}

export function minutesFromNow(minutes) {
  return new Date(Date.now() + minutes * 60_000).toISOString();
}

// 一次发言；返回退出码与输出。
export function say(dir, from, to, tag, text = "x", ...extra) {
  return board("post", "--dir", dir, "--from", from, "--to", to, "--tag", tag,
    "--text", text, ...extra);
}

// 一次发言，断言成功并返回记录。
export function sayJson(dir, from, to, tag, text = "x", ...extra) {
  return boardJson("post", "--dir", dir, "--from", from, "--to", to, "--tag", tag,
    "--text", text, ...extra);
}

export function addWorker(dir, name, ...extra) {
  const outcome = board("add", "--dir", dir, "--name", name, "--role", "worker",
    "--text", `见 briefs.md 的 ${name} 一节`, ...extra);
  assert.equal(outcome.code, 0, outcome.stderr);
}

// 登记一个任意角色的成员，返回 { member, record }（record 是派发的 brief）。
export function addMember(dir, name, role, ...extra) {
  return boardJson("add", "--dir", dir, "--name", name, "--role", role,
    "--text", `见 briefs.md 的 ${name} 一节`, ...extra).added[0];
}

export function statusOf(dir, ...extra) {
  return boardJson("status", "--dir", dir, ...extra);
}

export function memberOf(status, name) {
  return status.members.find((member) => member.name === name);
}

// 成员发 start 再发 done。
export function finish(dir, name) {
  say(dir, name, "coordinator", "start");
  say(dir, name, "coordinator", "done");
}

export function groupOp(dir, group, ...extra) {
  return board("group", "--dir", dir, "--name", group, ...extra);
}

// 每个测试文件一个临时工作区：freshRun 建项目与运行目录，remove 在 after 钩子里调用。
export function createWorkspace(prefix) {
  const root = mkdtempSync(join(tmpdir(), prefix));
  return {
    root,
    freshRun(name) {
      const project = join(root, name);
      mkdirSync(join(project, "out"), { recursive: true });
      const dir = join(project, "run");
      assert.equal(board("init", "--dir", dir, "--root", project, "--title", name).code, 0);
      return { project, dir };
    },
    remove() {
      rmSync(root, { recursive: true, force: true });
    },
  };
}
