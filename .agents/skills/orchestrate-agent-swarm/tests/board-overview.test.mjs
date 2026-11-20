// 总览与计划文件的回归测试：plan.json 校验、按组或 thread 分节、成员表、里程碑、截图、
// overview 子命令的输出与原子写入。node --test <skill-root>/tests/
import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { renderOverview, readPlan } from "../scripts/lib/board-overview.mjs";
import { formatLocalTime, readRoster } from "../scripts/lib/board-store.mjs";
import {
  addMember, addWorker, board, boardJson, createWorkspace, groupOp, say, sayJson,
} from "./helpers.mjs";

let workspace;
before(() => {
  workspace = createWorkspace("swarm-overview-test-");
});
after(() => {
  workspace.remove();
});

function writePlan(dir, plan) {
  writeFileSync(join(dir, "plan.json"), JSON.stringify(plan));
}

function overviewOf(dir, ...extra) {
  return boardJson("overview", "--dir", dir, ...extra).markdown;
}

function headings(markdown) {
  return markdown.split("\n").filter((line) => /^#{1,2} /.test(line));
}

// 某一节标题之后、下一个 ## 标题之前的非空行。
function sectionLines(markdown, heading) {
  const lines = markdown.split("\n");
  const start = lines.indexOf(heading);
  assert.ok(start >= 0, `缺少标题 ${heading}:\n${markdown}`);
  const rest = lines.slice(start + 1);
  const end = rest.findIndex((line) => line.startsWith("## "));
  return (end < 0 ? rest : rest.slice(0, end)).filter((line) => line !== "");
}

const TABLE_HEADER = [
  "| 成员 | 角色 | 状态 | 最近消息 | 待处理 | 产出 |",
  "| --- | --- | --- | --- | --- | --- |",
];

// 运行目录：a、b 在组 g，c 不在组，gone 已移除。
function planRun(name) {
  const { dir } = workspace.freshRun(name);
  addWorker(dir, "a", "--group", "g");
  addWorker(dir, "b", "--group", "g");
  addWorker(dir, "c");
  addWorker(dir, "gone");
  board("remove", "--dir", dir, "--name", "gone");
  return dir;
}

function validPlan() {
  return {
    schema: "agent-swarm-plan-v1",
    goal: { title: "补齐四项差距", line: "代码与文档并行，之后核对" },
    threads: [
      { id: "t-code", title: "代码", goal: "实现 CLI 变更", members: ["g"] },
      { id: "t-docs", title: "文档", members: ["c", "gone"] },
    ],
  };
}

describe("计划文件 plan.json", () => {
  test("不存在时返回 null；合法计划原样返回（含已移除成员与组名）", () => {
    const dir = planRun("plan-valid");
    const roster = readRoster(dir);
    assert.equal(readPlan(dir, roster), null);
    const plan = validPlan();
    plan.goal.title = "标".repeat(60);
    writePlan(dir, plan);
    assert.deepEqual(readPlan(dir, roster), plan);
  });

  test("各项校验失败时抛出 fail 类错误，信息写出字段路径", () => {
    const dir = planRun("plan-invalid");
    const roster = readRoster(dir);
    const cases = [
      [(plan) => { plan.schema = "agent-swarm-plan-v0"; }, "schema"],
      [(plan) => { delete plan.goal; }, "goal"],
      [(plan) => { plan.goal.title = ""; }, "goal.title"],
      [(plan) => { plan.goal.title = "长".repeat(61); }, "goal.title"],
      [(plan) => { plan.goal.line = "长".repeat(81); }, "goal.line"],
      [(plan) => { plan.threads = []; }, "threads"],
      [(plan) => { plan.threads = Array.from({ length: 7 }, (_, index) => ({
        id: `t-${index}`, title: "x", members: ["c"],
      })); }, "threads"],
      [(plan) => { plan.threads[1].id = "docs"; }, "threads[1].id"],
      [(plan) => { plan.threads[1].id = `t-${"a".repeat(31)}`; }, "threads[1].id"],
      [(plan) => { plan.threads[1].id = "t-code"; }, "threads[1].id"],
      [(plan) => { plan.threads[0].title = "长".repeat(31); }, "threads[0].title"],
      [(plan) => { plan.threads[0].goal = "长".repeat(61); }, "threads[0].goal"],
      [(plan) => { plan.threads[0].members = []; }, "threads[0].members"],
      [(plan) => { plan.threads[0].members = ["ghost"]; }, "threads[0].members[0]"],
      [(plan) => { plan.threads[1].members = ["c", "a"]; }, "threads[1].members[1]"],
    ];
    for (const [mutate, path] of cases) {
      const plan = validPlan();
      mutate(plan);
      writePlan(dir, plan);
      assert.throws(() => readPlan(dir, roster), (error) => {
        assert.equal(error.kind, "fail", path);
        assert.ok(error.message.includes(`plan.json 的 ${path} `), `${path}: ${error.message}`);
        return true;
      });
    }
    writeFileSync(join(dir, "plan.json"), "{");
    assert.throws(() => readPlan(dir, roster), /plan\.json 不是合法 JSON/);
  });

  test("overview 遇到不合法的计划退出 1", () => {
    const dir = planRun("plan-cli");
    const plan = validPlan();
    plan.threads[1].id = "t-code";
    writePlan(dir, plan);
    const outcome = board("overview", "--dir", dir);
    assert.equal(outcome.code, 1);
    assert.match(outcome.stderr, /threads\[1\]\.id/);
  });
});

describe("分节", () => {
  test("没有计划时每个组一节，已归档的组加标注，其余成员归入其他成员", () => {
    const { dir } = workspace.freshRun("sections-groups");
    addMember(dir, "shard", "worker", "--count", "2");
    addMember(dir, "v", "verifier");
    addMember(dir, "m", "monitor", "--owns", "out");
    assert.equal(groupOp(dir, "review", "--join", "v").code, 0);
    assert.equal(groupOp(dir, "shard", "--archive").code, 0);
    const markdown = overviewOf(dir);
    assert.deepEqual(headings(markdown), [
      "# sections-groups", "## 待处理", "## 组 shard（已归档）", "## 组 review", "## 其他成员",
      "## 里程碑",
    ]);
    assert.match(markdown,
      /^状态：running（head #\d+，距最后一条消息 0m，生成于 [^）]+）$/m);
    assert.deepEqual(sectionLines(markdown, "## 待处理"), ["无"]);
    assert.deepEqual(sectionLines(markdown, "## 组 shard（已归档）").slice(2)
      .map((row) => row.split(" | ")[0]), ["| shard-1", "| shard-2"]);
    assert.deepEqual(sectionLines(markdown, "## 其他成员"),
      [...TABLE_HEADER, "| m | monitor | briefed | - | - | - |"]);
    assert.deepEqual(sectionLines(markdown, "## 里程碑"), ["无"]);
  });

  test("有计划时按 thread 分节：目标说明、标题与 goal、组展开，未列入的成员归入其他成员",
    () => {
      const dir = planRun("sections-threads");
      addMember(dir, "m", "monitor", "--owns", "out");
      writePlan(dir, validPlan());
      const markdown = overviewOf(dir);
      assert.deepEqual(headings(markdown), [
        "# 补齐四项差距", "## 待处理", "## 代码 — 实现 CLI 变更", "## 文档", "## 其他成员",
        "## 里程碑",
      ]);
      assert.equal(markdown.split("\n\n")[1], "代码与文档并行，之后核对");
      const names = (heading) => sectionLines(markdown, heading).slice(2)
        .map((row) => row.split(" | ")[0].slice(2));
      assert.deepEqual(names("## 代码 — 实现 CLI 变更"), ["a", "b"]);
      assert.deepEqual(names("## 文档"), ["c", "gone"]);
      assert.deepEqual(names("## 其他成员"), ["m"]);
      assert.match(sectionLines(markdown, "## 文档")[3], /^\| gone \| worker \| removed \|/);
    });
});

describe("成员表", () => {
  test("状态带待命时间，最近消息截断并转义，待处理与产出计数", () => {
    const { project, dir } = workspace.freshRun("table");
    addMember(dir, "a", "worker", "--output", "out/a.md", "--output", "out/b.md");
    addWorker(dir, "b");
    writeFileSync(join(project, "out", "a.md"), "内容");
    say(dir, "a", "coordinator", "start");
    say(dir, "a", "coordinator", "done", "完成");
    say(dir, "coordinator", "a", "accept", "验收");
    const text = `第一行 | 竖线\n第二行${"字".repeat(60)}`;
    const standby = sayJson(dir, "a", "coordinator", "standby", text, "--minutes", "30");
    const fix = sayJson(dir, "coordinator", "a", "fix", "改第 3 行");
    const rows = sectionLines(overviewOf(dir), "## 其他成员");
    const latest = `#${standby.seq} standby：第一行 \\| 竖线 第二行${"字".repeat(48)}…`;
    assert.deepEqual(rows, [
      ...TABLE_HEADER,
      `| a | worker | done，待命至 ${standby.until.slice(11, 16)} | ${latest} | #${fix.seq} | 1/2 |`,
      "| b | worker | briefed | - | - | - |",
    ]);
  });
});

function fakeStatus(overrides = {}) {
  return {
    title: "演示", state: "running", head_seq: 0, quiet_minutes: 0, attention: [],
    groups: [], members: [], ...overrides,
  };
}

function fakeMember(name, overrides = {}) {
  return {
    name, role: "worker", groups: [], state: "active", reachable: false, standby_until: null,
    stopped_seq: null,
    last_post_seq: null, last_post_tag: null, pending: [], outputs: [], missing_outputs: [],
    flags: [], ...overrides,
  };
}

function record(seq, from, to, tag, text, extra = {}) {
  return { seq, time: "2026-11-19T08:00:00-05:00", from, to, tag, text, ...extra };
}

const NOW = new Date("2026-11-19T09:00:00-05:00");

describe("renderOverview", () => {
  test("待处理逐项列出 id、序号、开始时间与处理建议；生成时间取 now", () => {
    const attention = [
      { id: "w:blocked", refs: [3], since: "S1", detail: null, action: "读受阻原因" },
      { id: "coordinator:unanswered", refs: [3, 5], since: "S2", detail: null, action: "答复" },
    ];
    const markdown = renderOverview({
      status: fakeStatus({ state: "attention", head_seq: 5, quiet_minutes: 7, attention }),
      records: [], plan: null, now: NOW,
    });
    assert.deepEqual(sectionLines(markdown, "## 待处理"),
      ["- w:blocked #3 自 S1：读受阻原因", "- coordinator:unanswered #3 #5 自 S2：答复"]);
    assert.ok(markdown.includes(
      `状态：attention（head #5，距最后一条消息 7m，生成于 ${formatLocalTime(NOW)}）`));
    assert.ok(markdown.endsWith("\n") && !markdown.endsWith("\n\n"));
  });

  test("单元格转义竖线、换行换成空格，超过 60 字截断", () => {
    const records = [
      record(2, "w", ["coordinator"], "progress", "a|b\nc"),
      record(3, "x", ["coordinator"], "progress", "长".repeat(61)),
    ];
    const members = [
      fakeMember("w", { last_post_seq: 2, pending: [4, 6], outputs: ["o1", "o2"],
        missing_outputs: ["o2"] }),
      fakeMember("x", { state: "done", reachable: true, last_post_seq: 3,
        standby_until: "2026-11-19T08:12:00-05:00" }),
    ];
    const markdown = renderOverview({ status: fakeStatus({ members }), records, plan: null,
      now: NOW });
    assert.deepEqual(sectionLines(markdown, "## 其他成员").slice(2), [
      "| w | worker | active | #2 progress：a\\|b c | #4 #6 | 1/2 |",
      `| x | worker | done，待命至 08:12 | #3 progress：${"长".repeat(60)}… | - | - |`,
    ]);
  });

  test("里程碑只列 done 与 accept，按序号升序最多最近 20 条，正文截到 80 字", () => {
    const records = [];
    for (let seq = 1; seq <= 33; seq += 1) {
      if (seq % 3 === 0) records.push(record(seq, "w", ["coordinator"], "note", "告知"));
      else if (seq % 3 === 1) records.push(record(seq, "w", ["coordinator"], "done", `完成 ${seq}`));
      else records.push(record(seq, "coordinator", ["w"], "accept", `验收 ${seq}`));
    }
    records.push(record(34, "coordinator", ["s-1", "s-2"], "accept", "长".repeat(90),
      { addressed: ["#s"] }));
    records.push(record(35, "coordinator", ["w"], "accept", "名单变更通知不是里程碑",
      { control: { op: "join", group: "g" } }));
    const lines = sectionLines(
      renderOverview({ status: fakeStatus(), records, plan: null, now: NOW }), "## 里程碑");
    assert.equal(lines.length, 20);
    assert.equal(lines[0], "- #5 coordinator [accept] → @w：验收 5");
    assert.equal(lines[1], "- #7 w [done] → @coordinator：完成 7");
    assert.equal(lines[19], `- #34 coordinator [accept] → @#s：${"长".repeat(80)}…`);
    const seqs = lines.map((line) => Number(line.split(" ")[1].slice(1)));
    assert.deepEqual(seqs, [...seqs].sort((left, right) => left - right));
  });

  test("截图从以 Screenshot: 开头的行提取，按序号升序；没有截图时省略整节", () => {
    const records = [
      record(1, "w", ["coordinator"], "done",
        "完成\nScreenshot: shots/a.png | 首页\n  Screenshot: shots/b.png | 详情 | 第二屏"),
      record(2, "v", ["coordinator"], "progress", "核对\nScreenshot: shots/c.png"),
      record(3, "v", ["coordinator"], "note", "行中的 Screenshot: inline.png | 不提取"),
    ];
    const markdown = renderOverview({ status: fakeStatus(), records, plan: null, now: NOW });
    assert.equal(headings(markdown).at(-1), "## 截图");
    assert.deepEqual(sectionLines(markdown, "## 截图"), [
      "- ![首页](shots/a.png) #1 w",
      "- ![详情 | 第二屏](shots/b.png) #1 w",
      "- ![](shots/c.png) #2 v",
    ]);
    const plain = renderOverview({ status: fakeStatus(), records: records.slice(2), plan: null,
      now: NOW });
    assert.ok(!plain.includes("## 截图"));
  });
});

describe("overview 子命令", () => {
  test("--out 先写临时文件再改名，打印路径；父目录缺失退出 1", () => {
    const { project, dir } = workspace.freshRun("out");
    addWorker(dir, "a");
    const now = "2026-11-19T10:00:00-05:00";
    mkdirSync(join(project, "monitor"));
    const target = join(project, "monitor", "overview.md");
    const outcome = board("overview", "--dir", dir, "--out", target, "--now", now);
    assert.equal(outcome.code, 0, outcome.stderr);
    assert.equal(outcome.stdout, `已写入 ${target}\n`);
    assert.deepEqual(readdirSync(join(project, "monitor")), ["overview.md"]);
    const printed = board("overview", "--dir", dir, "--now", now);
    assert.equal(readFileSync(target, "utf8"), printed.stdout);
    const missing = join(project, "absent", "overview.md");
    const refused = board("overview", "--dir", dir, "--out", missing);
    assert.equal(refused.code, 1);
    assert.match(refused.stderr, /父目录不存在/);
    assert.equal(existsSync(join(project, "absent")), false);
  });

  test("--json 输出 path 与 markdown；--now 写入生成时间，其余命令仍拒绝 --now", () => {
    const { project, dir } = workspace.freshRun("json");
    addWorker(dir, "a");
    const now = "2026-11-19T10:00:00-05:00";
    const printed = boardJson("overview", "--dir", dir, "--now", now);
    assert.deepEqual(Object.keys(printed), ["path", "markdown"]);
    assert.equal(printed.path, null);
    assert.ok(printed.markdown.includes(`生成于 ${formatLocalTime(new Date(now))}）`));
    const target = join(project, "out", "overview.md");
    const written = boardJson("overview", "--dir", dir, "--out", target, "--now", now);
    assert.deepEqual(written, { path: target, markdown: printed.markdown });
    assert.equal(board("overview", "--dir", dir, "--now", "2026-11-19").code, 2);
    assert.equal(board("read", "--dir", dir, "--now", now).code, 2);
    assert.equal(board("group", "--dir", dir, "--name", "g", "--join", "a",
      "--now", now).code, 2);
  });
});
