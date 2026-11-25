# 事实复核报告：第 2 讲「数量表达（some / any / much / many / a lot of）」

- **复核对象**：`docs/research/beginner-english-a2-expansion/quantifiers-amounts/lesson_draft.md`（101 行，9,554 字节）
- **核查基准**：`docs/research/beginner-english-a2-expansion/quantifiers-amounts/budget_plan.json`、`docs/research/beginner-english-a2-expansion/syllabus.json`、`docs/research/beginner-english-a2-expansion/countable-articles/lesson_draft.md`、`scripts/lib/effort-audit.mjs`
- **复核结论**：**通过（PASS）** — 英语语法规则与例题解答准确无误、CEFR A1+ 级别适配得当、双语情景对话与例句自然地道、全文无 `无资料` 等占位符且无自相矛盾解释；概念锚点、例题数量与等效阅读量等全部定量门禁均已达标，第 32 行容器公式粗体标记亦已确认经 `micromark` 正常渲染。无阻断项，另有 2 条可选非阻断微调建议及 1 条下游课时门余量提示供参考。

---

## 一、门禁、锚点与等效阅读量核查

| 核查项 | 要求基准 | 实测结果 | 判定 |
| --- | --- | --- | --- |
| 禁用占位文本 | 严禁 `无资料`、`TODO`、`TBD`、`Replace this lesson` | 全文 0 处匹配 | 通过 |
| 知识点锚点 | 每个知识点小节含 `<!-- concepts: <id> -->`（`quantifiers-amounts`） | 第 5 行 `## 数量表达（some / any / much / many / a lot of）` 下一行（第 6 行）精确写入 `<!-- concepts: quantifiers-amounts -->`；经 `scripts/lib/effort-audit.mjs` `attributeLesson()` 验证精确匹配 1 个小节 | 通过 |
| 自评 `effort-lab` 锚点 | 仅零题自评知识点需含 `effort-lab` 锚点与编号步骤+清单 | `budget_plan.json` 与 `syllabus.json` 均声明本讲为 `skill_focus: grammar_core`、规划 9 道计分题，未配置 `effort_lab`，非零题自评知识点 | 不适用（合规） |
| 例题与常见错误结构 | `min_examples >= 2`，含 `### 例题` 与 `### 常见错误` | 含 3 个 `### 例题`（第 60、71、81 行）与 1 个 `### 常见错误`（第 92 行） | 通过 |
| Markdown 渲染完整性 | 无原始 HTML 标签（如 `<br>`），粗体与反引号正确闭合 | 0 处原始 HTML 标签；经项目内 `micromark` + GFM 实测渲染 2 张表格、1 处引用块、0 处未解析 `**`、0 处未闭合反引号；第 32 行公式正常渲染为 `公式为「<strong>a / an / 数词 / 数量词 + 容器或单位词 + of + 名词</strong>」。` | 通过 |
| 等效阅读量（`quantifiers-amounts`） | `中文字数 + 3×英文词数 >= 1944` | 仅 `##` 小节正文（去 HTML 注释）：`1321 + 3×672 = 3337`（含注释 `1321 + 3×674 = 3343`）；按 `effort-audit.mjs` 归属（导语池 + `##` 正文）：`1369 + 3×681 = 3412`；全文件：`1373 + 3×688 = 3437`（去注释 `1373 + 3×686 = 3431`） | 通过（超出基准 71.7%–76.8%） |

> **下游课时门余量提示（非阻断）**：按 `scripts/lib/effort-audit.mjs` 算法计算，当前讲义归属阅读时长 `readMin = 13.6427 min`（`1369/250 + 681/90 + 0.15×4`），折合设计学习工时 `1.8 × 13.6427 = 24.56 min`（高于 `budget_plan.json` 预算的 `14.0 min`）。叠加规划题库工时 `27.5 min` 后，预计概念总工时约 `52.06 min`（相对 `estimated_minutes = 40` 的 `η = 1.30`，仍处于 `[0.70, 1.40]` 平衡区间内，距 `strict_effort: true` 告警上限 `56.0 min` 还有 `3.94 min` 余量）。后续命制 9 道 v2 题目时应控制听力、完形与写作篇幅，确保总估算不超过 `56.0 min`。

---

## 二、英语语法准确性逐段核查

1. **两步判定与可数性基础（第 8 行）**：
   - 复数可数名词（`eggs, chairs`）、不可数名词（`milk, paper, time`）分类准确；单数可数名词表数量时使用 `a / an / one`、不能用 `*some pen` 的界定符合 CEFR A1+ 数量词教学范围。
2. **核心数量词搭配表（第 12–22 行）**：
   - `some`（复数可数/不可数；肯定句及礼貌提议/请求问句；`There be` 看中心名词）：例句 `We need some paper.` 与 `Would you like some tea?` 语法准确、自然。
   - `any`（复数可数/不可数；否定句及普通信息疑问句；`There be` 看中心名词）：例句 `There isn't any milk.` 与 `Do you have any questions?` 准确。
   - `a lot of` / `lots of`（复数可数/不可数；肯定句首选、否疑亦可用、`lots of` 更口语；`There be` 看中心名词）：例句 `We have a lot of work today.` 准确自然。
   - `many`（仅复数可数；否定/疑问首选、肯定句偏正式；配 `are`）与 `much`（仅不可数；否定/疑问首选、日常肯定句不单用；配 `is`）：例句 `There aren't many chairs left.` 与 `I don't have much free time.` 均准确，且“日常肯定句不单用”的限定与下文 `too / so / as + much` 严格自洽。
   - `a few`（仅复数可数；肯定句常用；配 `are`）与 `a little`（仅不可数；肯定句常用；配 `is`）：例句 `We still have a few minutes.` 与 `There is a little juice left.` 均准确。
3. **四条关键使用细则（第 24–28 行）**：
   - **礼貌特例与等价否定（第 25 行）**：`Is there any coffee?` 对比 `Would you like some...?` 与 `Can / Could I have some...?` 准确；`not ... any` 与肯定动词加 `no`（`There is no milk left.`）等价，禁止叠用否定词（`*There isn't no milk.`）或叠用限定词（`*There is no any milk.`）表述严谨。
   - **肯定句“很多”与 `of` 边界（第 26 行）**：限定在“`too / so / as` 后面接数量词时”必须用 `much / many` 而非 `a lot of`（`too much salt`, `so many meetings`），未过度泛化；`a lot of` 接名词必带 `of`、句末无名词去掉 `of`（`Thanks a lot.`）准确。
   - **切勿漏 `a`（第 27 行）**：`a few / a little`（积极、还有一点/几个）与 `few / little`（偏书面、否定“几乎没有”，口语宜用 `not many / not much`）辨析准确。
   - **`How many` vs `How much`（第 28 行）**：问数量按可数性区分（`How many eggs?` / `How much milk?`），问商品价格一律用 `How much` 且 `be` 动词随单复数变化（`How much is this bag?` / `How much are these apples?`），准确无误。
4. **容器量词与 `enough + 名词`（第 30–38 行）**：
   - 第 32 行公式覆盖 `a / an / 数词 / 数量词 + 容器或单位词 + of + 名词`，明确超过 1 份时复数加在容器/单位词词尾、不可数名词不加 `-s`、成盒包装的可数物品（如 `paper clips`）保持复数，且 `There be` 随容器/单位词单复数变化，与表 2（`two bottles of water`、`a carton of milk`、`a loaf of bread`、`a jar of honey`、`two packets of tea`、`three packs of printer paper`、`a box of paper clips`、`a few sheets of paper`、`There is a box of paper clips here.`）完全一致。
   - `enough + 复数可数 / 不可数名词`（`enough time / money / chairs / printer paper`）与例句 `Do we have enough chairs?` 准确。
5. **三道例题、解答与解析（第 60–90 行）**：
   - **例题 1**：`How much milk is left?`、`How many bottles of juice do we need?`、`How much are these apples?` 答案唯一，解析准确。
   - **例题 2**：明确“每词限用一次”，填入 `(1) a lot of`、`(2) many`、`(3) much`、`(4) some`、`(5) any` 后，整段英文（`We have a lot of notebooks already, so we don't need to buy more. There aren't many chairs in the meeting room, and we don't have much paper left. Could you order some paper and check if there is any coffee?`）语法完全正确、语用自然，且严格对应表 1 分工，无多解歧义。
   - **例题 3**：`*I have a few money left.` → `a little money`、`*There are a few folder here.` → `a few folders`、`*We have little time, so let's enjoy a cup of coffee.`（配合中文意图提示）→ `a little time`，三题错误识别、改正与解析全部准确。
6. **常见错误与三步自查口诀（第 92–101 行）**：
   - 准确归纳 4 类中文母语干扰错因；第 98 行谨慎限定“泛指名词前不加 `of`（正：`a few friends`）”，避免与部分结构 `a few of my friends` 冲突；第 99 行明确 `*a lots of` 与容器短语中不可数名词禁加 `-s`；第 101 行三步口诀与全文规则一致。

---

## 三、CEFR 级别适配与先修衔接核查

- **目标级别对齐**：`syllabus.json` 与 `budget_plan.json` 设定本讲为 **CEFR A1+**（第 11 单元第 2 讲，承接 `countable-articles` 与 `numbers`）。
- **词汇与语法负荷**：去 HTML 注释后全文共 126 个不重复英文词元（剔除词尾标记 `-s` 与缩写 `vs` 后为 124 个高频词），全部处于 A1–A2 核心生活与办公词汇范围（如 `fridge`, `carton`, `loaf`, `jar`, `bakery`, `packets`, `packs`, `printer paper`, `paper clips`, `meeting room`, `visitors`, `folders`），无 B2+ 超纲词；句法聚焦一般现在时、`There is / are`、祈使句（`Let's ...`、`Please buy ...`）及高频礼貌情态问句（`Would you like ...?`、`Can / Could ...?`），仅在合适语境自然衔接 A2 实用表达 `stop by`（附中文“顺路去”）、`By the way`（“顺便问一下”）与 `check if there is...`，梯度合理。
- **先修课一致性**：与第 1 讲 `countable-articles/lesson_draft.md` 保持一致（`coffee`, `water`, `milk`, `bread`, `paper`, `information`, `work` 的不可数属性与 `a cup of coffee`、`a bottle of water`、`a sheet of paper` 等量词表达无缝衔接，无冲突）。
- **大纲主题与语境覆盖**：完整覆盖 `syllabus.json` 的 `topic_1`–`topic_3`（含 `Would you like some...?`、`two bottles of water`、`two packets of tea`、`enough time` 与三类高频误区），全篇保持通用日常与办公语境，未混入无关车间/制造术语。

---

## 四、例句地道度与内部一致性核查

- **例句与对话地道度**：
  - **情景一（第 42–49 行）**：`Do we have any milk or eggs left in the fridge?`、`There is only a little milk left, and we only have a few eggs.`、`a carton of milk and a carton of eggs`、`We have a lot of rice, so we don't need any.`、`Do we have enough time to stop by the bakery for some bread?`（疑问句目的状语中表预期采购用 `some bread` 地道自然）及答句 `Yes, we do. Let's go!` 均自然贴近母语日常口语，中译准确。
  - **情景二（第 51–58 行）**：礼貌招待（`Would you like some coffee or tea?`）、礼貌请求（`Can I have some coffee with a little milk?`）、库存询问与衔接补货（第 56 行指出纸杯仅剩几个，第 57–58 行自然回应并将 `some paper cups` 纳入最终订购清单，配合口语简答 `Not much, just a few sheets.`）前后呼应、职场语气得体。
  - **例题英文**：三道例题语境真实、搭配地道（如 `enjoy a cup of coffee`、`in the meeting room`、`bottles of juice`）。
- **内部一致性**：规则表、四条使用细则、容器量词公式、两段情景对话、三道例题与常见错误在名词可数性、句式语气分工、`There be` 主谓一致及 `of` 边界等所有规则上前后统一，无自相矛盾之处。

---

## 五、非阻断优化建议（可选）

以下两处均不构成语法错误或门禁阻断，可视后续润色需要酌情采纳：

1. **补注 `only / just + a few / a little` 的语气变化（第 27 行）**：表 1 将 `a few / a little` 简标为“几个/一点（**够用**）”，而两段对话均地道使用了 `only a little milk left`、`only have a few eggs`、`only a few`、`just a few sheets` 强调“所剩偏少、需要补货”。二者在英语语法中并不矛盾（`only / just` 叠加后转为限定强调数量少，且此时 `a` 仍不可省），若在第 27 行补半句提示（如“前加 `only / just` 时转为强调‘只剩一点/几个，偏少’，且仍须保留 `a`”），可进一步帮助初学者把规则表与情景对话直接打通。
2. **微调第 8 行措辞精度（第 8 行）**：`单数可数物品须用 a / an / one（不能说 *some pen）` 可将“单数可数物品”改为“单数可数名词”（与后文非实物可数名词 `minutes / questions / meetings` 更一致），并将反例置于短语/整句语境（如 `*I need some pen`），表达更严谨。
