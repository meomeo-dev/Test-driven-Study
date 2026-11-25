# 调研笔记：12/24 小时制时间换算、截止时间前置条件误读与细节计算训练

- **课程与单元**：`beginner-english`（v2.5.0：保留第 1–10 单元 37.33 小时 / 41 知识点与全部既有 ID 不变，按通用 CEFR A1+→A2 听说读写体系扩展第 11–16 单元 +23.00 小时 / +30 微知识点，总课时 60.33 小时）｜第 12 单元 `travel-plans`（出行问路与将来计划）
- **本讲定位**：第 9 讲「行程单、酒店预订与出行通知阅读」｜`hotel-trip-booking`（CEFR A2，`skill_focus: reading_comprehension`，预算 45 分钟，`target_read_units: 2180`，`min_examples: 3`，`vocab_target: 3`，练习配额 10 题）
- **先修与分工**：承接先修 `clock-time`（12 小时制整点/半点/一刻钟）、`directions-transport` 与 `future-will`，衔接第 10 讲 `trip-plan-writing`。本笔记（`topic_3`）聚焦 **12/24 小时制换算陷阱、截止时间前置条件误读、行程细节核算纠偏及听说读写练习设计**（与 `topic_1` 高频术语、`topic_2` 三类完整语料互补）。
- **场景边界**：通用日常生活（周末出游、酒店入住退订、高铁/航班出行）与现代职场（商务出差、赴外地参会/拜访客户、报销行程核对）。

---

## 一、12/24 小时制时间换算规则与中文母语负迁移诊断

先修 `clock-time` 仅建立基础 12 小时制报时，而真实国际电子机票、高铁时刻表与酒店确认单大量混用 24 小时制（`00:25`、`15:00`）与 12 小时制（`12:00 p.m.`、`3:00 p.m.`），导致学习者频繁在零点、正午和跨日航班上出错。

### 1. 12/24 小时制快速换算对照表

| 24 小时制 | 12 小时制（标准写法） | 中文对应与语义锚点 | 高频出行语料示例 |
| --- | --- | --- | --- |
| `00:00` | `12:00 a.m.`（推荐 `midnight`） | **当日凌晨 0:00（新一天的起点）** | `Free cancellation ends at midnight (00:00) on May 9.` |
| `00:25` | `12:25 a.m.` | **当日凌晨 0:25（须前一晚出发候机）** | `Flight NH802 departs at 00:25 (12:25 a.m.) on July 8.` |
| `08:30` | `8:30 a.m.` | 上午 8:30（1–11 点直接去前导零加 `a.m.`） | `Breakfast is served from 07:00 to 09:30.` |
| `12:00` | `12:00 p.m.`（推荐 `noon / midday`） | **中午 12:00（正午，绝非半夜）** | `Check-out is by 12:00 p.m. (noon).` |
| `12:45` | `12:45 p.m.` | 中午 12:45（12 点段**不加 12**） | `The high-speed train arrives at 12:45 p.m.` |
| `15:00` | `3:00 p.m.` | 下午 3:00（`13:00–23:59` 换 12h 须**减 12**） | `Hotel check-in begins at 15:00 (3:00 p.m.).` |
| `21:15` | `9:15 p.m.` | 晚上 9:15（`1:00–11:59 p.m.` 换 24h 须**加 12**） | `The last airport shuttle leaves at 21:15.` |

### 2. 中文母语六大高频负迁移错误清单

| 编号 | 偏误类型 | 母语诱因与典型误判/病句（❌） | 纠偏规则与地道表达（✅） | 优先级 |
| --- | --- | --- | --- | --- |
| E1 | **`12:00 a.m.` 与 `12:00 p.m.` 颠倒** | 按中文“上午 12 点 = 中午、晚上 12 点 = 午夜”反向直译，把 `Check-out by 12:00 p.m.` 误当半夜退房，或把 `00:30` 红眼航班当成当天晚上。 | 牢记 **`12:00 p.m. = noon`（中午）**，**`12:00 a.m. = 00:00 midnight`（当天开端凌晨）**；写确认邮件优先用 `noon / midnight` 或 24 小时制消除歧义。 | P0 |
| E2 | **24 小时制混用 `a.m./p.m.` 或 `o'clock`** | 受中文“下午 15 点整 / 晚上 19 点半”影响，写出 `*at 19:30 p.m.`、`*at 15:00 o'clock`、`*at 8:00 a.m. in the morning`。 | 24 小时制**绝不加** `a.m./p.m.` 或 `o'clock`；`o'clock` 仅配 1–12 整点；`a.m./p.m.` 不与 `in the morning/evening` 叠用。→ `at 19:30` / `at 7:30 p.m.` | P0 |
| E3 | **前置截止条件锚点误读（最高频）** | 看到 `24 hours prior to arrival` 只抓数字 `24`，误以为“**预订后 24 小时内**可免费取消”，或将 `prior to` 误接从句（`*prior to you arrive`）。 | `prior to` = 正式版 `before`（介词短语，仅接名词或 `-ing`），锚点是**入住/出发基准时刻**而非下单时刻；须从基准时刻**向前倒推**。 | P0 |
| E4 | **`by / no later than` 与 `until` 混淆** | 中文“直到 11 点前退房”迁移，写出 `*Guests must check out until 11:00 a.m.`。 | **完成性动作截止点**用 `by / no later than`（`check out by 11:00 a.m.`）；**持续状态/服务窗口**用 `until`（`Breakfast is served until 10:00 a.m.`）。 | P0 |
| E5 | **`delayed by` 与 `delayed until / rescheduled to` 算反** | 见 `delayed by 45 minutes` 误以为改到 45 分；见 `rescheduled to 17:10` 漏算延误时长或忘同步推算新登机截止时间。 | **`by` 后是延误增量**（原时刻 `+` 时长）；**`until / to` 后是新时刻**；登机截止须按**新起飞时刻**倒推。 | P1 |
| E6 | **晚数/天数、跨日 `+1` 与附加费漏算** | 把入住 `June 9` 至退房 `June 12` 错当 4 晚；漏看机票到达时间后的 `(+1)` 次日标记；漏算 `excluding city tax` 或行李超重费。 | 住宿晚数 = **退房日 `−` 入住日**（`12 − 9 = 3 nights`）；见 `(+1)` 跨午夜计算飞行时长；逐项核对 `excluding` 与单件行李限重。 | P1 |

---

## 二、核心易混时间与条款表达辨析矩阵

依据 *Cambridge Dictionary (English Grammar Today)* 与英美航司、酒店通行规范整理：

| 对比组 | 核心语法与语义差异 | 地道对比例句 |
| --- | --- | --- |
| **`by` / `no later than` vs `until`** | `by` / `no later than` 管**单次截止动作**（在该时刻或之前完成）；`until` 管**持续状态或开放窗口**（持续到该时刻后停止）。 | `Please check out by / no later than 11:00 a.m.`（11 点前办完退房）<br>`The hotel restaurant is open until 10:00 p.m.`（营业至晚 10 点） |
| **`prior to` vs `in advance` vs `within`** | `prior to + 名词/-ing` 为正式“在……之前”（必带参照事件）；`in advance` 作副词放句末表“提前”（接事件用 `in advance of`）；`within + 时段` 表“在……时长内”（常从当前/下单算起）。 | `Cancel at least 24 hours prior to arrival.`（入住前至少 24 小时）<br>`Book the airport shuttle 24 hours in advance.`（提前 24 小时预订）<br>`Confirm your seat within 24 hours of booking.`（下单后 24 小时内） |
| **`at least X hours` vs `up to X hours`** | `at least 48 hours in advance` = **≥ 48 小时**（越早越符合）；`up to 24 hours prior to arrival` = **最迟至入住前 24 小时**（距入住不足 24 小时即失效）。 | `Notify us at least 48 hours in advance.`（不少于 48 小时前）<br>`Free cancellation up to 24 hours prior to check-in.`（最晚至入住前 24 小时） |
| **`delayed by` vs `delayed until` / `rescheduled to`** | `by` 接**延误时长**；`until / to` 接**更新后的具体时刻**。 | `Flight EA204 is delayed by 45 minutes.`（延误 45 分钟）<br>`The flight is delayed until / rescheduled to 19:15.`（改至 19:15 起飞） |
| **`check-in` vs `boarding` vs `departure`** | 机场三道时间门依次提前：**值机/托运截止**（常见起飞前 45–60 分钟）→ **登机口关闭**（常见起飞前 15–20 分钟）→ **起飞时刻**。酒店 `check-in` 多用 `from`（最早可入），`check-out` 多用 `by`（最晚须退）。 | `Check-in closes 45 minutes before departure.`<br>`Boarding closes 15 minutes prior to departure.`<br>`Hotel check-in is from 15:00; check-out is by 12:00 p.m.` |
| **`local time` 与 `(+1)`** | 机票、列车和酒店确认单默认以**发生地当地时间**为准；到达时刻旁标 `+1` 表示**次日抵达**。 | `Dep 22:40 → Arr 06:15 (+1). All times are local.`（跨夜次日 6:15 到达） |

---

## 三、A2 出行读单“三定两算”防错法（讲义速查卡）

1. **一定时制与日期**：先统一转成 **24 小时制** 标在草稿旁，严防 `12:00 p.m.`（中午）与 `00:XX / 12:XX a.m.`（当天凌晨）错位；扫视有无 `(+1)` 与 `local time`。
2. **二定锚点事件**：遇到 `prior to / before / in advance`，先圈出**参照基准点**（是 `arrival / check-in 15:00`，还是 `new departure time`，而非下单日）。
3. **三定红旗限制词**：圈出 `by / no later than`、`from`、`excluding`、`up to ... kg`、`non-refundable` 及登机口/站台变更通知。
4. **一算顺推时间**：延误时刻 = `原时刻 + delayed by 时长`；跨夜行程耗时 = `(24:00 − 出发) + 次日到达`；住宿晚数 = `退房日 − 入住日`。
5. **二算倒推截止与费用**：免费取消截止 = `入住基准时刻 − 提前小时数`；最晚到口时间 = `新起飞时刻 − 提前关闭分钟数`；总费用 = `晚数 × (房费 + 另计税费)` 或 `超重公斤数 × 单价`。

---

## 四、讲义示范例题（`min_examples >= 3`，供主笔直接选用）

### 例题 1：12/24 小时制换算与凌晨红眼航班排雷
- **材料**：出差备忘显示：① `Hotel check-in: from 15:00`；② `Check-out: by 12:00 p.m.`；③ `Return flight departs at 00:20 on May 12 (local time).`
- **设问**：① 用 12 小时制写出入住时间，用 24 小时制写出退房时间；② 返程航班应在 5 月几日晚上前往机场？
- **解答与点拨**：① 入住时间为 **`3:00 p.m.`**（`15 − 12 = 3`），退房时间为 **`12:00`**（中午 12 点，非午夜）；② 应在 **5 月 11 日晚上**抵达机场（`00:20 on May 12` 即 `12:20 a.m.`，属 5 月 12 日刚过零点的凌晨）。

### 例题 2：免费取消前置截止点倒推与住宿晚数核算
- **材料**：*Check-in: Fri, Oct 16 (from 14:00)｜Check-out: Mon, Oct 19 (by 11:00 a.m.)｜Rate: `$110` per night (taxes included). Policy: Free cancellation up to 24 hours prior to arrival (based on 14:00 check-in time). Late cancellations will be charged for the first night.*
- **设问**：① 共住几晚、房费总额多少？② 最晚何时前可免费取消？③ 若于 10 月 15 日 `16:30` 取消，需付多少违约金？
- **解答与点拨**：① `19 − 16 = 3 nights`，总额 `3 × $110 = $330`；② 锚定入住时刻 `Oct 16, 14:00` 倒推 24 小时 → **`Oct 15, 14:00 (2:00 p.m.)`**；③ `Oct 15, 16:30` 距入住仅剩 `21.5` 小时（超时 2.5 小时），须扣首晚房费 **`$110`**。

### 例题 3：航班延误顺推与新登机截止时间计算
- **材料**：原行程 *Flight MU5108, Dep 16:15, Gate B08*；新通知 *"Your flight is delayed by 50 minutes and the gate has changed to C14. Boarding closes 15 minutes prior to the new departure time."*
- **设问**：更新后的起飞时刻、最晚登机时刻（用 24h 与 12h 表示）及新登机口分别是什么？
- **解答与点拨**：新起飞时刻 = `16:15 + 50 min` = **`17:05`（`5:05 p.m.`）**；最晚登机时刻 = `17:05 − 15 min` = **`16:50`（`4:50 p.m.`）**；新登机口 = **`C14`**（切忌仍按原 `16:15` 倒推或走错 `B08`）。

---

## 五、听说读写四技能练习设计蓝图（对齐 `budget_plan.json` 10 题配额）

严格匹配本讲 10 题配额（`reading_comprehension ×2`、`cloze ×1`、`translation ×1`、`numeric ×1`、`single_choice ×2`、`multiple_choice ×1`、`true_false ×2`），并附听辨与口语确认微训练：

> **v2 题库与 TTS 制作硬规则**：① 含病句选项的题遵循 `uniformOptionAudio`，全组选项**不配 TTS**，仅在 `analysis` 给正确示范句内嵌 `tts`；② `cloze.passage` 禁内联 `tts`，必配 `passage_tts`；③ 2 道 `reading_comprehension` 须配齐与正文段数对齐的 `study_translation.material` 及 `study_translation.sub_questions`；④ `analysis` 禁止出现“选项 a/b/c/d”。

### 1. 读与算（8 题：核心测评矩阵）

1. **`single_choice` #1（12/24h 换算与 `12:00 p.m.` 辨识）**
   - 题干：酒店确认单标明 `Check-in: from 15:00; Check-out: by 12:00 p.m.`，下列理解完全正确的是？
   - 正解：下午 3:00 起可办理入住，中午 12:00 前须办理退房。
   - 干扰项诊断：分别拦截“把 `12:00 p.m.` 错成半夜 12 点”、“把 `15:00` 错减 10 得下午 5 点”、“把 `from` 与 `by` 语义互换”。
2. **`single_choice` #2（`prior to / by / until / delayed by` 语法排错，全组无 TTS）**
   - 题干：以下哪句关于出差酒店与航班变更的英文表达**完全正确**？
   - 选项：`a` `Free cancellation is available up to 24 hours prior to arrival, and guests must check out by 11:00 a.m.`（✅）；`b` `*Guests must check out until 11:00 a.m., and our flight leaves at 19:30 p.m.`（误用 `until` + 24h 多加 `p.m.`）；`c` `*Please cancel prior to you arrive, because check-in starts at 15:00 o'clock.`（`prior to` 误接从句 + 24h 加 `o'clock`）；`d` `*The train leaves at 8:00 a.m. in the morning and is delayed to 30 minutes.`（语义重复 + `delayed to` 错接时长）。
3. **`true_false` #1（凌晨 `00:30 / 12:30 a.m.` 日期陷阱）**
   - 题干：电子机票显示 `Flight NH802 departs at 00:30 (12:30 a.m.) on July 8.`，因此乘客应在 **7 月 8 日晚上**出发去机场。→ **`false`**（应于 7 月 7 日晚抵达机场）。
4. **`true_false` #2（`24 hours prior to arrival` 锚点误读）**
   - 题干：酒店条款为 `Free cancellation up to 24 hours prior to arrival (check-in from 15:00 on May 10).`，若客人在 **5 月 9 日 18:00** 取消预订，仍可免费取消。→ **`false`**（截止点为 5 月 9 日 15:00，已超时 3 小时）。
5. **`multiple_choice` #1（高铁+酒店行程单多维核对，5 选 3）**
   - 材料：*Train G108: Dep 08:40 → Arr 11:25; Boarding closes 10 minutes prior to departure; Free baggage allowance: up to 20 kg per passenger; Hotel check-in: from 14:00; Check-out: by 12:00 p.m.*
   - 正确项（3 项）：① 检票于 `08:30` 截止（`08:40 − 10 min`）；② 列车全程耗时 2 小时 45 分钟（`08:40 → 11:25`）；③ 最晚须在中午 12:00 前退房。
   - 干扰项（2 项）：④ 抵达后上午 11:45 即可办理酒店入住（早于 `14:00`）；⑤ 携带 22 公斤行李免费（超 `20 kg` 限额）。
6. **`numeric` #1（住宿晚数 + 另计城市税总价核算）**
   - 材料：*Hotel Confirmation — Check-in: Tue, June 9 (from 15:00); Check-out: Fri, June 12 (by 12:00 p.m.). Room rate: `$100` per night, excluding a `$10` city tax per night. Breakfast is included.*
   - 设问：此次入住共需支付多少美元？（填数字）→ 正解 **`330`**（`12 − 9 = 3 nights`，`3 × ($100 + $10) = 330`；解析点破 `300` 漏税、`440` 错算 4 晚、`310` 税仅加一次三大常见错算）。
7. **`reading_comprehension` #1（商务酒店预订确认邮件，3 小题，配 `study_translation`）**
   - 文本核心：*Riverview Hotel Confirmation — Check-in: Thu, Nov 12 (from 15:00); Check-out: Sat, Nov 14 (by 11:00 a.m.); Rate: `$125`/night (breakfast included). Free cancellation up to 48 hours prior to arrival (15:00 local time); late cancellations incur one night's fee. Airport shuttle runs hourly until 22:00 and must be booked at least 24 hours in advance.*
   - `sq-1`（`single_choice`）：最晚免费取消时间？→ **`Tuesday, Nov 10 at 15:00 (3:00 p.m.)`**（倒推 48 小时；干扰项设 `Nov 11 15:00` / `Nov 10 11:00 a.m.` / `Nov 12 15:00`）。
   - `sq-2`（`single_choice`）：关于机场接驳车哪项正确？→ 末班车为晚上 `10:00 p.m.`，且须至少提前 24 小时预订。
   - `sq-3`（`true_false`）：客人周六中午 12:00 退房符合规定且含早餐。→ **`false`**（须 `by 11:00 a.m.` 退房）。
8. **`reading_comprehension` #2（航班电子行程单 + 晚点换口通知，3 小题，配 `study_translation`）**
   - 文本核心：*Flight EA204 (May 18): Scheduled Dep 18:30 → Arr 20:45, Gate A09. Baggage: 1 carry-on (up to 7 kg) + 1 checked bag (up to 20 kg); excess fee `$12`/kg. SMS Update: Your flight is delayed by 45 minutes. The boarding gate has changed from A09 to B16. Boarding closes 15 minutes prior to the new departure time.*
   - `sq-1`（`single_choice`）：更新后的起飞时间与登机口是？→ **`7:15 p.m. (19:15), Gate B16`**（`18:30 + 45 min = 19:15`）。
   - `sq-2`（`single_choice`）：乘客最晚应于何时到达 `B16` 登机口？→ **`19:00 (7:00 p.m.)`**（`19:15 − 15 min`；干扰项设 `18:15` 按原时刻倒推与 `19:15` 漏算提前量）。
   - `sq-3`（`true_false`）：若乘客托运行李重 23 公斤，需补缴 `$36` 超重费。→ **`true`**（`(23 − 20) × $12 = $36`）。

### 2. 写与译（2 题：语境语法与跨语纠偏）

9. **`cloze` #1（出差出行须知 5 空完形，配 `passage_tts`，选项全组无 TTS）**
   - 语篇：*“Thank you for your booking! Check-in starts {{1}} 15:00, and guests must check out {{2}} 12:00 p.m. Free cancellation is available up to 24 hours {{3}} arrival. Please book the airport shuttle at least 12 hours {{4}}. Note that Flight CA412 is delayed {{5}} 30 minutes today, so the new departure time is 19:00.”*
   - 各空与干扰项：`{{1}}` `from`（✅）/ `until / by / to`；`{{2}}` `by`（✅）/ `until / from / during`；`{{3}}` `prior to`（✅）/ `after / within / until`；`{{4}}` `in advance`（✅）/ `on time / at once / by chance`；`{{5}}` `by`（✅）/ `to / until / at`。
10. **`translation` #1（实用中译英 `zh_to_en`，配 `reference_translation_tts`）**
    - 原文：「请至少提前 24 小时免费取消预订，并最晚于中午 12 点前办理退房。」
    - 参考译文：*Please cancel your booking for free at least 24 hours in advance, and check out by 12:00 p.m.*（可接受 `prior to arrival`、`no later than 12:00 p.m.`、`by noon`；核心纠偏 `*until 12:00 p.m.` 与 `*12:00 a.m.`）。

### 3. 听与说微训练（跨技能巩固与第 10 讲衔接）

- **机场/车站广播速算听辨**：听 20 秒内简短播报（如 *"Attention please: Flight EA204 to Singapore is now delayed by 40 minutes, and boarding will begin at Gate C14 at 18:50."*），快速记录 `原时刻 / 延误量 / 新登机口`，警惕 `14:15` vs `14:50`（`-teen/-ty` 重音）。
- **酒店与客服礼貌复核口语**（纠偏中式生硬直问）：
  - 核对正午退房：`*Check out 12 is night or day?` → **`Excuse me, check-out is by 12:00 p.m. — that's noon, right?`**
  - 核对免费取消线：`*When is last free cancel?` → **`Could you confirm the exact deadline for free cancellation? Is it 3:00 p.m. on May 9?`**
  - 核对延误后登机：`*Flight late, what time board?` → **`Since the flight is delayed by 45 minutes, what time does boarding close now?`**
- **写前衔接（对接第 10 讲 `trip-plan-writing`）**：要求学习者用 2–3 句将来时把读出的行程单转写为出行备忘（如 `Our train will depart at 08:40, and we are going to check in after 15:00.`），提前清除 `*at 15:00 p.m.` 等格式病句。

---

## 六、生词本候选词条建议（对齐 `vocab_target: 3`）

> **防冲突提醒**：既有课程词表 `assets/vocabulary/english.json` 已占用旧 ID **`check-out`**（以及其他 70 个旧词条）；本讲新增词条严禁复用 `check-out`。下列候选均遵循 `design-course-vocabulary`（短语/搭配省 `pos`，`grammar_note` 精准点拨）：

1. **`prior-to`**（首选 #1）：`term: "prior to"`｜`category: "phrase"`｜`meaning: "在……之前（较正式，常用于预订与登机条款）"`｜`grammar_note: "介词短语，后接名词或动词 -ing（如 prior to arrival / boarding），不可直接接完整从句。"`｜`example: "Free cancellation is available up to 24 hours prior to arrival."`（`入住前 24 小时内可免费取消。`）
2. **`in-advance`**（首选 #2）：`term: "in advance"`｜`category: "phrase"`｜`meaning: "提前；预先"`｜`grammar_note: "常放句末作状语，前可加具体时间量（at least 24 hours in advance）；接具体事件名时用 in advance of。"`｜`example: "Please book the airport shuttle at least 24 hours in advance."`（`请至少提前 24 小时预订机场接驳车。`）
3. **`no-later-than`**（首选 #3）：`term: "no later than"`｜`category: "phrase"`｜`meaning: "不晚于；最迟在……之前"`｜`grammar_note: "等同于正式语境中的 by，强调单次动作的截止期限，不可与表示持续状态的 until 混用。"`｜`example: "Please arrive at the boarding gate no later than 19:00."`（`请最晚于 19:00 到达登机口。`）
4. **`delayed-by`**（备选 #4）：`term: "delayed by"`｜`category: "collocation"`｜`meaning: "延误了（多长时间）"`｜`grammar_note: "by 后接延误时长增量（delayed by 45 minutes）；直接标明新起飞时刻时改用 delayed until 或 rescheduled to。"`｜`example: "Our flight is delayed by 45 minutes due to bad weather."`（`我们的航班因天气不佳延误了 45 分钟。`）
5. **`local-time`**（备选 #5）：`term: "local time"`｜`category: "collocation"`｜`meaning: "当地时间"`｜`grammar_note: "行程单与酒店确认邮件的默认计时基准；核对跨时区航班起降或取消截止时间时须以目的地当地时间换算。"`｜`example: "The flight arrives at 06:15 local time the next morning."`（`航班将于次日早晨 6:15 当地时间抵达。`）

---

## 七、权威核验与课程依据

- **Cambridge Dictionary (*English Grammar Today*)**：核验 `by / no later than`（完成截止）与 `until`（持续终点）、`prior to`（正式介词短语，仅接名词/动名词）与 `in advance` 用法差异。
- **英美航司与酒店通行规范（NPL / RMG 计时惯例与真实行程条款）**：核验 `12:00 a.m.`（midnight，当日零点）与 `12:00 p.m.`（noon，正午）转换规则，以及 `free cancellation up to 24 hours prior to arrival`、`boarding closes ... prior to departure`、`delayed by` 地道表述。
- **课程规划依据**：`docs/research/beginner-english-a2-expansion/syllabus.json`、`hotel-trip-booking/budget_plan.json`、`courses/beginner-english/lessons/numbers-places.md`（先修 `clock-time` 边界）与 `courses/beginner-english/assets/vocabulary/english.json`（词条 ID 去重核查）。
