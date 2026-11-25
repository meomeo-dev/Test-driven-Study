# 事实复核报告：第 9 讲「行程单、酒店预订与出行通知阅读（`hotel-trip-booking`）」

- **复核对象**：`docs/research/beginner-english-a2-expansion/hotel-trip-booking/lesson_draft.md`（139 行，12,138 字节；二审复核）
- **核查基准**：`docs/research/beginner-english-a2-expansion/hotel-trip-booking/budget_plan.json`、`docs/research/beginner-english-a2-expansion/syllabus.json`（目标级别 `CEFR A2`，`skill_focus: reading_comprehension`，`min_read_units = 2180`，`min_examples = 3`，规划 10 道计分题，非零题自评节点）、`scripts/lib/effort-audit.mjs`、先修讲义（`directions-transport`、`future-will`、`clock-time`）及同批阅读讲义（`receipts-menus-reading`）
- **复核结论**：**通过（PASS，0 项阻断问题）**——一审提出的 4 项阻断问题（B1–B4）与 5 项润色建议已全部闭环修复；英语语法、搭配与归类准确，CEFR A2 级别适配与中文释义支架完整，三类出行示范文档与两段情景对话自然地道，全文无 `无资料` 或占位文本，无自相矛盾解释，2026 公历日期与全部时间/费用算术无误，`<!-- concepts: hotel-trip-booking -->` 锚点精确匹配，等效阅读量 `3,640` 达标（`>= 2,180`），预计下游严格课时门 `η = 1.24` 处于平衡区间（`0.70 <= η <= 1.40`）。

---

## 一、核心门禁、锚点与等效阅读量核查

| 核查维度 | 要求基准 | 实测结果 | 判定 |
| --- | --- | --- | --- |
| `<!-- concepts: <id> -->` 锚点 | 每个知识点小节含 `<!-- concepts: hotel-trip-booking -->` | L5 `## 行程单、酒店预订与出行通知阅读` 下一行（L6）精确写入 `<!-- concepts: hotel-trip-booking -->`；经 `scripts/lib/effort-audit.mjs` `attributeLesson()` 实测精确匹配 1 个小节 | **通过** |
| `effort-lab` 锚点与编号步骤+清单 | 仅零题自评/实操知识点须配置 | `budget_plan.json` 与 `syllabus.json` 均未设 `effort_lab`；本讲为 `reading_comprehension`，规划 10 道计分题（`planned_item_design_min = 28.6`），非零题自评节点 | **不适用（合规）** |
| 无 `无资料` 及占位文本 | 严禁 `无资料`、`TODO`、`TBD`、`FIXME`、`Replace this lesson` | 全文 0 处匹配；中英文车间/工厂离题词扫描为 0 命中 | **通过** |
| 例题与常见错误结构 | `min_examples >= 3`，含 `### 例题` 与 `### 常见错误` | 含 3 道 `### 例题`（L107、L115、L123）、1 节 `### 常见错误`（L131）与「三定两算」口诀（L139） | **通过** |
| 等效阅读量（`中文字数 + 3×英文词数`） | `hotel-trip-booking >= 2180` | `effort-audit.mjs` `attributeLesson()` 归属口径（导语池 + `##` 正文，不含 `##` 标题行）：中文 `1,585` 字 + 英文 `685` 词 = **`3,640`**（去注释 `1,585 + 3×683 = 3,634`）；仅 `##` 正文：`1,511 + 3×683 = 3,560`（去注释 `3,554`）；全文件原始：`1,599 + 3×685 = 3,654`（去注释 `3,648`） | **通过**（各口径均高于基准 `2,180`） |
| 下游严格课时门预测 | `audit-course-effort.mjs --strict` 要求 `0.70 <= η <= 1.40` | 实测 `readMin = 15.0011 min`（`1585/250 + 685/90 + 0.15×(3+4)`），讲义设计工时 `1.8 × 15.0011 = 27.00 min`；叠加规划题库 `28.60 min`（参照同题型配额已生成单元 `receipts-menus-reading` 实测 `29.10 min`）合计 `55.60–56.10 min / 45 min`，预计 `η = 1.24–1.25`，距 `63.00 min`（`η = 1.40`）告警上限尚余 **`6.90–7.40 min`** | **通过** |
| Markdown 渲染与 HTML 安全 | 无原始 HTML 标签（注释除外），GFM 语法完整闭合 | 除 L6 概念注释外 **0 处**原始 HTML 标签；经 `micromark` + `micromark-extension-gfm`（`allowDangerousHtml: false`）实测：3 张 3 列表格（7/4/6 行）与 3 个 `text` 代码块（最长单行 65 字符）完整解析，54 处 `<strong>`、227 处 `<code>` 正常闭合，0 处意外 `<em>`、0 处未解析标记、0 处相邻 `</code><code>`、0 处括号失配、0 处行尾空白 | **通过** |
| 英语语法准确性与内部自洽 | 语法归类、搭配、时间规则与示例无错误及自相矛盾 | 全文语法与搭配准确，规则表、示范文档、对话与常见错误前后完全闭环 | **通过** |
| CEFR A2 级别适配与例句地道度 | 核心词配中文释义支架，示范文档与对话自然地道 | 六组核心术语及高阶/专有词均配中文释义，示范文档与双语对话自然地道 | **通过** |

---

## 二、一审阻断项（B1–B4）修复验证

| 一审编号 | 原问题概要 | 二审实测验证 | 状态 |
| --- | --- | --- | --- |
| **B1** | 原 L8 将 `will be charged` 误归“状态词块”，且 `is confirmed`、`must`、`be going to` 等多项宣称写法在正文与示范中悬空缺失 | 现 L8 将 `is included`、`is delayed by`、`rescheduled to`、`will be charged` 准确归为**固定实用词块（表状态、变更或被动扣费）**，移除了悬空的 `is confirmed` 与 `be going to`；四类写法全部在正文与示范 1–3 / 对话 1–2 中闭环落地：`departs / closes`（L68/79/91/103/109）、`It will now depart...`（L77/101）与 `I'll stay...`（L104）、`breakfast & tax included`（L55）与 `available until 14:00`（L56）、祈使句 `Please show a valid photo ID at check-in.`（L57）、情态规则句 `Passengers must carry a valid photo ID.`（L69）与 `You can rebook...`（L81–82）、`is included`（L92）、`is delayed by`（L76/101）、`rescheduled to`（L43/135）、`will be charged`（L59） | **已修复** |
| **B2** | 原示范 1 `Late check-out: until 14:00` 与常见错误 3 `*check out until 11:00` 表面矛盾；原 L54 `after deadline, $110 fee applies.` 双省冠词且与例题 2“首晚房费”错位 | 现示范 1 L56 改为 `Late check-out: available until 14:00 (+$25).`，并与表 3 L40（`available until 14:00`）及常见错误 3 L135（“单次截止动作用 `by`，持续开放或停留状态才用 `until`，如 `available until 14:00`、`open until 10:00`”）三处互印，彻底消除表面矛盾；现 L59 改为 `After the deadline, a $110 first-night fee will be charged.`，补齐冠词并与 L8 `will be charged`、例题 2 L121“首晚房费”完全一致 | **已修复** |
| **B3** | 表 1 与示范缺少零基础 A2 核心术语及 `excess` 中文释义；原 L33 `in the morning` 叠用规则主语错挂；原 L30 “12 点段”未限定中午；原 L23 窄化 `excluding` | 表 1 L14–21 全面补齐六组术语中文释义（含 `check in`“办理入住 / 办理值机”、`check out`、`board`“登机 / 登车”等）并明晰 `cancellation` 英美双写 `ll` 与 `cancelled / canceled` 分工；L23–24 补全 `Standard Queen`、`excluding`（表“不含…… / 除……外”）、`valid photo ID`、`excess`（超重/超额）、`full refund`、`meal voucher` 释义；L31 限定为“中午 `12:00–12:59`（`p.m.`）不加减 12”；L34 显式拆清主语“**`a.m. / p.m.` 亦不与 `in the morning / afternoon / evening` 叠用**”，与常见错误 1 L133 一致 | **已修复** |
| **B4** | 原对话 2 `The new departure time is 10:55 from Gate C08.` 存在主语（时间）与 `from Gate C08` 搭配失真 | 现对话 2 L101 改为 `Yes, I'm sorry. Due to heavy rain, it's delayed by 75 minutes. It will now depart at 10:55 from Gate C08.`，主语 `It` 指代 `Flight SL-418`，与示范 3 L77 及中文“航班将改在 10:55 从 C08 登机口起飞”精确对应 | **已修复** |

此外，一审非阻断润色项亦全部完成：`board` 及物/不及物区分（L19）、退房义限定 `表“退房”禁漏 of`（L136）、`from A to B` 覆盖“位置或时间变更”（L44）、对话 1 转为自然口语 12 小时制并扩至 8 轮顺畅衔接（L89–96）、对话 2 明确角色标注并将“停登”改为“停止登机”（L98–105）、口诀改为“限制警示词与变更项”（L139）、三份示范文档单行收窄至 `<= 65` 字符。

---

## 三、分维度详细事实核验

### 1. 英语语法准确性与内部自洽
- **词性、拼写与不可数规则**：`check in`（动词分写）vs `check-in`（名词/定语连写）、`check out of the hotel` vs `check-out / checkout`、`booking`（英）/ `reservation`（美）、`depart from`、`arrive at`（站点）vs `arrive in`（城市）、票面单数 `Dep / Arr` vs 大厅屏复数 `Departures / Arrivals`、`board` 接交通工具及物不加 `on`（指登机进程可不及物 `Boarding closes`）、`platform / track`、`coach / car`、`cancellation` 双写 `ll` 与 `cancelled`（英）/ `canceled`（美）、`luggage / baggage` 不可数与 `one piece of luggage / two bags` 全部准确。
- **时制与介词边界**：`00:00 / 00:25 ↔ 12:00 a.m. / 12:25 a.m.`、`12:00 / 12:45 ↔ 12:00 p.m. / 12:45 p.m.`、`13:00–23:59 ↔ 1:00–11:59 p.m.`、`01:00–11:59` 去前导零加 `a.m.`；24 小时制禁加 `a.m. / p.m. / o'clock`，`a.m. / p.m.` 不与 `in the morning / afternoon / evening` 叠用；`from / by / until`、`prior to + 名词/-ing`、`in advance`、`within`、`at least / up to`、`delayed by + 时长` vs `delayed until / rescheduled to + 新时刻`、`from A to B`、`Due to + 名词短语` 均准确且与常见错误 1–5 严格一致。
- **语法范围边界**：与 `syllabus.json` 课程编排完全对齐——衔接先修 `directions-transport`、`future-will`（临场决定 `I'll stay...` 及临时改期 `It will now depart...`）、`clock-time`，将完整被动语态（第 15 单元 `basic-passive-voice`）与现在完成时（第 13 单元 `present-perfect-forms`）留待后续单元，符合 A2 渐进设计。

### 2. CEFR A2 级别适配与例句地道度
- **词汇分级与中文支架**：全稿去注释共 224 个独立英文词形，无拼写错误（除教学错例 `*two luggages` 外）；主体词汇处于 CEFR A1–A2 核心范围，文档中出现的 B1/B2 实用出行词（`excess`、`cancellation`、`non-refundable`、`valid photo ID`、`meal voucher`、`rescheduled`、`prior to`）均在表 1–3 或 L23–24 给出准确中文释义及情景例证。
- **示范文档地道度**：示范 1（酒店确认邮件）、示范 2（中国铁路高铁电子行程单，上海虹桥 → 杭州东 50 分钟车程、提前 5 分钟停检、20 kg 免费行李额度均符合现实）、示范 3（航班晚点改口通知与免费改签/退款/餐券选项）句式真实、简洁、无冠词缺失或中式生造。
- **对话自然度**：对话 1（8 轮，职场同事共看高铁票与酒店确认单核对出差安排，口语使用 `1:15 p.m.` / `1:10` / `3:00 p.m.`，自然引出客户改期提问，以 `Sounds like you're all set! Have a safe trip!` / `Thanks! See you Monday.` 收尾，与周五–周日行程逻辑严密）；对话 2（6 轮，乘客与地勤核对晚点、登机口、改签与餐券，衔接自然、语气得体）。

### 3. 公历日期、时间与费用算术验算
- **2026 公历核验**：`2026-06-11`（Thu / 周四）、`2026-06-12`（Fri / 周五）、`2026-06-14`（Sun / 周日）全部与真实公历一致；对话 1 末尾 `See you Monday.` 对应周日退房后的周一返岗，逻辑自洽。
- **示范 3 与例题 1–3 全量验算**：
  - 示范 3：`09:40 + 1h 15m (75 min) = 10:55`，`12:10 + 1h 15m = 13:25 (1:25 p.m.)`，飞行时长保持 2 小时 30 分钟；`10:55 − 15 min = 10:40`；免费改签截止 `10:15` 早于 `10:40` 停登。
  - 例题 1：`15:00 → 3:00 p.m.`、`12:00 p.m. → 12:00`、`00:20 on May 12 → 5 月 11 日晚`，全部正确。
  - 例题 2：`14 − 12 = 2 晚`，含早含税加延迟退房 `2 × $110 + $25 = $245`；从 6 月 12 日 `15:00` 倒推 24 小时得 `6 月 11 日周四 15:00`；`18:00` 超时 3 小时按条款扣首晚房费 `$110`，全部正确。
  - 例题 3：`G214` `13:15 − 5 min = 13:10` 停检，故 `13:12` 不能进站；`SL-418` 最晚登机 `10:40`、新到达 `1:25 p.m.`、新登机口 `C08`；随身 `6 kg <= 7 kg` 不超重，托运 `(23 − 20) × $12 = $36`，全部正确。

---

## 四、阻断问题与修订指令

- **阻断问题（Blocking Issues）**：无（0 项）。
- **修订指令（Revision Instructions）**：无（无需再次修订，可直接进入下一阶段）。
