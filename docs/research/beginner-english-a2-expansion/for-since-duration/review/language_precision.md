# 语言与结构审查报告：`for-since-duration/lesson_draft.md`（修订复核）

- **审查对象**：`docs/research/beginner-english-a2-expansion/for-since-duration/lesson_draft.md`（128 行，8,729 字节；全文去注释中文 1,233 字、英文 573 词、147 个独立英文词形）
- **课程定位**：`docs/research/beginner-english-a2-expansion/syllabus.json` 第 13 讲（第 13 单元「个人经历与进度追踪」，CEFR A2，`grammar_core`，45 分钟，通用日常与现代职场英语，无车间背景）
- **课时门余量实测**：经 `scripts/lib/effort-audit.mjs` 的 `attributeLesson()` 实测，概念 `for-since-duration` 精确匹配 1 个小节（L6 `<!-- concepts: for-since-duration -->`），`cjk = 1,218`、`en = 573`（等效阅读量 `2,937`，为 `budget_plan.json` 基线 `target_read_units = 2,180` 的 `1.347` 倍）、`readMin = 11.8387`、`lectureDesignMin = 21.31`；叠加规划题库 `29.30` 设计分钟合计 `50.61` 分钟 / 声明 `45` 分钟（`ratio = 1.125`），稳居严格门禁 `[0.70, 1.40]` 安全区间内，距 `63.0` 分钟严格上限尚余 `12.39` 设计分钟。
- **总体结论**：**通过（PASS，0 项阻断性问题）**
- **审查摘要**：本轮复核确认首轮提出的 2 大类 5 项阻断性问题（B1.1、B1.2、B2.1、B2.2、B2.3）及全部可选润色建议均已完整落实，且未引入新缺陷。两段情景对话（茶水间结识新同事 7 轮、周末聚会聊朋友与学习 6 轮）及表格/例题英文自然地道、零拼写错误；161 个中英文车间/制造/工业关键词全量扫描 **0 命中**，语境纯净聚焦日常社交与现代职场；中文讲解平实准确、语法边界限定清晰；经 `react-markdown@10.1.0` + `remark-gfm@4.0.1` 实测渲染零原始 HTML、零未闭合标记、3 张 3 列 GFM 表格与 `H1–H4` 标题层级规范整洁。

---

## 一、四维度审查总览

| 审查维度 | 判定 | 核心评估 |
| --- | --- | --- |
| 1. 英文对话自然度（含表格例句与例题英文） | **通过** | 首轮 B1.1、B1.2 已全面修复。对话 1（L54–60，7 轮）消除了 `five years` 同义反复，以 `lived in this city` 明确语境、补充 `from Hangzhou for my first job` 真实迁移信息并以 `Let's have coffee next week.` 自然收尾；对话 2（L64–69，6 轮）尾轮先呼应西班牙旅行（`I'd love to visit Spain too.`），再补明宾语与合理起点（`I haven't practiced my Spanish since last month`）并顺接改天同练邀请，互动连贯真实。表格例句、3 道例题及常见错误英文地道规范，147 个独立英文词形零拼写错误、零弯撇号混用。 |
| 2. 通用日常/职场语境一致性 | **通过** | 逐行通读全文 128 行并对 161 个中英文车间/制造/工业关键词（中文 100 词 + 英文 61 词）执行全量检索：**0 命中**。全部场景、人物（马库斯、汉娜、诺亚、克洛伊、玛雅、Lena、Leo、Ben、莉莎，且人名与同单元其他讲义保持一致）与交际事务均严格处于现代职场与日常生活语境。 |
| 3. 中文讲解清晰度 | **通过** | 首轮 B2.1、B2.2、B2.3 已全面修复。L35 改用「现在完成时基本形式（`have / has + 过去分词`）」彻底消除与一般现在/过去时的混淆；L36 补全 `be on a team / be in a club` 搭配语境，与 `buy / join / move / get married` 顺序一一对应；L101 与 L128 均将 `When` 准确限定为追问过去时间（`When did...?`），彻底清除未铺垫术语「查窗口」与口语词「锁死」，呼应表 3「标志词」口径。 |
| 4. Markdown 结构可读性 | **通过** | 经 `react-markdown@10.1.0` + `remark-gfm@4.0.1`（对齐 `web/src/features/guide/LessonReader.tsx` 的 `skipHtml: true`、`disallowedElements: ['img']`、`h1–h4 → h3–h6` 映射）实测，除 L6 合法概念锚点注释外零原始 HTML、零占位词、零行尾空白、零制表符、零双空格、零未闭合反引号/加粗/括号/引号、零意外 `<em>`、零残余 Markdown 符号；标题树无跳级，3 张 3 列表格完整闭合，全篇斜杠两侧空格统一。 |

---

## 二、首轮阻断项整改核验

| 首轮编号 | 整改要求 | 现稿落实位置与核验结果 | 复核结论 |
| --- | --- | --- | --- |
| **B1.1** | 重构对话 1 尾轮（原 L58–59），消除 `five years` 同义重复、补足真实迁移信息并自然收尾 | L58 改为 `That's great! How long have you lived in this city?`（避免与对话 2 `Nice!` 重复并明确城市语境）；L59 改为 `For five years. I moved here from Hangzhou for my first job.`（城市名与例题 2 成都错开，承载新信息）；L60 补自然收尾 `So you know the city well! Let's have coffee next week.` | **已闭环** |
| **B1.2** | 改写对话 2 尾轮（原 L68），呼应旅行话题、补全宾语并使时间起点与聚会人设相符 | L69 改为 `Cool! I'd love to visit Spain too. I haven't practiced my Spanish since last month—maybe we can practice together sometime!`，自然衔接上文西班牙旅行并带出改天同练邀请，英中对译流畅 | **已闭环** |
| **B2.1** | 替换 L35 易混淆表述「A2 简单式」，明示对比对象 | L35 改为「本讲统一用现在完成时基本形式（`have / has + 过去分词`），现在完成进行时留待进阶学习。」，语义清晰无歧义 | **已闭环** |
| **B2.2** | 补全 L36 裸写 `be on` 的搭配语境，防误造 `*be on the club/company` | L36 改为「须改状态或延续动词（`have`、`be on a team / be in a club`、`live in`、`be married`），或改过去时加 `ago`」，与 `buy / join / move / get married` 及下文 L93/L124 严密对齐 | **已闭环** |
| **B2.3** | 收紧原 L100/L127 对 `When` 的过度泛化，清除口语「锁死」与未铺垫术语「查窗口」 | L101 改为「第 3 题追问过去发生时间（`When did...?`）并配 `ago`，均须用一般过去时」；L128 改为「① 查时间标志（见 `yesterday / last week / ago` 或问过去时间 `When did...?` 用一般过去时）」；全文检索「窗口」「锁死」均为 `0` 命中 | **已闭环** |
| **可选润色项** | 表 1 补月份例词、表 2 换非年份简答并统一标点、表 3 补注 `so far`、例题 1 备用答案自足、例题 2 称「第 N 题」、常见错误补全箭号与措辞、导语动宾对称 | 全部 8 处均已落实：L19 补 `three months / May`；L32 改为 `Since university.` 及 `（我认识她六年了。 / 从大学起。）`；L44 补注 `` `so far`（截至目前） ``；L83 改为 `He bought this bike a year ago.`；L101 改用「第 1/2/3 题」；L119 改为「6 类高频错误」；L122 补全 `→ all my life`；L3 改为「学习表达持续时长，并辨析现在完成时与一般过去时」 | **已落实** |

---

## 三、分维度详细审查记录

### 1. 英文对话自然度（含表格例句与例题英文）

- **对话 1：茶水间结识新同事（L52–60，7 轮）**：
  - 全段围绕新同事入职寒暄展开：`Welcome, Hannah! When did you join us?` → `I joined last Monday. I'm in marketing.` → `How long have you worked in marketing?` → `Since 2023. Before that, I worked in sales for two years.` → `That's great! How long have you lived in this city?` → `For five years. I moved here from Hangzhou for my first job.` → `So you know the city well! Let's have coffee next week.`。
  - 时间线严密自洽，在自然职场寒暄中无痕示范了 `When did...?`、过去时、现在完成时 `How long...?`、`Since` 简答、过去时配 `for` 表已结束经历以及现在完成时切回过去时补迁移背景，收尾自然有温度，中文译文地道无翻译腔。
- **对话 2：周末聚会聊朋友与学习（L62–69，6 轮）**：
  - 诺亚与克洛伊从共同朋友玛雅切入（`How long have you known Maya?` → `I've known her since university.` → `Where did you meet?` → `In a Spanish class. Maya said you study Spanish—how long have you studied it?` → `For eight months. I started before my trip to Spain.` → `Cool! I'd love to visit Spain too. I haven't practiced my Spanish since last month—maybe we can practice together sometime!`）。
  - 话题过渡自然、口语衔接真实，兼顾否定持续 `haven't practiced ... since last month`，中文译文（如「我从上个月起就没练过西班牙语了——改天我们可以一起练！」）准确鲜活。
- **表格、例题与常见错误英文**：
  - 全文去注释共 `573` 英文词次、`147` 个独立英文词形（含 L32 句型槽位 `'ve / 's` 拆出的 `ve / s` 与 `vs.`），美式拼写一致（`practiced`），全部英文撇号均统一为直撇号 `'`（`0` 处弯撇号、代码内 `0` 处弯引号），除刻意标 `*` 的 9 处语法错句及例题 1 待改错题干外零语法或拼写错误。
  - 3 张规则表例句（L18–25、L31–33、L43–47）、3 道梯度例题（L75–83、L91–99、L112–113）及 6 类常见错误正反例（L121–126）均符合 CEFR A2 水平与母语表达习惯，英中语义精确对齐。

### 2. 通用日常/职场语境一致性（无无关车间术语混入）

- 逐行通读全文 128 行，并对 **161 个**中英文车间/制造/工业类关键词（100 个中文词：车间、产线、生产线、流水线、工位、工件、机床、车床、铣床、磨床、钻床、焊接、焊机、焊缝、装配、组装、分拣、质检、品控、抽检、料盒、料架、料盘、托盘、栈板、叉车、传送带、输送带、皮带、领班、班长、工长、工友、操作员、操作工、技工、机修、班次、夜班、白班、交接班、点检、巡检、工装、夹具、治具、模具、冲模、劳保、安全帽、护目镜、耳塞、防静电、传感器、舵机、伺服、轴承、齿轮、丝杠、导轨、校准、标定、卡尺、千分尺、量规、垫片、螺栓、螺母、铆钉、线缆、线束、台账、公差、返工、返修、报废、不良品、良品率、批次、工单、停机、急停、液压、气压、冲压、注塑、铸造、锻造、仓库、仓管、备件、耗材、加工、数控、看板、安灯、厂房、厂区、工厂、机台；61 个英文词：`workshop`、`factory`、`plant`、`shop floor`、`shop-floor`、`assembly`、`workstation`、`conveyor`、`foreman`、`operator`、`shift`、`handover`、`ppe`、`helmet`、`goggles`、`caliper`、`micrometer`、`tolerance`、`work order`、`rework`、`scrap`、`defect`、`yield`、`batch`、`lot`、`lathe`、`milling`、`welding`、`fixture`、`jig`、`mold`、`mould`、`gasket`、`bolt`、`nut`、`rivet`、`bearing`、`gear`、`sensor`、`servo`、`actuator`、`calibration`、`downtime`、`emergency stop`、`e-stop`、`hydraulic`、`pneumatic`、`stamping`、`injection`、`warehouse`、`pallet`、`forklift`、`spare part`、`machining`、`cnc`、`plc`、`sop`、`bom`、`oee`、`kanban`、`andon`）执行全量检索：
  - **中文命中**：`0` 处；
  - **英文命中**：`0` 处。
- 全文人物与跨讲呼应一致（`Maya / 玛雅`、`Chloe / 克洛伊`、`Hannah / 汉娜`、`Leo` 与第 13 单元同组讲义译名统一），主题全部落在茶水间入职交流、市场/销售履历、开会、发邮件、周末聚会、学西班牙语、读书会、骑车与搬家等通用日常与现代办公语境。

### 3. 中文讲解清晰度

- **逻辑主线与层次**：沿「导语衔接 → 汉英差异切入 → `for / since` 规则表与特例 → `How long...?` 与持续/瞬间动词限定 → 双时态四维对照与对话切换 → 两段职场/日常双语对话 → 改错/填空/汉译英 3 道例题 → 6 类高频错误与三步自查」层层递进，重点突出。
- **规则表述精确性**：
  - L14「`for` 量**时长**（多久），`since` 钉**起点**并连到现在（从何时起）」凝练直观；
  - L23–25 对 `since last year` vs. `for the last two weeks`、`all day / all my life` 零介词、`ago` 边界及过去起始事件 `since` 从句的限定严谨；
  - L35–36 清晰交代本讲采用现在完成时基本形式并将现在完成进行时留待进阶，严格限定「肯定句中」瞬间动作替换规则并给出完整宾语搭配（`be on a team / be in a club`），与 L33 否定持续自洽；
  - L47 用上午 10:00 与下午 3:00 区分 `this morning` 未完/已过，直观好懂；
  - L119 显式说明 `*` 错句图例，L128 三步自查（① 查时间标志 → ② 查延续 → ③ 查搭配）与正文术语及 6 类常见错误严密呼应。

### 4. Markdown 结构可读性

- **渲染与语法实测**（基于仓库已安装 `react-markdown@10.1.0` + `remark-gfm@4.0.1`，模拟 `web/src/features/guide/LessonReader.tsx` 的 `skipHtml: true`、`disallowedElements: ['img']`、`h1–h4 → h3–h6` 映射）：
  - **原始 HTML 与清洁度**：除 L6 合法概念锚点 `<!-- concepts: for-since-duration -->` 外，原始 HTML 标签为 `0`；`TODO / TBD / FIXME / 无资料 / 待补充 / Replace this lesson` 等占位词为 `0`；行尾空白 `0` 行，制表符 `0` 处，多余双空格 `0` 处，不可见空白符 `0` 处，文件末尾含标准换行符。
  - **行内格式与标点配对**：渲染产出 `51` 处 `<strong>`、`143` 处 `<code>`、`0` 处意外 `<em>`、`0` 处相邻 `</code><code>`、`0` 处行内代码首尾冗余空格；代码块外残余 `*`、`` ` ``、`_`、`~`、`|`、`<`、`>` 均为 `0`；代码块外中文邻接半角标点为 `0` 处；全篇斜杠两侧留空格（`\S+\/\S+` 为 `0` 处）；全部 128 行反引号、中文括号（46 对）、英文括号（4 对）、中文双引号（3 对）及英文双引号逐行成对闭合。
  - **标题树、表格与列表**：标题层级为 `H1`（L1）→ `H2`（L5）→ `H3`（L10/50/71/87/103/117，共 6 处）→ `H4`（L12/27/38/52/62，共 5 处），映射后为 `h3`（1）、`h4`（1）、`h5`（6）、`h6`（5），层级连续无跳级；3 张 3 列 GFM 表格（表 1 L16–21 含表头 6 行、行宽 19–89 字符；表 2 L29–33 含表头 5 行、行宽 19–130 字符；表 3 L40–45 含表头 6 行、行宽 19–97 字符）解析为 `3` 个 `<table>`、`14` 个 `<tr>`、`9` 个 `<th>`、`33` 个 `<td>`，列数齐整且前后空行完备；例题 2 填空位 `____`（L91–93）均安全置于行内代码中；全部 5 组无序列表与 7 组有序列表（共 42 个 `<li>`）均为紧凑列表（`<li><p>` 为 `0`）。
  - *前端组件侧通用备注（非本稿缺陷）*：`web/src/features/guide/LessonReader.tsx` 当前未显式挂载 `remarkGfm`，本次表格渲染核验沿用仓库既有课程的 GFM 表格约定。

---

## 四、微小可选润色备注（非阻断，无需返工）

以下 1 处不影响语法准确性或初学者理解，当前版本可直接定稿；若后续版本顺手微调，可酌情参考：

1. **例题 2 第 3 题解析（L101）可再拆细双空因果**：当前写「第 3 题追问过去发生时间（`When did...?`）并配 `ago`，均须用一般过去时」，因第 3 题第二空本身要求在 `since / ago` 中二选一，若未来顺手改作「第 3 题追问过去发生时间，问句用一般过去时 `did you join`，答句表“一年前”配 `ago`（不用 `since`）」，双空解析逻辑会更加严密。

---

## 五、最终结论

- **是否通过**：**通过（PASS）**
- **阻断性问题**：无（`0` 项）
- **修订要求**：首轮全部 5 项阻断性问题与可选润色项均已闭环；本讲义在英文对话自然度、通用日常/职场语境一致性（零车间术语混入）、中文讲解清晰度与 Markdown 结构可读性四个维度全面达标，课时门余量稳健（`ratio = 1.125`，距 `1.40` 上限余 `12.39` 设计分钟），可直接进入后续题库编写与课程打包环节。
