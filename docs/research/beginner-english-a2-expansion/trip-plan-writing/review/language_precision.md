# 语言与结构复核报告：`trip-plan-writing/lesson_draft.md`

- **审查对象**：`docs/research/beginner-english-a2-expansion/trip-plan-writing/lesson_draft.md`（97 行，9,348 字节；去注释中文 1,462 字，英文 573 词，134 个独立英文词形）
- **课程定位**：第 12 单元第 10 讲「出行与周末计划短文写作」（CEFR A2，`writing_application`，40 分钟，通用日常与现代职场英语，无车间背景）
- **课时门余量实测**：按 `scripts/lib/effort-audit.mjs` 的 `attributeLesson()` 实测，概念 `trip-plan-writing` 精确匹配 1 个小节，`cjk = 1,451`、`en = 575`（等效阅读量 `3,176`，高于 `budget_plan.json` 基线 `target_read_units = 1,944`）、`readMin = 12.6429`、`lectureDesignMin = 22.76`；叠加 `budget_plan.json` 规划题库 `27.20` 设计分钟合计 `49.96` 分钟 / 声明 `40` 分钟（`ratio = 1.249`），处于严格门禁 `0.70–1.40` 区间内，距 `56.00` 分钟上限尚余 `6.04` 设计分钟。
- **总体结论**：**通过（PASS，无阻断性问题）**
- **复核摘要**：上轮审查指出的 3 项阻断性问题（B1 两段情景对话过压缩导致的语用跳脱、悬空 `First,`、`Can you meet him?` 语义偏窄及上午时间断层；B2 中文讲解多处语法边界误导、例题 2 漏解 `go → are going`、L21 例证失配、术语压缩晦涩、`*` 图例滞后及缺正例对照；B3 例题 1 整段短文压入行内代码导致渲染阅读吃力）及主要润色建议均已逐项闭环落实。经逐行通读、687 个中英文车间/制造/工业关键词全量扫描（**0 命中**）、两篇示范短文词数精确验算（57 词与 56 词均与标注完全一致）以及 `react-markdown@10.1.0` + `remark-gfm@4.0.1` 渲染实测，四个维度均达到发布标准。

---

## 一、四维度审查总览

| 审查维度 | 判定 | 核心评估 |
| --- | --- | --- |
| 1. 英文对话自然度（含范文与例题英文） | **通过** | 两段双语情景对话均已扩充至 6 轮：对话 1（L45–52）开场锚定周六苏州之行，经到达后安排自然过渡（`What's our plan after we arrive?`）拆清 `First, ... Then ...`，并自然示范 `excited`、`relaxing`、`Shall we...?` 与 `looking forward to seeing Suzhou`；对话 2（L54–61）补全 `meet him at the station`，串联 9:00 接站 → 参观办公室 → 附近已订桌午饭并自然示范 `Would you like to join us? / I'd love to!`，中译自然流畅。两篇示范短文（L38 共 57 词、L69 共 56 词）及例题 2 改写句语法地道、词数与拆解精准自洽，134 个独立英文词形严守 CEFR A1–A2、零拼写与弯撇号错误。 |
| 2. 通用日常/职场语境一致性 | **通过** | 全文围绕周末苏州短途游、车站碰面、酒店存包、逛园林尝面条、办公室接待来访同事、参观办公区、附近午餐及项目讨论展开；经逐行通读及 687 个中英文车间/制造/工业关键词（410 中文 + 277 英文）全量扫描，中文命中 **0** 处、英文命中 **0** 处，无任何无关车间术语混入。 |
| 3. 中文讲解清晰度 | **通过** | 上轮全部语法边界误导均已修正：明确限定「**表将来安排时**」一般现在时仅用于公共时刻表（L20、L91）、「`this / next` 接**时间名词**前零介词」（L21、L30、L93）、「**具体某天的晚间（星期 + 时段）**用 `on`（泛指晚间用 `in`）」（L85）、「来访与已订好的午饭安排用现在进行时」（L71）、「形容**人的感受**用 `-ed`、形容**活动或事物特征**用 `-ing`」（L22）及「`Would you like` 接动词须留 `to`；`Shall we` 后不加 `to`」（L95）。补齐了 L8 `*` 图例、L21 双时间示例、L71 `discuss` 原因、L85 `go → are going` 解析，以及 `look forward to + -ing` 与 5 类常见错误的成对正误对照，表述平实清晰。 |
| 4. Markdown 结构可读性 | **通过** | 例题 1 完整短文（L67–69）已改为独立 `>` 引用块，与高分范文（L38）体例统一；经 `react-markdown@10.1.0` + `remark-gfm@4.0.1`（对齐 `LessonReader.tsx` 的 `skipHtml: true`、`disallowedElements: ['img']`、`h1–h4 → h3–h6` 映射）实测，除 L6 概念锚点外零原始 HTML，零未解析标记、异常斜体、松散列表、裸 `$`、占位词或行尾空白；标题树 `H1–H4`、2 张 3 列 GFM 表格与 2 处引用块结构整洁、阅读舒适。 |

---

## 二、上轮阻断项整改核验

| 原阻断项 | 修订位置 | 实测核验结果 |
| --- | --- | --- |
| **B1**：两段情景对话仅 4 轮，对话 1 缺目的地锚定且从 8:00 车站碰面突跳至孤立 `First,`；对话 2 `Can you meet him?` 语义偏窄、9:00 接站直跳午饭且中译略省主语 | L45–61 | **已关闭**：对话 1 扩至 6 轮，首轮点明 `our Suzhou trip this Saturday`，第 4 轮以 `What's our plan after we arrive?` 自然承接到达后安排，第 5 轮拆清 `First, ... Then ...`（配 `and` 合并动作），末轮以 `Sounds relaxing! I'm looking forward to seeing Suzhou.` 自然收尾；对话 2 扩至 6 轮，修正为 `Can you meet him at the station?`，第 3 轮补入 `Then we're going to show him around the office.` 打通上午时间线，第 5–6 轮补入 `Would you like to join us?` / `I'd love to!` 并补全中译主语，语用与时间链严密自然。 |
| **B2**：中文讲解多处语法边界误导、例题 2 漏解 `go → are going`、L21 例证缺大时间、L8/L22 压缩晦涩、`*` 图例滞后、缺 `look forward to + -ing` 与常见错误正解对照 | L8、L20–22、L30、L71、L85、L91–95 | **已关闭**：L8 将「系统动词搭配」改为「动词后接 `to do` / `-ing` 的完整用法」并提前声明 `下文用 * 标出语法错句`；L20/L91 补清「表将来安排时」限定；L21 补全 `at the station at 8:00 on Saturday`、`go home by train on Sunday`、`钟点用 at` 与 `this / next 接时间名词`；L22 展开可分离短语代词中置、`to` 为介词配正例 `I'm looking forward to seeing you.`、`I hope` 接完整从句及 `-ed / -ing` 感受与特征释义；L30/L93 限定「时间名词前零介词」；L71 改为「已订好的午饭安排」并说明 `discuss` 直接接宾语、发给本人须改为第二人称；L85 补齐 `go → are going`、改为「游玩/观光不用 `play`」及「具体某天的晚间（星期 + 时段）用 `on`（泛指晚间用 `in`）」；L91–95 修正 `动词/目的地后接 by + 交通`、明确 `Would you like` 与 `Shall we` 分工，并补齐成对 `→` 英文正解。 |
| **B3**：原 L62 将 57 词完整短文压入行内代码 `` `...` ``，在 `guide.css` 下版式拥挤且与 L38 引用块分裂 | L67–69 | **已关闭**：L67 `**解答**（56 词）：` 独立成行，L69 以标准 Markdown 引用块 `> Our colleague Leo ...` 呈现完整短文，与 L38 范文视觉体例完全统一。 |

---

## 三、分维度详细审查结论

### 1. 英文对话自然度（含范文与例题英文）

- **高分范文示范（L36–41）**：
  - **词数与拆解精确核验**：L38 全文按空格分词实测 **57 词**（含 `8:30`，纯字母词 56 词），其中开头 S1 共 `9` 词（`This Saturday, my sister and I are visiting Suzhou.`）、主体 S2–S5 共 `5 + 11 + 13 + 9 = 38` 词、结尾 S6 共 `10` 词（`Everything is ready, so it will be a relaxing weekend!`），`9 + 38 + 10 = 57` 词，与标题「57 词」、L41 拆解及表 1 区间（`8–15 / 30–42 / 6–15`）100% 吻合。
  - **地道度与教学示范**：消除了上轮 `visiting Suzhou / visit a garden` 重复，改为 `walk around a garden and try local noodles`，并以 `Everything is ready, so it will be a relaxing weekend!` 精准示范 L34 所强调的 `and` 合并动作与 `so` 引出结果，中译（L40）自然顺畅。
- **两段双语情景对话（L45–61）**：
  - **对话 1（6 轮，日常生活）**：由周末兴奋感与发车时间切入，约定 8:00 车站碰面并作准时承诺，再过渡到到达后安排与期待收尾，话轮动机真实、口语缩略（`I'm`、`I'll`、`What's`、`we're`）自然得体，且同时示范了 `looking forward to seeing Suzhou` 的 `-ing` 宾语用法。
  - **对话 2（6 轮，现代职场）**：角色分工清晰（格蕾丝协调接待、汤姆负责接站与发计划），以 `there` 避免紧邻重复 `at the station`，9:00 接站 → 带逛办公室 → 附近已订桌午餐并礼貌邀约（`Would you like to join us?` / `I'd love to!`）逻辑连贯，中译口语自然。
- **例题 1 与例题 2 英文（L67–83）**：
  - **例题 1 解答（L69）**：实测 **56 词**（含 `9:00`，纯字母词 55 词），其中开头 S1 共 `9` 词、主体 S2–S6 共 `5 + 9 + 10 + 7 + 9 = 40` 词、结尾 S7 共 `7` 词，与标称「56 词」及表 1 区间（`8–15 / 30–42 / 6–15`）完全一致。将 `His train arrives at 9:00.` 独立于 `First, I will pick him up at the station.` 之前，时序更利落。
  - **例题 2（L77–83）**：两组病句针对中式迁移高发点，改写句（L82–83）语法、语序与标点完全地道。
- **词汇、拼写与标点**：全稿去注释共 `134` 个独立英文词形，英文直撇号 `'` 统一规范（`0` 处弯撇号混用），除刻意标 `*` 的错例与口语对比词 `gonna` 外零拼写错误，词汇严格控制在 CEFR A1–A2 范围内。

### 2. 通用日常/职场语境一致性

- 逐行通读全文 97 行，并对 **687 个**中英文车间/制造/工业类关键词（410 个中文词如车间、产线、流水线、工位、工件、机床、车床、焊接、装配、分拣、质检、品控、料盒、托盘、叉车、传送带、领班、班长、工友、操作员、班次、交接班、点检、巡检、工装、夹具、模具、卡尺、垫片、螺栓、线缆、端子、传感器、舵机、校准、台账、公差、返工、报废、批次、工单、停机、劳保、安全帽、冲压、注塑、仓库、备件、看板、安灯、SOP、5S 等；277 个英文词如 `workshop`、`factory`、`plant`、`shop floor`、`assembly`、`workstation`、`conveyor`、`foreman`、`operator`、`shift`、`handover`、`PPE`、`caliper`、`tolerance`、`work order`、`rework`、`scrap`、`QC`、`lathe`、`welding`、`fixture`、`gasket`、`sensor`、`calibration`、`downtime`、`warehouse`、`pallet`、`forklift`、`terminal`、`CNC`、`PLC`、`SOP`、`BOM`、`OEE` 等）执行全量检索：
  - **中文命中**：`0` 处；
  - **英文命中**：`0` 处。
- 全文人物（玛雅、萨姆、妹妹、格蕾丝、汤姆、利奥）、场所（苏州、车站、酒店、园林、办公室、附近餐厅、公园）与交际任务纯粹属于通用日常出游与现代办公室接待，完全契合第 12 单元去车间化定位。

### 3. 中文讲解清晰度

- **结构主线清晰**：遵循「任务与范围说明 → 三层谋篇与核心规则表 → 顺序衔接词表 → 高分范文与三层拆解 → 日常/职场双语对话 → 职场写作例题与病句诊改 → 5 类常见错误 + 四步自检」递进展开，规则、范文、对话与例题高度闭环。
- **规则边界严谨、零跨讲冲突**：本讲与同单元先修讲义（`directions-transport`、`future-going-to`、`future-will`、`hotel-trip-booking`）在时刻表一般现在时、地点与大小时间语序、`at / on / in` 与零介词边界、`Would you like to...?` vs `Shall we...?`、可分离短语代词中置及 `look forward to + -ing` 等关键规则上口径 100% 一致，无生硬术语或残缺缩写。

### 4. Markdown 结构可读性

- **渲染与语法实测**（基于项目依赖 `react-markdown@10.1.0` + `remark-gfm@4.0.1`，对齐 `web/src/features/guide/LessonReader.tsx` 的 `skipHtml: true`、`disallowedElements: ['img']`、`h1–h4 → h3–h6` 配置）：
  - **零非法原始 HTML**：除 L6 课程概念锚点 `<!-- concepts: trip-plan-writing -->` 外，正文原始 HTML 标签为 `0`；
  - **零未解析标记与格式瑕疵**：渲染后可见正文（代码块外）残留 `*`、`` ` ``、`_`、`~`、`|`、裸 `$` 均为 `0`，异常 `<em>` 为 `0`；`41` 处 `<strong>`、`132` 处行内 `<code>` 与 `2` 处 `<blockquote>` 全部闭合良好且无首尾冗余空格，无相邻 `</code><code>` 粘连、无松散列表（`<li><p>` 为 `0`）、无行尾空白、无 `无资料` / `TODO` / `TBD` / `FIXME` 占位文本，全部中文括号（61 对）、中文双引号（4 对）及逐行反引号均精确配对；
  - **层级与表格版式齐整**：标题树严格为 `H1`（L1）→ `H2`（L5）→ `H3`（L10/36/43/63/73/87，共 6 处）→ `H4`（L12/24/45/54，共 4 处），映射后为 `h3–h6` 无跳级溢出；2 张 3 列 GFM 表格（表 1 L14–18：含表头与 3 行数据共 4 个 `<tr>`，行长 19–91 字符；表 2 L26–32：含表头与 5 行数据共 6 个 `<tr>`，行长 19–80 字符）列数统一、紧凑易读；行内 `<code>` 最长为对话单轮英文（114 字符），两篇示范短文均采用 `>` 引用块呈现，在 `web/src/styles/guide.css` 下层次分明。
  - *前端组件侧通用备注（非本稿缺陷）*：`web/src/features/guide/LessonReader.tsx` 当前未显式挂载 `remarkGfm`，本次表格渲染核验沿用仓库既有课程的 GFM 约定。

---

## 四、可选润色建议（非阻断）

以下细节均不构成阻断，如后续全单元统稿有微调需求可酌情参考（注意当前 `ratio = 1.249` 距 `1.40` 上限余量 `6.04` 设计分钟，不宜大幅扩写）：

1. **L8 `*` 图例措辞微调**：「下文用 `*` 标出语法错句」可顺手改为「下文用 `*` 标出误用或语法错句」，更精确覆盖 `*discuss about`、`*pick up him` 等短语级反例。
2. **L18 表 1 结尾句式补全**：表 1 结尾收束栏当前写「`will` 收尾；邀约用 `Would you like to...?` / `Shall we...?`」，后续统稿时可酌情补注 `I hope...` / `I'm looking forward to...`，与 L22、L52、L69 的期待/祝愿例句形成表文一一呼应。
