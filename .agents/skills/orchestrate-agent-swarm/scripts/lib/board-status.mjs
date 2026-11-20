// 从消息记录、成员名单与产出文件推导成员状态、停滞判定与待处理事项。
//
// 判定依据是“活动”而不是“发帖”：成员最后一条消息、派发时间、其 owns 路径下最新的
// 文件修改时间，三者取最晚。只看发帖会把埋头写文件的成员误判为停滞。
// 每个成员标记与 coordinator 标记各生成一条待处理事项（attention），写明相关序号、
// 开始时间与处理建议；monitor 按事项的 id 判断是否报警。

import { readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  BROADCAST, COORDINATOR, COORDINATOR_ACTION_TAGS, MEMBER_ACTION_TAGS, archivedGroups,
  formatLocalTime, isAddressedTo, lifecycleState, pendingRecords,
} from "./board-store.mjs";

export const DEFAULT_STALE_MINUTES = 12;

// 待处理事项给 coordinator 的处理建议。键的顺序就是事项的排序：同一标记内成员按名单
// 顺序，coordinator 的事项排在同标记的成员之后。
export const ATTENTION_ACTIONS = Object.freeze({
  blocked: "读受阻原因，补输入、改派或发 stop",
  "needs-resume": "成员没有读到这些消息：已结束的续接送达或改派，运行中的等它读板",
  unanswered: "答复这些回报：accept、fix、brief 或 note",
  stalled: "成员没有活动：确认它在宿主中是否仍在运行，必要时改派",
  "incomplete-outputs": "产出缺失或为空：发 fix，或核对 outputs 登记",
  idle: "无人干活且超过阈值没有新消息：派活、收尾或发 stop",
});
const ATTENTION_ORDER = Object.keys(ATTENTION_ACTIONS);

const WORKING_STATES = Object.freeze(["briefed", "active"]);
// 目录遍历有固定上限，避免 owns 指向大目录时巡检变慢。按层广度遍历，并限制单个目录计入
// 的条目数，一个大目录不会挤掉同级目录里的新文件；条目数触到上限时标出 scan_truncated。
const WALK_ENTRY_LIMIT = 2000;
const WALK_DIRECTORY_LIMIT = 500;
const WALK_DEPTH_LIMIT = 4;
const SKIPPED_DIRECTORIES = new Set(["node_modules", ".git"]);
const MINUTE_MS = 60_000;

function statOrNull(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function entriesOrEmpty(path) {
  try {
    return readdirSync(path, { withFileTypes: true });
  } catch {
    return []; // 目录在遍历期间被删除
  }
}

// 返回 owns 路径下最新的修改时间；子目录的修改时间也计入，超出深度的新建文件仍能
// 通过其父目录的修改时间反映出来。
function scanActivity(path) {
  const root = statOrNull(path);
  if (!root) return { newestMs: 0, truncated: false };
  if (!root.isDirectory()) return { newestMs: root.mtimeMs, truncated: false };
  let newestMs = root.mtimeMs;
  let visited = 0;
  let truncated = false;
  const queue = [{ path, depth: 0 }];
  let head = 0;
  for (; head < queue.length && visited < WALK_ENTRY_LIMIT; head += 1) {
    const current = queue[head];
    const entries = entriesOrEmpty(current.path);
    if (entries.length > WALK_DIRECTORY_LIMIT) truncated = true;
    for (const entry of entries.slice(0, WALK_DIRECTORY_LIMIT)) {
      if (visited >= WALK_ENTRY_LIMIT) {
        truncated = true;
        break;
      }
      visited += 1;
      const child = join(current.path, entry.name);
      if (entry.isDirectory() && SKIPPED_DIRECTORIES.has(entry.name)) continue;
      newestMs = Math.max(newestMs, statOrNull(child)?.mtimeMs ?? 0);
      if (entry.isDirectory() && current.depth < WALK_DEPTH_LIMIT) {
        queue.push({ path: child, depth: current.depth + 1 });
      }
    }
  }
  if (head < queue.length) truncated = true; // 总条目数用尽时还有目录没有遍历
  return { newestMs, truncated };
}

function missingOutputs(rootDir, outputs) {
  return outputs.filter((output) => {
    const stats = statOrNull(resolve(rootDir, output));
    return !stats || !stats.isFile() || stats.size === 0;
  });
}

function memberFlags(entry, staleMinutes) {
  const flags = [];
  // 已发 stop 的成员会直接结束运行，没有活动不算停滞。
  const working = WORKING_STATES.includes(entry.state) && entry.stopped_seq === null;
  if (working && entry.idle_minutes >= staleMinutes) flags.push("stalled");
  if (entry.state === "blocked") flags.push("blocked");
  if (entry.state === "done" && entry.missing_outputs.length > 0) {
    flags.push("incomplete-outputs");
  }
  // 待处理消息发出后超过阈值仍没有 start：成员没有读到它。待命成员本该秒级醒来，
  // 运行中的成员本该在下一次 progress 前读到，已结束的成员要由 coordinator 续接送达。
  if (entry.unserved_minutes >= staleMinutes) flags.push("needs-resume");
  return flags;
}

// 最早一条待处理消息发出后的分钟数；没有待处理消息时为 -1。
function unservedMinutes(pendingRecords, nowMs) {
  if (pendingRecords.length === 0) return -1;
  return Math.floor((nowMs - Date.parse(pendingRecords[0].time)) / MINUTE_MS);
}

// 成员最后一次发言（没有时为派发）之后，coordinator 发给它的第一条 stop 或收尾 done：它就是
// 让成员结束的那条。worker 与 verifier 收到后直接结束运行，不再发言，所以“已停止”只能从这条
// 记录推出。
function stopAfterLastPost(member, lastOwn, records) {
  const after = lastOwn?.seq ?? member.added_seq;
  return records.find(
    (record) => record.seq > after && record.from === COORDINATOR &&
      ["stop", "done"].includes(record.tag) && isAddressedTo(record, member.name, member),
  ) ?? null;
}

// 待命：最后一条自己的消息是 standby、未到截止时间，且之后没有收到 stop 或 coordinator
// 的收尾 done 时，点名即可唤醒，不需要宿主续接。返回截止时间，不可唤醒时为 null。
function standbyUntil(member, lastOwn, stop, nowMs) {
  if (member.removed || lastOwn?.tag !== "standby") return null;
  if (Date.parse(lastOwn.until) <= nowMs) return null;
  return stop === null ? lastOwn.until : null;
}

// 成员的活动事实：自己的消息、待处理消息与最晚活动时间；待处理事项的 refs 与 since
// 也取自这里。
function memberFacts(member, { records, rootDir }) {
  const own = records.filter((record) => record.from === member.name);
  const briefRecord = records.find((record) => record.seq === member.added_seq);
  const scans = member.owns.map((path) => scanActivity(resolve(rootDir, path)));
  const activityMs = Math.max(
    own.length > 0 ? Date.parse(own.at(-1).time) : 0,
    briefRecord ? Date.parse(briefRecord.time) : 0,
    ...scans.map((scan) => scan.newestMs),
  );
  return { own, pending: pendingRecords(member, records), scans, activityMs };
}

function attentionItem(subject, flag, refs, sinceMs, detail = null) {
  return {
    id: `${subject}:${flag}`, subject, flag, refs,
    since: formatLocalTime(new Date(sinceMs)), detail, action: ATTENTION_ACTIONS[flag],
  };
}

// 成员标记对应的事项：blocked 与 incomplete-outputs 指向最后一条 blocked 或 done，
// needs-resume 指向全部待处理消息，stalled 指向最后一条自己的消息（没有时为派发消息）。
function memberAttention(member, entry, facts, flag) {
  const lastTagged = (tag) => facts.own.filter((record) => record.tag === tag).at(-1);
  const recordItem = (record, detail) =>
    attentionItem(member.name, flag, [record.seq], Date.parse(record.time), detail);
  switch (flag) {
    case "blocked":
      return recordItem(lastTagged("blocked"));
    case "incomplete-outputs":
      return recordItem(lastTagged("done"), entry.missing_outputs.join(","));
    case "needs-resume":
      return attentionItem(member.name, flag, entry.pending, Date.parse(facts.pending[0].time));
    default: // stalled
      return attentionItem(member.name, flag, [entry.last_post_seq ?? member.added_seq],
        facts.activityMs);
  }
}

function describeMember(member, context) {
  const { records, rootDir, nowMs, staleMinutes } = context;
  const facts = memberFacts(member, context);
  const lastOwn = facts.own.at(-1);
  const stop = member.removed ? null : stopAfterLastPost(member, lastOwn, records);
  const until = standbyUntil(member, lastOwn, stop, nowMs);
  const entry = {
    name: member.name,
    role: member.role,
    groups: member.groups ?? [],
    state: member.removed ? "removed" : lifecycleState(facts.own),
    reachable: until !== null,
    standby_until: until,
    stopped_seq: stop?.seq ?? null,
    last_post_seq: lastOwn?.seq ?? null,
    last_post_tag: lastOwn?.tag ?? null,
    idle_minutes: Math.max(0, Math.floor((nowMs - facts.activityMs) / MINUTE_MS)),
    scan_truncated: facts.scans.some((scan) => scan.truncated),
    pending: facts.pending.map((record) => record.seq),
    unserved_minutes: unservedMinutes(facts.pending, nowMs),
    outputs: [...member.outputs],
    missing_outputs: missingOutputs(rootDir, member.outputs),
  };
  entry.flags = member.removed ? [] : memberFlags(entry, staleMinutes);
  const attention = entry.flags.map((flag) => memberAttention(member, entry, facts, flag));
  return { entry, attention };
}

// 待答复：成员发给 coordinator（或 all）的 done、blocked、stall，之后 coordinator 还没有
// 给该成员（直接、经组或 all）发过消息。coordinator 发给别人的消息不算答复；group 发出的
// 名单变更通知（带 control 的记录）也不算答复。
function unansweredRecords(records) {
  const answered = new Set();
  let broadcast = false;
  const result = [];
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    if (record.from === COORDINATOR) {
      if (record.control) continue;
      record.to.forEach((name) => answered.add(name));
      broadcast ||= record.to.includes(BROADCAST);
      continue;
    }
    if (!COORDINATOR_ACTION_TAGS.includes(record.tag)) continue;
    if (!isAddressedTo(record, COORDINATOR)) continue;
    if (broadcast || answered.has(record.from)) continue;
    result.unshift(record);
  }
  return result;
}

function describeCoordinator(records, nowMs, staleMinutes) {
  const lastSeq = records.filter((record) => record.from === COORDINATOR).at(-1)?.seq ?? 0;
  const unanswered = unansweredRecords(records);
  const oldestMs = unanswered.length > 0 ? Date.parse(unanswered[0].time) : nowMs;
  const waitingMinutes = Math.floor((nowMs - oldestMs) / MINUTE_MS);
  const coordinator = {
    last_post_seq: lastSeq,
    unanswered: unanswered.map((record) => record.seq),
    flags: unanswered.length > 0 && waitingMinutes >= staleMinutes ? ["unanswered"] : [],
  };
  const attention = coordinator.flags.map(
    (flag) => attentionItem(COORDINATOR, flag, coordinator.unanswered, oldestMs),
  );
  return { coordinator, attention };
}

// 收尾：coordinator 最近一条 done、brief、fix、resume 是发给 all 的 done。
// 收尾之后再派活（含 add 自动发的 brief）即重新打开。
function isFinished(records) {
  const last = records.filter(
    (record) => record.from === COORDINATOR &&
      (record.tag === "done" || MEMBER_ACTION_TAGS.includes(record.tag)),
  ).at(-1);
  return last?.tag === "done" && last.to.includes(BROADCAST);
}

function swarmState(records, members, attention) {
  if (isFinished(records)) return "finished";
  if (attention.length > 0) return "attention";
  const working = members.some(
    (entry) => entry.role !== "monitor" && WORKING_STATES.includes(entry.state),
  );
  // 没有人在干活、也没有待处理的异常：swarm 在等 coordinator 派活或收尾。
  return working ? "running" : "idle";
}

// 按 ATTENTION_ACTIONS 的标记顺序排序；排序是稳定的，同一标记内保持收集顺序
// （成员按名单顺序，coordinator 在后）。
function sortAttention(items) {
  return items.sort(
    (left, right) => ATTENTION_ORDER.indexOf(left.flag) - ATTENTION_ORDER.indexOf(right.flag),
  );
}

function summarizeGroups(roster) {
  const archived = archivedGroups(roster);
  const groups = new Map();
  for (const member of roster.members) {
    if (member.removed) continue;
    for (const group of member.groups ?? []) {
      groups.set(group, [...(groups.get(group) ?? []), member.name]);
    }
  }
  return [...groups].map(([name, members]) => ({
    name, members, archived: archived.includes(name),
  }));
}

export function deriveStatus({ roster, records, rootDir, now, staleMinutes }) {
  const nowMs = now.getTime();
  const context = { records, rootDir, nowMs, staleMinutes };
  const described = roster.members.map((member) => describeMember(member, context));
  const members = described.map(({ entry }) => entry);
  const { coordinator, attention: coordinatorItems } =
    describeCoordinator(records, nowMs, staleMinutes);
  const attention = [...described.flatMap((item) => item.attention), ...coordinatorItems];
  const last = records.at(-1);
  const quietMinutes = last ? Math.floor((nowMs - Date.parse(last.time)) / MINUTE_MS) : 0;
  let state = swarmState(records, members, attention);
  // 没有人在干活，且已超过阈值没有任何新消息：swarm 在等 coordinator，记为异常，
  // monitor 据此报警。阈值内的 idle 是 coordinator 处理回报的正常空档。
  if (state === "idle" && quietMinutes >= staleMinutes) {
    coordinator.flags.push("idle");
    attention.push(attentionItem(COORDINATOR, "idle", [last.seq], Date.parse(last.time)));
    state = "attention";
  }
  return {
    title: roster.title,
    head_seq: last?.seq ?? 0,
    stale_minutes: staleMinutes,
    quiet_minutes: Math.max(0, quietMinutes),
    state,
    coordinator,
    // 收尾后不再列待处理事项：attention 非空当且仅当状态为 attention。
    attention: state === "finished" ? [] : sortAttention(attention),
    groups: summarizeGroups(roster),
    members,
  };
}
