# 消息板协议（Board Protocol）

执行到工作流第 2 至第 8 步、需要查看运行目录格式、组、标签含义或状态推导规则时加载。
真相源是 `<skill-root>/scripts/swarm-board.mjs` 与 `scripts/lib/`；本页与代码不一致时
以代码和 `--help` 为准。总览（`overview`）与计划文件（`plan.json`）的格式见
`references/overview-and-plan.md`。

## 1. 运行目录

一次 swarm 运行对应一个运行目录，由 `init` 建立：

| 文件 | 写入者 | 内容 |
| --- | --- | --- |
| `board.jsonl` | 只经 CLI 追加 | 消息板，一行一条记录 |
| `members.json` | 只经 CLI 替换 | 成员名单 |
| `briefs.md` | coordinator | 公开派发书（模板 `templates/briefs.md.tpl`） |
| `acceptance.md` | coordinator 照录用户或 spec 原文 | 验收口径，verifier 依据它核对 |
| `plan.json` | coordinator，可选 | 目标与工作线，`overview` 按它分节 |
| `board.md` | 收尾时由 `read --format md` 导出 | 人类可读的消息板快照 |
| `overview.md` | 收尾时由 `overview --out` 导出 | 给人看的总览快照 |

- `board.jsonl` 与 `members.json` 不手工编辑。
- 成员只写自己 `owns` 下的路径，并经 CLI 发消息。monitor 巡检时把总览写在自己的 `owns` 下。
- 临时脚本写系统临时目录，不写进运行目录。

写入的一致性：

- 两份文件的写入都在同一把目录锁内完成。同一操作要写两份文件时（`add`、`remove`、
  `group`、`assign`），先追加消息、后写名单：中途崩溃只留下一条无人认领的消息，重做该操作即可。
- `init` 最后写 `members.json`，它是“已初始化”的标志。`init` 中途中断时直接重跑；已有的
  `board.jsonl` 不会被截断。
- 追加中途崩溃会在 `board.jsonl` 末尾留下没有换行的半行：读取时跳过，下一次追加前截掉。
  文件中间出现非法行才是真正的损坏，读命令报错退出 1。
- 持锁只覆盖一次读写，是毫秒级的。超过 5 秒的锁视为崩溃遗留并回收；等待锁的上限约 10 秒。
- `overview --out` 先写 `<path>.tmp` 再改名，读者不会读到写了一半的总览。

## 2. 记录格式

`board.jsonl` 每行一个 JSON 对象：

```json
{"seq":7,"time":"2026-11-19T05:23:31-05:00","from":"repo-fit","to":["coordinator"],"tag":"done","text":"产出 01、02、sources；推荐 (a)"}
```

| 字段 | 含义 |
| --- | --- |
| `seq` | 单调递增序号；写入时在目录锁内取最后一条加 1，并发写入也唯一且连续 |
| `time` | 本地时间，带时区偏移 |
| `from` | `coordinator` 或在册成员名 |
| `to` | 展开后的收件人：成员名、`all`（广播）或 `coordinator`（主控） |
| `addressed` | 只在用了组名时出现：发送时的原写法，组名前加 `#`，例如 `["#parser"]` |
| `tag` | 见第 5 节 |
| `until` | 只在 `standby` 记录中出现：待命截止时间 |
| `control` | 只在 `group` 与 `assign` 发出的 coordinator `note` 中出现。`group`：`{"op": "join"\|"leave"\|"archive", "group": "<组>"}`；`assign`：`{"op": "assign", "member": "<成员>", "owns": [...], "outputs": [...]}`。带它的记录是名单变更通知，不核销任何成员的待答复，也不计入总览的里程碑 |
| `text` | 正文，不超过 2000 字符；细节写进产出文件，正文只写结论与文件名 |

引用别人的消息写 `#seq`，不转述别人的报告内容。同一秒可能写入多条消息，时间戳不能唯一
引用。正文中以 `Screenshot: <path> | <caption>` 开头的行会被 `overview` 收进“截图”一节。

## 3. 成员名单

`members.json` 的 schema 为 `agent-swarm-members-v1`，记录名单与项目根：

- `root`：项目根相对运行目录的路径，名单里不出现本机绝对路径。
- `archived_groups`：已归档的组名（字符串数组），可省，缺省视为空，见第 4 节。
- `members[]`：每个成员有以下字段：
  - `name`、`role`（`worker` / `verifier` / `monitor`）；
  - `groups`：所属的组，见第 4 节；
  - `owns`：负责的文件或目录，相对项目根，用于活动判定与所有权划分；
  - `outputs`：应交付的文件，`done` 后核对；
  - `added_seq`：派发消息的序号；
  - `removed`：是否已移除。

可省字段缺省时按空处理，没有这些字段的名单照常读写。

规则：

- **加入成员只用 `add`。** 它在同一把锁内登记名单，并为每个新成员发出一条
  `coordinator @<name> [brief]`。不在板上用自由文本宣布名单。2026-11-19 的实操中，
  monitor 靠解析自由文本名单巡检，连续两轮漏掉了中途加入的成员。
- **名字不复用。** 移除后名字仍被占用，替换者取 `<name>-2`、`<name>-3`。
- **路径。** `owns` 与 `outputs` 须为项目根内的相对路径。monitor 必须带 `--owns`：它的巡检
  记录写在那里，也是它的活动来源。
- **`owns` 写什么。** 写成员要改的文件或目录：成片改一个目录时写目录，散在几处时逐个写
  文件。它决定活动判定扫描哪里，也是“每块只有一个所有者”的登记；不限制成员读别处。
- **登记后调整负责范围只用 `assign`**（`assign --dir <run-dir> --name <成员>
  [--owns <path>]... [--output <path>]...`，至少一个路径）：
  - 路径加到该成员名下；同一路径（按项目根内的位置比较，`./a` 与 `a` 相同）原来登记在
    其他在册成员名下时随之移走。
  - 锁内先追加一条 coordinator 的 `note`，发给新旧所有者，正文如
    `负责范围调整：负责 src/a.ts 由 shell 交给 sidebar`，带 `control`（第 2 节），再写名单。
  - 这条 `note` 不计入待处理，也不唤醒待命成员：要新所有者接手干活，另发 `brief` 或
    `fix`。只转交已完成或待命中的成员的路径；运行中的成员先等它发 `done`。
  - 成员不在册（含已移除）、路径越出项目根、没有路径退出 2；路径已在该成员名下、或会让
    monitor 失去全部 `owns` 退出 1，失败时不写名单、不发消息。
  - 2026-11-19 的一次真实项目运行中，作者拆出了派发书没列的文件，又有作者结束后其文件转给
    仍在待命的作者，名单都无法同步。
- **保留名。** `all` 与 `coordinator` 不能作成员名或组名。名字须小写字母开头，只含小写字母、
  数字与连字符，不超过 32 字符。

## 4. 组

组是一组成员的名字，可以用来寻址。组名与成员名共用一套名字：组名不能是已有成员名，新成员
名也不能是已有组名。

**形成组：**

- **批量登记的同构成员。** `add --name reviewer --count 3` 登记 `reviewer-1` 到 `reviewer-3`，
  三人都归入组 `reviewer`。`--owns`、`--output` 与 `--text` 中的 `{i}` 换成各自的序号；
  不带 `--count` 时出现 `{i}` 是用法错误。一次最多 20 个，带序号后的名字仍须不超过 32 字符。
- **只登记本批能启动的成员。** 登记即派发，未启动的成员 12 分钟后会被判 `stalled`。并行位
  不够时分批 `add`，后到的成员用 `--name <name>-<序号> --group <组>` 补登。
- **工作区。** `add --group parser` 让成员加入组 `parser`。一个成员可以属于多个组。

**加入、退出与归档**（`group --dir <run-dir> --name <组> (--join <m1,m2> | --leave <m1,m2> |
--archive)`）：三个操作每次恰好一个，否则退出 2。只由 coordinator 运行；每个操作都在锁内
先追加一条 coordinator 的 `note`，再写名单。

| 操作 | 条件 | 效果 |
| --- | --- | --- |
| `--join <m1,m2>` | 组名合法、不是成员名、未归档；各成员在册且尚不在该组 | 组不存在时即新建；`note` 发给这些成员，正文 `加入组 #<组>` |
| `--leave <m1,m2>` | 各成员都在该组中 | `note` 发给这些成员，正文 `退出组 #<组>` |
| `--archive` | 组有在册成员且未归档 | 组名记入名单的 `archived_groups`；`note` 发给组内在册成员，`addressed` 为 `["#<组>"]`，正文 `组 #<组> 已归档，不再接收消息` |

- 未知成员或组、名字冲突退出 2；重复加入、成员已在组外、组已归档退出 1。
- 这些 `note` 只是告知：不计入待处理，也不唤醒待命成员。需要成员补读区内历史或开始新工作
  时，另发 `brief`，成员用 `read --group <组>` 补读。
- 这些 `note` 带 `control` 字段（第 2 节），是名单变更通知，不核销成员的待答复（第 5 节）：
  调整组不影响回报的处理。

归档之后：

- `post --to <组>` 与 `add --group <组>` 退出 2，信息含“已归档”。
- `read --group <组>` 照常读取历史，`remove --name <组>` 照常移除组内成员。
- 成员的 `groups` 字段保留该组。`status` 的 `groups` 中该组的 `archived` 为真，文本输出为
  `组 <name>（已归档）: …`。
- 区结束时，先给组内没有其他工作的成员发 `stop`（都没有时可以发给整个组），再归档：归档后
  不能再发给该组。成员同时属于其他组时，发给组的 `stop` 也会结束它在别处的工作。

寻址与读取：

- `post --to parser` 发给组内全部在册成员。记录的 `to` 存展开后的成员名，`addressed` 存
  `#parser`；之后才加入该组的成员收不到这条消息。
- `read --group parser` 读发给该组的历史消息。新加入某区的成员，用它补读之前的区内消息。
- `read --for <name>` 与 `wait --for <name>` 包含发给该成员所在组的消息。
- 收件判定只有一条口径，`read`、`wait`、`watch` 与状态推导共用：发给本人（含经组展开）或
  `all` 的消息都算，自己发的不算；成员加入之前发给 `all` 的消息也不算，与组消息只发给当时
  在册成员一致。
- `remove --name parser` 移除组内全部在册成员，名字仍被占用。

与 agy 看板 channel 的对应：

| agy | 本协议 |
| --- | --- |
| 一个工作区一个 channel，如 `#parser` | 一个工作区一个组，如 `parser` |
| `@#parser` 唤醒订阅该区的成员 | `--to parser` 发给组内成员；行动标签唤醒其中的待命成员 |
| `main` 放跨区内容 | 跨区内容发给 `coordinator`、具体成员或 `all` |
| `@<name>` 叫整个编号组 | `--to reviewer` 叫 `reviewer-1..n` |
| 订阅、退订 | `group --join`、`group --leave`；之前的区内消息用 `read --group` 补读 |
| 归档 channel | `group --archive`：不再接收消息，也不能再加人；历史照常可读 |
| worker 点名同伴并唤醒对方 | 派发书允许时发 `handoff`（第 5 节），计入对方的待处理 |

区内消息发给组，不发给 `all`：发给 `all` 的消息会唤醒每个待命成员。

## 5. 标签

| 标签 | 谁发 | 含义 | 需要谁处理 |
| --- | --- | --- | --- |
| `brief` | coordinator（`add` 自动发；追加任务时手动发） | 派发 | 收件成员 |
| `start` | 成员 | 开始，或读到待处理消息、被唤醒、续接后重新开始 | — |
| `progress` | 成员 | 完成一个产出文件 | — |
| `done` | 成员，发给 coordinator 或 `all`；coordinator 只能发给 `all`，表示整个 swarm 收尾 | 完成 | coordinator |
| `blocked` | 成员，发给 coordinator 或 `all` | 受阻，正文写原因 | coordinator |
| `standby` | 成员，须带 `--minutes`（1 到 120） | 完成后待命，截止时间记在 `until` | — |
| `fix` | coordinator；verifier（派发书允许直接交接时） | 退回修正，正文写修正项的 `#seq` 或文件位置 | 收件成员 |
| `handoff` | worker、verifier（派发书允许直接交接时） | 把下一步工作直接交给同伴，正文写对方要做什么与依据的 `#seq` 或文件 | 收件成员 |
| `accept` | coordinator | 验收通过 | — |
| `stall` | monitor，收件人须含 coordinator 或 `all` | 停滞报警，正文逐项写待处理事项；发出后 monitor 的状态不变 | coordinator |
| `stop` | coordinator；`remove` 也会发 | 要求成员收尾结束 | — |
| `resume` | coordinator | 要求已结束的成员继续 | 收件成员 |
| `note` | 任何人 | 告知，不要求行动 | — |

`post` 按“谁发”一列的角色校验发送者，不符时退出 2；括号里的条件（如“派发书允许直接交接
时”）由派发书约束，CLI 不校验。“需要谁处理”一列决定状态推导中的待处理与
待答复，也决定 `watch` 输出哪些消息：

- **成员的待处理**：该成员最近一次 `start` 之后发给它的 `brief`、`fix`、`resume`、`handoff`
  （没有发过 `start` 时从派发消息之后算起）。`start` 是“已读到并开始处理”的唯一凭据；
  `progress`、`done`、`standby` 等其他发言都不清除待处理。
- **coordinator 的待答复**：成员发给 coordinator 或 `all` 的 `done`、`blocked`、`stall`，之后
  coordinator 还没有给该成员（直接、经组或 `all`）发过消息。coordinator 发给别的成员的
  消息不算答复，`add` 为别人自动发的 `brief` 也不算，带 `control` 的 coordinator 记录
  （`group` 与 `assign` 的名单变更通知）也不算。抄送 coordinator 的 `handoff` 与
  `fix` 只留记录，不进入待答复，`watch --for coordinator` 也不输出它们。

**`handoff` 的收件人：** 须点名至少一个其他成员或组，可以同时抄送 coordinator；不接受 `all`，
也不能只发给 coordinator，不符时退出 2。coordinator 不发 `handoff`，派活仍用 `brief`。`handoff` 与
`brief` 一样计入收件成员的待处理与 `needs-resume`，唤醒待命成员，并受 `done` 的拒绝门约束：
收件成员先发 `start`，才能发 `done`。

**成员的状态转移**（`post` 校验，不符时退出 2）：

| 标签 | 允许的当前状态 | 转移后 |
| --- | --- | --- |
| `start` | 任何（`briefed`、`active`、`done`、`blocked`） | `active` |
| `progress` | `active` | `active` |
| `done` | `active` | `done` |
| `blocked` | `briefed`、`active` | `blocked` |
| `standby` | `done` | 不变 |
| `stall`（monitor） | `active` | 不变 |
| `handoff`（worker、verifier） | `active`、`done` | 不变 |
| `note`、`fix`（verifier） | 任何 | 不变 |

被唤醒或续接后必须先发 `start` 再发 `done`：这既是转移规则，也让待处理与实际处理一致。
成员还有待处理消息时，`post` 也不接受它的 `done`，错误信息列出这些 `#seq`：先发 `start`
处理，再发 `done`。2026-11-19 的前向验证中，成员读到 `brief` 后没有处理就发了 `done`。

## 6. 状态推导

`status` 不读任何存盘状态，只从记录、名单与文件推导。

**成员状态**取该成员自己最后一个生命周期标签：

- `start` / `progress` → `active`；
- `done` → `done`；
- `blocked` → `blocked`；
- 没发过 → `briefed`；
- 已移除 → `removed`。

`standby`、`stall`、`handoff`、`note` 不改变状态：待命成员的状态仍是 `done`；monitor 发
`stall` 后仍是 `active`，继续巡检。

**待命：** 成员最后一条消息是 `standby`、还没到 `until`，且之后没有收到 `stop` 或
coordinator 的收尾 `done` 时：

- `reachable` 为真，`standby_until` 为截止时间；
- 这样的成员，板上发给它的消息会把它唤醒，不需要宿主续接。

**已停止：** 成员最后一次发言（没有时为派发）之后，coordinator 发给它过 `stop` 或收尾
`done` 时，`stopped_seq` 为其中第一条的序号（让它结束的那条），否则为 `null`。worker 与
verifier 收到后直接结束运行、不再发言，所以“已结束”只能从这条记录推出：文本输出显示
`stopped=#<seq>`，总览的状态列显示 `已停止 #<seq>`，成员不再判 `stalled`。成员之后再发言
即清除。

**活动时间**取以下三者中最晚的一个。只看是否发帖，会把埋头写文件的成员误判为停滞。

- 成员最后一条消息的时间；
- 派发时间；
- `owns` 下最新的文件或子目录修改时间。按层广度遍历，最多 4 层、共 2000 项、单个目录
  500 项，跳过 `node_modules`、`.git`；条目数触到上限时 `scan_truncated` 为真（文本输出
  显示 `scan=truncated`），这时活动时间可能偏早。

**成员标记：**

| 标记 | 条件 |
| --- | --- |
| `stalled` | 状态 `briefed` 或 `active`，`stopped_seq` 为 `null`，且空闲分钟数 ≥ 阈值（默认 12） |
| `blocked` | 状态 `blocked` |
| `incomplete-outputs` | 状态 `done`，且 `outputs` 中有文件缺失或为空 |
| `needs-resume` | 有待处理消息，且最早一条发出后已超过阈值，成员仍没有发 `start`。待命成员本该秒级醒来，运行中的成员本该在下一次 `progress` 前读到，已结束的成员要由 coordinator 续接送达 |

**coordinator 标记：**

| 标记 | 条件 |
| --- | --- |
| `unanswered` | 有待答复消息，且最早一条已超过阈值 |
| `idle` | 没有人在干活（推导出的 swarm 状态为 `idle`），且距最后一条消息已超过阈值 |

`quiet_minutes` 是距最后一条消息的分钟数。阈值内的 `idle` 是 coordinator 处理回报的正常
空档，不算异常。

**待处理事项（`attention`）：** 顶层数组，把上面的标记展开成可以逐项处理的事项。每个成员
标记与 coordinator 标记各生成一项，已移除的成员不产生事项。每项写明归属（`subject`）与给
coordinator 的处理建议；monitor 按它报警，coordinator 按它处理。

| 字段 | 含义 |
| --- | --- |
| `id` | `<subject>:<flag>`，如 `shard-2:needs-resume`、`coordinator:unanswered`；同一情况在多次推导中 id 不变 |
| `subject` | 成员名或 `coordinator` |
| `flag` | `blocked`、`needs-resume`、`unanswered`、`stalled`、`incomplete-outputs`、`idle` |
| `refs` | 相关序号数组，见下表 |
| `since` | 该情况开始的时间，本地时间带时区偏移 |
| `detail` | 只有 `incomplete-outputs` 有：缺失的路径，逗号分隔；其余为 `null` |
| `action` | 给 coordinator 的处理建议，见下表 |

| flag | refs | since | action |
| --- | --- | --- | --- |
| `blocked` | 该成员最后一条 `blocked` | 该记录时间 | 读受阻原因，补输入、改派或发 stop |
| `needs-resume` | 该成员的 `pending` | 最早一条待处理的时间 | 成员没有读到这些消息：已结束的续接送达或改派，运行中的等它读板 |
| `unanswered` | coordinator 的 `unanswered` | 最早一条的时间 | 答复这些回报：accept、fix、brief 或 note |
| `stalled` | 成员最后一条自己的消息，没有时为 `added_seq` | 活动时间 | 成员没有活动：确认它在宿主中是否仍在运行，必要时改派 |
| `incomplete-outputs` | 成员最后一条 `done` | 该记录时间 | 产出缺失或为空：发 fix，或核对 outputs 登记 |
| `idle` | `[head_seq]` | 最后一条消息的时间 | 无人干活且超过阈值没有新消息：派活、收尾或发 stop |

排序：按上表 flag 的顺序；同一 flag 内按名单顺序，coordinator 的事项排在同一 flag 的成员
之后。`status` 的文本输出在成员行与组行之后，有事项时追加：

```text
待处理事项：
- shard-2:needs-resume #16 自 2026-11-19T08:02:12-05:00：成员没有读到这些消息：…
- shard-1:incomplete-outputs #12 自 …：src/a.md；产出缺失或为空：…
```

多个 refs 以空格分隔；有 `detail` 时写在 action 之前，以“；”分隔。

**组汇总：** `groups` 列出每个组、其在册成员与 `archived`（布尔）。

**swarm 状态**（按表中顺序判定）：

| 状态 | 条件 |
| --- | --- |
| `finished` | coordinator 最近一条 `done`、`brief`、`fix`、`resume` 是发给 `all` 的 `done`；收尾后再派活（含 `add`）即重新打开 |
| `attention` | `attention` 非空 |
| `running` | 有非 monitor 成员处于 `briefed` 或 `active` |
| `idle` | 以上都不是：没有人在干活，swarm 在等 coordinator 派活或收尾 |

## 7. 读取、等待与 watch

- `--for <name>` 须是 `coordinator` 或名单里的成员，否则退出 2；`wait`、`watch` 也不接受已
  移除的成员。拼错的名字会让等待永远静默。
- `read --since <seq>`：读取增量。`--for <name>` 按第 4 节的收件判定过滤；`--group <组名>`
  只看发给该组的消息；`--tags <标签,..>` 只看这些标签；`--format md` 每条一行，供导出。
- `wait --since <seq> [--for <name>] [--tags <标签,..>] [--until <time>] --timeout-seconds <n>`：
  有界等待。
  - 每隔 `--interval-seconds`（默认 5）检查一次，出现符合条件的新消息立即返回。不带 `--for`
    时任何新消息都返回：monitor 休眠时这样用。
  - 超时返回 `timed_out: true`，退出码仍为 0。到 `--until` 时提前返回，`deadline_reached`
    为真。`--until` 须带时区偏移。
  - 上限 590 秒，可以放进宿主单次 600 秒的命令时限。
  - monitor 用它作巡检节拍与休眠，待命成员用它等点名，都不需要 shell 的 `sleep`。
- `watch --for <name> [--since <seq>] [--timeout-seconds <n>]`：逐行输出发给 `<name>`、
  且需要它处理的新消息（第 5 节）：coordinator 是 `done`、`blocked`、`stall`，成员是
  `brief`、`fix`、`resume`、`handoff`。
  - 默认从 `<name>` 最后一次发言之后开始：挂上之前到达、还没处理的消息也会输出。会话
    重启后不带 `--since` 重新挂上，就能补上期间到达的消息。
  - 到时输出一行“继续监视时加 `--since <seq>`”后以 0 退出。默认 1790 秒，最大 1800 秒。
  - 宿主的事件监视把每行变成一条通知。只输出需要处理的消息，避免通知过多被宿主停掉。
  - 不支持 `--json`。
- `overview --dir <run-dir> [--out <path>] [--stale-minutes <n>] [--now <time>]`：按
  `status` 的推导与 `plan.json` 生成 Markdown 总览，见 `references/overview-and-plan.md`。
- `--now <time>` 只用于 `status` 与 `overview`，供测试与复现指定当前时间。

## 8. 退出码

| 退出码 | 含义 | 例子 |
| --- | --- | --- |
| 0 | 成功 | 包括 `wait` 超时、`watch` 到时、`status` 报出待处理事项 |
| 1 | 失败 | 重复 `init`、`add` 时成员或组重名、锁等待超时（约 10 秒）、消息板中间有非法行、`group` 重复加入或成员已在组外或组已归档、`assign` 的路径已在该成员名下或会让 monitor 失去全部 `owns`、`plan.json` 校验失败、`overview --out` 的父目录不存在 |
| 2 | 用法错误 | 缺选项、未知子命令、未知成员或组、未知标签、非法名字、`standby` 缺 `--minutes`、`watch --json`、发送者无权发该标签、非法状态转移、收件人不合标签要求（如 `handoff` 发给 `all` 或只发给 coordinator）、`--for` 不在名单、时间不带时区偏移、`--now` 用于 `status` 与 `overview` 以外的命令、`group` 不是恰好一个操作或组名与成员名冲突、`assign` 没有路径或成员不在册、`post --to` 或 `add --group` 写了已归档的组 |
| 3 | 未就绪 | 运行目录未初始化 |

## 9. 没有 Node 时的降级

宿主没有 Node.js 18.3 或更新版本时，用一个 Markdown 文件作消息板：

- 每条消息一行：`- #<seq> <时间> <from> @<to> [<tag>] <正文>`。
- 序号由 coordinator 分配：每个成员的派发书里给出它可用的序号段（例如 `#100–#199`）。
- 名单与组写在 `briefs.md` 开头的表格里，只由 coordinator 修改；组的加入、退出与归档也改
  这张表。
- 停滞判定按第 6 节的规则人工执行；不提供待命、`watch` 与 `overview`。

这种方式没有锁，也没有自动推导，只适合不超过 4 个成员的运行。
