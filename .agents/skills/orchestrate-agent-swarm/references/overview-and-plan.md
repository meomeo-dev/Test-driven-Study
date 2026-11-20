# 总览与计划文件（Overview and Plan）

执行到工作流第 4 步写计划文件、第 6 与第 8 步向用户汇报进度时加载；monitor 每次巡检按
本页写总览。真相源是 `<skill-root>/scripts/lib/board-overview.mjs` 与 `--help`；本页与代码
不一致时以代码为准。

总览（overview）是给人看的一页 Markdown：目标、待处理事项、各工作线的成员进度、里程碑与
截图。它由 `overview` 从消息板、名单与可选的计划文件直接生成，不另存状态。

## 1. 计划文件（`plan.json`）

`<run-dir>/plan.json` 记录目标与工作线（thread），`overview` 按它分节。没有计划文件时，
`overview` 按组分节。

- 由 coordinator 在登记成员之后写；改派、调整分工、调整计划引用的组或登记下一期成员之后
  重写。计划引用的组被 `group --leave` 清空后，校验失败，`overview` 退出 1。
- `members` 只能引用名单里已有的名字，所以先 `add`，再写或重写计划。
- thread 的划分宜与派发书的各节对应；成员不改这个文件。

格式：

```json
{"schema": "agent-swarm-plan-v1",
 "goal": {"title": "补齐四项差距", "line": "代码与文档并行，之后核对"},
 "threads": [{"id": "t-code", "title": "代码", "goal": "实现 CLI 变更", "members": ["code"]}]}
```

| 字段 | 要求 |
| --- | --- |
| `schema` | 等于 `agent-swarm-plan-v1` |
| `goal.title` | 1 到 60 字符；总览的标题 |
| `goal.line` | 可省，不超过 80 字符；标题下的一句话 |
| `threads` | 1 到 6 项；每项一条工作线，总览中各占一节 |
| `threads[].id` | 匹配 `^t-[a-z0-9-]{1,30}$`，在文件内唯一 |
| `threads[].title` | 1 到 30 字符 |
| `threads[].goal` | 可省，不超过 60 字符 |
| `threads[].members` | 非空；每项是名单中的成员名（含已移除）或组名。组展开后，同一成员最多出现在一个 thread 中 |

校验失败时 `overview` 退出 1，信息写出字段路径，如 `threads[1].id`。文件不存在不算错误。

## 2. `overview` 子命令

```text
node <skill-root>/scripts/swarm-board.mjs overview --dir <run-dir> [--out <path>]
    [--stale-minutes <n>] [--now <time>] [--json]
```

- 推导与 `status` 相同（同一阈值、同一 `attention`），再读 `plan.json`。
- 无 `--out`：把 Markdown 打印到标准输出。
- 有 `--out`：先写 `<path>.tmp`，再改名为 `<path>`；父目录不存在时退出 1。成功时打印
  `已写入 <path>`。
- `--json`：输出 `{"path": <path 或 null>, "markdown": "<全文>"}`。
- `--now`：指定当前时间（带时区偏移），供测试与复现；只有 `status` 与 `overview` 接受它。

用法：

- monitor 每次巡检写 `<monitor 的 owns>/overview.md`，coordinator 与用户随时可读。
- coordinator 向用户汇报进度时引用这份总览，或运行一次 `overview` 打印。
- 收尾时导出到 `<run-dir>/overview.md`，与 `board.md` 放在一起。

## 3. Markdown 结构

标题与顺序固定：

```text
# <plan.goal.title，没有计划时为 status.title>

<plan.goal.line；没有时省略这一段>

状态：<state>（head #<head_seq>，距最后一条消息 <quiet_minutes>m，生成于 <now>）

## 待处理

- <id> #<refs> 自 <since>：<action>
（没有事项时只写一行“无”）

## <thread.title> — <thread.goal>
（每个 thread 一节，没有 goal 时只写 title；没有计划时每个组一节，标题“组 <name>”，已归档的
组加“（已归档）”；不在任何 thread 或组中的成员归入最后一节“其他成员”，没有则省略）

| 成员 | 角色 | 状态 | 最近消息 | 待处理 | 产出 |
| --- | --- | --- | --- | --- | --- |
| shard-1 | worker | done，待命至 08:12 | #12 done：<正文前 60 字> | - | 1/1 |

## 里程碑

- #<seq> <from> [<tag>] → <收件人>：<正文前 80 字>
（`done` 与 `accept` 记录，按序号升序，最多最近 20 条；没有时只写“无”）

## 截图

- ![<caption>](<path>) #<seq> <from>
（从正文中以 `Screenshot: <path> | <caption>` 开头的行提取，按序号升序；没有截图时省略整节）
```

成员表各列：

| 列 | 内容 |
| --- | --- |
| 成员、角色 | 名单中的 `name`、`role` |
| 状态 | 成员 `state`；待命中（`reachable`）时加“，待命至 HH:MM”，取 `standby_until` 的时分；否则已发 `stop` 或收尾 `done`（`stopped_seq` 非空）时加“，已停止 #<seq>” |
| 最近消息 | 成员最后一条自己的消息：`#seq tag：正文前 60 字`；没有时 `-` |
| 待处理 | `pending` 写成 `#a #b`；没有时 `-` |
| 产出 | `已交付数/登记数`，已交付指文件存在且非空；没有登记 `outputs` 时 `-` |

文本规则：

- 待处理一节的 `#<refs>` 与 `status` 文本输出相同，多个序号以空格分隔。
- 里程碑只取 `done` 与 `accept`；`group` 与 `assign` 发出的名单变更通知（带 `control` 的 `note`）
  不计入。
  收件人取 `addressed`（有时）或 `to`，各加 `@`，空格分隔。
- 截断按字符计，截断处加 `…`；单元格中的 `|` 转义为 `\|`，换行换成空格。
- 截图：成员要在总览里展示截图时，在消息正文中单独写一行
  `Screenshot: <path> | <caption>`；`<path>` 原样写进图片链接。
