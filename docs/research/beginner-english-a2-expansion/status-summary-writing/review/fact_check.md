# 事实复核报告：第 15 讲「阶段总结与进度汇报写作（`status-summary-writing`）」

- **复核对象**：`docs/research/beginner-english-a2-expansion/status-summary-writing/lesson_draft.md`（100 行，7,949 字节）
- **核查基准**：`docs/research/beginner-english-a2-expansion/status-summary-writing/budget_plan.json`、`docs/research/beginner-english-a2-expansion/syllabus.json`（第 15 讲，第 13 单元「个人经历与进度追踪」，目标级别 `CEFR A2`，`skill_focus: writing_application`，`min_read_units = 2180`，`min_examples = 3`，规划 8 道计分题，非零题自评节点）、`scripts/lib/effort-audit.mjs`、本讲三份研究笔记（`topic_1`–`topic_3`）以及先修讲义（`future-going-to`、`future-will`、`trip-plan-writing`、`present-perfect-forms`、`ever-never-already-yet`、`for-since-duration`、`progress-update-listening`）
- **复核结论**：**暂不通过（FAIL，4 项阻断问题待修订）**——知识点锚点（`<!-- concepts: status-summary-writing -->`）、非零题自评合规性、无 `无资料`/占位文本与离题车间词、Markdown/GFM 渲染安全、CEFR A2 词汇与语法边界、两篇范文词数统计（64 词 / 62 词）及等效阅读量（`effort-audit.mjs` 归属口径 **`2,628 >= 2,180`**，`1.206×`，预测严格课时门 **`η = 1.10`**）均已达标；但存在 **4 处语法准确性、内部自洽与范文/对话地道度阻断缺陷**：① L21、L96 泛写「`this / last / next` 前零介词」，以偏概全且与第 13–14 讲 `since last ...` 及本讲 `by next ...` 冲突；② L20「`right now / still` 用现在进行时」与 L30/L95「`still` 完成否定置 `haven't` 前」内部自相矛盾（兼 `for / on Tuesday` 缺范围限定），且 L95 孤立标星 `*already have` 误判实义动词合法句；③ L62 例题 1 范文 `wrap them up` 前置两个复数名词（`the slides` / `the notes`）造成代词指代歧义，且 L46–47 对话 1 问答脱节、`so` 因果牵强；④ L14–18 表 1 三要素词数配比（`22–28 / 18–24 / 18–26`）与顺序跟全文唯二两篇范文（`31 / 12 / 14`、`37 / 11 / 14`）逐行脱节。修正上述 4 项即可放行。

---

## 一、核心门禁、锚点与等效阅读量核查

| 核查维度 | 要求基准 | 实测结果 | 判定 |
| --- | --- | --- | --- |
| `<!-- concepts: <id> -->` 锚点 | 每个知识点小节含 `<!-- concepts: status-summary-writing -->` | L5 `## 阶段总结与进度汇报写作` 下一行（L6）精确写入 `<!-- concepts: status-summary-writing -->`；经 `scripts/lib/effort-audit.mjs` `attributeLesson()` 实测精确匹配 1 个小节 | **通过** |
| `effort-lab` 锚点与编号步骤+清单 | 仅零题自评/实操知识点须配置 | `budget_plan.json`、`syllabus.json` 与复核基准 `[{"id": "status-summary-writing", "min_read_units": 2180}]` 均未配置 `effort_lab`；本讲为 `writing_application`，规划 8 道计分题（`planned_item_design_min = 30.4`），非零题自评节点 | **不适用（合规）** |
| 无 `无资料` 及占位文本 | 严禁 `无资料`、`TODO`、`TBD`、`FIXME`、`Replace this lesson` | 全文 `0` 处匹配；中英文车间/工厂/产线等离题术语扫描 `0` 命中 | **通过** |
| 例题与常见错误结构 | `min_examples >= 3`，含 `### 例题` 与 `### 常见错误` | 含 3 道 `### 例题`（L56、L66、L76）、1 节 `### 常见错误`（L90，5 类失误）及 `**四步自检**`（L100） | **通过** |
| 等效阅读量（`中文字数 + 3×英文词数`） | `status-summary-writing >= 2180`（建议控制 `1.0–1.25×`，即 `2,180–2,725`） | `effort-audit.mjs` `attributeLesson()` 归属口径（导语池 + `##` 正文，不含 `##` 标题行）：中文 `1,173` 字 + 英文 `485` 词 = **`2,628`**（**`1.206×`**；去 HTML 注释 `1,173 + 3×483 = 2,622`，`1.203×`）；仅 `##` 正文：`1,127 + 3×485 = 2,582`（去注释 `2,576`）；全文件原始：`1,184 + 3×485 = 2,639`（去注释 `2,633`） | **通过**（全口径达标且落于 `1.0–1.25×` 区间） |
| 下游严格课时门预测 | `audit-course-effort.mjs --strict` 要求 `0.70 <= η <= 1.40` | `readMin = 10.6809 min`（`1173/250 + 485/90 + 0.15×4`），讲义设计工时 `1.8 × 10.6809 = 19.23 min`；叠加 `budget_plan.json` 规划题库 `30.40 min` 合计 `49.63 / 45 min`（**`η = 1.10`**，距 `63.0 min` 上限余 `13.37 min`）；按实际 8 题较重参数估算（`39.90 min`）合计 `59.12 / 45 min`（**`η = 1.31`**），仍稳居安全区间 | **通过** |
| Markdown 渲染与 HTML 安全 | 无原始 HTML 标签（注释除外），GFM 语法完整闭合 | 除 L6 概念注释锚点外 **0 处**原始 HTML 标签；经 `micromark` + `micromark-extension-gfm`（`allowDangerousHtml: false`）实测：3 张 3 列表格（14 `<tr>`、9 `<th>`、33 `<td>`）、2 处引用块（L62、L72）、32 处 `<strong>` 与 116 处 `<code>` 全部闭合；0 处意外 `<em>`、0 处代码块外残留 `*`/反引号、0 处代码内弯引号/弯撇号、0 处括号/引号失配、0 处行尾空白 | **通过** |
| CEFR A2 级别适配 | 词汇与句法适配 CEFR A2，衔接先修且不抢跑后续单元 | 去注释共 `483` 英文词次、`136` 个独立小写词形，0 拼写错误，全篇美式拼写一致（`practiced / learned`）；严格守住 A2 边界，L8 明确不引入完成进行时，并将完整邮件格式与条件句留待后续单元（仅 `draft` 建议补中文释义） | **通过** |
| 英语语法准确性与内部自洽 | 规则表述、`*` 错句标注、内部与跨讲口径无误且无自相矛盾 | 存在 **L21/L96 零介词过泛**、**L20 与 L30/L95 `still` 自相矛盾**、**L95 孤立 `*already have` 误标**及 **表 1 与两篇范文配比全面脱节** | **不通过（阻断 #1、#2、#4）** |
| 例句与情景对话地道度 | 两篇范文、两段对话与改错解答自然地道、指代清晰、逻辑闭环 | 对话 2、例题 2 范文（62 词）与例题 3 改错解答均地道准确；但 **L62 例题 1 范文 `wrap them up` 存在代词指代歧义**、**L46–47 对话 1 问答断层且 `so` 因果松散** | **不通过（阻断 #3）** |

---

## 二、阻断问题明细与修订指令

### 阻断 #1（L21、L96）：`this / last / next` 前「零介词」规则过泛，存在语法失实与跨讲冲突

- **原文位置**：
  - L21：`截止点用 by（配完成动作），持续到某时用 until（配延续动作）；this / last / next 前零介词，单独星期用 on；句首时间锚点加逗号。`
  - L96：`截止用 by 非 until；this / last / next 前零介词（禁 *in next week）。`
- **事实核查**：
  1. **遗漏名词类别限定**：英语中 `this / last / next` 仅在修饰**时间名词**作时间状语时（如 `this week / last Tuesday / next Monday`）不加常规时间介词，置于地点或普通名词前必须按需加介词（如 `in this group`、`on the next page`、`at the next station`）。同类泛写在第 10 讲复核中已作为阻断项（B1-2）统一修正。
  2. **遗漏介词类别限定，与先修第 13–14 讲及本行自身冲突**：即使接时间名词，省略的也仅是 **`in / on / at`**，而非所有介词——先修第 13 讲（`for-since-duration` L23、L69、L91、L113）与第 14 讲（`progress-update-listening` L62）高频使用 `since last year / since last month / since last Friday` 与 `for the last two weeks`，本讲 L21 的截止/持续介词同样合法搭配 `by next Monday / until next Friday`。笼统写「`this / last / next` 前零介词」会直接与先修讲义及本讲 `by / until` 产生矛盾。
- **修订指令**：将 L21 与 L96 同步改为精准表述，例如：
  - L21：`this / last / next 接时间名词作时间状语时不加 in / on / at（仍可按语义配 since / by），单独星期用 on；句首时间锚点加逗号。`
  - L96：`this / last / next 接时间名词时不加 in / on / at（禁 *in next week）。`

### 阻断 #2（L20、L30、L95）：`still` 规则前后自相矛盾、`for / on Tuesday` 缺时间边界，且 L95 孤立标星 `*already have` 误判合法结构

- **原文位置**：
  - L20：`so far、for / since 与未完 this week 用**现在完成时**；yesterday / on Tuesday / ago 立刻切**一般过去时**（and 并列动词同用过去式）；right now / still 用**现在进行时**；交付承诺用 will，个人打算用 be going to，均接原形。`
  - L30：``| `still` | 进行时置 `be` 后；完成否定置 `haven't` 前 | `I'm still working.` |``
  - L95：`肯定 already 置助动词后（禁 *already have / *haven't already）；yet 置分句末（禁 *yet haven't）；still 置 be 后或 haven't 前（禁 *haven't still）。`
- **事实核查**：
  1. **内部自相矛盾（`still`）**：L20 绝对化表述为「`right now / still` 用**现在进行时**」，但仅隔 10 行的表 2（L30）与 L95 均明确指出 `still` 亦用于**现在完成时否定句**（`still haven't ...`），两处口径直接冲突；此外 L30 虽提出「完成否定置 `haven't` 前」，却未给出任何 `still haven't` 正例，且仅列 `haven't` 漏 `hasn't`。
  2. **跨讲边界失准（`for`、`on Tuesday`）**：L20 未给 `for / since` 加「延续至今」限定，与先修第 13 讲（`for-since-duration` L45、L126「见 `for` 盲选完成时」`I lived there for two years.`）存在口径张力；未给 `on Tuesday` 加「过去已结束的」限定，而 `on Tuesday` 在第 7 讲（`future-going-to` L32 `I'm seeing the dentist at 3:30 on Tuesday.`）中同样常表将来。
  3. **孤立错句标星失实（`*already have`）**：L95 对裸片段 `` `*already have` `` 加星禁用，但当 `have` 作实义动词（“拥有”）时，`I already have the notes.` / `We already have a plan.` 是完全正确且高频的 A1–A2 表达；仅在 `have` 作完成时助动词后接过去分词时（`*I already have sent it` / `*already have written`）才构成标准 A2 语序错误。同理，`*haven't already` 也宜写出完整句（`*I haven't sent it already`），避免与高阶条件从句（*if you haven't already...*）混淆。
- **修订指令**：
  - **L20**：修订为「延续至今的 `so far / for / since` 与未完 `this week` 用**现在完成时**；已结束过去时间（`yesterday / ago` 或过去的 `on Tuesday`）立刻切**一般过去时**（`and` 并列动词同用过去式）；表“此刻正推进”配 `right now / still` 用**现在进行时**；交付承诺用 `will`，个人打算用 `be going to`，均接原形。」
  - **L30**：将 `haven't` 补全为 `haven't / hasn't`，并在示范栏补充完成否定正例（如 `` `I'm still working.` / `I still haven't sent it.` ``）。
  - **L95**：将 `` `*already have` / `*haven't already` `` 修订为带过去分词的完整或清晰错例（如 `` `*I already have sent it` / `*I haven't sent it already` ``），同时将「完成否定置 `haven't` 前」顺手与 L30 对齐。

### 阻断 #3（L62 例题 1 范文、L46–47 对话 1）：例题 1 `wrap them up` 指代歧义，对话 1 问答脱节且 `so` 因果松散

- **原文位置**：
  - L62（例题 1 范文第 4–5 句）：`Right now, I am still working on the slides, and I have not checked the notes yet. Next week, I will wrap them up by Monday and follow up with clients.`
  - L46–47（对话 1 第 3–4 轮）：
    - 瑞秋：`Nice! Have you checked the notes yet?`（很好！笔记核对了吗？）
    - 丹尼尔：`Not yet. I'm still working on the slides, so I'll wrap them up by Monday.`（还没。我还在做幻灯片，周一前会收尾。）
- **事实核查**：
  1. **例题 1 范文代词指代歧义（L62）**：第 4 句出现两个复数名词 `the slides` 与 `the notes`，紧邻第 5 句的复数先行词是 `the notes`；第 5 句随即使用 `wrap them up`，按就近原则指向 `the notes`（“尚未核对笔记”却用 `wrap up` 收尾不合英语搭配），若意指 `the slides` 则被 `the notes` 隔断且未交代笔记何时核对。尤其 L64 专门把 `wrap them up` 作为可分短语「代词中置」范例讲解，核心范文更不容出现代词先行词歧义。此外，`Next week, I will wrap them up by Monday` 将 `Next week` 与紧贴周初的 `by Monday` 叠放，语感略显局促（改为 `by Tuesday` 或把 `next week` 移至 `follow up with clients next week` 更自然）。
  2. **对话 1 问答逻辑断层（L46–47）**：L46 瑞秋询问的是**笔记**（`the notes`），L47 丹尼尔答 `Not yet.` 后未交代因果即转向**幻灯片**（`I'm still working on the slides`），再用 `so` 连接 `I'll wrap them up by Monday`——“还在做幻灯片”并非“所以周一前会收尾”的严谨因果（中文译文甚至被迫省去“所以”与宾语来掩盖突兀感），且 `the notes` 悬空未落、代词 `them` 在 `notes / slides` 间指代不清。
- **修订指令**：
  - **L62（例题 1）**：调整第 4–5 句结构使 `wrap them up`（或 `wrap it up`）先行词唯一且两项待办均有清晰交代，例如：
    - 方案 A（保持 `wrap them up` 代词中置且指代 `the slides` 唯一清晰）：第 4 句改为 `I have not checked the notes yet because I am still working on the slides.`，第 5 句改为 `Next week, I will wrap them up by Tuesday, check the notes, and follow up with clients.`（或单复数错开，如将 `the notes` 改为 `the final note / checklist` 或将 `slides` 改为单数 `slide deck` 对应 `wrap it up`），并同步更新 L58 题干、L60 总词数（确保落于 60–80 词）及 L64 逐句词数拆解。
  - **L46–47（对话 1）**：打通问答逻辑链与 `them` 指代（二选一）：
    - 方案 A（扩为 6 轮，兼顾 `notes` 与 `slides` 闭环）：L47 改为 `Not yet, because I'm still working on the slides.`（还没，因为我还在做幻灯片。）；增 L48 瑞秋 `No problem. When will you finish the slides?`（没关系。幻灯片什么时候完成？）；增 L49 丹尼尔 `I'll wrap them up by Monday and check the notes right after.`（我周一前把幻灯片收尾，紧接着就核对笔记。）；
    - 方案 B（维持 4 轮、极简控字）：L46 改为 `Nice! Have you finished the slides yet?`（很好！幻灯片做完了吗？），L47 改为 `Not yet. I'm still working on them, and I'll wrap them up by Monday.`（还没。我还在做，周一前会把它们收尾。）。

### 阻断 #4（L14–18 表 1 与 L62、L72）：表 1 三要素词数配比与顺序跟两篇范文全面矛盾

- **原文位置**：L14–18 表 1，对照 L62（例题 1，64 词）、L64 逐句拆解与 L72（例题 2，62 词）。
- **事实核查**：逐句实测两篇示范短文各板块精确词数如下：

| 写作板块 | 表 1 规定区间（L16–18） | 例题 1 实测（L62，64 词） | 例题 2 实测（L72，62 词） | 核对结果 |
| --- | --- | --- | --- | --- |
| 可选开场 | 未单列 | 7 词 | 0 词 | — |
| **已完成 + 进行/待办** | **22–28 词**（置于过去节点前） | **31 词**（14 + 17，被过去节点隔开） | **37 词**（24 + 13，被过去节点隔开） | **两篇均超出上限且语序不符** |
| **关键过去节点** | **18–24 词** | **12 词** | **11 词** | **两篇均显著低于下限** |
| **下一步与收尾** | **18–26 词** | **14 词**（无单独收尾句） | **14 词**（无单独收尾句） | **两篇均显著低于下限** |

两篇唯二示范短文的**每一项要素均落在表 1 区间之外**，且实际采用的都是「已完成 → 关键过去节点 → 进行/待办 → 下一步」顺序；L64 解析又将 `14 / 12 / 17 / 14` 词数显性标出，使表 1 指导与示范解答直接自相矛盾。
- **修订指令**：按 60–80 词实战结构重新校准表 1 词数区间（例如：**已完成与进行/待办**约 `26–38 词`、**关键过去节点**约 `10–18 词`、**下一步与可选收尾**约 `12–22 词`，并注明可加 `6–8 词` 轻开场且「进行中/待办项可紧跟已完成项，也可置过去节点后自然衔接下一步」），使表 1 与修改后的两篇示范短文 100% 吻合。

---

## 三、逐段复核明细（通过项核验）

1. **标题、导语、概念锚点与 A2 边界（L1–8）**：
   - L1 与 L5 标题同 `syllabus.json`、`budget_plan.json` 逐字一致；L6 精准写入 `<!-- concepts: status-summary-writing -->`；L8 在首次出现错句前即申明 `* 标错句`，准确划定 A2 边界（不用现在完成进行时，将完整邮件格式与条件句留待后续单元）。
2. **表 2 进度副词与表 3 进展短语（L24–38，除阻断 #2 中 L30 补例建议外）**：
   - `already / yet / still` 核心分工准确；表 3 全部 9 组高频短语与搭配（`make progress` 不可数不配 `do`、`work on / go over` 不可分且 `work on / finish` 接名词或 `-ing`、`send out / hand in / wrap up` 可分代词中置及不规则/双写变形 `sent / wrapped`、`wait for / catch up on` 不可分不省介词、`follow up with 人 / on 事`）语法属性经核均准确无误。
3. **对话 2：英语学习搭子复盘（L49–54）**：
   - 4 轮对话（`you've studied here for four weeks`、`I've made steady progress`、`Yesterday, I went over my notes`、`Have you practiced speaking yet?`、`Not yet. Next week, I'm going to catch up on speaking and review new words.`）语法准确、衔接自然、中译贴切、缩写风格通篇一致。
4. **例题 1 词数核算（L60、L62、L64）**：
   - 实测各句词数 `7 + 14 + 12 + 17 + 14 = 64` 词，与 L60 `64 词` 及 L64 逐句计数完全一致，且通篇严格保持完整形（`here is / I have already / I am still / I have not / I will`）；修订阻断 #3 后须同步复算并更新 L60 与 L64 词数。
5. **例题 2：英语学习打卡小结（L66–74）**：
   - 实测各句词数 `12 + 12 + 11 + 13 + 14 = 62` 词，与 L70 `62 词` 及 `60–80 词` 要求完全吻合；完整覆盖题干 4 项要点，四态切换精准，分句末 `yet` 接 `because` 引出进行时自然地道，通篇严格保持自然缩写（`I've / haven't / I'm`）。
6. **例题 3：病句诊改与去流水账升级（L76–88）**：
   - 第 1 组（L80 → L85：`Yesterday, I finished the draft. I'll send it out by Friday and follow up with clients.`）与第 2 组（L81 → L86：`I've already written the draft and made good progress. I haven't finished checking it yet, so I'll do that tonight.`）解答均语法无瑕、表达地道、缩写一致，精准纠正时态、`by / until`、代词中置、`follow up with`、`already / yet` 语序、不可数 `progress`、`finish + -ing`、逗号黏连与将来时。
7. **常见错误其余条目与四步自检（L90–100，除阻断 #1、#2 涉及处外）**：
   - L94（`*I live here for two years`、`*Yesterday, I have sent`、`*has wrote`）、L96 前半（`*I still wait`、`*have working`、`by` 非 `until`）、L97（`*... yet, I do it.` → `... yet, so I'll do it.`）与 L98（`*do a progress`、`work on / finish` 禁接 `to do`、`send it out`、`follow up with`、`weekly update`）均确属典型失误且修正准确。

---

## 四、非阻断润色建议（修订阻断项时可一并采纳）

以下 4 处不构成阻断，建议在修复 4 项阻断时顺手微调（注意将修订后等效阅读量保持在 **`2,630–2,725`** 左右，稳守 `1.0–1.25×` 建议上限及下游 `η <= 1.40` 严格课时门）：

1. **L95 替换未解释语言学术语「极性」**：将「`副词错位与极性混用`」改为「`副词错位与肯定/否定句混用`」（对齐第 12 讲 `ever-never-already-yet` 去术语标准）。
2. **L88 补全例题 3 改错说明并给 `draft` 加注释义**：L86 第 2 组还将 `*I do it tonight` 改为了 `I'll do that tonight`（一般现在时改将来时 `will`）并统一了 `I've` 缩写，建议在 L88 顺手点明「改 `will` 表今晚行动」；另 `draft`（草稿/初稿）首次出现于 L80，可加注中文释义。
3. **L22 措辞更精准**：将「`用 and 省重复主语或助动词`」改为「`用 and 省重复主语（及同助动词）`」（避免误读为可保留主语仅省助动词）；将「`口语打卡多用缩写`」改为「`口语与日常打卡多用缩写`」。
4. **L36 与 L94 细节微调**：表 3 L36「`过去式 sent / wrapped`」改为「`过去式/分词 sent / wrapped`」（呼应完成时 `have sent out`）；L94「`*Yesterday, I have sent` → `sent`」补宾语为「`*Yesterday, I have sent it` → `sent it`」。

---

## 五、最终结论

本讲义在知识点锚点、无 `无资料`/占位文本、Markdown 安全、CEFR A2 级别把控、例题 2 与例题 3 质量及等效阅读量（`2,628 >= 2,180`，预测 `η = 1.10`）上均达标，但须先修正 **① L21/L96 `this / last / next` 零介词过泛、② L20 与 L30/L95 `still` 内部矛盾及 L95 孤立 `*already have` 误标、③ L62 例题 1 `wrap them up` 指代歧义与 L46–47 对话 1 逻辑断层、④ 表 1 词数配比及顺序与两篇范文脱节** 4 项阻断问题后复审放行。
