#!/usr/bin/env node
// 维护 swarm 的消息板与成员名单，给出成员状态、待处理事项与 Markdown 总览
//
// Skill: orchestrate-agent-swarm。遵守工具箱标准：--help 必备、默认文本输出、--json 给机器、
// 退出码只用 0（成功）/ 1（失败）/ 2（用法错误）/ 3（未就绪）。

import { realpathSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import {
  BoardError, COORDINATOR, COORDINATOR_ACTION_TAGS, MEMBER_ACTION_TAGS, TAGS, addMembers,
  archiveGroup, assignPaths, initRun, isAddressedTo, joinGroup, leaveGroup, postMessage,
  projectRoot, readRecords, readRoster, removeMembers, requireRun,
} from "./lib/board-store.mjs";
import { DEFAULT_STALE_MINUTES, deriveStatus } from "./lib/board-status.mjs";
import { readPlan, renderOverview, writeOverview } from "./lib/board-overview.mjs";

export const EXIT = Object.freeze({ OK: 0, FAIL: 1, USAGE: 2, NOT_READY: 3 });

const HELP = `swarm-board: 维护 swarm 的消息板与成员名单，给出成员状态、待处理事项与 Markdown 总览

用法:
  node scripts/swarm-board.mjs init     --dir <run-dir> --root <project-root> --title <text>
  node scripts/swarm-board.mjs add      --dir <run-dir> --name <name> --role <role>
                                        --text <brief> [--owns <path>]... [--output <path>]...
                                        [--group <group>]... [--count <n>]
  node scripts/swarm-board.mjs post     --dir <run-dir> --from <name> --to <name|group[,..]>
                                        --tag <tag> --text <text> [--minutes <n>]
  node scripts/swarm-board.mjs read     --dir <run-dir> [--since <seq>] [--for <name>]
                                        [--group <group>] [--tags <tag,..>] [--format text|md]
  node scripts/swarm-board.mjs status   --dir <run-dir> [--stale-minutes <n>] [--now <time>]
  node scripts/swarm-board.mjs overview --dir <run-dir> [--out <path>] [--stale-minutes <n>]
                                        [--now <time>]
  node scripts/swarm-board.mjs wait     --dir <run-dir> --since <seq> [--for <name>]
                                        [--tags <tag,..>] [--until <time>]
                                        [--timeout-seconds <n>] [--interval-seconds <n>]
  node scripts/swarm-board.mjs watch    --dir <run-dir> --for <name> [--since <seq>]
                                        [--timeout-seconds <n>] [--interval-seconds <n>]
  node scripts/swarm-board.mjs group    --dir <run-dir> --name <group>
                                        (--join <name,..> | --leave <name,..> | --archive)
  node scripts/swarm-board.mjs assign   --dir <run-dir> --name <name>
                                        [--owns <path>]... [--output <path>]...
  node scripts/swarm-board.mjs remove   --dir <run-dir> --name <name|group>

子命令:
  init     建立运行目录（board.jsonl 与 members.json）；中途中断时可以重跑
  add      登记成员并为每个成员公开派发一条 @name [brief]；--count 批量登记
           <name>-1..<name>-n 并归入组 <name>，owns、output、text 中的 {i} 换成序号
  post     追加一条消息，返回序号；--to 写组名时发给组内全部在册成员。发送者只能发
           本角色的标签，成员的 done、progress 只在 start 之后、standby 只在 done 之后；
           成员还有未处理的 brief、fix、resume、handoff 时不接受它的 done。
           worker 与 verifier 在 active 或 done 时可以发 handoff，把工作直接交给点名的
           成员或组：不接受 all，coordinator 只能抄送
  read     读取序号大于 --since 的消息；--for 只看发给该成员（含其所在组）或 all、
           且不是它自己发的消息；--group 只看发给该组的消息；--tags 只看这些标签
  status   推导每个成员的状态（briefed/active/done/blocked/removed）、待命与异常标记，
           并列出待处理事项（attention）：每个标记一项，含相关序号、开始时间与处理建议
  overview 生成 Markdown 总览：目标、状态、待处理事项、各 thread（或组）的成员表、
           里程碑与截图；目标与分工取运行目录中可选的 plan.json（agent-swarm-plan-v1）。
           --out 先写 <path>.tmp 再改名为 <path>
  wait     有界等待新消息，出现即返回；超时或到 --until 也以 0 退出并注明 timed_out
  watch    逐行输出发给 --for、需要它处理的新消息，到时退出；供宿主的事件监视逐行通知。
           默认从 --for 最后一次发言之后开始，挂上之前未处理的消息也会输出
  group    组的加入（--join，组不存在时新建）、退出（--leave）与归档（--archive），三者
           恰好一个；每次操作向受影响的成员发一条 coordinator 的 note，带
           control: {op, group}，是名单变更通知：不核销待答复，不计入总览的里程碑。
           归档后 post --to 与 add --group 不再接受该组，read --group 与 remove 照常
  assign   把 owns 与 output 交给在册成员 --name；原来登记在其他在册成员名下的同一路径
           随之移走。向新旧所有者发一条带 control 的 note（名单变更通知，不唤醒待命成员，
           要它接手时另发 brief 或 fix）
  remove   把成员或整个组移出名单；名字不再复用

选项:
  --dir <path>              运行目录（必填）
  --root <path>             项目根；owns 与 output 路径相对它（init 必填）
  --name <name>             add、assign：成员名；remove：成员名或组名；group：组名
  --role <role>             worker | verifier | monitor（monitor 须带 --owns）
  --owns <path>             成员负责的文件或目录，可重复；用于活动判定（add、assign）
  --output <path>           成员应交付的文件，可重复；done 后缺失或为空即标记（add、assign）
  --group <group>           add：成员加入的组（工作区），可重复；read：只看发给该组的消息
  --count <n>               add 批量登记的个数，1..20
  --to <names>              收件人，逗号分隔；可写成员名、组名、all、coordinator
  --tag <tag>               brief start progress done blocked standby fix accept stall
                            stop resume note handoff
  --tags <tags>             read、wait 只看这些标签，逗号分隔
  --minutes <n>             standby 的待命分钟数，1..120（只用于 standby）
  --until <time>            wait 的截止时间（带时区偏移的 ISO 时间），早于超时时提前返回
  --for <name>              coordinator 或在册成员名；wait、watch 不接受已移除的成员
  --out <path>              overview 写入的文件；父目录须已存在
  --join <names>            group：加入该组的在册成员，逗号分隔
  --leave <names>           group：退出该组的在册成员，逗号分隔
  --archive                 group：归档该组
  --stale-minutes <n>       停滞阈值，默认 ${DEFAULT_STALE_MINUTES}
  --timeout-seconds <n>     wait 默认 180、最大 590；watch 默认 1790、最大 1800
  --interval-seconds <n>    轮询间隔，默认 5
  --now <time>              status 与 overview 的当前时间（带时区偏移的 ISO 时间，测试用）
  --json                    以 JSON 输出结果；overview 输出 {"path", "markdown"}，path 在
                            没有 --out 时为 null。watch 不支持，它逐行输出文本
  --verbose                 向 stderr 打印进度
  -h, --help                显示本帮助

退出码: 0 成功；1 失败；2 用法错误；3 运行目录未初始化。

示例:
  node scripts/swarm-board.mjs init --dir .agents/swarm/demo --root . --title "解析器重写"
  node scripts/swarm-board.mjs add --dir .agents/swarm/demo --name parser --role worker \\
      --owns src/parser --output src/parser/README.md --text "见 briefs.md 的 parser 一节"
  node scripts/swarm-board.mjs add --dir .agents/swarm/demo --name reviewer --role verifier \\
      --count 3 --output review/{i}.md --text "见 briefs.md 的 reviewer 一节，分片 {i}"
  node scripts/swarm-board.mjs post --dir .agents/swarm/demo --from parser \\
      --to coordinator --tag done --text "parser 完成，测试通过"
  node scripts/swarm-board.mjs post --dir .agents/swarm/demo --from parser \\
      --to coordinator --tag standby --minutes 30 --text "待命，可点名追加任务"
  node scripts/swarm-board.mjs post --dir .agents/swarm/demo --from parser \\
      --to lexer,coordinator --tag handoff --text "按 #12 的接口补 token 表，见 src/parser/api.md"
  node scripts/swarm-board.mjs wait --dir .agents/swarm/demo --for parser --since 5 \\
      --tags brief,fix,resume,handoff,stop --until 2026-11-19T10:30:00-05:00 \\
      --timeout-seconds 590
  node scripts/swarm-board.mjs watch --dir .agents/swarm/demo --for coordinator
  node scripts/swarm-board.mjs status --dir .agents/swarm/demo --json
  node scripts/swarm-board.mjs overview --dir .agents/swarm/demo \\
      --out .agents/swarm/demo/monitor/overview.md
  node scripts/swarm-board.mjs group --dir .agents/swarm/demo --name parser --join lexer,ast
  node scripts/swarm-board.mjs group --dir .agents/swarm/demo --name parser --archive
  node scripts/swarm-board.mjs assign --dir .agents/swarm/demo --name ast \\
      --owns src/parser/ast.ts --output src/parser/ast.md
`;

const OPTIONS = {
  dir: { type: "string" },
  root: { type: "string" },
  title: { type: "string" },
  name: { type: "string" },
  role: { type: "string" },
  owns: { type: "string", multiple: true, default: [] },
  output: { type: "string", multiple: true, default: [] },
  group: { type: "string", multiple: true, default: [] },
  count: { type: "string" },
  text: { type: "string" },
  from: { type: "string" },
  to: { type: "string" },
  tag: { type: "string" },
  tags: { type: "string" },
  minutes: { type: "string" },
  until: { type: "string" },
  out: { type: "string" },
  join: { type: "string" },
  leave: { type: "string" },
  archive: { type: "boolean", default: false },
  since: { type: "string" },
  for: { type: "string" },
  format: { type: "string", default: "text" },
  "stale-minutes": { type: "string", default: String(DEFAULT_STALE_MINUTES) },
  "timeout-seconds": { type: "string" },
  "interval-seconds": { type: "string", default: "5" },
  now: { type: "string" },
  json: { type: "boolean", default: false },
  verbose: { type: "boolean", default: false },
  help: { type: "boolean", short: "h", default: false },
};

// wait 要放进宿主单次 600 秒的命令时限；watch 要放进宿主事件监视最长 30 分钟的时限。
const WAIT_LIMITS = Object.freeze({ fallback: 180, max: 590 });
const WATCH_LIMITS = Object.freeze({ fallback: 1790, max: 1800 });
const COMMANDS = [
  "init", "add", "post", "read", "status", "overview", "wait", "watch", "group", "assign",
  "remove",
];
// --now 只用于只读的推导命令：写入命令总用真实时间，序号递增时时间不会倒退。
const NOW_COMMANDS = Object.freeze(["status", "overview"]);

function log(values, message) {
  if (values.verbose) console.error(message);
}

function required(values, ...names) {
  const missing = names.filter((name) => values[name] === undefined || values[name] === "");
  if (missing.length > 0) {
    throw new BoardError(`缺少选项: ${missing.map((name) => `--${name}`).join(" ")}`, "usage");
  }
}

function integerOption(values, name, { min, max, fallback }) {
  const raw = values[name] ?? (fallback === undefined ? undefined : String(fallback));
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || (max !== undefined && value > max)) {
    const range = max === undefined ? `>= ${min}` : `${min}..${max}`;
    throw new BoardError(`--${name} 须为整数 ${range}: ${raw}`, "usage");
  }
  return value;
}

function optionalInteger(values, name, limits) {
  return values[name] === undefined ? undefined : integerOption(values, name, limits);
}

// 时间选项须写明时区：不带偏移的日期会被 JavaScript 按 UTC 解析，与本地时间相差数小时。
const ZONED_TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/;

function timeOption(values, name) {
  const raw = values[name];
  const parsed = new Date(raw);
  if (!ZONED_TIME.test(raw) || Number.isNaN(parsed.getTime())) {
    throw new BoardError(`--${name} 须为带时区偏移的 ISO 时间，例如 ` +
      `2026-11-19T10:30:00-05:00: ${raw}`, "usage");
  }
  return parsed;
}

// --now 只用于 NOW_COMMANDS；其余命令在 main 中被拒绝。
function inspectionTime(values) {
  return values.now === undefined ? new Date() : timeOption(values, "now");
}

function tagsOption(values) {
  if (values.tags === undefined) return undefined;
  const tags = values.tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  const unknown = tags.filter((tag) => !TAGS.includes(tag));
  if (tags.length === 0 || unknown.length > 0) {
    throw new BoardError(`--tags 含未知标签: ${unknown.join(",") || values.tags}`, "usage");
  }
  return tags;
}

// --for 须是 coordinator 或名单里的成员：拼错的名字会让 wait 与 watch 永远静默。
// 返回成员条目，coordinator 返回 undefined。
function addressee(roster, name, { allowRemoved }) {
  if (name === COORDINATOR) return undefined;
  const member = roster.members.find((entry) => entry.name === name);
  if (!member || (member.removed && !allowRemoved)) {
    const reason = member ? "已移除" : "不在名单中";
    throw new BoardError(`--for ${name} ${reason}；可用 coordinator 或在册成员名`, "usage");
  }
  return member;
}

function oneLine(text) {
  return text.replace(/\s*\n\s*/g, " ");
}

export function formatRecord(record, format) {
  const recipients = (record.addressed ?? record.to).map((name) => `@${name}`).join(" ");
  const until = record.until ? ` 至 ${record.until}` : "";
  const body = `${record.from} ${recipients} [${record.tag}]${until} ${oneLine(record.text)}`;
  if (format === "md") return `- #${record.seq} ${record.time} ${body}`;
  return `#${record.seq} ${record.time} ${body}`;
}

// filter.forName 省略时不按收件人过滤；filter.member 是 --for 对应的名单条目。
function selectRecords(records, { since, forName, member, group, tags }) {
  return records.filter((record) => {
    if (record.seq <= since) return false;
    if (group !== undefined && !(record.addressed ?? []).includes(`#${group}`)) return false;
    if (tags !== undefined && !tags.includes(record.tag)) return false;
    return forName === undefined || isAddressedTo(record, forName, member);
  });
}

function runInit(values, dir) {
  required(values, "root", "title");
  const roster = initRun(dir, { root: values.root, title: values.title, now: new Date() });
  return { result: { dir, roster }, text: `已建立运行目录 ${dir}` };
}

function runAdd(values, dir) {
  required(values, "name", "role", "text");
  requireRun(dir);
  const added = addMembers(dir, {
    name: values.name, role: values.role, owns: values.owns, outputs: values.output,
    text: values.text, groups: values.group,
    count: optionalInteger(values, "count", { min: 1 }),
  }, new Date());
  const text = added.map(({ record }) => formatRecord(record, "text")).join("\n");
  return { result: { added }, text };
}

function runPost(values, dir) {
  required(values, "from", "to", "tag", "text");
  requireRun(dir);
  const to = values.to.split(",").map((name) => name.trim()).filter(Boolean);
  const record = postMessage(dir, {
    from: values.from, to, tag: values.tag, text: values.text,
    minutes: optionalInteger(values, "minutes", { min: 1 }),
  }, new Date());
  return { result: record, text: formatRecord(record, "text") };
}

// read、wait 共用的过滤条件；allowRemoved 只在 read 中为真，已移除成员的历史仍可读。
function recordFilter(values, dir, { allowRemoved }) {
  const roster = readRoster(dir);
  const member = values.for === undefined
    ? undefined
    : addressee(roster, values.for, { allowRemoved });
  return {
    since: integerOption(values, "since", { min: 0, fallback: 0 }),
    forName: values.for, member, tags: tagsOption(values),
  };
}

function runRead(values, dir) {
  requireRun(dir);
  if (!["text", "md"].includes(values.format)) {
    throw new BoardError(`--format 只能是 text 或 md: ${values.format}`, "usage");
  }
  if (values.group.length > 1) throw new BoardError("read 只接受一个 --group", "usage");
  const filter = { ...recordFilter(values, dir, { allowRemoved: true }), group: values.group[0] };
  const records = selectRecords(readRecords(dir), filter);
  const text = records.map((record) => formatRecord(record, values.format)).join("\n");
  return { result: { records }, text: text || `#${filter.since} 之后没有消息` };
}

function formatMember(member) {
  const pending = member.pending.map((seq) => `#${seq}`).join(" ") || "-";
  const groups = member.groups.length > 0 ? ` groups=${member.groups.join(",")}` : "";
  const standby = member.reachable ? ` standby→${member.standby_until}` : "";
  const stopped = member.stopped_seq === null ? "" : ` stopped=#${member.stopped_seq}`;
  const missing = member.flags.includes("incomplete-outputs")
    ? ` missing=${member.missing_outputs.join(",")}`
    : "";
  const scan = member.scan_truncated ? " scan=truncated" : "";
  return (
    `${member.name} ${member.role} ${member.state}${standby}${stopped}` +
    ` idle=${member.idle_minutes}m` +
    ` last=${member.last_post_seq === null ? "-" : `#${member.last_post_seq}`}` +
    ` pending=${pending} flags=${member.flags.join(",") || "-"}${groups}${missing}${scan}`
  );
}

// 一行一个待处理事项：多个序号以空格分隔，有 detail 时写在处理建议之前。
function formatAttention(item) {
  const refs = item.refs.map((seq) => `#${seq}`).join(" ");
  const detail = item.detail === null ? "" : `${item.detail}；`;
  return `- ${item.id} ${refs} 自 ${item.since}：${detail}${item.action}`;
}

function formatStatus(status) {
  const unanswered = status.coordinator.unanswered.map((seq) => `#${seq}`).join(" ") || "-";
  const lines = [
    `${status.title}: ${status.state}（head #${status.head_seq}，` +
      `距最后一条消息 ${status.quiet_minutes}m）`,
    `coordinator 最后发言 #${status.coordinator.last_post_seq} 未答复 ${unanswered}` +
      ` 标记 ${status.coordinator.flags.join(",") || "-"}`,
    ...status.members.map(formatMember),
  ];
  for (const group of status.groups) {
    const archived = group.archived ? "（已归档）" : "";
    lines.push(`组 ${group.name}${archived}: ${group.members.join(", ")}`);
  }
  if (status.attention.length > 0) {
    lines.push("待处理事项：", ...status.attention.map(formatAttention));
  }
  return lines.join("\n");
}

// status 与 overview 共用的推导；返回推导时间，overview 用它写“生成于”。
function inspectRun(values, dir) {
  requireRun(dir);
  const roster = readRoster(dir);
  const records = readRecords(dir);
  const now = inspectionTime(values);
  const status = deriveStatus({
    roster,
    records,
    rootDir: projectRoot(dir, roster),
    now,
    staleMinutes: integerOption(values, "stale-minutes", { min: 1 }),
  });
  return { roster, records, now, status };
}

function runStatus(values, dir) {
  const { status } = inspectRun(values, dir);
  return { result: status, text: formatStatus(status) };
}

// 没有 --out 时打印 Markdown；有 --out 时原子写入并打印路径。
function runOverview(values, dir) {
  const { roster, records, now, status } = inspectRun(values, dir);
  const plan = readPlan(dir, roster);
  const markdown = renderOverview({ status, records, plan, now });
  if (values.out === undefined) {
    return { result: { path: null, markdown }, text: markdown.trimEnd() };
  }
  const path = resolve(values.out);
  writeOverview(path, markdown);
  return { result: { path, markdown }, text: `已写入 ${path}` };
}

function nameList(raw) {
  return raw.split(",").map((name) => name.trim()).filter(Boolean);
}

function groupOperation(values) {
  const chosen = [
    values.join !== undefined && "join", values.leave !== undefined && "leave",
    values.archive && "archive",
  ].filter(Boolean);
  if (chosen.length !== 1) {
    throw new BoardError("group 需要 --join、--leave、--archive 恰好一个", "usage");
  }
  return chosen[0];
}

function runGroup(values, dir) {
  required(values, "name");
  requireRun(dir);
  const operation = groupOperation(values);
  const now = new Date();
  let outcome;
  if (operation === "archive") outcome = archiveGroup(dir, values.name, now);
  else if (operation === "join") outcome = joinGroup(dir, values.name, nameList(values.join), now);
  else outcome = leaveGroup(dir, values.name, nameList(values.leave), now);
  return { result: outcome, text: formatRecord(outcome.record, "text") };
}

function runAssign(values, dir) {
  required(values, "name");
  requireRun(dir);
  const paths = { owns: values.owns, outputs: values.output };
  const outcome = assignPaths(dir, values.name, paths, new Date());
  return { result: outcome, text: formatRecord(outcome.record, "text") };
}

function runRemove(values, dir) {
  required(values, "name");
  requireRun(dir);
  const removed = removeMembers(dir, values.name, new Date());
  return { result: removed, text: formatRecord(removed.record, "text") };
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

// 轮询次数由超时与间隔算出，循环有固定上限。boundSeconds 是更早的截止（wait 的
// --until 距现在的秒数），到它为止就不再等待；为 0 时只检查一次。
function pollPlan(values, limits, boundSeconds = Infinity) {
  const timeout = integerOption(values, "timeout-seconds", { min: 1, ...limits });
  const interval = integerOption(values, "interval-seconds", { min: 1, max: 60 });
  const seconds = Math.max(0, Math.min(timeout, boundSeconds));
  return { timeout, interval, rounds: Math.ceil(seconds / interval) };
}

function waitDeadline(values) {
  if (values.until === undefined) return { untilMs: Infinity, boundSeconds: Infinity };
  const untilMs = timeOption(values, "until").getTime();
  return { untilMs, boundSeconds: Math.ceil((untilMs - Date.now()) / 1000) };
}

function waitTimeoutText(since, timeout, deadlineReached, until) {
  return deadlineReached
    ? `已到截止时间 ${until}，#${since} 之后没有新消息`
    : `等待 ${timeout} 秒，#${since} 之后没有新消息`;
}

// 出现符合条件的新消息即返回；超时或到 --until 时 timed_out 为真，
// deadline_reached 表示已到 --until。
async function runWait(values, dir) {
  requireRun(dir);
  const filter = recordFilter(values, dir, { allowRemoved: false });
  const { untilMs, boundSeconds } = waitDeadline(values);
  const { timeout, interval, rounds } = pollPlan(values, WAIT_LIMITS, boundSeconds);
  for (let round = 0; round <= rounds; round += 1) {
    const records = selectRecords(readRecords(dir), filter);
    if (records.length > 0) {
      const text = records.map((record) => formatRecord(record, "text")).join("\n");
      return { result: { timed_out: false, deadline_reached: false, records }, text };
    }
    if (round < rounds) await delay(interval * 1000);
    log(values, `wait: 第 ${round + 1} 轮无新消息`);
  }
  const deadlineReached = Date.now() >= untilMs;
  return {
    result: { timed_out: true, deadline_reached: deadlineReached, records: [] },
    text: waitTimeoutText(filter.since, timeout, deadlineReached, values.until),
  };
}

function actionTagsFor(name) {
  return name === COORDINATOR ? COORDINATOR_ACTION_TAGS : MEMBER_ACTION_TAGS;
}

// 默认起点是 --for 最后一次发言的序号：之后发给它的行动消息还没有处理，挂上（含会话
// 重启后重新挂上）时一并输出。没有发过言时从头开始。
function watchStart(values, records) {
  if (values.since !== undefined) return integerOption(values, "since", { min: 0 });
  return records.filter((record) => record.from === values.for).at(-1)?.seq ?? 0;
}

// 逐行输出需要 --for 处理的新消息：每行就是宿主事件监视的一条通知。
// 到时输出重新挂上时要用的 --since。
async function runWatch(values, dir) {
  required(values, "for");
  requireRun(dir);
  if (values.json) throw new BoardError("watch 逐行输出文本，不支持 --json", "usage");
  const member = addressee(readRoster(dir), values.for, { allowRemoved: false });
  const tags = actionTagsFor(values.for);
  let since = watchStart(values, readRecords(dir));
  const { timeout, interval, rounds } = pollPlan(values, WATCH_LIMITS);
  for (let round = 0; round <= rounds; round += 1) {
    const records = readRecords(dir).filter((record) => record.seq > since);
    for (const record of records) {
      if (tags.includes(record.tag) && isAddressedTo(record, values.for, member)) {
        process.stdout.write(`${formatRecord(record, "text")}\n`);
      }
    }
    since = records.at(-1)?.seq ?? since;
    if (round < rounds) await delay(interval * 1000);
  }
  return {
    result: { since },
    text: `watch 到时（${timeout} 秒），已看到 #${since}；继续监视时加 --since ${since}`,
  };
}

const HANDLERS = {
  init: runInit, add: runAdd, post: runPost, read: runRead, status: runStatus,
  overview: runOverview, wait: runWait, watch: runWatch, group: runGroup, assign: runAssign,
  remove: runRemove,
};

function exitCodeFor(error) {
  if (error instanceof BoardError) {
    if (error.kind === "usage") return EXIT.USAGE;
    if (error.kind === "not-ready") return EXIT.NOT_READY;
  }
  return EXIT.FAIL;
}

export async function main(argv = process.argv.slice(2)) {
  let parsed;
  try {
    parsed = parseArgs({ args: argv, options: OPTIONS, strict: true, allowPositionals: true });
  } catch (error) {
    console.error(`✗ ${error.message}\n${HELP}`);
    return EXIT.USAGE;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    process.stdout.write(HELP);
    return EXIT.OK;
  }
  const command = positionals[0];
  if (positionals.length !== 1 || !COMMANDS.includes(command)) {
    console.error(`✗ 需要一个子命令: ${COMMANDS.join(" | ")}\n${HELP}`);
    return EXIT.USAGE;
  }
  try {
    required(values, "dir");
    if (values.now !== undefined && !NOW_COMMANDS.includes(command)) {
      throw new BoardError("--now 只用于 status 与 overview；写入命令总用真实时间", "usage");
    }
    const outcome = await HANDLERS[command](values, resolve(values.dir));
    if (values.json) console.log(JSON.stringify(outcome.result, null, 2));
    else console.log(outcome.text);
    return EXIT.OK;
  } catch (error) {
    console.error(`✗ ${error.message}`);
    return exitCodeFor(error);
  }
}

// 直接执行时才运行 main；兼容经符号链接或 /var 与 /private/var 之类别名路径的调用。
function isEntryPoint() {
  const entry = process.argv[1];
  if (!entry) return false;
  let real = entry;
  try {
    real = realpathSync(entry);
  } catch {
    real = entry; // 路径无法解析时按原值比较
  }
  return [entry, real].some((path) => pathToFileURL(path).href === import.meta.url);
}

if (isEntryPoint()) process.exitCode = await main();
