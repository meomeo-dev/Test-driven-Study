// 消息板协议的回归测试：待处理与送达、状态转移、待答复、收件判定、存储一致性、
// 待处理事项、成员之间的交接与组的加入、退出和归档。node --test <skill-root>/tests/
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  appendFileSync, mkdirSync, readFileSync, rmSync, utimesSync, writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { promisify } from "node:util";
import {
  TOOL, addMember, addWorker, board, boardJson, createWorkspace, finish, groupOp, memberOf,
  minutesFromNow, say, sayJson, statusOf,
} from "./helpers.mjs";

const execFileAsync = promisify(execFile);
const WAKE_TAGS = "brief,fix,resume,stop";

let workspace;
before(() => {
  workspace = createWorkspace("swarm-protocol-test-");
});
after(() => {
  workspace.remove();
});

describe("待处理与送达", () => {
  test("done 与 standby 之间发来的 fix 仍待处理，从 start 起 wait 能读到", () => {
    const { dir } = workspace.freshRun("fix-between");
    addWorker(dir, "w");
    const start = sayJson(dir, "w", "coordinator", "start");
    say(dir, "w", "coordinator", "done");
    const fix = sayJson(dir, "coordinator", "w", "fix", "改第 3 行");
    say(dir, "w", "coordinator", "standby", "待命", "--minutes", "10");
    assert.deepEqual(memberOf(statusOf(dir), "w").pending, [fix.seq]);
    const woke = boardJson("wait", "--dir", dir, "--for", "w", "--since", String(start.seq),
      "--tags", WAKE_TAGS, "--timeout-seconds", "1", "--interval-seconds", "1");
    assert.equal(woke.timed_out, false);
    assert.deepEqual(woke.records.map((record) => record.seq), [fix.seq]);
  });

  test("运行中成员的 progress 不清除待处理，start 清除", () => {
    const { dir } = workspace.freshRun("fix-running");
    addWorker(dir, "w");
    say(dir, "w", "coordinator", "start");
    const fix = sayJson(dir, "coordinator", "w", "fix");
    say(dir, "w", "coordinator", "progress");
    assert.deepEqual(memberOf(statusOf(dir), "w").pending, [fix.seq]);
    const later = memberOf(statusOf(dir, "--now", minutesFromNow(15)), "w");
    assert.ok(later.flags.includes("needs-resume"), later.flags.join(","));
    say(dir, "w", "coordinator", "start", `开始处理 #${fix.seq}`);
    assert.deepEqual(memberOf(statusOf(dir), "w").pending, []);
  });

  test("有未处理的 brief 时 done 被拒，发 start 之后可以 done", () => {
    const { dir } = workspace.freshRun("done-gate");
    addWorker(dir, "w");
    say(dir, "w", "coordinator", "start");
    say(dir, "w", "coordinator", "progress");
    const brief = sayJson(dir, "coordinator", "w", "brief", "追加一个函数");
    const refused = say(dir, "w", "coordinator", "done");
    assert.equal(refused.code, 2);
    assert.match(refused.stderr, new RegExp(`#${brief.seq}`));
    say(dir, "w", "coordinator", "start", `开始处理 #${brief.seq}`);
    assert.equal(say(dir, "w", "coordinator", "done").code, 0);
    assert.equal(say(dir, "w", "coordinator", "blocked").code, 2, "done 之后不能 blocked");
  });

  test("发给 all 的 fix 计入每个成员的待处理", () => {
    const { dir } = workspace.freshRun("fix-all");
    addWorker(dir, "a");
    addWorker(dir, "b");
    finish(dir, "a");
    const fix = sayJson(dir, "coordinator", "all", "fix", "全体补一节");
    assert.deepEqual(memberOf(statusOf(dir), "a").pending, [fix.seq]);
    assert.deepEqual(memberOf(statusOf(dir), "b").pending, [fix.seq]);
  });
});

describe("monitor 与 idle", () => {
  test("monitor 发 stall 后仍为 active，可以再报；stall 须由 active 的 monitor 发给 coordinator",
    () => {
      const { dir } = workspace.freshRun("monitor-stall");
      addWorker(dir, "w");
      addMember(dir, "monitor", "monitor", "--owns", "out");
      assert.equal(say(dir, "monitor", "coordinator", "stall", "未开始").code, 2);
      say(dir, "monitor", "coordinator", "start");
      assert.equal(say(dir, "monitor", "w", "stall", "不经 coordinator").code, 2);
      const stall = sayJson(dir, "monitor", "coordinator", "stall", "w 停滞");
      let status = statusOf(dir);
      assert.equal(memberOf(status, "monitor").state, "active");
      assert.deepEqual(status.coordinator.unanswered, [stall.seq]);
      assert.equal(say(dir, "monitor", "coordinator", "stall", "refs 变化后再报").code, 0);
      status = statusOf(dir);
      assert.equal(memberOf(status, "monitor").state, "active");
    });

  test("monitor 休眠：发 note 后用不带 --for 的 wait 等任何新消息，状态一直是 active", () => {
    const { project, dir } = workspace.freshRun("monitor-sleep");
    addWorker(dir, "w");
    addMember(dir, "monitor", "monitor", "--owns", "out");
    say(dir, "monitor", "coordinator", "start");
    const sleep = sayJson(dir, "monitor", "coordinator", "note", "休眠");
    const waitArgs = ["wait", "--dir", dir, "--since", String(sleep.seq),
      "--timeout-seconds", "1", "--interval-seconds", "1"];
    assert.equal(boardJson(...waitArgs).timed_out, true);
    const old = new Date(Date.now() - 60 * 60_000);
    utimesSync(join(project, "out"), old, old);
    let monitor = memberOf(statusOf(dir, "--now", minutesFromNow(20)), "monitor");
    assert.deepEqual(monitor.flags, ["stalled"], "不追加 ticks 时会被判停滞");
    // 每次等待超时向 ticks 文件追加一行“休眠”，owns 的修改时间随之更新。
    const ticks = join(project, "out", "ticks-monitor.md");
    appendFileSync(ticks, "休眠\n");
    const recent = new Date(Date.now() + 19 * 60_000);
    utimesSync(ticks, recent, recent);
    monitor = memberOf(statusOf(dir, "--now", minutesFromNow(20)), "monitor");
    assert.equal(monitor.state, "active");
    assert.deepEqual(monitor.flags, []);
    assert.deepEqual(statusOf(dir).coordinator.unanswered, [], "休眠的 note 不要求答复");
    const news = sayJson(dir, "w", "coordinator", "start");
    const woke = boardJson(...waitArgs);
    assert.deepEqual(woke.records.map((record) => record.seq), [news.seq]);
  });

  test("monitor 不带 --owns 退出 2", () => {
    const { dir } = workspace.freshRun("monitor-owns");
    assert.equal(board("add", "--dir", dir, "--name", "monitor", "--role", "monitor",
      "--text", "x").code, 2);
  });

  test("idle 在阈值内照常为 idle，超过阈值记 coordinator 的 idle 标记", () => {
    const { dir } = workspace.freshRun("idle-timeout");
    addWorker(dir, "w");
    finish(dir, "w");
    say(dir, "coordinator", "w", "accept");
    let status = statusOf(dir);
    assert.equal(status.state, "idle");
    assert.deepEqual(status.coordinator.flags, []);
    status = statusOf(dir, "--now", minutesFromNow(15));
    assert.equal(status.state, "attention");
    assert.deepEqual(status.coordinator.flags, ["idle"]);
  });
});

describe("待命的结束", () => {
  test("stop 之后不再 reachable；coordinator 的收尾 done 同样结束待命", () => {
    const { dir } = workspace.freshRun("standby-stop");
    for (const name of ["a", "b"]) {
      addWorker(dir, name);
      finish(dir, name);
      say(dir, name, "coordinator", "standby", "待命", "--minutes", "10");
    }
    say(dir, "coordinator", "a", "stop");
    let status = statusOf(dir);
    assert.equal(memberOf(status, "a").reachable, false);
    assert.equal(memberOf(status, "b").reachable, true);
    say(dir, "coordinator", "all", "done", "收尾");
    status = statusOf(dir);
    assert.equal(memberOf(status, "b").reachable, false);
  });

  test("发过 stop 的成员标 stopped_seq：status 与总览标出已停止，没有活动也不判停滞", () => {
    const { dir } = workspace.freshRun("stopped");
    addWorker(dir, "a");
    addWorker(dir, "b");
    finish(dir, "a");
    say(dir, "a", "coordinator", "standby", "待命", "--minutes", "10");
    say(dir, "b", "coordinator", "start");
    const stopA = sayJson(dir, "coordinator", "a", "stop");
    const stopB = sayJson(dir, "coordinator", "b", "stop");
    const later = statusOf(dir, "--now", minutesFromNow(30));
    assert.deepEqual([memberOf(later, "a").stopped_seq, memberOf(later, "a").reachable],
      [stopA.seq, false]);
    assert.deepEqual([memberOf(later, "b").state, memberOf(later, "b").stopped_seq],
      ["active", stopB.seq]);
    assert.deepEqual(memberOf(later, "b").flags, [], "已发 stop 的成员没有活动不算停滞");
    assert.match(board("status", "--dir", dir).stdout,
      new RegExp(`^a worker done stopped=#${stopA.seq} `, "m"));
    assert.match(board("overview", "--dir", dir).stdout,
      new RegExp(`\\| a \\| worker \\| done，已停止 #${stopA.seq} \\|`));
    say(dir, "b", "coordinator", "done", "收到 stop 前已完成");
    assert.equal(memberOf(statusOf(dir), "b").stopped_seq, null, "stop 之后再发言即清除");
    const closing = sayJson(dir, "coordinator", "all", "done", "收尾");
    const finished = statusOf(dir);
    assert.equal(memberOf(finished, "a").stopped_seq, stopA.seq, "保留让它结束的第一条");
    assert.equal(memberOf(finished, "b").stopped_seq, closing.seq);
  });

  test("standby 只在 done 之后可发", () => {
    const { dir } = workspace.freshRun("standby-active");
    addWorker(dir, "a");
    say(dir, "a", "coordinator", "start");
    assert.equal(say(dir, "a", "coordinator", "standby", "x", "--minutes", "5").code, 2);
  });

  test("wait --until 已过时立即返回 deadline_reached；不带时区偏移退出 2", () => {
    const { dir } = workspace.freshRun("wait-until");
    addWorker(dir, "a");
    const started = Date.now();
    const past = new Date(Date.now() - 60_000).toISOString();
    const result = boardJson("wait", "--dir", dir, "--for", "a", "--since", "1",
      "--until", past, "--timeout-seconds", "30");
    assert.equal(result.timed_out, true);
    assert.equal(result.deadline_reached, true);
    assert.ok(Date.now() - started < 5_000);
    assert.equal(board("wait", "--dir", dir, "--for", "a", "--since", "1",
      "--until", "2026-11-19").code, 2);
  });
});

describe("收尾与重新打开", () => {
  test("coordinator 的 done 只能发给 all；收尾后再 add 即重新打开", () => {
    const { dir } = workspace.freshRun("finish");
    addWorker(dir, "a");
    finish(dir, "a");
    assert.equal(say(dir, "coordinator", "a", "done").code, 2);
    say(dir, "coordinator", "all", "done", "收尾");
    assert.equal(statusOf(dir).state, "finished");
    addWorker(dir, "b");
    assert.equal(statusOf(dir).state, "running");
  });
});

describe("发送者与转移校验", () => {
  test("成员不能发 coordinator 的标签，worker 不能发 stall，verifier 可以发 fix", () => {
    const { dir } = workspace.freshRun("permissions");
    addWorker(dir, "a");
    addWorker(dir, "b");
    assert.equal(board("add", "--dir", dir, "--name", "v", "--role", "verifier",
      "--text", "x").code, 0);
    for (const tag of ["stop", "accept", "brief", "resume", "stall"]) {
      assert.equal(say(dir, "a", "b", tag).code, 2, tag);
    }
    assert.equal(say(dir, "v", "a,coordinator", "fix", "改第 2 行").code, 0);
    assert.equal(say(dir, "coordinator", "a", "progress").code, 2);
  });

  test("未 start 不能 done；done 须发给 coordinator 或 all", () => {
    const { dir } = workspace.freshRun("transitions");
    addWorker(dir, "a");
    addWorker(dir, "b");
    assert.equal(say(dir, "a", "coordinator", "done").code, 2);
    say(dir, "a", "coordinator", "start");
    assert.equal(say(dir, "a", "b", "done").code, 2);
    assert.equal(say(dir, "a", "all", "done").code, 0);
    assert.equal(say(dir, "a", "coordinator", "done").code, 2, "done 之后再 done 要先 start");
  });
});

describe("待答复的核销", () => {
  test("coordinator 发给别人的消息与 add 的派发都不核销", () => {
    const { dir } = workspace.freshRun("unanswered");
    addWorker(dir, "v");
    addWorker(dir, "w");
    say(dir, "v", "coordinator", "start");
    say(dir, "w", "coordinator", "start");
    say(dir, "v", "coordinator", "done");
    const blocked = sayJson(dir, "w", "coordinator", "blocked", "缺输入");
    say(dir, "coordinator", "v", "accept");
    assert.deepEqual(statusOf(dir).coordinator.unanswered, [blocked.seq]);
    addWorker(dir, "x");
    assert.deepEqual(statusOf(dir).coordinator.unanswered, [blocked.seq]);
    say(dir, "coordinator", "w", "brief", "改派");
    assert.deepEqual(statusOf(dir).coordinator.unanswered, []);
  });

  test("发给 all 的 blocked 计入待答复，watch 也输出", async () => {
    const { dir } = workspace.freshRun("unanswered-all");
    addWorker(dir, "a");
    say(dir, "a", "coordinator", "start");
    const watching = execFileAsync(process.execPath, [TOOL, "watch", "--dir", dir,
      "--for", "coordinator", "--timeout-seconds", "3", "--interval-seconds", "1"]);
    const blocked = sayJson(dir, "a", "all", "blocked", "受阻");
    const { stdout } = await watching;
    assert.match(stdout, new RegExp(`^#${blocked.seq} .*\\[blocked\\] 受阻$`, "m"));
    assert.deepEqual(statusOf(dir).coordinator.unanswered, [blocked.seq]);
  });
});

describe("收件人与读取", () => {
  test("--for 拼错退出 2；已移除成员只能 read", () => {
    const { dir } = workspace.freshRun("addressee");
    addWorker(dir, "a");
    assert.equal(board("read", "--dir", dir, "--for", "ghost").code, 2);
    assert.equal(board("wait", "--dir", dir, "--for", "ghost", "--since", "0",
      "--timeout-seconds", "1").code, 2);
    assert.equal(board("watch", "--dir", dir, "--for", "cordinator",
      "--timeout-seconds", "1").code, 2);
    board("remove", "--dir", dir, "--name", "a");
    assert.equal(board("wait", "--dir", dir, "--for", "a", "--since", "0",
      "--timeout-seconds", "1").code, 2);
    assert.equal(board("read", "--dir", dir, "--for", "a").code, 0);
  });

  test("自己发给 all 的消息不唤醒自己；--tags 只看指定标签", () => {
    const { dir } = workspace.freshRun("self-and-tags");
    addWorker(dir, "a");
    addWorker(dir, "b");
    const start = sayJson(dir, "a", "coordinator", "start");
    say(dir, "a", "all", "note", "接口已定");
    const result = boardJson("wait", "--dir", dir, "--for", "a", "--since", String(start.seq),
      "--timeout-seconds", "1", "--interval-seconds", "1");
    assert.equal(result.timed_out, true);
    say(dir, "coordinator", "b", "accept");
    const fix = sayJson(dir, "coordinator", "b", "fix");
    const read = boardJson("read", "--dir", dir, "--for", "b", "--tags", "fix");
    assert.deepEqual(read.records.map((record) => record.seq), [fix.seq]);
    assert.equal(board("read", "--dir", dir, "--tags", "shout").code, 2);
  });

  test("后加入的成员读不到加入之前发给 all 的消息", () => {
    const { dir } = workspace.freshRun("late-join");
    addWorker(dir, "a");
    say(dir, "coordinator", "all", "note", "早先的广播");
    addWorker(dir, "b");
    const read = boardJson("read", "--dir", dir, "--for", "b", "--since", "0");
    assert.deepEqual(read.records.map((record) => record.tag), ["brief"]);
  });
});

describe("存储一致性", () => {
  test("超过 5 秒的遗留锁被回收，写入不必等满等待上限", () => {
    const { dir } = workspace.freshRun("stale-lock");
    addWorker(dir, "a");
    const lock = join(dir, "board.lock");
    writeFileSync(lock, "");
    const old = new Date(Date.now() - 10_000);
    utimesSync(lock, old, old);
    const started = Date.now();
    assert.equal(say(dir, "a", "coordinator", "start").code, 0);
    assert.ok(Date.now() - started < 5_000);
  });

  test("缺名单时可以重跑 init，已有消息板不截断", () => {
    const { project, dir } = workspace.freshRun("reinit");
    addWorker(dir, "a");
    const before = readFileSync(join(dir, "board.jsonl"), "utf8");
    rmSync(join(dir, "members.json"));
    assert.equal(board("init", "--dir", dir, "--root", project, "--title", "x").code, 0);
    assert.equal(readFileSync(join(dir, "board.jsonl"), "utf8"), before);
  });

  test("末尾的半行在读取时跳过，下一次追加前截掉", () => {
    const { dir } = workspace.freshRun("torn-tail");
    addWorker(dir, "a");
    appendFileSync(join(dir, "board.jsonl"), '{"seq":2,"ti');
    assert.equal(boardJson("read", "--dir", dir).records.length, 1);
    assert.equal(sayJson(dir, "a", "coordinator", "start").seq, 2);
    const lines = readFileSync(join(dir, "board.jsonl"), "utf8").trim().split("\n");
    assert.deepEqual(lines.map((line) => JSON.parse(line).seq), [1, 2]);
  });

  test("单个成员的路径不得含 {i}，也不得越出项目根", () => {
    const { dir } = workspace.freshRun("paths");
    const add = (...extra) => board("add", "--dir", dir, "--name", "a", "--role", "worker",
      "--text", "x", ...extra).code;
    assert.equal(add("--output", "out/{i}.md"), 2);
    assert.equal(add("--owns", "/etc"), 2);
    assert.equal(add("--owns", "../elsewhere"), 2);
    assert.equal(add("--owns", "out"), 0);
  });

  test("--now 只用于 status，且须带时区偏移", () => {
    const { dir } = workspace.freshRun("now-option");
    addWorker(dir, "a");
    assert.equal(say(dir, "a", "coordinator", "start", "x",
      "--now", "2020-01-01T00:00:00Z").code, 2);
    assert.equal(board("status", "--dir", dir, "--now", "2026-11-19").code, 2);
    assert.equal(board("status", "--dir", dir, "--now", "2026-11-19T10:00:00-05:00").code, 0);
  });
});

describe("活动判定", () => {
  test("大目录不挤掉同级目录里的新文件，截断时标出 scan_truncated", () => {
    const { project, dir } = workspace.freshRun("big-directory");
    const own = join(project, "own");
    mkdirSync(join(own, "big"), { recursive: true });
    mkdirSync(join(own, "a", "b"), { recursive: true });
    const old = new Date(Date.now() - 60 * 60_000);
    for (let index = 0; index < 2100; index += 1) {
      const file = join(own, "big", `old-${index}.md`);
      writeFileSync(file, "");
      utimesSync(file, old, old);
    }
    const recent = new Date(Date.now() + 19 * 60_000);
    writeFileSync(join(own, "a", "b", "new.md"), "进行中");
    utimesSync(join(own, "a", "b", "new.md"), recent, recent);
    for (const path of [join(own, "a", "b"), join(own, "a"), join(own, "big"), own]) {
      utimesSync(path, old, old);
    }
    addWorker(dir, "w", "--owns", "own");
    say(dir, "w", "coordinator", "start");
    const member = memberOf(statusOf(dir, "--now", minutesFromNow(20)), "w");
    assert.ok(member.idle_minutes < 12, `idle=${member.idle_minutes}`);
    assert.equal(member.scan_truncated, true);
    assert.deepEqual(member.flags, []);
  });
});

// 处理建议照录 spec 第 1 节的表格。
const ACTIONS = {
  blocked: "读受阻原因，补输入、改派或发 stop",
  "needs-resume": "成员没有读到这些消息：已结束的续接送达或改派，运行中的等它读板",
  unanswered: "答复这些回报：accept、fix、brief 或 note",
  stalled: "成员没有活动：确认它在宿主中是否仍在运行，必要时改派",
  "incomplete-outputs": "产出缺失或为空：发 fix，或核对 outputs 登记",
  idle: "无人干活且超过阈值没有新消息：派活、收尾或发 stop",
};

function item(subject, flag, refs, since, detail = null) {
  return { id: `${subject}:${flag}`, subject, flag, refs, since, detail, action: ACTIONS[flag] };
}

describe("待处理事项（attention）", () => {
  // 名单顺序 o、s、n、a 与标记顺序相反，用来检查排序。
  function flaggedRun(name) {
    const { dir } = workspace.freshRun(name);
    addMember(dir, "o", "worker", "--output", "out/o.md");
    const sBrief = addMember(dir, "s", "worker").record;
    addMember(dir, "n", "worker");
    addMember(dir, "a", "worker");
    say(dir, "o", "coordinator", "start");
    const oDone = sayJson(dir, "o", "coordinator", "done");
    finish(dir, "n");
    const nFix = sayJson(dir, "coordinator", "n", "fix", "改第 3 行");
    say(dir, "a", "coordinator", "start");
    const aBlocked = sayJson(dir, "a", "coordinator", "blocked", "缺输入");
    return { dir, sBrief, oDone, nFix, aBlocked };
  }

  test("每种成员标记与 unanswered 各一项：字段齐全，按标记顺序排序", () => {
    const { dir, sBrief, oDone, nFix, aBlocked } = flaggedRun("attention-fields");
    const status = statusOf(dir, "--now", minutesFromNow(15));
    assert.equal(status.state, "attention");
    assert.deepEqual(status.attention, [
      item("a", "blocked", [aBlocked.seq], aBlocked.time),
      item("n", "needs-resume", [nFix.seq], nFix.time),
      item("coordinator", "unanswered", [oDone.seq, aBlocked.seq], oDone.time),
      item("s", "stalled", [sBrief.seq], sBrief.time),
      item("o", "incomplete-outputs", [oDone.seq], oDone.time, "out/o.md"),
    ]);
  });

  test("status 文本在成员行与组行之后列出待处理事项", () => {
    const { dir, sBrief, oDone, nFix, aBlocked } = flaggedRun("attention-text");
    const outcome = board("status", "--dir", dir, "--now", minutesFromNow(15));
    assert.equal(outcome.code, 0, outcome.stderr);
    const lines = outcome.stdout.trim().split("\n");
    const header = lines.indexOf("待处理事项：");
    assert.equal(header, 2 + 4, outcome.stdout); // 标题、coordinator、4 个成员行之后
    assert.deepEqual(lines.slice(header + 1), [
      `- a:blocked #${aBlocked.seq} 自 ${aBlocked.time}：${ACTIONS.blocked}`,
      `- n:needs-resume #${nFix.seq} 自 ${nFix.time}：${ACTIONS["needs-resume"]}`,
      `- coordinator:unanswered #${oDone.seq} #${aBlocked.seq} 自 ${oDone.time}：` +
        ACTIONS.unanswered,
      `- s:stalled #${sBrief.seq} 自 ${sBrief.time}：${ACTIONS.stalled}`,
      `- o:incomplete-outputs #${oDone.seq} 自 ${oDone.time}：out/o.md；` +
        ACTIONS["incomplete-outputs"],
    ]);
  });

  test("idle 事项指向板头；stalled 指向最后一条自己的消息；没有事项时不列", () => {
    const { dir } = workspace.freshRun("attention-idle");
    addWorker(dir, "w");
    finish(dir, "w");
    const accept = sayJson(dir, "coordinator", "w", "accept");
    let status = statusOf(dir);
    assert.deepEqual(status.attention, []);
    assert.doesNotMatch(board("status", "--dir", dir).stdout, /待处理事项/);
    status = statusOf(dir, "--now", minutesFromNow(15));
    assert.deepEqual(status.attention,
      [item("coordinator", "idle", [accept.seq], accept.time)]);
    addWorker(dir, "x");
    const start = sayJson(dir, "x", "coordinator", "start");
    status = statusOf(dir, "--now", minutesFromNow(15));
    assert.deepEqual(status.attention, [item("x", "stalled", [start.seq], start.time)]);
  });

  test("已移除的成员不产生事项；收尾后没有事项", () => {
    const { dir } = workspace.freshRun("attention-removed");
    addWorker(dir, "w");
    addWorker(dir, "x");
    say(dir, "w", "coordinator", "start");
    say(dir, "w", "coordinator", "blocked", "缺输入");
    board("remove", "--dir", dir, "--name", "w");
    let status = statusOf(dir, "--now", minutesFromNow(15));
    assert.deepEqual(status.attention.map((entry) => entry.id), ["x:stalled"]);
    say(dir, "coordinator", "all", "done", "收尾");
    status = statusOf(dir, "--now", minutesFromNow(15));
    assert.equal(status.state, "finished");
    assert.deepEqual(status.attention, []);
    assert.deepEqual(memberOf(status, "x").flags, [], "收尾的 done 与 stop 一样，不再判停滞");
  });
});

describe("成员之间的交接（handoff）", () => {
  test("只有 worker 与 verifier 在 active 或 done 时可发；coordinator 与 monitor 不能发", () => {
    const { dir } = workspace.freshRun("handoff-permissions");
    addWorker(dir, "a");
    addWorker(dir, "b");
    addMember(dir, "v", "verifier");
    addMember(dir, "m", "monitor", "--owns", "out");
    assert.equal(say(dir, "coordinator", "a", "handoff").code, 2);
    say(dir, "m", "coordinator", "start");
    assert.equal(say(dir, "m", "a,coordinator", "handoff").code, 2);
    assert.equal(say(dir, "a", "b", "handoff", "未开始").code, 2);
    say(dir, "a", "coordinator", "start");
    assert.equal(say(dir, "a", "b", "handoff", "接手解析器").code, 0);
    finish(dir, "v");
    assert.equal(say(dir, "v", "a,coordinator", "handoff", "改第 2 行").code, 0);
    say(dir, "b", "coordinator", "start");
    say(dir, "b", "coordinator", "blocked", "缺输入");
    assert.equal(say(dir, "b", "a", "handoff", "受阻时不交接").code, 2);
  });

  test("不接受 all，不能只发给 coordinator 或自己；可以发给组并抄送 coordinator", () => {
    const { dir } = workspace.freshRun("handoff-recipients");
    addWorker(dir, "a", "--group", "pair");
    addWorker(dir, "b", "--group", "pair");
    say(dir, "a", "coordinator", "start");
    for (const to of ["all", "b,all", "coordinator", "a", "a,coordinator"]) {
      assert.equal(say(dir, "a", to, "handoff").code, 2, to);
    }
    const record = sayJson(dir, "a", "pair,coordinator", "handoff", "按 #3 接手");
    assert.deepEqual(record.to, ["a", "b", "coordinator"]);
    assert.deepEqual(record.addressed, ["#pair", "coordinator"]);
    const status = statusOf(dir);
    assert.deepEqual(memberOf(status, "b").pending, [record.seq]);
    assert.deepEqual(memberOf(status, "a").pending, []);
    assert.deepEqual(status.coordinator.unanswered, [], "抄送不要求 coordinator 答复");
  });

  test("handoff 计入收件成员的待处理与 needs-resume，done 被拒直到 start", () => {
    const { dir } = workspace.freshRun("handoff-pending");
    addWorker(dir, "a");
    addWorker(dir, "b");
    say(dir, "a", "coordinator", "start");
    say(dir, "b", "coordinator", "start");
    const handoff = sayJson(dir, "a", "b,coordinator", "handoff", "接手 src/b.md");
    const later = memberOf(statusOf(dir, "--now", minutesFromNow(15)), "b");
    assert.ok(later.flags.includes("needs-resume"), later.flags.join(","));
    const refused = say(dir, "b", "coordinator", "done");
    assert.equal(refused.code, 2);
    assert.match(refused.stderr, new RegExp(`#${handoff.seq}`));
    say(dir, "b", "coordinator", "start", `开始处理 #${handoff.seq}`);
    assert.equal(say(dir, "b", "coordinator", "done").code, 0);
  });

  test("handoff 唤醒待命成员的 wait，watch --for 成员也输出", async () => {
    const { dir } = workspace.freshRun("handoff-wake");
    addWorker(dir, "a");
    addWorker(dir, "b");
    const start = sayJson(dir, "b", "coordinator", "start");
    say(dir, "b", "coordinator", "done");
    say(dir, "b", "coordinator", "standby", "待命", "--minutes", "10");
    say(dir, "a", "coordinator", "start");
    const watching = execFileAsync(process.execPath, [TOOL, "watch", "--dir", dir,
      "--for", "b", "--timeout-seconds", "3", "--interval-seconds", "1"]);
    const handoff = sayJson(dir, "a", "b", "handoff", "接手");
    const woke = boardJson("wait", "--dir", dir, "--for", "b", "--since", String(start.seq),
      "--tags", `${WAKE_TAGS},handoff`, "--timeout-seconds", "1", "--interval-seconds", "1");
    assert.deepEqual(woke.records.map((record) => record.seq), [handoff.seq]);
    const { stdout } = await watching;
    assert.match(stdout, new RegExp(`^#${handoff.seq} .*\\[handoff\\] 接手$`, "m"));
  });
});

describe("组的加入、退出与归档", () => {
  function groupOf(dir, name) {
    return statusOf(dir).groups.find((group) => group.name === name);
  }

  test("join 新建组并加入已有组，leave 退出；每次给受影响的成员发 note", () => {
    const { dir } = workspace.freshRun("group-join");
    for (const name of ["a", "b", "c"]) addWorker(dir, name);
    const joined = boardJson("group", "--dir", dir, "--name", "g", "--join", "a,b");
    assert.deepEqual(joined.members, ["a", "b"]);
    assert.deepEqual([joined.record.from, joined.record.tag, joined.record.text],
      ["coordinator", "note", "加入组 #g"]);
    assert.deepEqual(joined.record.to, ["a", "b"]);
    assert.deepEqual(joined.record.control, { op: "join", group: "g" });
    assert.deepEqual(groupOf(dir, "g"), { name: "g", members: ["a", "b"], archived: false });
    assert.equal(groupOp(dir, "g", "--join", "c").code, 0);
    assert.deepEqual(sayJson(dir, "coordinator", "g", "note").to, ["a", "b", "c"]);
    const left = boardJson("group", "--dir", dir, "--name", "g", "--leave", "b");
    assert.deepEqual([left.members, left.record.text], [["b"], "退出组 #g"]);
    assert.deepEqual(left.record.control, { op: "leave", group: "g" });
    assert.deepEqual(groupOf(dir, "g").members, ["a", "c"]);
    assert.deepEqual(memberOf(statusOf(dir), "b").groups, []);
    assert.equal(groupOp(dir, "g", "--leave", "b").code, 1, "已在组外");
    assert.equal(groupOp(dir, "g", "--join", "a").code, 1, "重复加入");
  });

  test("组的 note 带 control，是名单变更通知，不核销成员的待答复", () => {
    const { dir } = workspace.freshRun("group-control");
    addWorker(dir, "a");
    addWorker(dir, "b");
    say(dir, "b", "coordinator", "start");
    const done = sayJson(dir, "b", "coordinator", "done", "完成");
    assert.deepEqual(statusOf(dir).coordinator.unanswered, [done.seq]);
    for (const args of [["--join", "a,b"], ["--leave", "a"], ["--archive"]]) {
      assert.equal(groupOp(dir, "z", ...args).code, 0, args.join(" "));
      assert.deepEqual(statusOf(dir).coordinator.unanswered, [done.seq], args.join(" "));
    }
    const accept = sayJson(dir, "coordinator", "b", "accept", "验收");
    assert.equal("control" in accept, false, "post 不写 control");
    assert.deepEqual(statusOf(dir).coordinator.unanswered, []);
  });

  test("名字冲突、未知成员或组退出 2；操作须恰好一个", () => {
    const { dir } = workspace.freshRun("group-usage");
    addWorker(dir, "a");
    addWorker(dir, "b");
    addWorker(dir, "gone");
    board("remove", "--dir", dir, "--name", "gone");
    assert.equal(groupOp(dir, "a", "--join", "b").code, 2, "组名与成员名相同");
    assert.equal(groupOp(dir, "gone", "--join", "b").code, 2, "组名与已移除成员同名");
    assert.equal(groupOp(dir, "g", "--join", "ghost").code, 2);
    assert.equal(groupOp(dir, "g", "--join", "gone").code, 2, "已移除的成员不在册");
    assert.equal(groupOp(dir, "Bad_Name", "--join", "a").code, 2);
    assert.equal(groupOp(dir, "nog", "--leave", "a").code, 2);
    assert.equal(groupOp(dir, "nog", "--archive").code, 2);
    assert.equal(groupOp(dir, "g").code, 2);
    assert.equal(groupOp(dir, "g", "--join", "a", "--archive").code, 2);
    assert.equal(groupOp(dir, "g", "--join", "a", "--leave", "b").code, 2);
    assert.equal(statusOf(dir).groups.length, 0, "失败的操作不写名单");
  });

  test("归档后 post 与 add --group 被拒，read --group 与 remove 照常，status 标出已归档",
    () => {
      const { dir } = workspace.freshRun("group-archive");
      addWorker(dir, "a", "--group", "g");
      addWorker(dir, "b", "--group", "g");
      addWorker(dir, "c");
      const roster = () => JSON.parse(readFileSync(join(dir, "members.json"), "utf8"));
      assert.equal("archived_groups" in roster(), false, "0.3.0 名单没有该字段，照常读写");
      const archived = boardJson("group", "--dir", dir, "--name", "g", "--archive");
      assert.deepEqual(archived.record.to, ["a", "b"]);
      assert.deepEqual(archived.record.addressed, ["#g"]);
      assert.equal(archived.record.text, "组 #g 已归档，不再接收消息");
      assert.deepEqual(archived.record.control, { op: "archive", group: "g" });
      assert.deepEqual(roster().archived_groups, ["g"]);
      assert.deepEqual(groupOf(dir, "g"), { name: "g", members: ["a", "b"], archived: true });
      assert.match(board("status", "--dir", dir).stdout, /^组 g（已归档）: a, b$/m);
      assert.deepEqual(memberOf(statusOf(dir), "a").groups, ["g"]);
      const post = say(dir, "coordinator", "g", "note");
      assert.equal(post.code, 2);
      assert.match(post.stderr, /已归档/);
      const add = board("add", "--dir", dir, "--name", "d", "--role", "worker",
        "--group", "g", "--text", "x");
      assert.equal(add.code, 2);
      assert.match(add.stderr, /已归档/);
      assert.equal(groupOp(dir, "g", "--archive").code, 1, "已归档");
      assert.equal(groupOp(dir, "g", "--join", "c").code, 1, "不能加入已归档的组");
      const read = boardJson("read", "--dir", dir, "--group", "g");
      assert.deepEqual(read.records.map((record) => record.seq), [archived.record.seq]);
      assert.equal(say(dir, "coordinator", "a", "note", "单独点名照常").code, 0);
      const removed = boardJson("remove", "--dir", dir, "--name", "g");
      assert.deepEqual(removed.members.map((member) => member.name), ["a", "b"]);
    });
});

describe("负责范围的调整（assign）", () => {
  function pathsOf(dir, name) {
    const roster = JSON.parse(readFileSync(join(dir, "members.json"), "utf8"));
    const member = roster.members.find((entry) => entry.name === name);
    return { owns: member.owns, outputs: member.outputs };
  }

  test("路径交给另一名成员：原所有者名下移走，note 带 control 发给新旧所有者", () => {
    const { dir } = workspace.freshRun("assign-move");
    addWorker(dir, "a", "--owns", "src/x.ts", "--owns", "src/y.ts", "--output", "out/a.md");
    addWorker(dir, "b", "--owns", "src/z.ts");
    say(dir, "a", "coordinator", "start");
    const done = sayJson(dir, "a", "coordinator", "done", "完成");
    const moved = boardJson("assign", "--dir", dir, "--name", "b", "--owns", "./src/x.ts",
      "--output", "out/a.md", "--output", "out/b.md");
    assert.deepEqual([moved.record.from, moved.record.tag, moved.record.to],
      ["coordinator", "note", ["b", "a"]]);
    assert.deepEqual(moved.record.control,
      { op: "assign", member: "b", owns: ["./src/x.ts"], outputs: ["out/a.md", "out/b.md"] });
    assert.equal(moved.record.text, "负责范围调整：负责 ./src/x.ts 由 a 交给 b；" +
      "产出 out/a.md 由 a 交给 b；产出 out/b.md 交给 b");
    assert.deepEqual(pathsOf(dir, "a"), { owns: ["src/y.ts"], outputs: [] });
    assert.deepEqual(pathsOf(dir, "b"),
      { owns: ["src/z.ts", "./src/x.ts"], outputs: ["out/a.md", "out/b.md"] });
    const status = statusOf(dir);
    assert.deepEqual(status.coordinator.unanswered, [done.seq], "名单变更通知不核销待答复");
    assert.deepEqual(memberOf(status, "b").pending, [], "note 不计入待处理，不唤醒待命成员");
  });

  test("没有路径、成员不在册、越出项目根退出 2；已登记或让 monitor 失去 owns 退出 1", () => {
    const { dir } = workspace.freshRun("assign-usage");
    addWorker(dir, "a", "--owns", "src/x.ts");
    addMember(dir, "monitor", "monitor", "--owns", "mon");
    addWorker(dir, "gone");
    board("remove", "--dir", dir, "--name", "gone");
    const assign = (...args) => board("assign", "--dir", dir, ...args);
    assert.equal(assign("--name", "a").code, 2, "没有路径");
    assert.equal(assign("--name", "ghost", "--owns", "p").code, 2);
    assert.equal(assign("--name", "gone", "--owns", "p").code, 2, "已移除的成员不在册");
    assert.equal(assign("--name", "a", "--owns", "../p").code, 2);
    assert.equal(assign("--name", "a", "--owns", "./src/x.ts").code, 1, "已登记");
    assert.equal(assign("--name", "a", "--owns", "mon").code, 1, "monitor 须保留 owns");
    assert.deepEqual(pathsOf(dir, "a").owns, ["src/x.ts"], "失败的操作不写名单");
    assert.deepEqual(pathsOf(dir, "monitor").owns, ["mon"]);
    const notes = boardJson("read", "--dir", dir).records.filter((record) => record.control);
    assert.deepEqual(notes, [], "失败的操作不发 note");
  });
});
