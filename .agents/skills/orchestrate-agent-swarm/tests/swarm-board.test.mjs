// swarm-board.mjs 的回归测试：node --test <skill-root>/tests/
import assert from "node:assert/strict";
import { execFile, execFileSync } from "node:child_process";
import { readFileSync, readdirSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { promisify } from "node:util";
import {
  SKILL_ROOT, TOOL, board, boardJson, createWorkspace, minutesFromNow, say,
} from "./helpers.mjs";

const execFileAsync = promisify(execFile);

let workspace;
before(() => {
  workspace = createWorkspace("swarm-board-test-");
});
after(() => {
  workspace.remove();
});

function freshRun(name) {
  return workspace.freshRun(name);
}

describe("CLI 契约", () => {
  test("--help 退出 0 且含示例", () => {
    const outcome = board("--help");
    assert.equal(outcome.code, 0);
    assert.match(outcome.stdout, /^swarm-board: /);
    assert.match(outcome.stdout, /示例:/);
  });

  test("缺少子命令或未知子命令退出 2", () => {
    assert.equal(board().code, 2);
    assert.equal(board("launch", "--dir", workspace.root).code, 2);
  });

  test("未初始化的运行目录退出 3", () => {
    assert.equal(board("status", "--dir", join(workspace.root, "missing")).code, 3);
  });

  test("重复 init 退出 1", () => {
    const { project, dir } = freshRun("double-init");
    assert.equal(board("init", "--dir", dir, "--root", project, "--title", "x").code, 1);
  });
});

describe("名单与消息", () => {
  test("add 公开派发一条 brief，序号连续", () => {
    const { dir } = freshRun("roster");
    const { added } = boardJson("add", "--dir", dir, "--name", "alpha", "--role", "worker",
      "--owns", "out", "--text", "见 briefs.md 的 alpha 一节");
    assert.deepEqual(added[0].record.to, ["alpha"]);
    assert.equal(added[0].record.tag, "brief");
    const posted = boardJson("post", "--dir", dir, "--from", "alpha", "--to", "coordinator",
      "--tag", "start", "--text", "开始");
    assert.equal(posted.seq, added[0].record.seq + 1);
  });

  test("保留名、非法名、未知角色退出 2，重名退出 1", () => {
    const { dir } = freshRun("names");
    const base = ["add", "--dir", dir, "--role", "worker", "--text", "x"];
    assert.equal(board(...base, "--name", "all").code, 2);
    assert.equal(board(...base, "--name", "Agent_1").code, 2);
    assert.equal(board("add", "--dir", dir, "--name", "beta", "--role", "boss",
      "--text", "x").code, 2);
    assert.equal(board(...base, "--name", "beta").code, 0);
    assert.equal(board(...base, "--name", "beta").code, 1);
  });

  test("未知发送者、未知收件人、未知标签退出 2", () => {
    const { dir } = freshRun("validation");
    board("add", "--dir", dir, "--name", "alpha", "--role", "worker", "--text", "x");
    const post = (from, to, tag) =>
      board("post", "--dir", dir, "--from", from, "--to", to, "--tag", tag, "--text", "x").code;
    assert.equal(post("ghost", "coordinator", "note"), 2);
    assert.equal(post("alpha", "ghost", "note"), 2);
    assert.equal(post("alpha", "coordinator", "shout"), 2);
    assert.equal(post("alpha", "coordinator,all", "note"), 0);
  });

  test("移除后名字不复用，发给已移除成员退出 2", () => {
    const { dir } = freshRun("remove");
    board("add", "--dir", dir, "--name", "alpha", "--role", "worker", "--text", "x");
    assert.equal(board("remove", "--dir", dir, "--name", "alpha").code, 0);
    assert.equal(board("add", "--dir", dir, "--name", "alpha", "--role", "worker",
      "--text", "x").code, 1);
    assert.equal(board("post", "--dir", dir, "--from", "coordinator", "--to", "alpha",
      "--tag", "note", "--text", "x").code, 2);
    const status = boardJson("status", "--dir", dir);
    assert.equal(status.members[0].state, "removed");
  });

  test("并发写入的序号唯一且连续", async () => {
    const { dir } = freshRun("concurrency");
    board("add", "--dir", dir, "--name", "alpha", "--role", "worker", "--text", "x");
    say(dir, "alpha", "coordinator", "start");
    const writers = Array.from({ length: 8 }, (_, index) =>
      execFileAsync(process.execPath, [TOOL, "post", "--dir", dir, "--from", "alpha",
        "--to", "coordinator", "--tag", "progress", "--text", `第 ${index} 条`]));
    await Promise.all(writers);
    const lines = readFileSync(join(dir, "board.jsonl"), "utf8").trim().split("\n");
    const seqs = lines.map((line) => JSON.parse(line).seq);
    assert.deepEqual(seqs, Array.from({ length: 10 }, (_, index) => index + 1));
  });

  test("read --for 只返回发给该成员或 all 的消息，md 格式带序号", () => {
    const { dir } = freshRun("read");
    board("add", "--dir", dir, "--name", "alpha", "--role", "worker", "--text", "给 alpha");
    board("add", "--dir", dir, "--name", "beta", "--role", "worker", "--text", "给 beta");
    board("post", "--dir", dir, "--from", "coordinator", "--to", "all", "--tag", "note",
      "--text", "全体\n注意");
    const outcome = board("read", "--dir", dir, "--for", "alpha", "--format", "md");
    assert.equal(outcome.code, 0);
    const lines = outcome.stdout.trim().split("\n");
    assert.equal(lines.length, 2);
    assert.match(lines[0], /^- #1 .* coordinator @alpha \[brief\] 给 alpha$/);
    assert.match(lines[1], /^- #3 .* @all \[note\] 全体 注意$/);
  });
});

describe("状态推导", () => {
  test("无消息、无文件变化超过阈值即 stalled；文件变化算活动", () => {
    const { project, dir } = freshRun("stall");
    board("add", "--dir", dir, "--name", "alpha", "--role", "worker", "--owns", "out",
      "--text", "x");
    const old = new Date(Date.now() - 60 * 60_000);
    utimesSync(join(project, "out"), old, old);
    const later = minutesFromNow(20);
    let status = boardJson("status", "--dir", dir, "--now", later);
    assert.deepEqual(status.members[0].flags, ["stalled"]);
    assert.equal(status.state, "attention");
    writeFileSync(join(project, "out", "draft.md"), "进行中");
    const recent = new Date(Date.now() + 19 * 60_000);
    utimesSync(join(project, "out", "draft.md"), recent, recent);
    status = boardJson("status", "--dir", dir, "--now", later);
    assert.deepEqual(status.members[0].flags, []);
    assert.equal(status.state, "running");
  });

  test("done 后缺产出为 incomplete-outputs；fix 超过阈值未送达为 needs-resume", () => {
    const { project, dir } = freshRun("outputs");
    board("add", "--dir", dir, "--name", "alpha", "--role", "worker",
      "--output", "out/a.md", "--text", "x");
    say(dir, "alpha", "coordinator", "start");
    say(dir, "alpha", "coordinator", "done", "完成");
    let member = boardJson("status", "--dir", dir).members[0];
    assert.deepEqual(member.missing_outputs, ["out/a.md"]);
    assert.deepEqual(member.flags, ["incomplete-outputs"]);
    writeFileSync(join(project, "out", "a.md"), "内容");
    board("post", "--dir", dir, "--from", "coordinator", "--to", "alpha", "--tag", "fix",
      "--text", "改第 3 行");
    member = boardJson("status", "--dir", dir).members[0];
    assert.deepEqual(member.flags, [], "fix 刚发出时不标记");
    assert.equal(member.pending.length, 1);
    const old = new Date(Date.now() - 60 * 60_000);
    utimesSync(join(project, "out", "a.md"), old, old);
    utimesSync(join(project, "out"), old, old);
    member = boardJson("status", "--dir", dir, "--now", minutesFromNow(15)).members[0];
    assert.deepEqual(member.flags, ["needs-resume"]);
  });

  test("coordinator 未答复超过阈值即标记；coordinator 发 done 后为 finished", () => {
    const { dir } = freshRun("coordinator");
    board("add", "--dir", dir, "--name", "alpha", "--role", "worker", "--text", "x");
    say(dir, "alpha", "coordinator", "start");
    say(dir, "alpha", "coordinator", "done", "完成");
    let status = boardJson("status", "--dir", dir, "--now", minutesFromNow(15));
    assert.deepEqual(status.coordinator.flags, ["unanswered"]);
    board("post", "--dir", dir, "--from", "coordinator", "--to", "all", "--tag", "done",
      "--text", "收尾");
    status = boardJson("status", "--dir", dir);
    assert.equal(status.state, "finished");
    assert.deepEqual(status.coordinator.unanswered, []);
  });

  test("没有成员在工作也没有异常时为 idle", () => {
    const { dir } = freshRun("idle");
    board("add", "--dir", dir, "--name", "alpha", "--role", "worker", "--text", "x");
    say(dir, "alpha", "coordinator", "start");
    say(dir, "alpha", "coordinator", "done", "完成");
    board("post", "--dir", dir, "--from", "coordinator", "--to", "alpha", "--tag", "accept",
      "--text", "验收");
    const status = boardJson("status", "--dir", dir);
    assert.equal(status.state, "idle");
  });
});

describe("wait", () => {
  test("超时返回 timed_out 且退出 0", () => {
    const { dir } = freshRun("wait-timeout");
    const result = boardJson("wait", "--dir", dir, "--since", "0", "--timeout-seconds", "1",
      "--interval-seconds", "1");
    assert.equal(result.timed_out, true);
  });

  test("出现发给自己的新消息即提前返回", async () => {
    const { dir } = freshRun("wait-wake");
    board("add", "--dir", dir, "--name", "monitor", "--role", "monitor", "--owns", "out",
      "--text", "x");
    const started = Date.now();
    const waiting = execFileAsync(process.execPath, [TOOL, "wait", "--dir", dir,
      "--since", "1", "--for", "monitor", "--timeout-seconds", "30", "--interval-seconds", "1",
      "--json"]);
    setTimeout(() => {
      execFileSync(process.execPath, [TOOL, "post", "--dir", dir, "--from", "coordinator",
        "--to", "monitor", "--tag", "stop", "--text", "收尾"]);
    }, 1500);
    const { stdout } = await waiting;
    const result = JSON.parse(stdout);
    assert.equal(result.timed_out, false);
    assert.equal(result.records[0].tag, "stop");
    assert.ok(Date.now() - started < 10_000);
  });
});

describe("组与批量登记", () => {
  test("--count 批量登记 <name>-1..n，{i} 换成序号，成员归入组", () => {
    const { dir } = freshRun("batch");
    const { added } = boardJson("add", "--dir", dir, "--name", "reviewer", "--role",
      "verifier", "--count", "3", "--output", "out/review-{i}.md", "--text", "分片 {i}");
    assert.deepEqual(added.map(({ member }) => member.name),
      ["reviewer-1", "reviewer-2", "reviewer-3"]);
    assert.deepEqual(added[1].member.outputs, ["out/review-2.md"]);
    assert.deepEqual(added[1].member.groups, ["reviewer"]);
    assert.equal(added[2].record.text, "分片 3");
    const status = boardJson("status", "--dir", dir);
    assert.deepEqual(status.groups, [{
      name: "reviewer", members: ["reviewer-1", "reviewer-2", "reviewer-3"], archived: false,
    }]);
  });

  test("--to 组名展开为组内在册成员，read --group 与 --for 都能读到", () => {
    const { dir } = freshRun("group-post");
    board("add", "--dir", dir, "--name", "lexer", "--role", "worker", "--group", "parser",
      "--text", "x");
    board("add", "--dir", dir, "--name", "ast", "--role", "worker", "--group", "parser",
      "--text", "x");
    board("add", "--dir", dir, "--name", "ui", "--role", "worker", "--text", "x");
    const record = boardJson("post", "--dir", dir, "--from", "coordinator", "--to", "parser",
      "--tag", "note", "--text", "AST 接口已定");
    assert.deepEqual(record.to, ["lexer", "ast"]);
    assert.deepEqual(record.addressed, ["#parser"]);
    const byGroup = boardJson("read", "--dir", dir, "--group", "parser").records;
    assert.deepEqual(byGroup.map((entry) => entry.seq), [record.seq]);
    assert.equal(boardJson("read", "--dir", dir, "--for", "ui").records.length, 1);
    assert.equal(boardJson("read", "--dir", dir, "--for", "ast").records.length, 2);
    const text = board("read", "--dir", dir, "--since", String(record.seq - 1)).stdout;
    assert.match(text, /coordinator @#parser \[note\]/);
  });

  test("组名与成员名冲突退出 1；remove 组名移除组内全部成员", () => {
    const { dir } = freshRun("group-remove");
    board("add", "--dir", dir, "--name", "alpha", "--role", "worker", "--text", "x");
    assert.equal(board("add", "--dir", dir, "--name", "beta", "--role", "worker",
      "--group", "alpha", "--text", "x").code, 1);
    board("add", "--dir", dir, "--name", "shard", "--role", "worker", "--count", "2",
      "--text", "x");
    assert.equal(board("add", "--dir", dir, "--name", "shard", "--role", "worker",
      "--text", "x").code, 1);
    const removed = boardJson("remove", "--dir", dir, "--name", "shard");
    assert.deepEqual(removed.members.map((member) => member.name), ["shard-1", "shard-2"]);
    assert.equal(board("post", "--dir", dir, "--from", "coordinator", "--to", "shard",
      "--tag", "note", "--text", "x").code, 2);
  });

  test("--count 越界或带序号后超长退出 2", () => {
    const { dir } = freshRun("batch-limits");
    const base = ["add", "--dir", dir, "--role", "worker", "--text", "x"];
    assert.equal(board(...base, "--name", "w", "--count", "21").code, 2);
    assert.equal(board(...base, "--name", "a".repeat(31), "--count", "10").code, 2);
  });
});

describe("待命", () => {
  test("standby 记录截止时间；到期前 reachable，到期后不再 reachable", () => {
    const { dir } = freshRun("standby");
    board("add", "--dir", dir, "--name", "alpha", "--role", "worker", "--text", "x");
    say(dir, "alpha", "coordinator", "start");
    say(dir, "alpha", "coordinator", "done", "完成");
    const record = boardJson("post", "--dir", dir, "--from", "alpha", "--to", "coordinator",
      "--tag", "standby", "--minutes", "10", "--text", "待命");
    assert.ok(Date.parse(record.until) > Date.now());
    let member = boardJson("status", "--dir", dir).members[0];
    assert.equal(member.state, "done");
    assert.equal(member.reachable, true);
    assert.equal(member.standby_until, record.until);
    member = boardJson("status", "--dir", dir, "--now", minutesFromNow(11)).members[0];
    assert.equal(member.reachable, false);
  });

  test("standby 须由成员发出且带 --minutes；--minutes 不用于其他标签", () => {
    const { dir } = freshRun("standby-validation");
    board("add", "--dir", dir, "--name", "alpha", "--role", "worker", "--text", "x");
    say(dir, "alpha", "coordinator", "start");
    say(dir, "alpha", "coordinator", "done");
    const post = (...extra) => board("post", "--dir", dir, "--to", "coordinator",
      "--text", "x", ...extra).code;
    assert.equal(post("--from", "alpha", "--tag", "standby"), 2);
    assert.equal(post("--from", "alpha", "--tag", "standby", "--minutes", "121"), 2);
    assert.equal(post("--from", "coordinator", "--tag", "standby", "--minutes", "5"), 2);
    assert.equal(post("--from", "alpha", "--tag", "note", "--minutes", "5"), 2);
    assert.equal(post("--from", "alpha", "--tag", "standby", "--minutes", "5"), 0);
  });
});

describe("watch", () => {
  test("逐行输出需要 --for 处理的消息（含挂上前未处理的），到时给出 --since", async () => {
    const { dir } = freshRun("watch");
    board("add", "--dir", dir, "--name", "alpha", "--role", "worker", "--text", "x");
    say(dir, "alpha", "coordinator", "start");
    say(dir, "alpha", "coordinator", "done", "挂上前的完成也输出");
    const watching = execFileAsync(process.execPath, [TOOL, "watch", "--dir", dir,
      "--for", "coordinator", "--timeout-seconds", "4", "--interval-seconds", "1"]);
    setTimeout(() => {
      const post = (tag, text) => execFileSync(process.execPath, [TOOL, "post", "--dir", dir,
        "--from", "alpha", "--to", "coordinator", "--tag", tag, "--text", text]);
      post("start", "重新开始不输出");
      post("progress", "进展不输出");
      post("blocked", "受阻要输出");
    }, 1200);
    const { stdout } = await watching;
    const lines = stdout.trim().split("\n");
    assert.equal(lines.length, 3, stdout);
    assert.match(lines[0], /^#3 .* alpha @coordinator \[done\] 挂上前的完成也输出$/);
    assert.match(lines[1], /^#6 .* alpha @coordinator \[blocked\] 受阻要输出$/);
    assert.match(lines[2], /--since 6$/);
  });

  test("watch 不支持 --json", () => {
    const { dir } = freshRun("watch-json");
    assert.equal(board("watch", "--dir", dir, "--for", "coordinator", "--json").code, 2);
  });
});

describe("闭包", () => {
  test("脚本只 import Node 内置模块与包内相对路径，不含本机绝对路径", () => {
    const files = [];
    const walk = (directory) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name);
        if (entry.isDirectory()) walk(path);
        else if (entry.name.endsWith(".mjs")) files.push(path);
      }
    };
    walk(join(SKILL_ROOT, "scripts"));
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/from\s+"([^"]+)"/g)) {
        const specifier = match[1];
        assert.ok(specifier.startsWith("node:") || specifier.startsWith("./"),
          `${file} 引用了包外模块 ${specifier}`);
      }
      assert.doesNotMatch(source, /\/Users\/|\/home\//, `${file} 含本机绝对路径`);
    }
  });
});
