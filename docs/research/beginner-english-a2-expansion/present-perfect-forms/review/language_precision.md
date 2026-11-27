# 语言与结构审查报告：`present-perfect-forms/lesson_draft.md`（二审复核）

- **审查对象**：`docs/research/beginner-english-a2-expansion/present-perfect-forms/lesson_draft.md`（126 行，9,919 字节；去注释中文 1,387 字，去注释与 IPA 音标后英文 603 词、195 个独立英文词形）
- **课程定位**：`beginner-english` 第 13 单元「个人经历与进度追踪（`experiences-progress`）」首讲「现在完成时构成与过去分词（`have / has + done`）」（CEFR A2，`grammar_core`，50 分钟，通用日常与职场英语，无车间背景）
- **课时门实测**：经 `scripts/lib/effort-audit.mjs` 的 `attributeLesson()` 实测，概念 `present-perfect-forms` 精确匹配 1 个小节（L6 `<!-- concepts: present-perfect-forms -->`），`cjk = 1,375`、`en = 630`（等效阅读量 `3,265`，为 `budget_plan.json` 基线 `target_read_units = 2,430` 的 `1.344` 倍）、`readMin = 13.10`、`lectureDesignMin = 23.58`；叠加规划题库 `34.50` 设计分钟合计 `58.08` 分钟 / 声明 `50` 分钟（`ratio = 1.162`），稳居严格门禁 `[0.70, 1.40]` 区间内，距 `70.00` 分钟上限尚余 `11.92` 设计分钟。
- **总体结论**：**通过（PASS，0 项阻断性问题）**
- **审查摘要**：本轮修订已完整修复一审提出的全部 4 项阻断性缺陷（对话 2 方向动词 `brought` 与 `key card`、对话 1 下午 3:30 突问 `lunch` 与 L58 过渡/搭配、例题 3 第 1 组无关联硬拼、L22 悬空对比与规则过度泛化、L40 泄露内部讲次编号、L47/L121「面谈」歧义），并同步落实了全部语音与措辞润色建议。全稿英文对话与例题自然地道、严守跨讲语法边界、通用日常/职场语境纯净（210 个中英文车间/工业关键词检索 **0 命中**）、中文讲解清晰准确、Markdown/GFM 结构与渲染规范，达到发布标准。

---

## 一、四维度审查总览

| 审查维度 | 判定 | 核心评估 |
| --- | --- | --- |
| 1. 英文对话自然度（含例句与例题英文） | **通过** | 两段 6 轮情景对话、3 张核心规则表例句、3 道梯度例题及 6 组常见错误正例均自然地道、英中对齐且严控在 CEFR A1–A2 词法范围内。全稿 195 个独立英文词形零意外拼写错误、零弯撇号混用、未超前引入 `ever / never / just / already / yet / for / since`。一审 B1.1、B1.2 缺陷已全部闭环。 |
| 2. 通用日常/职场语境一致性 | **通过** | 逐行通读全文 126 行并逐一核查全部 195 个独立英文词形，对 210 个中英文车间/制造/工业关键词执行全量检索：**0 命中**。全部场景、人物与任务均严格处于现代日常与办公职场语境，无任何无关车间术语混入。 |
| 3. 中文讲解清晰度 | **通过** | 主线与教学层次清楚（中英「了、过」对比 → 句型与缩写/语音 → 规则与不规则三态分组 → 基础语用与 `been to / gone to` → 双语对话 → 梯度例题 → 常见错误与三步自查）。L22 `'s not` 对照与兼作状态形容词前提已补全并与不及物完成时自洽；L23 语音强弱读准确；L40 改用相对指代；L47/L121 消除「面谈」歧义；人名「苏菲 / 丹尼尔」与同单元后续讲次统一。 |
| 4. Markdown 结构可读性 | **通过** | 经 `react-markdown@10.1.0` + `remark-gfm@4.0.1`（对齐 `web/src/features/guide/LessonReader.tsx` 的 `skipHtml: true`、`disallowedElements: ['img']`、`h1–h4 → h3–h6` 映射）实测：除 L6 概念锚点外零原始 HTML，零占位词、零行尾空白、零意外 `<em>`、零未闭合反引号/括号/引号，标题层级无跳级，3 张 3 列表格完整闭合，例题 2 空格 `____` 均安全置于行内代码内。 |

---

## 二、一审问题闭环复核

| 一审编号 | 原问题定位 | 二审实测修订结果 | 状态 |
| --- | --- | --- | --- |
| **B1.1** | 对话 2 L64 在家筹备出行误用 `brought two umbrellas`；L65 紧接 `hotel` 突现 `key card`（门禁卡） | L64 改为 `I've packed the bags and bought two travel umbrellas.`（激活表 2 `buy → bought`，符合出发前居家采购准备）；L65 改为 `Wait—where's your wallet?`（“等等——你的钱包呢？”），与 L66–L67 `I've lost it!` / `You've left it by the door.` 衔接自然 | **已修复** |
| **B1.2** | 对话 1 L56 下午 3:30 会议前突问 `lunch`；L58 跳题缺过渡且裸用 `put water`；例题 3 第 1 组两句无关联硬拼 | L56 改为 `Has Liam replied to our email?`（契合会前核对语境）；L58 改为 `Okay, I'll call him. Oh, and I've put some water in Room B.`（口语过渡与搭配自然）；例题 3 第 1 组（L105/L110/L113）拆分为 `a) Anna has been to Chengdu twice.` 与 `b) Liam has gone to the bank.` 两句独立对比，体例与例题 2 第 3 题一致 | **已修复** |
| **B2.1** | L22 缺 `'s not` 参照导致「优先 `hasn't` 防混 `is not`」悬空；「无宾语按 `is`」过度泛化，与 `He's gone home.` 表观冲突 | L22 明确写出「否定缩写优先用 `haven't / hasn't`，少用 `'s not`，以免与 `is not` 混淆」；限定适用范围为「对 `closed / broken` 等既可作过去分词又可作状态形容词的词」，并补清「不及物动词的完成时（如 `He's gone home.`）虽无宾语，`'s` 仍为 `has`」 | **已修复** |
| **B2.2** | L40 泄露扩展批次内部编号「第 12 讲 / 第 13 讲」；L47 与 L121 误用固定词「面谈」引起歧义 | L40 改为「`ever / never / just / already / yet` 留待下一讲，`for / since` 与一般过去时辨析留待后续专题」；L47 与 L121 改为「谈论自己或对方的过往去处或经历只用 `been to`」并在 L121 补全成对正解句 `I have been to Tokyo.` | **已修复** |
| **可选润色 & 语音细节** | L21/L23/L27/L32/L40/L62/L71/L83/L90/L97/L117/L124/L126 多处细微措辞、语音与人名统一 | 全部落实：L23 准确区分句首留 `/h/` 仍常弱读与简答/强调必强读；L21「可连用为」、L27「双写尾辅音加 `-ed`」、L32「美式也用 `gotten`」；L40/L124/L126「已结束的过去时间」；L62 统一译名「苏菲」；L71「语法或动词形式错误」及 L83 补明不可误用过去式 `wrote`；L90 `bought some bread!`；L97 补全完整还原句；L117「`*` 标出语法或拼写错误」 | **已落实** |

---

## 三、分维度详细审查记录

### 1. 英文对话自然度（含表格例句与例题英文）

- **情景对话复核**：
  - **对话 1（L51–L58，会前进度核对）**：6 轮围绕下午 3:30 会议准备展开（`updated the slides`、`printed six copies`、`finished the report and sent it to our manager`、`replied to our email`、`gone to the bank`、`put some water in Room B`），节奏紧凑、口语衔接词（`Hi Owen!`、`Great!`、`Thanks!`、`Okay, I'll call him. Oh, and...`）自然，英中译文准确流畅（如 `Yes, I have. I've printed six copies too.` 译为「更新了，也打印了六份。」无翻译腔）。
  - **对话 2（L60–L67，周末出行准备）**：6 轮围绕明早乘火车出行打包展开（`booked the train tickets`、`paid for the hotel`、`packed the bags and bought two travel umbrellas`、`where's your wallet?`、`lost it`、`left it by the door`），角色互动生动、指示方向准确，英中语义完全对齐。
- **句型表、例题与常见错误复核**：
  - 表 1 例句（L16–L19）、规则正文例句（L21–L22、L40、L44–L47）、例题 1–3（L73–L111）及 6 组常见错误正例（L119–L124）均符合英语母语习惯且贴合日常/职场交际。
  - 全稿去注释与 IPA 音标后共 `603` 英文词次、`195` 个独立英文词形；所有英文撇号均为直撇号 `'`（`0` 处弯撇号、行内代码内 `0` 处弯引号），`café` 重音一致（2 处）；除 L119–L124 刻意以 `*` 标示的 13 处错例（`*She has wrote it.`、`*He has finish it.`、`*Everyone have arrived.`、`*Did you have booked it?`、`*He has gone to home.`、`*She is sent it.`、`*Yes, I've.`、`*sended`、`*planed`、`*replyed`、`*payed`、`*writen`、`*I have booked it yesterday.`）外，零拼写错误。
- **跨讲语法边界核查**：
  - 全文检索 `ever / never / just / already / yet / for / since`：除 L40 边界说明句及 L63 动介固定搭配 `paid for the hotel`（非时长状语）外，对话、例句与例题中 **0 处**超前混入后续讲次语法点。

### 2. 通用日常/职场语境一致性（无无关车间术语混入）

- 对全文 126 行与 195 个独立英文词形逐一核查，并对 **210 个**中英文车间/制造/工业关键词（130 个中文词如车间、产线、生产线、流水线、工位、工件、机床、车床、铣床、焊接、装配、分拣、质检、品控、料盒、托盘、叉车、传送带、领班、班长、工友、操作员、班次、交接班、点检、巡检、工装、夹具、模具、劳保、安全帽、护目镜、传感器、舵机、伺服、校准、卡尺、垫片、螺栓、线缆、端子、台账、公差、返工、报废、批次、工单、停机、急停、液压、冲压、注塑、仓库、备件、数控、看板、安灯、厂区、工厂、主轴、刀具、冷却液等；80 个英文词如 `workshop`、`factory`、`plant`、`shop floor`、`assembly`、`workstation`、`workbench`、`conveyor`、`foreman`、`operator`、`shift`、`handover`、`PPE`、`caliper`、`tolerance`、`work order`、`rework`、`scrap`、`QC`、`QA`、`lathe`、`welding`、`fixture`、`gasket`、`sensor`、`calibration`、`downtime`、`warehouse`、`pallet`、`forklift`、`CNC`、`PLC`、`SOP`、`BOM`、`OEE`、`machining`、`spindle`、`torque`、`soldering` 等）执行全量检索：
  - **中文命中**：`0` 处；
  - **英文命中**：`0` 处。
- 全文人物（格蕾丝、欧文、利亚姆、苏菲、丹尼尔、Tom、Leo、Nina、Anna）与事务（更新幻灯片、打印副本、写报告、发邮件给经理/客户、B 会议室备水、订火车票、付酒店、买便携雨伞、找钱包、买面包、去咖啡馆、去银行、去苏州/成都/东京）均严格属于通用日常与现代办公语境。

### 3. 中文讲解清晰度

- **概念衔接与结构**：L3 清晰衔接先修知识点 `past-irregular` 与 `did-questions`；L8 从汉语「了、过」不变形切入英语 `have / has + 过去分词`，切入点直白；规则讲解、双语情景、三道由改错 → 辨析 → 汉译英递进的例题、6 类常见错误与 L126 三步自查形成完整学习闭环。
- **规则精确性与可读性**：
  - L21 主谓一致（含不可数名词及 `everyone / someone`）、禁借 `do / does / did`、疑问否定保持过去分词及 `have had / has had` 解释清楚；
  - L22 缩写偏好与 `'s` 判别逻辑闭环，无悬空对比或与不及物完成时冲突；
  - L23 弱读与强读条件准确，全部 20 处 IPA 音标（`/həv/`、`/əv/`、`/həz/`、`/əz/`、`/h/`、`/hæv/`、`/hæz/`、`/v/`、`/s/`、`/z/`、`/t/`、`/d/`、`/ɪd/`、`/riːd/`、`/red/`、`/dʌn/`、`/ɡɒn/`、`/ɡɔːn/`）Unicode 编码标准规范；
  - 中文标点使用规范，正文无中文邻接半角标点混用，无多余双空格；人名译名「苏菲 / 丹尼尔」与同单元后续讲义 `ever-never-already-yet/lesson_draft.md` 保持一致。

### 4. Markdown 结构可读性

- **渲染与语法实测**（基于 `react-markdown@10.1.0` + `remark-gfm@4.0.1`，对齐 `web/src/features/guide/LessonReader.tsx` 的 `skipHtml: true`、`disallowedElements: ['img']`、`h1–h4 → h3–h6` 映射）：
  - **原始 HTML 与清洁度**：除 L6 概念锚点 `<!-- concepts: present-perfect-forms -->` 外，正文原始 HTML 标签为 `0`；占位文本（`无资料` / `TODO` / `TBD` / `FIXME` / `待补` / `Replace this lesson`）为 `0`；行尾空白为 `0` 行。
  - **行内格式与配对闭合**：渲染产出 `60` 处 `<strong>`、`222` 处 `<code>`、`0` 处意外 `<em>`、`0` 处 `<li><p>`、`0` 处相邻 `</code><code>`、`0` 处行内代码首尾冗余空格；代码块外残留 `*`、`` ` ``、`_`、`~`、`|`、裸 `$` 均为 `0`；全部 126 行反引号偶数闭合，中文括号（58 对）与中文双引号（6 对）严格配对，例题 2 填空位 `____`（L89–L90）均安全置于行内代码中。
  - **标题树与表格**：标题结构为 `H1`（L1）→ `H2`（L5）→ `H3`（L10/49/69/85/101/115，共 6 处）→ `H4`（L12/25/38/51/60，共 5 处），经阅读器下移两级后映射为 `h3`（1）、`h4`（1）、`h5`（6）、`h6`（5），层级连续无跳级；3 张 3 列 GFM 表格（表 1 L14–19 含表头 6 行、行宽 19–112 字符；表 2 L29–34 含表头 6 行、行宽 19–232 字符；表 3 L42–45 含表头 4 行、行宽 19–82 字符）解析为 `3` 个 `<table>`、`13` 个 `<tr>`、`9` 个 `<th>`、`30` 个 `<td>`，列数齐整。
- **非阻断备忘**：
  - 表 2 L32（179 字符）与 L34（232 字符）单格词条较集中，桌面端与常规屏幕可正常自动换行，无结构缺陷。
  - `web/src/features/guide/LessonReader.tsx` 当前未显式挂载 `remarkGfm`（属前端组件侧既有限制，非本讲义问题，本稿沿用仓库既有课程的 GFM 表格写法）。

---

## 四、审查结论

- **是否通过**：**通过（PASS）**
- **阻断性问题**：无（`0` 项）
- **修订要求**：无需进一步修改，可直接进入后续打包或题库联动环节。
