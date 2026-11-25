# 语言与结构复核报告：`directions-transport/lesson_draft.md`

- **审查对象**：`docs/research/beginner-english-a2-expansion/directions-transport/lesson_draft.md`（129 行，10,348 字节；去注释中文 1,464 字，英文 717 词，165 个独立英文词形）
- **课程定位**：第 12 单元第 6 讲「问路、交通出行与地点导航」（CEFR A2，`listening_speaking`，45 分钟，通用日常与职场英语，无车间背景）
- **课时门余量实测**：按 `scripts/lib/effort-audit.mjs` 的 `attributeLesson()` 实测，概念归属 `cjk = 1453`、`en = 719`（等效阅读量 `3610`，达标基线 `target_read_units = 2180`）、`readMin = 14.4009`、`lectureDesignMin = 25.92`；叠加 `budget_plan.json` 规划题库 `29.2` 设计分钟合计 `55.12` 分钟 / 声明 `45` 分钟（`ratio = 1.225`），低于 `1.40`（`63.0` 分钟）严格告警上限，尚余 `7.88` 设计分钟余量。
- **总体结论**：**通过（PASS，无阻断性问题）**
- **复核摘要**：上轮审查指出的 3 类阻断性问题（B1 两段对话自然度/闭环与地铁广播硬拼接、B2 例题 1 改错正解中式直译及例题 2 计数与角色混拼、B3 规则表指代歧义/词性标注失准/听说专项空心化与词块缺释义）以及主要润色建议均已逐项落实并通过实测复核。全文英文对话、报站广播与例题地道自然，词汇严格契合 CEFR A1–A2；通用日常与职场通勤语境纯粹（193 个中英文车间/工业关键词检索 **0 命中**）；中文讲解清晰无歧义；经 `react-markdown`（`skipHtml: true`、`disallowedElements: ['img']`、`h1–h4 → h3–h6` 映射）与 `remark-gfm` 渲染实测，除概念锚点注释 `<!-- concepts: directions-transport -->` 外零原始 HTML、零未解析标记与格式瑕疵。四个维度均达到发布标准。

---

## 一、四维度审查总览

| 审查维度 | 判定 | 核心评估 |
| --- | --- | --- |
| 1. 英文对话自然度（含广播、例句与例题英文） | **通过** | 情景一（L46–53，8 轮）补齐复述核对与礼貌致谢道别；情景二（L57–64，8 轮）补齐改打车过渡、自然口语估算与道别收尾，并与独立小节的地铁车厢广播（L66–70）逻辑分离；3 道例题与表格英文全部地道自然、符合 CEFR A1–A2 难度。 |
| 2. 通用日常/职场语境一致性 | **通过** | 全文聚焦街头问路、地铁换乘、办公楼赴约与打车通勤；经逐行审阅及 107 个中文 + 86 个英文（共 193 个）车间/制造类关键词全量检索，**0 处**无关车间术语混入（上轮提及的「班次」亦已改为「车次或方向」）。 |
| 3. 中文讲解清晰度 | **通过** | 表 1/表 2 歧义与词性标注全部修正，新增词块中文释义齐全，听说专项补齐重读/升降调图例、3 组英文示范句、`/f/` vs `/θ/` 发音方法与 3 组连读实例，常见错误边界准确、措辞平实易懂。 |
| 4. Markdown 结构可读性 | **通过** | 标题树严格保持 `H1–H4`（映射为 `h3–h6` 无跳级），两张 3 列表格对齐均衡，地铁广播（L68–70）与例题 3 英文材料（L106）均采用独立引用块提升可读性；实测零非法 HTML、零未解析 Markdown 符号与行尾空白。 |

---

## 二、上轮阻断项整改核验

| 原阻断项 | 修订位置 | 实测核验结果 |
| --- | --- | --- |
| **B1**：情景一仅 4 轮且无复述确认与致谢道别；情景二电话打车场景与地铁广播硬拼接，且存在 `get in a taxi outside`、`Floor 6`、漏 `about / around`、口语分号、话题突兀跳转及缺少出口动词/道别收尾 | L44–53、L55–64、L66–70 | **已关闭**：情景一扩为 8 轮，增补复述核对（`Got it—turn left at the second traffic light, right?`）及致谢道别闭环；情景二在 L59 补齐带大行李箱改问打车的过渡，L58 补全出口动词 `take Exit B`，L60 改为 `You can take a taxi outside—just get in at the taxi stand. It takes about twenty minutes, and the fare is around eighteen dollars.`，L62 改用 `the sixth floor` 并自然嵌入 `get out of the taxi`，L63–64 补齐告别收尾；L66–70 将地铁报站广播拆为独立小节与引用块，叙事逻辑完全自洽。 |
| **B2**：例题 1 第 1 句改错正解 `Let's get in a taxi and arrive at the office.` 语义失真、解答缺完整句；例题 2 题干计数失配且第 3 题无角色标记混拼相反视角；例题 3 缺出口动词且长英文压入单行内联代码 | L72–84、L86–100、L102–116 | **已关闭**：例题 1 改为目的从句 `Let's get in the taxi so we can arrive at the office on time.` 与习惯从句 `When I arrive at the station, I usually go home on foot or by bus.`，精准保留 5 处介词/冠词错误并在解答中给出完整正确句；例题 2 题干改为「改写或改正下列 3 组表达」，第 3 组清晰标出 `**指路人**` 与 `**问路人**` 并理顺语序；例题 3 改为 `Get off at West Square and use Exit C.` 并将 5 句指引改为 `>` 引用块。 |
| **B3**：表 1 存在 `前者无 to` 指代歧义、`go past` 词性标注失准、误用「反问」与「转向词」；表 2 缺多处 A2 词块中文释义与英式语序示范；听说专项缺少图例、示范句、`/f/` vs `/θ/` 发音说明与连读示例；常见错误边界过宽或夹带未讲内容 | L16–21、L27–31、L33–40、L118–129 | **已关闭**：表 1 明确写清 `` `arrive` 不配 `to`（禁 `*arrive to`），`reach` 直接接地点（无介词） ``、统一 `go past`（`past` 为介词，勿写 `*passed`）vs `pass`（动词）与 `go across` vs `cross` 平行结构、改「反问」为「复述确认并在句尾加 `right?` 核对」；表 2 补齐 `Platform 3`、`the Green Line`、`change at ... for Line 4`、`Mind the gap.`、`drop me off`、`crosswalk / zebra crossing`、`elevator / lift` 释义与 `take + 冠词 + 车` 说明；听说专项补齐图例、3 组带重读与升降调标注的英文例句、`/f/` vs `/θ/` 发音方法及 `get‿off‿at` / `get‿out‿of` / `straight‿ahead` 连读示例；常见错误精确收窄 `*get down the bus`、`接车名勿省 of`、`*drop off me`、`*take by bus`、`*It needs 15 minutes` 与 `*spend ... to get there`。 |

---

## 三、分维度详细审查记录

### 1. 英文对话自然度（含广播、表格例句与例题英文）

- **情景一：街头问路找地铁站（L46–53，8 轮）**：覆盖礼貌破冰（`Excuse me, how do I get to the nearest subway station?`）→ 分步步行指引（`Go straight for two blocks, walk past a bookstore, and turn left at the second traffic light.`）→ 中途复述确认（`Got it—turn left at the second traffic light, right?`）→ 过街定位（`Cross the street—it's on your right, across from the bank.`）→ 步行耗时与地道提示（`About eight minutes. You can't miss it.`）→ 致谢与道别闭环。用词自然，无中式直译。
- **情景二：地铁换乘与打车赴约（L57–64，8 轮）**：职场同事来访致电语境真实自然；大卫以 `I just arrived at East Station`（一般过去时配 `just`，贴合课程进度未超前引入现在完成时）开场，瑞秋先给地铁换乘与出口方案，大卫因携带重行李自然转向打车询价与落客点，瑞秋自然示范 `take a taxi`、`get in at the taxi stand`、`about twenty minutes`、`around eighteen dollars`、`get out of the taxi` 与 `the sixth floor`，最后双轮简短道别收尾，语用得体。
- **地铁车厢广播示范（L66–70）**：独立小节呈现，3 句连贯报站（`The next station is Central Station. Transfer is available to Line 4. Doors will open on the right—please mind the gap.`）贴合国际/都市双语地铁真实广播风格，与表 2 知识点完全呼应。
- **词汇难度与拼写核查**：全文去注释共 165 个独立英文词形（含 `café` 规范重音符），无任何拼写错误或超纲学术词，实用出行词（`transfer`、`fare`、`pull over`、`crosswalk / zebra crossing`、`Mind the gap`、`taxi stand`）均附清晰中文释义。

### 2. 通用日常/职场语境一致性

- 逐行通读全文 129 行，并对 **193 个**中英文车间/制造/工业类关键词（107 个中文词如车间、产线、工位、工件、机床、焊接、装配、分拣、质检、料盒、托盘、叉车、传送带、领班、班长、工友、操作员、班次、交接班、点检、工装、劳保、安全帽、传感器、舵机、校准、卡尺、夹具、垫片、螺栓、线缆、台账、公差、返工、批次、工单、停机、厂区、物料等；86 个英文词如 `workshop`、`factory`、`assembly`、`workstation`、`foreman`、`shift`、`handover`、`PPE`、`caliper`、`tolerance`、`work order`、`QC`、`workbench`、`conveyor` 等）执行检索：
  - **中文命中**：`0` 处；
  - **英文命中**：`0` 处。
- 全文人物（玛雅、本、大卫、瑞秋）、场所（地铁站、书店、银行、东站、办公室、中央站、公园广场、图书馆、咖啡馆）及任务场景均纯粹属于通用日常生活与现代职场通勤，与第 12 单元去车间化定位完全一致。

### 3. 中文讲解清晰度

- **逻辑主线清晰**：导语（L3）准确衔接 `positions`、`imperatives`、`wh-questions` 三项先修，正文按「步行指路与到达耗时表 → 公共交通与上下车方式表 → 听说专项（重读/语调/辨音/连读/速记）→ 双语情景对话与报站广播 → 3 道梯度例题 → 6 类常见错误与四句自查口诀」递进，自学路径顺畅。
- **规则表述精确、术语平实**：上轮指出的专业术语与缩略语（`形式主语`、`大车`、`核对班次`、`拆清线站口`、`母语负迁移` 等）已全部平实化；规则表、对话、例题解答与常见错误四部分在介词、冠词、代词位置、语调标注与错误星号（`*`）规范上完全自洽，无内部矛盾。

### 4. Markdown 结构可读性

- **渲染与语法实测**（基于仓库依赖 `react-markdown` + `remark-gfm`，对齐 `web/src/features/guide/LessonReader.tsx` 的 `skipHtml: true`、`disallowedElements: ['img']`、`h1–h4 → h3–h6` 配置）：
  - **零非法 HTML**：除 L6 概念锚点 `<!-- concepts: directions-transport -->` 外，正文原始 HTML 标签为 `0`（无 `<br>`）；
  - **零未解析标记与格式瑕疵**：代码块外残留 `*`、`_`、`` ` ``、`~`、`<`、`>`、`|` 均为 `0`；异常 `<em>` 为 `0`；61 处 `<strong>` 与 187 处 `<code>` 全部准确闭合，无首尾冗余空格、无相邻 `</code><code>` 粘连、无中英文括号/直角引号/反引号失配、无行尾空白、无 `无资料` / `TODO` 等占位文本；
  - **层级、表格与块结构规范**：标题层级严格保持 `H1`（L1）→ `H2`（L5）→ `H3`（L10/42/72/86/102/118）→ `H4`（L12/23/33/44/55/66），下移两级后为 `h3–h6` 无跳级溢出；表 1（含表头 7 行 × 3 列，行长 19–165 字符）与表 2（含表头 6 行 × 3 列，行长 19–214 字符）列数一致、密度适中；2 处 `<blockquote>`（L68–70、L106）使报站广播与长段英语指引层次分明；全部列表保持紧凑（`<li><p>` 为 `0`）。
  - *前端组件侧通用备注（非本稿缺陷）*：`web/src/features/guide/LessonReader.tsx` 当前未显式挂载 `remarkGfm`，本次表格渲染核验沿用仓库既有课程的 GFM 约定。

---

## 四、可选润色建议（非阻断）

以下细节不影响通过与发布，供后续统稿或定稿时按需微调：

1. **情景二中文译文流畅度微调（L58、L59、L61）**：
   - L61 `Where should the driver drop me off?` 译作 `让司机在哪儿让我下车？` 连续出现两个「让」，略显绕口，可改为 `司机应该在哪儿让我下车？` 或 `我让司机在哪儿放我下车？`；
   - L58 `坐 2 号线坐三站` 叠用「坐」，可顺手改为 `乘 2 号线坐三站` 或 `坐 2 号线三站`；
   - L59 `a heavy suitcase` 译作 `大行李箱` 虽通顺，改为 `很重的行李箱`（或 `重行李箱`）与 `heavy` 词义对应更紧。
2. **表 2 换乘介词英美呼应（L28）**：左栏已给出 `transfer to Line 4 at ...（英：change at ... for Line 4）`，右栏 `站点用 at、线用 to` 如微调为 `站点用 at、换乘线用 to（英式 change 配 for）`，与左栏呼应更严密。
3. **例题 1 解析与错点对齐（L84）**：题干第 2 句 `go home` 本身正确（5 处错误为 `get on`、`arrive to`、`arrive in`、`by foot`、`by a bus`），解析中 `` `home` 零介词 `` 建议加括号写作 `（注意 go home 保持零介词）`，避免初学者误以为 `home` 也是待改错项。
4. **例题 2 解析措辞微收口（L100）**：句尾 `不用 spend` 可与常见错误 L126 对齐微调为 `不用 *spend ... to get there`，更精确界定错因边界。
