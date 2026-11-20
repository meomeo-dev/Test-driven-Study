---
name: orchestrate-agent-swarm
description: >-
  当一项任务能拆成多块互不冲突、可以同时推进的工作，或需要另一组代理核对前一组的产出，且
  宿主能在后台运行子代理、在其结束时通知主会话并续接它（如 Claude Code）时使用：主会话作
  coordinator，只派发、验收与汇总；按文件或问题划定所有权，用公开派发书、可选的计划文件与自带
  的消息板 CLI（序号、成员名单与组、状态与待处理事项、待命与逐行通知、Markdown 总览）协调
  worker、verifier 与 monitor。同构成员可批量登记并按组寻址，组可中途加入、退出与归档，负责
  范围可在登记后调整或转交；成员完成后可待命、点名即醒，派发书允许时可直接交接给同伴；
  coordinator 用宿主的事件监视接收需要处理的消息。verifier 只报告、由作者修正；monitor 定时巡检并写总览，按成员归因、同一停滞限频
  报警，报过仍无动作时休眠。用户说“swarm”“并行派子代理调查”“主控调度加 monitor”时也用它。
  不用于单线程即可完成的小任务、单 provider 代码外包、跨工作单元的 PLAN/TODO 治理，也不用于
  宿主已有原生 swarm 的场合（如 agy 的 /swarm）。
---

# Agent Swarm 编排

本 Skill 让主会话以 coordinator 身份编排一组后台子代理：worker 分块干活，verifier 核对，
monitor 盯停滞。成员通过一个运行目录里的消息板协作。本文是入口索引，细节在 `references/`，
执行到对应步骤再加载。

`<skill-root>` 指本 SKILL.md 所在目录。安装后，本 Skill 只依赖这个目录内的文件，以及 Node.js
18.3 或更新版本。

## 触发与形态

触发：

- 用户要求“swarm”、多个代理并行、主控加 monitor 调度；
- 任务能拆成至少两块可以同时推进、互不写同一文件的工作；
- 任务需要独立的一方核对产出。

不触发：

- 单线程几步就能完成的任务；
- 只有一块工作的任务（直接做，或只派一个子代理）；
- 单 provider 的代码外包；
- 跨工作单元的长程计划治理；
- 宿主自带 swarm 功能的场合。

形态判据：数一数能真正独立推进的块。少于两块，又不需要独立核对时，不用本 Skill。

## 职责边界

- **coordinator（主会话）负责：** 拆分与所有权划分、派发书、计划文件、验收、汇总、与用户
  沟通、按项目规则提交。它不做调查、实现或核对本身。以下属于 coordinator 的工作：为回答用户
  而做的只读快速查阅；拆分前为划定所有权做的只读摸底；阅读和判断成员的产出，包括打开页面或
  运行产物抽查结果；提交前运行项目规定的提交门禁。逐条对照验收口径的核对与完整测试派给
  verifier。
- **成员只写自己 `owns` 下的路径**，并经 CLI 发消息。各角色的规则见
  `references/member-roles.md`。
- **本 Skill 不做的事：** 不启动宿主之外的进程或服务；不推送、不发布；不建 worktree，除非
  用户明确要求；不替成员申请被拒绝的权限。

## 场景到命令

| 场景 | 命令 |
| --- | --- |
| 建运行目录 | `node <skill-root>/scripts/swarm-board.mjs init --dir <run-dir> --root <project-root> --title "<任务名>"` |
| 登记并公开派发成员 | `node <skill-root>/scripts/swarm-board.mjs add --dir <run-dir> --name <name> --role worker --owns <path> --output <file> --text "见 briefs.md 的 <name> 一节"` |
| 把成员放进工作区组 | 在 `add` 上加 `--group <区>`，可重复 |
| 批量登记同构成员 | `node <skill-root>/scripts/swarm-board.mjs add --dir <run-dir> --name reviewer --role verifier --count 3 --output review/{i}.md --text "见 briefs.md 的 reviewer 一节，分片 {i}"` |
| 已登记的成员加入或退出组 | `node <skill-root>/scripts/swarm-board.mjs group --dir <run-dir> --name <区> --join <m1,m2>`（退出用 `--leave <m1,m2>`） |
| 登记后调整或转交负责范围 | `node <skill-root>/scripts/swarm-board.mjs assign --dir <run-dir> --name <新所有者> --owns <path> --output <file>`（原所有者名下的同一路径随之移走） |
| 归档结束的工作区 | 组内成员没有其他工作时先 `post --to <区> --tag stop`，再 `node <skill-root>/scripts/swarm-board.mjs group --dir <run-dir> --name <区> --archive` |
| 发消息（验收、退回、追加任务、收尾） | `node <skill-root>/scripts/swarm-board.mjs post --dir <run-dir> --from coordinator --to <name 或组名> --tag accept --text "<一句>"` |
| 成员直接交接给同伴（派发书允许时） | `node <skill-root>/scripts/swarm-board.mjs post --dir <run-dir> --from <name> --to <同伴>,coordinator --tag handoff --text "<对方要做什么；依据 #seq>"` |
| 接收需要 coordinator 处理的消息 | 用宿主的事件监视挂上 `node <skill-root>/scripts/swarm-board.mjs watch --dir <run-dir> --for coordinator` |
| 看全体状态与待处理事项 | `node <skill-root>/scripts/swarm-board.mjs status --dir <run-dir>` |
| 生成给人看的总览 | `node <skill-root>/scripts/swarm-board.mjs overview --dir <run-dir> --out <path>`（不带 `--out` 时打印） |
| 读增量消息 | `node <skill-root>/scripts/swarm-board.mjs read --dir <run-dir> --since <seq>` |
| monitor 的巡检节拍 | `node <skill-root>/scripts/swarm-board.mjs wait --dir <run-dir> --since <seq> --for <name> --timeout-seconds 180` |
| monitor 休眠时等任何新消息 | `node <skill-root>/scripts/swarm-board.mjs wait --dir <run-dir> --since <“休眠” note 的序号> --timeout-seconds 590`（不带 `--for`） |
| 待命成员等点名 | `node <skill-root>/scripts/swarm-board.mjs wait --dir <run-dir> --for <name> --since <START> --tags brief,fix,resume,handoff,stop --until <UNTIL> --timeout-seconds 590` |
| 移出成员或整组 | `node <skill-root>/scripts/swarm-board.mjs remove --dir <run-dir> --name <name 或组名>` |
| 收尾导出板与总览 | `node <skill-root>/scripts/swarm-board.mjs read --dir <run-dir> --format md > <run-dir>/board.md`；`overview --dir <run-dir> --out <run-dir>/overview.md` |

各子命令的参数与退出码见 `--help`。记录格式、标签、组和状态推导见
`references/board-protocol.md`；总览与计划文件见 `references/overview-and-plan.md`。

## 工作流

> 节点标记：`[自动]` 直接调工具完成；`[主观]` 语义判断，不机械套模板；`[交互]` 与用户澄清；
> `[人工]` 必须由用户操作，只提示不代做。

0. **[主观] 确认宿主。** 宿主须满足三项：子代理能在后台运行；子代理结束时通知主会话；能
   续接已结束的子代理。三项都满足才按本流程执行（Claude Code 满足）。宿主还有事件监视
   （逐行把命令输出推给主会话，如 Claude Code 的 `Monitor`）时，第 4 步挂上 `watch`。
   不满足时按 `references/host-primitives.md` 第 5 节降级。没有 Node 时，按
   `references/board-protocol.md` 第 9 节改用手工消息板。
1. **[主观] 拆分与排期。**
   - 拆分前的摸底由 coordinator 自己做：只读查看目录结构、入口文件、相关测试与构建命令和
     项目规则，够划定所有权即止；不改文件，不跑构建。
   - 按文件、目录或问题划定所有者，每块只有一个。`owns` 写成员要改的文件或目录：成片改一个
     目录时写目录，散在几处时逐个写文件。运行中拆出新文件或转交文件，用 `assign` 调整。
   - 规模：worker 数等于独立块数；每 2 到 4 个作者配 1 个 verifier；每期 1 个 monitor。
   - 同构的分片用 `--count` 批量登记成一个组；两个以上互不相干的工作区，各建一个组。工作区
     中途增减成员用 `group --join`、`--leave`，区结束后先给没有其他工作的组内成员发 `stop`，
     再 `group --archive`；计划引用该组时随之重写 `plan.json`。
   - 预计会有后续任务的成员，派发书写明完成后待命多少分钟；审查类任务的作者默认待命。
     待命中的成员仍占并行位。
   - 并行上限取用户或项目规则，没有规则时为 3，monitor 与待命成员都计入上限。超出的成员
     排进后续各期，到时再 `add`：登记即派发，未启动的成员 12 分钟后会被判停滞。
   - 给 verifier 留位：作者都完成后，只让修正最可能落到的作者待命，给其余作者发 `stop`，
     再派 verifier。上限为 3 时的排法：monitor 加两名作者；派 verifier 前停掉其中一名。
   - 依据：`references/member-roles.md` 第 1 节。
2. **[自动] 建运行目录。**
   - 用户指定了材料位置时用该位置；否则用 `<project-root>/.agents/swarm/<YYYYMMDD>-<slug>/`。
   - 用 `git check-ignore -q <run-dir>` 查它是否被忽略。没被忽略时（例如项目的 `.agents/`
     已入库）照常使用，但不随功能改动提交，收尾时向用户说明位置并询问是否入库；不替用户改
     `.gitignore`。
   - 执行 `init`。
3. **[主观] 写派发书与验收口径。**
   - 按 `templates/briefs.md.tpl` 写 `<run-dir>/briefs.md`：一节通用规则，加每个成员或每个
     组一节。项目规范、禁读路径与环境注意事项从项目规则文件中摘录。
   - 环境注意事项还要写正在运行、会监视文件变化的开发进程（用 `ps` 查看，如 dev server、
     `tauri dev`）：改到哪些路径会触发重建或重启，成员是否要避开。
   - 允许成员之间直接交接时，派发书写明谁可以交给谁、交接什么；没写的交接一律经
     coordinator。
   - 用户或 spec 给出验收要求时，照录原文到 `<run-dir>/acceptance.md`，不改写。coordinator
     从项目规则或代码约束补充的技术口径（最小窗口尺寸、兼容范围、性能下限等），在同一文件
     另起一节「补充口径（coordinator）」，逐条写来源。
4. **[自动] 登记本期成员，挂 watch。**
   - 对本期每个成员先 `add`，登记 `owns`、`output`，以及所属的组。monitor 名为 `monitor`，
     替换者依次为 `monitor-2`、`monitor-3`。
   - 本期成员都登记后，写 `<run-dir>/plan.json`（可选）：目标一句话与各工作线，`overview`
     按它分节。它只能引用已登记的名字；改派、调整分工或登记下一期之后重写。
   - 宿主有事件监视时，在启动成员之前挂上 `watch --for coordinator`：时限取宿主上限（Claude
     Code 为 30 分钟），`watch` 自身的 `--timeout-seconds` 略短于它。`watch` 默认从
     coordinator 最后一次发言之后开始，挂上之前到达的消息也会输出。到时最后一行会给出
     `--since`，带上它重新挂上。
   - 依据：`references/host-primitives.md` 第 2 节；`references/overview-and-plan.md` 第 1 节。
5. **[自动] 启动本期成员与 monitor。**
   - 按 `templates/prompt-<role>.md.tpl` 填好提示词，在同一轮后台启动本期成员与 monitor。
   - 不传 `name`，模型沿用主会话的模型（用户另有要求的除外），不用 worktree 隔离（用户明确
     要求的除外）。
   - monitor 提示词的唤醒方式占位符 `wake_by`：宿主有事件监视时取 `watch`（Claude Code 下的
     默认），monitor 报警后继续巡检；没有时取 `exit`，monitor 报警后结束运行，靠宿主的结束
     通知唤醒 coordinator。
6. **[主观] 主循环。** 每收到一条 `watch` 事件或一次成员结束运行的通知：
   1. 运行 `status`，按“待处理事项”逐项处理（每项给出 `refs` 与处理建议），读相关的
      `done` 消息与产出。
   2. 逐份判断，并在板上回复发件人（只有发给该成员的消息才核销它的待答复，`group` 与
      `assign` 发出的名单变更 `note` 除外）：
      - 接受：发 `accept`；
      - 退回：发 `fix`；
      - 追加任务：发 `brief`；
      - 移交：把空出的并行位交给下一期的成员。
   3. 送达：`status` 显示 `reachable` 的成员（待命中）由板上消息直接唤醒；运行中的成员在
      下一次 `progress` 前读到；已结束的成员要用宿主的续接手段送达，或者改派新成员。成员
      读到后会发 `start`；超过阈值仍没有时，`status` 标 `needs-resume`。成员之间的
      `handoff` 不需要 coordinator 答复，没有被读到时同样标 `needs-resume`。
   4. 待命成员没有后续任务时，发 `stop` 让它结束，腾出并行位。
   5. monitor 报 `stall` 时，在这一轮内处理正文列出的各项，再给该 monitor 发 `note` 写明
      处理结果（核销）。`watch` 模式下 monitor 继续巡检，不派继任。monitor 发 `done` 结束
      运行（巡检到上限、休眠到期、`exit` 模式报警后）时，同样发 `note` 核销；swarm 未收尾
      时派下一任 `monitor-N`。monitor 休眠时发的是 `note`“休眠”，不需要答复。
   6. 用户在运行中追加要求时，按 `references/member-roles.md` 第 1 节“运行中追加要求”处理。
   7. 每轮保持简短。
   - 依据：`references/member-roles.md` 第 1 节“处理回报”。
7. **[主观] 核对与修正。**
   - 作者全部完成后派 verifier，依据 `acceptance.md` 核对；派之前按第 1 步给它腾出并行位。
   - coordinator 把每个作者的修正项合成一条 `fix` 发给作者：作者在待命中时直接唤醒。作者已
     结束时，可以把它的文件 `assign` 给待命中的作者再发 `fix`，否则续接送达。
   - 作者改完后，coordinator 抽查修正是否已落到文件；打开页面或运行产物看结果也属于抽查。
8. **[自动] 收尾。**
   1. 向仍在待命或运行的成员、以及 monitor 发 `stop`（可以发给组；已归档的组逐个点名）。
      worker 与 verifier 收到后直接结束，不再发言，`status` 的 `stopped=#<seq>` 与总览的
      “已停止”标出它们；monitor 写完核对结果再发 `done`。`remove` 只用于放弃成员。
   2. 等 monitor 写完核对结果并发 `done`。
   3. 发 `post --from coordinator --to all --tag done`。
   4. 停掉 `watch`，导出 `board.md` 与 `overview.md`，删除临时文件。
   5. 向用户汇报：结论、材料位置、未验证项。总览可以直接给用户看。
   6. 按项目规则提交：提交前由 coordinator 运行项目规定的提交门禁（如 `pnpm verify`），不另派
      成员。运行目录是否入库，按用户对材料位置的要求决定；用户没有要求时不提交，向用户说明
      位置并询问。

**会话重启或上下文压缩后：** 先运行 `status`，按 `attention`、各成员的 `pending` 与
`reachable` 补做第 6 步；再不带 `--since` 重新挂上 `watch`。续接 ID 已丢失的成员改派
`<name>-2`。依据：`references/member-roles.md` 第 1 节“会话重启或上下文压缩后的恢复”。

## 规则要点

每条都来自真实事件：

- **名单只经 `add` / `remove` / `group` / `assign` 修改，不在板上用自由文本宣布。**
  2026-11-19 的实操中，monitor 靠解析自由文本名单巡检，连续两轮漏掉了中途加入的成员。
- **引用写 `#seq`。** 同一秒常有多条消息，时间戳不能唯一引用。
- **停滞按活动判定，不按发帖判定。** 用户在 agy 中的一次 swarm 里，monitor 把正在工作的成员
  误报为停滞，原因就是只看发帖。
- **验收口径与派发书分开保存。** 同一次运行中，verifier 放行后，用户仍连续发现遗漏。
- **verifier 只报告，作者修正；monitor 不核对内容。** 内容验收由 coordinator 抽查完成。
- **追加任务优先给待命成员，修正项要合并。** 续接已结束的成员会重新载入整段会话：实操中
  每次 13 万到 21 万 tokens，而每次只改了 2 到 10 处。用户在 agy 中的 6 轮运行里，coordinator
  一直点名给已有成员追加任务。
- **成员发 `start` 才算读到消息。** 0.2.0 以成员的任何发言划线，自举审查复现了 `done` 与
  `standby` 之间到达的 `fix` 被静默吞掉。待处理只由 `start` 清除，CLI 也要求先 `start`
  后 `done`。0.3.0 的前向验证中，成员读到 `brief` 后仍先发了 `done`，所以有待处理消息时
  CLI 也拒绝 `done`。
- **monitor 只按 `status` 的 `attention` 报警。** 同一次审查中，monitor 按“`unanswered` 非空
  连续两次”报警，coordinator 正常处理约 3 分钟就被报 `stall`。事项已按阈值过滤。
- **monitor 报警后继续巡检，同一事项限频报。** 同一次审查中，monitor 报一次 `stall` 就结束
  运行，之后无人监视。`stall` 经 `watch` 推给 coordinator，monitor 不必靠结束运行唤醒它；
  同一 id 最多报 3 次，每个事项都报过而 coordinator 仍无动作时休眠。
- **成员之间的交接用 `handoff`。** 同一次审查指出成员之间的交接没有投递路径。`note` 不计入
  待处理，也不唤醒待命成员；`handoff` 计入收件人的待处理，唤醒待命成员，收件人先 `start`
  才能 `done`。
- **区内消息发给组，不发给 `all`。** 发给 `all` 的消息会唤醒每个待命成员，每唤醒一个就花它
  一轮。
- **子代理 ID 只留在会话里，不写进可能提交的文件。**

## 失败与纠正反馈

- 某步骤失败，或用户要求本 Skill 以后都按某种做法做时，把失败的步骤、错误与改法直接告诉
  用户。
- 只管这一次的纠正照做，不扩展成规则。
- 需要修改本 Skill 本身时，告诉用户由维护者更新。不要修改本 Skill 的安装目录：它是发布
  副本，改动不会回到维护者手里，下次更新时也会被覆盖。

## 指针

| 路径 | 用途 | 何时使用 |
| --- | --- | --- |
| `references/board-protocol.md` | 运行目录与写入一致性、记录格式、组的加入退出与归档、收件判定、标签与状态转移、`handoff`、待命、状态推导与待处理事项、退出码、无 Node 时的降级 | 第 2 至第 8 步 |
| `references/overview-and-plan.md` | `plan.json` 的格式与校验、`overview` 子命令与 Markdown 结构 | 第 4、6、8 步；monitor 每次巡检 |
| `references/member-roles.md` | coordinator、worker、verifier、monitor 的规则，替换与恢复，worker 待命循环与交接，monitor 巡检、限频与休眠 | 第 1、3、4、6、7、8 步与恢复；成员按派发书读取自己的一节 |
| `references/host-primitives.md` | 宿主能力、派发注意事项、事件监视与 monitor 唤醒方式、已知限制、其他宿主的降级 | 第 0、4、5、6 步 |
| `scripts/swarm-board.mjs` | 消息板 CLI | 共享实现在 `scripts/lib/` |
| `templates/briefs.md.tpl` | 公开派发书 | 第 3 步 |
| `templates/prompt-worker.md.tpl`、`prompt-verifier.md.tpl`、`prompt-monitor.md.tpl` | 成员提示词 | 第 4、5、7 步 |
| `tests/swarm-board.test.mjs`、`tests/board-protocol.test.mjs`、`tests/board-overview.test.mjs` | CLI、协议与总览回归测试，共用 `tests/helpers.mjs` | `node --test <skill-root>/tests/` |

执行到对应步骤再加载对应 reference，不要一次全读。
