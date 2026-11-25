# 事实复核报告：冠词与名词可数性（`countable-articles`）

- **核查对象**：`docs/research/beginner-english-a2-expansion/countable-articles/lesson_draft.md`（107 行，10,654 字节）
- **对照依据**：`budget_plan.json`、`syllabus.json`（第 1 讲，目标级别 `CEFR A1+`，`min_read_units = 1944`，`min_examples = 2`，含 9 道配额题、非零题自评节点）、`courses/beginner-english/course.json`（先修单元范围）及 `scripts/lib/effort-audit.mjs`
- **核查结论**：**通过（无阻断项）**——结构锚点、无 `无资料`/占位符与等效阅读量均达标；前轮 4 项阻断问题已全部闭环修复；全文英语语法、音素标注、规则自洽性、CEFR A1+ 适配度及例句/对话地道度均通过复核。

---

## 一、核心核查项总览

| 核查维度 | 状态 | 实测结果与说明 |
| --- | --- | --- |
| `<!-- concepts: <id> -->` 锚点 | **通过** | 第 5–6 行包含 `## 冠词与名词可数性（a / an / the 与复数）` 及紧随其后的 `<!-- concepts: countable-articles -->`，与 `budget_plan.json` 完全一致。 |
| `effort-lab` 自评锚点与步骤清单 | **不适用（通过）** | `countable-articles` 为常规语法核心节点（`skill_focus: "grammar_core"`，配额 9 题，`planned_item_design_min = 27.5`），并非零题口语/实操自评，无需 `effort-lab` 锚点。 |
| 无 `无资料` 及占位符 | **通过** | 全文检索 `无资料`、`TODO`、`TBD`、`FIXME`、`Replace this lesson` 及原始 HTML 标签（如 `<br>`）均为 `0` 处；无无关车间/工厂术语混入。 |
| 等效阅读量（`中文字数 + 3×英文词数`） | **通过** | 阈值 `1944`（均远超达标线）：<br>- 按 `effort-audit.mjs` 归属口径（导语池 + 匹配 `##` 正文，不含 `##` 标题行）：中文 `1600` 字 + 英文 `671` 词 = **`3613`**（剔除 HTML 注释后 `669` 词 = **`3607`**）。<br>- 仅 `##` 小节正文：中文 `1544` 字 + 英文 `661` 词 = **`3527`**（剔除 HTML 注释后 `3521`）。<br>- 全文原始统计：中文 `1611` 字 + 英文 `674` 词 = **`3633`**（剔除 HTML 注释后 `3627`）。<br>- 含 2 道 `### 例题`（满足 `min_examples = 2`）与 1 节 `### 常见错误`；按 `effort-audit.mjs` 折算 `readMin = 14.31m`、`lectureDesignMin = 25.75m`，叠加计划题库耗时 `27.50m` 后合计 `53.25m`（`η = 1.33`，处于 `0.70–1.40` 平衡区间）。 |
| 英语语法与语音准确性 | **通过** | 可数/不可数分类、规则与不规则复数拼写、`-s/-es` 词尾 `/ɪz/ /s/ /z/` 读音、`a/an` 首音素判定（含 `/aɪ/ /eɪtʃ/ /juː/ /wʌn/`）、`the` 强弱/元辅音前读音（`/ðə/ /ði/`）、`a/an` 弱读连读、例题解答与 6 条常见错误解析全部准确无误。 |
| 无自相矛盾解释 | **通过** | 全文统一表述为单数可数名词“**通常不可裸用**（除下文零冠词固定搭配外）”（L14、L48、L96、L102），并在表格 3（L46）与三步速判法（L48）中明确先判固定搭配例外，与 `by subway / pay by card / by email / at home` 逻辑闭环。 |
| CEFR 级别适配（A1+） | **通过** | 衔接先修 `there-is-are` 与 `demonstratives`，场景聚焦咖啡馆点单、日常购物与办公室协作；对 `receipt`（`p` 不发音）、`loaf`、`advice/furniture/luggage/equipment` 及 `/ɪz/` 尾音提供初学者友好支架。对话 2 出现的 `I'll` 与 `yours / mine` 属高频透明口语块，不影响 A1+ 理解。 |
| 例句与对话地道度 | **通过** | 两段双语对话、两道例题标准答案与全部表格例句均合语法、自然流畅，英中译文严格对应。 |

---

## 二、前轮阻断项闭环核验

| 前轮编号 | 原阻断问题 | 现行稿件核验结果 | 对应行号 |
| --- | --- | --- | --- |
| B1 | 单数可数“绝不裸用”与 `by email / pay by card / by subway` 零冠词固定搭配矛盾；`in cash` 归类不严谨及国名例外位置易误读 | **已闭环**：L14、L48、L96、L102 均已统一改为“通常不可裸用（除下文零冠词固定搭配外）”；L45 补入 `in China` 后再标 `（国名例外：the UK, the US）`；L46 明确标出 `④ 交通/支付/联络固定搭配（单数亦省略冠词：by + 交通/联络/card，in cash）`；L48 三步速判法第一步先判固定搭配与可数性，逻辑自洽。 | L14、L45–46、L48、L96、L102 |
| B2 | `a / an` 表格误称“字母 `u` 读 `/j/`、`o` 读 `/w/`” | **已闭环**：L33 已更正为 `u（含 USB）在此读 /juː/（以辅音 /j/ 开头）、one 读 /wʌn/（以辅音 /w/ 开头）；hotel 的 h 发音 /h/`，语音事实准确。 | L33 |
| B3 | 常见错误第 5 条错例与规则错配；第 6 条误将合法短语 `a paper to print` 标星判错 | **已闭环**：L106 并列 `*two childs / *two childrens / *two peoples` 并给出清晰说明“不规则名词须记特殊变形且变形后禁再加 `-s`（`two children / two people`）”；L107 改用无歧义打印纸错例 `*Put a paper in the printer.` / `*load two papers into the printer` 并给出完整正例对比。 | L106–107 |
| B4 | 例题 2 第 2 句中文含“你的”但译文漏译，且 `Thanks for the piece of advice.` 偏生硬 | **已闭环**：L90 改为“谢谢那条建议，这个消息太棒了。”，L94 对应 `Thanks for that piece of advice. The news is great.`，L96 同步补充泛指常用表达 `Thanks for your advice.`，忠实自然。 | L90、L94、L96 |

---

## 三、分模块事实核查明细

### 1. 名词可数性与复数规则（L10–24）

- **名词分类与词表（L14–18）**：单数可数例词（`a receipt`、`an umbrella`、`an email`）、规则复数（`eggs`、`boxes`、`cities`、`keys`、`loaf → loaves`、`photos`）、不规则复数（`person → people`、`man → men`、`woman → women`、`child → children`、`foot → feet`）、12 个不可数核心词（`water, milk, bread, paper, information, advice, news, work, cash, furniture, luggage, equipment`）及容器量词（`a cup of coffee → two cups of coffee`、`a bottle of water`、`a slice of bread`、`a sheet of paper`）均完全准确，且 `receipt` 中 `p` 不发音的提示正确。
- **复数拼写与词尾读音（L22–23）**：拼写规则区分“辅音字母 + `y`”与“元音字母 + `y`”，对 `-f/-fe → -ves` 准确限定为“部分”；读音规则先列出带嘶/吱尾音的 `-s/-x/-z/-ch/-sh/-ce/-ge` 等后读 `/ɪz/` 且多一音节（`boxes, watches, offices`），再用“其余清辅音后读 `/s/`（`cups`）、其余浊辅音及元音后读 `/z/`（`bags, keys`）”严格排他，音位描述无误。
- **兼类词与后续衔接（L24）**：`coffee / two coffees`、`paper / a paper`、`room / a room` 对比准确；“完整数量词体系将在下一讲展开”与 `syllabus.json` 第 2 讲 `quantifiers-amounts` 吻合。

### 2. 冠词规则与三步速判法（L26–50）

- **不定冠词 `a / an`（L28–36）**：12 组示例（`an umbrella`, `an hour`, `an honest answer`, `an ID card`, `an HR manager`, `a university`, `a useful app`, `a one-way ticket`, `a hotel`, `a USB drive`, `a blue umbrella`, `an online meeting`）及四大用法例句（`I bought a sandwich.`, `A receipt is useful for returns.`, `She is an accountant.`, `twice a week`, `once an hour`）全部语法正确、音素说明精准。
- **定冠词 `the` 与零冠词 `Ø`（L38–46）**：`/ðə/`（辅音音素前）与 `/ði/`（元音音素前）读音准确；`the` 五类场景示例、零冠词泛指/专有/固定搭配示例（`Apples are sweet.`, `I drink coffee.`, `on Monday`, `in China`, `the UK, the US`, `have lunch`, `go to work by subway`, `pay by card / in cash`, `by email`, `at home`）均准确无误。
- **衔接例句（L50）**：`There is an umbrella by the door, and there is some paper in the printer.` 准确联动先修 `there is/are` 与本讲可数/不可数、冠词规则，表达自然。

### 3. 双语对话、例题与常见错误（L52–107）

- **对话 1（L54–60）**：5 轮点单与结账对话语法正确、礼貌得体，完整覆盖 `a cup of coffee`、`a slice of cake`、`pay by card`、`a receipt → the receipt`、`for work` 及 `The coffee and the cake are ready at the counter.`。
- **对话 2（L62–68）**：5 轮办公打印对话场景连贯，正确示范 `out of paper`、`a meeting`、`some paper`、`the file`、`by email`、`two sheets of paper`、`that umbrella by the door`、`an hour`。
- **听说提示（L70）**：`a` 弱读 `/ə/`、`an` 弱读 `/ən/` 并与后词元音连读（`an hour`, `an umbrella`），以及复数尾音 `/s/ /z/` 不可吞音的语音提示准确实用。
- **例题 1 & 例题 2（L72–96）**：
  - 例题 1 五空答案（`an / a / a / an / a`）与两句改错（`I need some information and two sheets of paper.`；`He is a designer and goes to work by subway.`）及解析全部正确。
  - 例题 2 两句汉译英（`There are two slices of bread, a cup of coffee, and a receipt on the table.`；`Thanks for that piece of advice. The news is great.`）严格对应中文题干，就近原则、量词复数化与 `news` 配单数 `is` 解析精准。
- **常见错误 1–6（L98–107）**：全部 16 个标星错例在标准英语（或标注的泛指语境）下均确属偏误，对应改写与归因完全一致，无误判合法表达的问题。

---

## 四、非阻断观察与后续建议（不影响通过）

以下 4 点均非事实错误，不阻断本稿定稿，供后续题库编写或润色参考：

1. **下游题库耗时余量提醒（`effort-audit --strict`）**：本讲等效阅读量已达标且 `lectureDesignMin ≈ 25.75m`；若后续题库严格按 `planned_item_design_min = 27.50m` 编写，总估算约 `53.25m`（`η ≈ 1.33`），距 `--strict` 偏重告警阈值 `η = 1.40`（`56.00m`）余量约 `2.75m`。建议后续出题控制实际题库设计耗时在 `<= 30.2m` 以内，避免触发 `OVER_STUFFED_CONCEPT`。
2. **对话 2 第 64 行地道度微调**：`I have a meeting outside.` 语法正确且结合下文下雨语境可理解；若后续润色，可改为 `I have a meeting outside the office.` 或 `I have a meeting out of the office.`，避免偶发被理解为“露天开会”。
3. **三步速判法第 48 行表述外延**：步骤 ③ 写“单数首次提及，按紧邻词首音素选 `a / an`”，后续若微调可写作“其余单数可数（如首次提及/职业身份/分类泛指），按紧邻词首音素选 `a / an`”，与第 36 行四大用法更严密对应。
4. **表格 3 第 44 行最高级示例**：`⑤ 序数词/最高级` 右栏仅列了序数词 `on the second floor`（兼顾最高级将在第 14 单元展开的梯度，合理可行）；如需对称展示，后续可顺手补高频浅显词块 `the best coffee`。
