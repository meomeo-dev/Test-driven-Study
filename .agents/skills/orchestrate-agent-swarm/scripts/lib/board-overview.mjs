// swarm 的 Markdown 总览与可选的计划文件 plan.json。
//
// 计划文件由 coordinator 在登记成员后写，给出目标与分工线（thread）；总览把状态推导、
// 消息记录与计划合成一页：目标、待处理事项、各 thread 或组的成员表、里程碑与截图。
// renderOverview 是纯函数，读写文件只在 readPlan 与 writeOverview 中。

import { existsSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { BoardError, formatLocalTime, knownGroups, memberGroups } from "./board-store.mjs";

export const PLAN_FILE = "plan.json";
export const PLAN_SCHEMA = "agent-swarm-plan-v1";

const MAX_THREADS = 6;
const THREAD_ID_PATTERN = /^t-[a-z0-9-]{1,30}$/;
const TEXT_LIMITS = Object.freeze({
  goalTitle: 60, goalLine: 80, threadTitle: 30, threadGoal: 60,
});
const CELL_TEXT_LIMIT = 60;
const MILESTONE_TEXT_LIMIT = 80;
const MILESTONE_TAGS = Object.freeze(["done", "accept"]);
const MILESTONE_LIMIT = 20;
const SCREENSHOT_PREFIX = "Screenshot: ";
const OTHER_MEMBERS = "其他成员";

// 字符数按 Unicode 码点计，中文与英文都算一个字符。
function charLength(text) {
  return [...text].length;
}

function planError(path, reason) {
  return new BoardError(`${PLAN_FILE} 的 ${path} ${reason}`);
}

// required 为假时字段可省；给出时须为不超过 max 字符的字符串。
function checkText(value, path, { max, required }) {
  if (value === undefined && !required) return;
  if (typeof value !== "string") throw planError(path, "须为字符串");
  const length = charLength(value);
  const min = required ? 1 : 0;
  if (length < min || length > max) {
    throw planError(path, `须为 ${min} 到 ${max} 字符，实为 ${length}`);
  }
}

function checkGoal(goal) {
  if (goal === null || typeof goal !== "object" || Array.isArray(goal)) {
    throw planError("goal", "须为对象");
  }
  checkText(goal.title, "goal.title", { max: TEXT_LIMITS.goalTitle, required: true });
  checkText(goal.line, "goal.line", { max: TEXT_LIMITS.goalLine, required: false });
}

// 名单中的成员名（含已移除）展开为它自己，组名展开为组内全部成员（含已移除）。
function expandPlanMember(roster, value, path) {
  if (typeof value !== "string") throw planError(path, "须为成员名或组名");
  if (roster.members.some((member) => member.name === value)) return [value];
  if (!knownGroups(roster).has(value)) throw planError(path, `不是名单中的成员或组: ${value}`);
  return roster.members
    .filter((member) => memberGroups(member).includes(value))
    .map((member) => member.name);
}

// 展开后同一成员最多出现在一个 thread 中；owners 记录成员所在 thread 的下标。
function checkThreadMembers(roster, thread, index, owners) {
  const path = `threads[${index}].members`;
  if (!Array.isArray(thread.members) || thread.members.length === 0) {
    throw planError(path, "须为非空数组");
  }
  thread.members.forEach((value, position) => {
    const itemPath = `${path}[${position}]`;
    for (const name of expandPlanMember(roster, value, itemPath)) {
      const owner = owners.get(name);
      if (owner !== undefined && owner !== index) {
        throw planError(itemPath, `展开后的成员 ${name} 已在 threads[${owner}] 中`);
      }
      owners.set(name, index);
    }
  });
}

function checkThread(roster, thread, index, context) {
  const path = `threads[${index}]`;
  if (thread === null || typeof thread !== "object" || Array.isArray(thread)) {
    throw planError(path, "须为对象");
  }
  if (typeof thread.id !== "string" || !THREAD_ID_PATTERN.test(thread.id)) {
    throw planError(`${path}.id`, `须匹配 ${THREAD_ID_PATTERN.source}: ${thread.id}`);
  }
  if (context.ids.has(thread.id)) throw planError(`${path}.id`, `重复: ${thread.id}`);
  context.ids.add(thread.id);
  checkText(thread.title, `${path}.title`, { max: TEXT_LIMITS.threadTitle, required: true });
  checkText(thread.goal, `${path}.goal`, { max: TEXT_LIMITS.threadGoal, required: false });
  checkThreadMembers(roster, thread, index, context.owners);
}

export function validatePlan(plan, roster) {
  if (plan === null || typeof plan !== "object" || Array.isArray(plan)) {
    throw new BoardError(`${PLAN_FILE} 须为 JSON 对象`);
  }
  if (plan.schema !== PLAN_SCHEMA) throw planError("schema", `须为 ${PLAN_SCHEMA}`);
  checkGoal(plan.goal);
  const { threads } = plan;
  if (!Array.isArray(threads) || threads.length < 1 || threads.length > MAX_THREADS) {
    throw planError("threads", `须为 1 到 ${MAX_THREADS} 项的数组`);
  }
  const context = { ids: new Set(), owners: new Map() };
  threads.forEach((thread, index) => checkThread(roster, thread, index, context));
  return plan;
}

// 计划文件可选：不存在时返回 null；存在但不合法时报错，并写出出错的字段路径。
export function readPlan(dir, roster) {
  const path = join(dir, PLAN_FILE);
  if (!existsSync(path)) return null;
  let plan;
  try {
    plan = JSON.parse(readFileSync(path, "utf8"));
  } catch (error) {
    throw new BoardError(`${PLAN_FILE} 不是合法 JSON: ${error.message}`);
  }
  return validatePlan(plan, roster);
}

// 先写 <path>.tmp 再改名，读者不会看到写了一半的总览。父目录须已存在。
export function writeOverview(path, markdown) {
  const parent = dirname(path);
  if (!existsSync(parent) || !statSync(parent).isDirectory()) {
    throw new BoardError(`--out 的父目录不存在: ${parent}`);
  }
  const temporary = `${path}.tmp`;
  writeFileSync(temporary, markdown);
  renameSync(temporary, path);
}

function oneLine(text) {
  return text.replace(/\s*\n\s*/g, " ");
}

// 换行换成空格后按字符截断，截断处加 …。
function clip(text, limit) {
  const chars = [...oneLine(text)];
  return chars.length > limit ? `${chars.slice(0, limit).join("")}…` : chars.join("");
}

function cell(text) {
  return oneLine(text).replaceAll("|", "\\|");
}

function recipientsOf(record) {
  return (record.addressed ?? record.to).map((name) => `@${name}`).join(" ");
}

function refsOf(seqs) {
  return seqs.map((seq) => `#${seq}`).join(" ");
}

function statusLine(status, now) {
  return `状态：${status.state}（head #${status.head_seq}，` +
    `距最后一条消息 ${status.quiet_minutes}m，生成于 ${formatLocalTime(now)}）`;
}

function attentionSection(items) {
  const lines = items.map(
    (item) => `- ${item.id} ${refsOf(item.refs)} 自 ${item.since}：${item.action}`,
  );
  return `## 待处理\n\n${lines.length > 0 ? lines.join("\n") : "无"}`;
}

function memberRow(entry, recordsBySeq) {
  let state = entry.state;
  if (entry.reachable) state = `${entry.state}，待命至 ${entry.standby_until.slice(11, 16)}`;
  else if (entry.stopped_seq !== null) state = `${entry.state}，已停止 #${entry.stopped_seq}`;
  const last = recordsBySeq.get(entry.last_post_seq);
  const latest = last ? `#${last.seq} ${last.tag}：${clip(last.text, CELL_TEXT_LIMIT)}` : "-";
  const total = entry.outputs.length;
  const delivered = total - entry.missing_outputs.length;
  const cells = [
    entry.name, entry.role, state, latest, refsOf(entry.pending) || "-",
    total === 0 ? "-" : `${delivered}/${total}`,
  ];
  return `| ${cells.map(cell).join(" | ")} |`;
}

function memberTable(section, recordsBySeq) {
  if (section.members.length === 0) return `## ${section.heading}\n\n无`;
  const rows = section.members.map((entry) => memberRow(entry, recordsBySeq));
  return [
    `## ${section.heading}`, "",
    "| 成员 | 角色 | 状态 | 最近消息 | 待处理 | 产出 |",
    "| --- | --- | --- | --- | --- | --- |",
    ...rows,
  ].join("\n");
}

// thread 的 members 可写成员名或组名；组展开为组内成员，同一成员只列一次。
function threadSections(plan, members) {
  return plan.threads.map((thread) => {
    const names = new Set();
    for (const value of thread.members) {
      const direct = members.some((entry) => entry.name === value);
      const expanded = direct
        ? [value]
        : members.filter((entry) => entry.groups.includes(value)).map((entry) => entry.name);
      expanded.forEach((name) => names.add(name));
    }
    const title = oneLine(thread.title);
    const heading = thread.goal ? `${title} — ${oneLine(thread.goal)}` : title;
    return { heading, members: members.filter((entry) => names.has(entry.name)) };
  });
}

// 没有计划时每个组一节；成员条目保留所在组，已移除的成员仍列在原来的组里。
function groupSections(status) {
  return status.groups.map((group) => ({
    heading: `组 ${group.name}${group.archived ? "（已归档）" : ""}`,
    members: status.members.filter((entry) => entry.groups.includes(group.name)),
  }));
}

function memberSections(status, plan, recordsBySeq) {
  const sections = plan ? threadSections(plan, status.members) : groupSections(status);
  const placed = new Set(sections.flatMap((section) => section.members.map((entry) => entry.name)));
  const others = status.members.filter((entry) => !placed.has(entry.name));
  if (others.length > 0) sections.push({ heading: OTHER_MEMBERS, members: others });
  return sections.map((section) => memberTable(section, recordsBySeq));
}

// 名单变更通知（带 control 的记录）不是里程碑。
function milestoneSection(records) {
  const lines = records
    .filter((record) => MILESTONE_TAGS.includes(record.tag) && !record.control)
    .slice(-MILESTONE_LIMIT)
    .map((record) => `- #${record.seq} ${record.from} [${record.tag}] → ` +
      `${recipientsOf(record)}：${clip(record.text, MILESTONE_TEXT_LIMIT)}`);
  return `## 里程碑\n\n${lines.length > 0 ? lines.join("\n") : "无"}`;
}

// 正文中以 "Screenshot: <path> | <caption>" 开头的行登记一张截图；没有 | 时说明为空。
function screenshotsOf(record) {
  return record.text.split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith(SCREENSHOT_PREFIX))
    .map((line) => {
      const rest = line.slice(SCREENSHOT_PREFIX.length);
      const bar = rest.indexOf("|");
      const path = (bar < 0 ? rest : rest.slice(0, bar)).trim();
      const caption = bar < 0 ? "" : rest.slice(bar + 1).trim();
      return `- ![${caption}](${path}) #${record.seq} ${record.from}`;
    });
}

// 没有截图时省略整节，返回空数组。
function screenshotSection(records) {
  const lines = records.flatMap(screenshotsOf);
  return lines.length > 0 ? [`## 截图\n\n${lines.join("\n")}`] : [];
}

// 节的标题与顺序固定：标题、目标说明（可省）、状态、待处理、成员表各节、里程碑、截图。
export function renderOverview({ status, records, plan, now }) {
  const recordsBySeq = new Map(records.map((record) => [record.seq, record]));
  const title = oneLine(plan ? plan.goal.title : status.title);
  const blocks = [
    `# ${title}`,
    ...(plan?.goal.line ? [oneLine(plan.goal.line)] : []),
    statusLine(status, now),
    attentionSection(status.attention),
    ...memberSections(status, plan, recordsBySeq),
    milestoneSection(records),
    ...screenshotSection(records),
  ];
  return `${blocks.join("\n\n")}\n`;
}
