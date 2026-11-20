// swarm 运行目录的文件存储。
//
// 运行目录有两份数据文件：board.jsonl（消息板，只追加，一行一条记录）与
// members.json（成员名单，整体替换）。两者的写入都在同一把目录锁内完成：
// 锁内先读出最后一条记录的序号再追加，所以并发写入的成员拿到的序号唯一且连续。
// 成员状态不存盘，由 board-status.mjs 从消息记录推导，消息板是唯一事实源。
// 同一操作要写两份文件时先追加消息、后写名单：中途崩溃只留下一条无人认领的消息，
// 重做该操作即可，不会留下没有派发消息的成员。

import {
  appendFileSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  truncateSync,
  unlinkSync,
  writeFileSync,
  writeSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

export const BOARD_FILE = "board.jsonl";
export const MEMBERS_FILE = "members.json";
export const MEMBERS_SCHEMA = "agent-swarm-members-v1";
export const COORDINATOR = "coordinator";
export const BROADCAST = "all";
export const RESERVED_NAMES = Object.freeze([BROADCAST, COORDINATOR]);
export const ROLES = Object.freeze(["worker", "verifier", "monitor"]);
export const TAGS = Object.freeze([
  "brief", "start", "progress", "done", "blocked", "standby",
  "fix", "accept", "stall", "stop", "resume", "note", "handoff",
]);
// 需要成员行动的标签：成员发 start 之前一直算待处理。accept、note、stop 只是告知。
// handoff 是同伴之间的直接交接，与 coordinator 的 brief、fix 同样要求收件成员处理。
export const MEMBER_ACTION_TAGS = Object.freeze(["brief", "fix", "resume", "handoff"]);
// 需要 coordinator 处理的标签：成员的 start、progress、standby 不要求答复。
export const COORDINATOR_ACTION_TAGS = Object.freeze(["done", "blocked", "stall"]);
// 批量登记一次最多 20 个成员；待命最长 120 分钟。
export const MAX_BATCH = 20;
export const MAX_STANDBY_MINUTES = 120;

// 成员自己发出的生命周期标签决定状态；没有发过时为 briefed（已派发、未开始）。
// stall 不改状态：monitor 报警后继续巡检，仍为 active。
export const LIFECYCLE_STATES = Object.freeze({
  start: "active", progress: "active", done: "done", blocked: "blocked",
});

// 谁能发哪个标签。verifier 可以把修正项直接发给作者，monitor 报停滞；worker 与 verifier
// 可以用 handoff 把工作直接交给同伴。coordinator 派活仍用 brief。
const COORDINATOR_TAGS = Object.freeze([
  "brief", "fix", "accept", "stop", "resume", "note", "done",
]);
const MEMBER_TAGS = Object.freeze(["start", "progress", "done", "blocked", "standby", "note"]);
const ROLE_EXTRA_TAGS = Object.freeze({
  worker: ["handoff"], verifier: ["fix", "handoff"], monitor: ["stall"],
});
// 成员发各标签时允许的当前状态；note 与 fix 不改状态，任何状态都可以发。
const ALLOWED_FROM = Object.freeze({
  start: ["briefed", "active", "done", "blocked"],
  progress: ["active"],
  done: ["active"],
  blocked: ["briefed", "active"],
  standby: ["done"],
  stall: ["active"],
  handoff: ["active", "done"],
});

const LOCK_FILE = "board.lock";
const NAME_PATTERN = /^[a-z][a-z0-9-]{0,31}$/;
const MAX_TEXT_LENGTH = 2000;
// 锁的等待有固定上限：400 次 × 25 ms ≈ 10 秒。持锁只覆盖一次读写，是毫秒级的，所以
// 超过 5 秒的锁视为崩溃遗留；等待上限长于这个阈值，遗留的锁总能在等待期内被回收。
const LOCK_RETRY_LIMIT = 400;
const LOCK_RETRY_MS = 25;
const LOCK_STALE_MS = 5_000;

// kind 决定工具的退出码：usage → 2，not-ready → 3，其余 → 1。
export class BoardError extends Error {
  constructor(message, kind = "fail") {
    super(message);
    this.kind = kind;
  }
}

export function formatLocalTime(date) {
  const pad = (value) => String(value).padStart(2, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absolute = Math.abs(offsetMinutes);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}` +
    `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`
  );
}

function sleepSync(milliseconds) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, milliseconds);
}

function removeStaleLock(lockPath) {
  try {
    const ageMs = Date.now() - statSync(lockPath).mtimeMs;
    if (ageMs > LOCK_STALE_MS) unlinkSync(lockPath);
  } catch {
    // 锁在检查期间被持有者释放，下一轮重试即可。
  }
}

// 只删除自己的锁：持锁超过阈值时，锁可能已被别人当作遗留回收并重建。
function releaseLock(lockPath, token) {
  try {
    if (readFileSync(lockPath, "utf8") === token) unlinkSync(lockPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

export function withLock(dir, action) {
  const lockPath = join(dir, LOCK_FILE);
  const token = `${process.pid}-${Date.now()}-${Math.random()}`;
  for (let attempt = 0; attempt < LOCK_RETRY_LIMIT; attempt += 1) {
    let handle;
    try {
      handle = openSync(lockPath, "wx");
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      removeStaleLock(lockPath);
      sleepSync(LOCK_RETRY_MS);
      continue;
    }
    try {
      writeSync(handle, token);
      return action();
    } finally {
      closeSync(handle);
      releaseLock(lockPath, token);
    }
  }
  throw new BoardError(`等待消息板锁超时: ${lockPath}`);
}

export function requireRun(dir) {
  if (!existsSync(join(dir, MEMBERS_FILE)) || !existsSync(join(dir, BOARD_FILE))) {
    throw new BoardError(`运行目录未初始化，先执行 init: ${dir}`, "not-ready");
  }
}

// 追加中途崩溃会在末尾留下没有换行的半行：读取时跳过它，下一次追加前截掉。
// 文件中间出现非法行才是真正的损坏，照常报错。
function splitBoardText(text) {
  const end = text.lastIndexOf("\n") + 1;
  return { complete: text.slice(0, end), tail: text.slice(end) };
}

function parseTail(tail) {
  if (tail.trim() === "") return null;
  try {
    const record = JSON.parse(tail);
    return Number.isInteger(record?.seq) ? record : null;
  } catch {
    return null;
  }
}

export function readRecords(dir) {
  const text = readFileSync(join(dir, BOARD_FILE), "utf8");
  const { complete, tail } = splitBoardText(text);
  const records = [];
  complete.split("\n").forEach((line, index) => {
    if (line.trim() === "") return;
    try {
      records.push(JSON.parse(line));
    } catch {
      throw new BoardError(`${BOARD_FILE} 第 ${index + 1} 行不是合法 JSON`);
    }
  });
  const last = parseTail(tail);
  if (last) records.push(last);
  return records;
}

// 只在持锁时调用。能解析的末行只缺换行，补上；解析不了的半行截掉。
// 多条记录一次写入，批量登记不会只写进一部分。
function appendLines(dir, records) {
  const path = join(dir, BOARD_FILE);
  const { complete, tail } = splitBoardText(readFileSync(path, "utf8"));
  if (tail !== "") {
    if (parseTail(tail)) appendFileSync(path, "\n");
    else truncateSync(path, Buffer.byteLength(complete));
  }
  appendFileSync(path, records.map((record) => `${JSON.stringify(record)}\n`).join(""));
}

export function readRoster(dir) {
  const roster = JSON.parse(readFileSync(join(dir, MEMBERS_FILE), "utf8"));
  if (roster.schema !== MEMBERS_SCHEMA) {
    throw new BoardError(`${MEMBERS_FILE} 的 schema 不是 ${MEMBERS_SCHEMA}`);
  }
  return roster;
}

function writeRoster(dir, roster) {
  // 先写临时文件再改名，读者不会看到写了一半的名单。
  const target = join(dir, MEMBERS_FILE);
  const temporary = `${target}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(roster, null, 2)}\n`);
  renameSync(temporary, target);
}

// 成员的 owns / outputs 路径相对项目根；名单只记项目根相对运行目录的位置，
// 运行目录随项目移动或提交时不带本机绝对路径。
export function projectRoot(dir, roster) {
  return resolve(dir, roster.root);
}

// 名单最后写：它是“已初始化”的标志。中途崩溃后重跑 init 即可，已有的消息板不截断。
export function initRun(dir, { root, title, now }) {
  if (existsSync(join(dir, MEMBERS_FILE))) {
    throw new BoardError(`运行目录已初始化: ${dir}`);
  }
  mkdirSync(dir, { recursive: true });
  const boardPath = join(dir, BOARD_FILE);
  if (!existsSync(boardPath)) writeFileSync(boardPath, "");
  const roster = {
    schema: MEMBERS_SCHEMA,
    title,
    created_at: formatLocalTime(now),
    root: relative(resolve(dir), resolve(root)) || ".",
    members: [],
  };
  writeRoster(dir, roster);
  return roster;
}

export function validateName(name) {
  if (!NAME_PATTERN.test(name ?? "")) {
    throw new BoardError(
      `成员名须为小写字母开头、只含小写字母数字与连字符、不超过 32 字符: ${name}`,
      "usage",
    );
  }
  if (RESERVED_NAMES.includes(name)) {
    throw new BoardError(`成员名 ${name} 是保留名`, "usage");
  }
}

function liveMembers(roster) {
  return roster.members.filter((member) => !member.removed);
}

export function memberGroups(member) {
  return member.groups ?? []; // 0.1.0 写出的名单没有 groups 字段
}

export function archivedGroups(roster) {
  return roster.archived_groups ?? []; // 0.3.0 及更早写出的名单没有 archived_groups 字段
}

export function lifecycleState(ownRecords) {
  const last = ownRecords.filter((record) => record.tag in LIFECYCLE_STATES).at(-1);
  return last ? LIFECYCLE_STATES[last.tag] : "briefed";
}

// 收件判定：read、wait、watch 与状态推导共用这一条口径。发给本人（含经组展开）或
// all 的消息都算，自己发的不算。成员加入之前发给 all 的消息不算，与组消息只发给
// 当时在册成员的口径一致；member 省略时（coordinator）不做这项限制。
export function isAddressedTo(record, name, member) {
  if (record.from === name) return false;
  if (record.to.includes(name)) return true;
  if (!record.to.includes(BROADCAST)) return false;
  return member === undefined || record.seq > member.added_seq;
}

// 待处理：成员最近一次 start 之后发给它的行动消息。start 表示已读到并开始处理；
// done、progress、standby 等其他发言不算已读。没有发过 start 时从派发消息之后算起。
export function pendingRecords(member, records) {
  const lastStart = records.filter(
    (record) => record.from === member.name && record.tag === "start",
  ).at(-1);
  const baseline = Math.max(member.added_seq, lastStart?.seq ?? 0);
  return records.filter(
    (record) => record.seq > baseline && MEMBER_ACTION_TAGS.includes(record.tag) &&
      isAddressedTo(record, member.name, member),
  );
}

// 组名与成员名共用一个命名空间：组名不能是成员名，成员名也不能是组名。
// 已归档的组即使成员都已退出也占用名字。
export function knownGroups(roster) {
  return new Set([...roster.members.flatMap(memberGroups), ...archivedGroups(roster)]);
}

function archivedGroupError(group) {
  return new BoardError(`组 ${group} 已归档，不再接收消息`, "usage");
}

// 收件人展开：成员名、all、coordinator 原样保留；组名展开为组内在册成员。
// 记录的 to 存展开后的成员名，addressed 只在用了组名时保存原写法（组名前加 #）。
function expandRecipients(roster, targets) {
  if (!Array.isArray(targets) || targets.length === 0) {
    throw new BoardError("收件人不能为空；广播写 all", "usage");
  }
  const live = liveMembers(roster);
  const liveNames = live.map((member) => member.name);
  const recipients = [];
  const addressed = [];
  let usedGroup = false;
  const add = (name) => {
    if (!recipients.includes(name)) recipients.push(name);
  };
  for (const raw of targets) {
    const target = raw.replace(/^#/, "");
    if (RESERVED_NAMES.includes(target) || liveNames.includes(target)) {
      add(target);
      addressed.push(target);
      continue;
    }
    if (archivedGroups(roster).includes(target)) throw archivedGroupError(target);
    const members = live.filter((member) => memberGroups(member).includes(target));
    if (members.length === 0) {
      throw new BoardError(`收件人不是在册成员，也不是有在册成员的组: ${target}`, "usage");
    }
    members.forEach((member) => add(member.name));
    addressed.push(`#${target}`);
    usedGroup = true;
  }
  return { recipients, addressed: usedGroup ? addressed : null };
}

function validateText(text) {
  if (!text || text.trim() === "") throw new BoardError("消息正文不能为空", "usage");
  if (text.length > MAX_TEXT_LENGTH) {
    throw new BoardError(`消息正文超过 ${MAX_TEXT_LENGTH} 字符；细节写进产出文件`, "usage");
  }
}

function senderMember(roster, from) {
  if (from === COORDINATOR) return null;
  const member = liveMembers(roster).find((entry) => entry.name === from);
  if (!member) throw new BoardError(`发送者不在名单中或已移除: ${from}`, "usage");
  return member;
}

function checkPermission(member, tag) {
  const allowed = member === null
    ? COORDINATOR_TAGS
    : [...MEMBER_TAGS, ...ROLE_EXTRA_TAGS[member.role]];
  if (!allowed.includes(tag)) {
    const sender = member === null ? COORDINATOR : `${member.role} ${member.name}`;
    throw new BoardError(`${sender} 不能发 ${tag}；可发: ${allowed.join(", ")}`, "usage");
  }
}

// 状态转移：done 与 progress 只在 active 时可发，所以被唤醒或续接后必须先发 start，
// start 也是“已读到待处理消息”的唯一凭据；standby 只在 done 之后。
function checkTransition(member, records, tag) {
  const allowedFrom = ALLOWED_FROM[tag];
  if (!allowedFrom) return;
  const state = lifecycleState(records.filter((record) => record.from === member.name));
  if (allowedFrom.includes(state)) return;
  const hint = tag === "standby" ? "；standby 只在 done 之后发" : "；被唤醒或续接后先发 start";
  throw new BoardError(`${member.name} 当前状态为 ${state}，不能发 ${tag}${hint}`, "usage");
}

// 有未处理的 brief、fix、resume 时不接受 done：成员要先发 start 并把它们做完。
// 2026-11-19 的前向验证中，成员读到 brief 后没有处理就发了 done。
function checkNothingPending(member, records, tag) {
  if (tag !== "done") return;
  const pending = pendingRecords(member, records).map((record) => `#${record.seq}`);
  if (pending.length === 0) return;
  throw new BoardError(`${member.name} 有未处理的 ${pending.join(" ")}；先发 start 处理，` +
    "再发 done", "usage");
}

function checkMinutes(tag, minutes) {
  if (tag === "standby") {
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_STANDBY_MINUTES) {
      throw new BoardError(`standby 需要 --minutes 1..${MAX_STANDBY_MINUTES}`, "usage");
    }
  } else if (minutes !== undefined) {
    throw new BoardError("--minutes 只用于 standby", "usage");
  }
}

// coordinator 的 done 表示整个 swarm 收尾；成员需要 coordinator 处理的消息必须发给它。
function checkRecipients(from, tag, recipients) {
  const broadcastOnly = recipients.length === 1 && recipients[0] === BROADCAST;
  if (from === COORDINATOR && tag === "done" && !broadcastOnly) {
    throw new BoardError("coordinator 的 done 表示整个 swarm 收尾，只能发给 all；" +
      "验收单个成员用 accept", "usage");
  }
  const reachesCoordinator = recipients.includes(COORDINATOR) || recipients.includes(BROADCAST);
  if (from !== COORDINATOR && COORDINATOR_ACTION_TAGS.includes(tag) && !reachesCoordinator) {
    throw new BoardError(`${tag} 需要 coordinator 处理，收件人须含 coordinator`, "usage");
  }
  if (tag === "handoff") checkHandoffRecipients(from, recipients);
}

// handoff 点名接手的同伴：不接受 all，coordinator 只能抄送，发给自己没有接收者。
function checkHandoffRecipients(from, recipients) {
  if (recipients.includes(BROADCAST)) {
    throw new BoardError("handoff 须点名成员或组，不接受 all", "usage");
  }
  const peers = recipients.filter((name) => name !== COORDINATOR && name !== from);
  if (peers.length === 0) {
    throw new BoardError("handoff 须点名至少一个其他成员或组；coordinator 只能抄送", "usage");
  }
}

function validatePost(roster, records, { from, tag, text, minutes }) {
  if (!TAGS.includes(tag)) {
    throw new BoardError(`未知标签 ${tag}；可用: ${TAGS.join(", ")}`, "usage");
  }
  const member = senderMember(roster, from);
  checkPermission(member, tag);
  if (member) {
    checkTransition(member, records, tag);
    checkNothingPending(member, records, tag);
  }
  checkMinutes(tag, minutes);
  validateText(text);
}

// control 只出现在 group 与 assign 发出的名单变更通知中，post 不写它。
function nextRecord(records, message, now) {
  const lastSeq = records.length === 0 ? 0 : records[records.length - 1].seq;
  const { from, to, tag, text, addressed, until, control } = message;
  const record = { seq: lastSeq + 1, time: formatLocalTime(now), from, to, tag, text };
  if (addressed) record.addressed = addressed;
  if (until) record.until = until;
  if (control) record.control = control;
  return record;
}

export function postMessage(dir, message, now) {
  return withLock(dir, () => {
    const roster = readRoster(dir);
    const records = readRecords(dir);
    validatePost(roster, records, message);
    const { recipients, addressed } = expandRecipients(roster, message.to);
    checkRecipients(message.from, message.tag, recipients);
    const until = message.tag === "standby"
      ? formatLocalTime(new Date(now.getTime() + message.minutes * 60_000))
      : undefined;
    const { from, tag, text } = message;
    const record = nextRecord(records, { from, to: recipients, tag, text, addressed, until }, now);
    appendLines(dir, [record]);
    return record;
  });
}

// 批量登记时把 {i} 换成序号，例如 --owns review/{i}.md。
function fillIndex(template, index) {
  return index === null ? template : template.replaceAll("{i}", String(index));
}

function plannedMembers({ name, count, groups, templates }) {
  if (count === undefined) {
    validateName(name);
    if (templates.some((template) => template.includes("{i}"))) {
      throw new BoardError("{i} 只在 --count 批量登记时替换；单个成员写实际路径", "usage");
    }
    return [{ name, index: null, groups }];
  }
  if (!Number.isInteger(count) || count < 1 || count > MAX_BATCH) {
    throw new BoardError(`--count 须为 1..${MAX_BATCH}`, "usage");
  }
  validateName(name);
  validateName(`${name}-${count}`); // 带序号后仍须符合长度限制
  return Array.from({ length: count }, (_, offset) => ({
    name: `${name}-${offset + 1}`, index: offset + 1, groups: [name, ...groups],
  }));
}

// owns 与 output 须为项目根内的相对路径。
function validateMemberPath(rootDir, path) {
  const outside = () => new BoardError(`路径须为项目根内的相对路径: ${path}`, "usage");
  if (!path || path.trim() === "" || isAbsolute(path)) throw outside();
  const fromRoot = relative(rootDir, resolve(rootDir, path));
  if (fromRoot === ".." || fromRoot.startsWith(`..${sep}`)) throw outside();
}

function checkNamespace(roster, planned) {
  const archived = archivedGroups(roster);
  const closed = planned.flatMap((entry) => entry.groups).find((group) => archived.includes(group));
  if (closed !== undefined) throw archivedGroupError(closed);
  const memberNames = new Set(roster.members.map((member) => member.name));
  const groups = knownGroups(roster);
  const newNames = planned.map((entry) => entry.name);
  for (const entry of planned) {
    if (memberNames.has(entry.name)) {
      // 名字不复用：被移除的成员也占用名字，替换者用 <name>-2。
      throw new BoardError(`成员名已存在（含已移除）: ${entry.name}；替换者用 ${entry.name}-2`);
    }
    if (groups.has(entry.name)) throw new BoardError(`成员名与已有组名相同: ${entry.name}`);
    for (const group of entry.groups) {
      if (memberNames.has(group) || newNames.includes(group)) {
        throw new BoardError(`组名与成员名相同: ${group}`);
      }
    }
  }
}

function validateAdd({ role, owns, text, groups }) {
  if (!ROLES.includes(role)) {
    throw new BoardError(`未知角色 ${role}；可用: ${ROLES.join(", ")}`, "usage");
  }
  if (!text || text.trim() === "") throw new BoardError("派发书摘要不能为空", "usage");
  if (role === "monitor" && owns.length === 0) {
    throw new BoardError("monitor 须带 --owns：巡检记录写在这里，也用于活动判定", "usage");
  }
  groups.forEach(validateName);
}

// 加入成员即公开派发：每个成员一条 coordinator → @name [brief] 与名单登记在同一把锁内
// 写入，先写消息板，后写名单。
export function addMembers(dir, { name, role, owns, outputs, text, groups = [], count }, now) {
  validateAdd({ role, owns, text, groups });
  const planned = plannedMembers({ name, count, groups, templates: [text, ...owns, ...outputs] });
  return withLock(dir, () => {
    const roster = readRoster(dir);
    const rootDir = projectRoot(dir, roster);
    [...owns, ...outputs].forEach((path) => validateMemberPath(rootDir, path));
    checkNamespace(roster, planned);
    const records = readRecords(dir);
    const added = [];
    for (const entry of planned) {
      const brief = {
        from: COORDINATOR, to: [entry.name], tag: "brief", text: fillIndex(text, entry.index),
      };
      validateText(brief.text);
      const record = nextRecord(records, brief, now);
      records.push(record);
      const member = {
        name: entry.name, role, groups: entry.groups,
        owns: owns.map((path) => fillIndex(path, entry.index)),
        outputs: outputs.map((path) => fillIndex(path, entry.index)),
        added_seq: record.seq, removed: false,
      };
      roster.members.push(member);
      added.push({ member, record });
    }
    appendLines(dir, added.map(({ record }) => record));
    writeRoster(dir, roster);
    return added;
  });
}

// --name 可以是成员名，也可以是组名（移除组内全部在册成员）。
export function removeMembers(dir, name, now) {
  return withLock(dir, () => {
    const roster = readRoster(dir);
    const live = liveMembers(roster);
    const single = live.filter((member) => member.name === name);
    const targets = single.length > 0
      ? single
      : live.filter((member) => memberGroups(member).includes(name));
    if (targets.length === 0) throw new BoardError(`名单中没有在册成员或组: ${name}`, "usage");
    const notice = {
      from: COORDINATOR, to: targets.map((member) => member.name), tag: "stop",
      text: "已从名单移除", addressed: single.length > 0 ? null : [`#${name}`],
    };
    const record = nextRecord(readRecords(dir), notice, now);
    for (const member of targets) {
      member.removed = true;
      member.removed_seq = record.seq;
    }
    appendLines(dir, [record]);
    writeRoster(dir, roster);
    return { members: targets, record };
  });
}

// 组的加入、退出与归档。三者都在锁内先追加一条 coordinator 的 note，再写名单，
// 返回 { record, members }，members 是受影响的成员名。note 带 control: { op, group }，
// 标明它是名单变更通知：不核销成员的待答复，也不计入总览的里程碑。
// 未知成员或组、名字冲突是用法错误（退出 2）；重复加入、已在组外、已归档是失败（退出 1）。

function liveTargets(roster, names) {
  if (!Array.isArray(names) || names.length === 0) {
    throw new BoardError("成员列表不能为空", "usage");
  }
  const live = liveMembers(roster);
  return [...new Set(names)].map((name) => {
    const member = live.find((entry) => entry.name === name);
    if (!member) throw new BoardError(`不是在册成员: ${name}`, "usage");
    return member;
  });
}

function commitRosterNote(dir, roster, notice, now) {
  const message = { from: COORDINATOR, tag: "note", ...notice };
  const record = nextRecord(readRecords(dir), message, now);
  appendLines(dir, [record]);
  writeRoster(dir, roster);
  return { record, members: record.to };
}

// 组不存在时即新建；组名不能是成员名（含已移除），也不能是已归档的组。
export function joinGroup(dir, group, names, now) {
  validateName(group);
  return withLock(dir, () => {
    const roster = readRoster(dir);
    if (roster.members.some((member) => member.name === group)) {
      throw new BoardError(`组名与成员名相同: ${group}`, "usage");
    }
    if (archivedGroups(roster).includes(group)) throw new BoardError(`组 ${group} 已归档`);
    const targets = liveTargets(roster, names);
    const inside = targets.filter((member) => memberGroups(member).includes(group));
    if (inside.length > 0) {
      throw new BoardError(`已在组 ${group} 中: ${inside.map((member) => member.name).join(", ")}`);
    }
    targets.forEach((member) => {
      member.groups = [...memberGroups(member), group];
    });
    const to = targets.map((member) => member.name);
    const control = { op: "join", group };
    return commitRosterNote(dir, roster, { to, text: `加入组 #${group}`, control }, now);
  });
}

export function leaveGroup(dir, group, names, now) {
  return withLock(dir, () => {
    const roster = readRoster(dir);
    if (!knownGroups(roster).has(group)) throw new BoardError(`没有这个组: ${group}`, "usage");
    const targets = liveTargets(roster, names);
    const outside = targets.filter((member) => !memberGroups(member).includes(group));
    if (outside.length > 0) {
      const outsiders = outside.map((member) => member.name).join(", ");
      throw new BoardError(`不在组 ${group} 中: ${outsiders}`);
    }
    targets.forEach((member) => {
      member.groups = memberGroups(member).filter((name) => name !== group);
    });
    const to = targets.map((member) => member.name);
    const control = { op: "leave", group };
    return commitRosterNote(dir, roster, { to, text: `退出组 #${group}`, control }, now);
  });
}

// 归档后组名仍留在成员的 groups 中，read --group 与 remove 照常可用；
// post --to 与 add --group 不再接受该组。
export function archiveGroup(dir, group, now) {
  return withLock(dir, () => {
    const roster = readRoster(dir);
    if (archivedGroups(roster).includes(group)) throw new BoardError(`组 ${group} 已归档`);
    const members = liveMembers(roster).filter((member) => memberGroups(member).includes(group));
    if (members.length === 0) {
      throw new BoardError(`没有这个组，或组内没有在册成员: ${group}`, "usage");
    }
    roster.archived_groups = [...archivedGroups(roster), group];
    const notice = {
      to: members.map((member) => member.name), addressed: [`#${group}`],
      text: `组 #${group} 已归档，不再接收消息`, control: { op: "archive", group },
    };
    return commitRosterNote(dir, roster, notice, now);
  });
}

// 登记后调整负责范围：把 owns 与 output 交给 --name。同一路径原来登记在其他在册成员名下时
// 随之移走，保持“每块只有一个所有者”。锁内先追加一条 coordinator 的 note，发给新旧所有者，
// 带 control: { op: "assign", member, owns, outputs }，再写名单。路径已在该成员名下、或会让
// monitor 失去全部 owns 是失败（退出 1）；不在册的成员、项目根外的路径是用法错误（退出 2）。
// note 不唤醒待命成员：要它接手干活，另发 brief 或 fix。
export function assignPaths(dir, name, { owns, outputs }, now) {
  if (owns.length === 0 && outputs.length === 0) {
    throw new BoardError("assign 需要至少一个 --owns 或 --output", "usage");
  }
  return withLock(dir, () => {
    const roster = readRoster(dir);
    const rootDir = projectRoot(dir, roster);
    [...owns, ...outputs].forEach((path) => validateMemberPath(rootDir, path));
    const [target] = liveTargets(roster, [name]);
    const moves = [
      ...transferPaths(roster, target, "owns", owns, rootDir),
      ...transferPaths(roster, target, "outputs", outputs, rootDir),
    ];
    const previous = [...new Set(moves.flatMap((move) => move.from))];
    const text = `负责范围调整：${moves.map(describeMove).join("；")}`;
    validateText(text);
    const control = { op: "assign", member: target.name, owns: [...owns], outputs: [...outputs] };
    return commitRosterNote(dir, roster, { to: [target.name, ...previous], text, control }, now);
  });
}

// 同一路径按项目根内的位置比较：src/a.ts 与 ./src/a.ts 是同一个。
function samePath(rootDir, left, right) {
  return resolve(rootDir, left) === resolve(rootDir, right);
}

function transferPaths(roster, target, field, paths, rootDir) {
  return [...new Set(paths)].map((path) => {
    const holds = (member) => member[field].some((entry) => samePath(rootDir, entry, path));
    if (holds(target)) throw new BoardError(`${target.name} 已登记 ${path}`);
    const from = liveMembers(roster).filter((member) => member !== target && holds(member));
    for (const member of from) {
      member[field] = member[field].filter((entry) => !samePath(rootDir, entry, path));
      if (field === "owns" && member.role === "monitor" && member.owns.length === 0) {
        throw new BoardError(`monitor ${member.name} 须保留至少一个 owns`);
      }
    }
    target[field] = [...target[field], path];
    return { field, path, to: target.name, from: from.map((member) => member.name) };
  });
}

function describeMove({ field, path, to, from }) {
  const kind = field === "owns" ? "负责" : "产出";
  const source = from.length > 0 ? `由 ${from.join("、")} ` : "";
  return `${kind} ${path} ${source}交给 ${to}`;
}
