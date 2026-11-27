# 语言与结构审查报告：`progress-update-listening/lesson_draft.md`

- **审查对象**：`docs/research/beginner-english-a2-expansion/progress-update-listening/lesson_draft.md`（121 行，10,179 字节；去注释中文 1,493 字，去注释与反引号内 IPA 音标后英文 590 词、188 个独立英文词形）
- **课程定位**：`beginner-english` 第 13 单元「个人经历与进度追踪（`experiences-progress`）」第 4 讲「日常分享与工作进度同步听力」（`progress-update-listening`，CEFR A2，`listening_speaking`，50 分钟，通用日常与现代职场英语，无车间背景）
- **课时门实测**：经 `scripts/lib/effort-audit.mjs` 的 `attributeLesson()` 实测，概念 `progress-update-listening` 精确匹配 1 个小节，`cjk = 1,480`、`en = 629`（等效阅读量 `cjk + 3×en = 3,367`，高于 `budget_plan.json` 基线 `target_read_units = 2,430`）、`readMin = 13.5089`、`lectureDesignMin = 24.32`；叠加规划题库 `32.70` 设计分钟合计 `57.02` 分钟 / 声明 `50` 分钟（`ratio = 1.140`），稳定处于 `[0.70, 1.40]` 严格区间内，距 `70.00` 分钟上限尚余 `12.98` 设计分钟。
- **总体结论**：**通过（PASS，零阻断性问题）**
- **审查摘要**：本版讲义已完成针对首轮全部阻断项及顺手润色项的闭环修订，在**英文对话自然度**、**通用日常/职场语境一致性**、**中文讲解清晰度**与 **Markdown 结构可读性**四个维度均达到发布标准。两段双语情景对话（周三项目晨会、新公寓语音留言与回电）时间线严密、搭配自然且符合 CEFR A2 语法边界；181 个中英文车间/制造/工业关键词检索确认语义层 **0 命中**；语法、语音弱读与时间换算中文讲解准确清晰、无内部矛盾或电报体歧义；经 `react-markdown@10.1.0` + `remark-gfm@4.0.1` 实测结构与语法完整无误。

---

## 一、四维度审查总览

| 审查维度 | 判定 | 核心评估 |
| --- | --- | --- |
| 1. 英文对话自然度（含规则表与例题英文） | **通过** | 情景 1（L52–L57）与情景 2（L63–L66）均已消除原版搭配失真、日期重复、分号硬拼、英中信息错位与中式直译问题；`prepared for ... for two weeks now`、`How's your part going?`、`just sent the event link` / `already confirmed`、`waiting for Mia's email`、`the welcome cards`、`I've just listened to your message.`、`Come over on Sunday to catch up!` 均自然贴合 A2 通用日常与职场语境；规则表与 3 道例题示范句信号词与时间支点完整。 |
| 2. 通用日常/职场语境一致性 | **通过** | 逐行审读全篇 121 行并核查全部 188 个独立英文词形，对 181 个中英文车间/制造/工业关键词执行全量检索：110 个中文词 **0 命中**；71 个英文词中 70 词 **0 命中**，仅常规词 `part` 在 L52 `How's your part going?` 出现 1 次，语义为“你负责的部分”，非机械“零件”，语义层面车间/工业术语 **0 命中**。 |
| 3. 中文讲解清晰度 | **通过** | 教学主线（弱读辨音 → 进度四态与信号词 → 时间换算与三步三栏法 → 双情景对话 → 3 道梯度例题 → 常见错误与听辨三查）清晰连贯。首轮所有语法/语音表述失准（L8、L19、L21–L22、L42、L78）与压缩歧义/矛盾/伪拼写（L29、L40/L113、L44、L92/L94、L110）均已修正，术语与 IPA 音标全篇前后统一，英中译文准确流畅。 |
| 4. Markdown 结构可读性 | **通过** | 经 `react-markdown@10.1.0` + `remark-gfm@4.0.1`（对齐 `web/src/features/guide/LessonReader.tsx` 的 `skipHtml: true`、`disallowedElements: ['img']`、`h1–h5 → h3–h6` 映射）实测：除 L6 合法概念锚点 `<!-- concepts: progress-update-listening -->` 外零原始 HTML、零占位文本、零未闭合符号、零意外 `<em>`、零行尾空白与制表符；标题层级无跳级；3 张 3 列表格、拆分后的语音段落（L63–L64）及嵌套列表（L114–L119）均规范紧凑。 |

---

## 二、首轮阻断项复核清单

| 原编号 | 原问题摘要 | 现行文本位置与修订结果 | 复核状态 |
| --- | --- | --- | --- |
| B1.1 | 情景 1 `We've planned ... for two weeks.` 语义失真、`just` 作用域过宽、`waiting for Mia` 歧义、`the cards` 与「欢迎卡」错位及分号硬拼 | L52–L57 已改为 `We've prepared for Friday's event for two weeks now. How's your part going?`、补 L53 自然回应 `Hi Hannah! Pretty well.`、拆分 `just sent the event link` 与 `already confirmed twenty guests`、改为 `this morning` 与 `waiting for Mia's email`、补全 `the welcome cards` 并改逗号与自然过渡词 | **已关闭** |
| B1.2 | 情景 2 `five days ago` 与 `since last Friday` 同日重复、分号硬拼、`heard your message` 中式直译、`settling in` 译为完成态 | L63–L66 拆分为两条流畅语音（L63/L64），改为 `moved into my new apartment last week, and I've lived here for five days now`、补 `my books` 与 `Good news—the Wi-Fi has worked since Tuesday!`、中文保留“从周二起就一直能正常用了”、结尾改 `Call me back tonight!`；L65 改为 `I've just listened to your message.` 并译为「真高兴你正慢慢安顿下来！」；L66 改为 `Come over on Sunday to catch up!` | **已关闭** |
| B1.3 | 规则表/例题/常见错误示范句缺信号词、时间支点或对象（原 L16、L30、L72、L95、L112） | 现 L16 补 `We've already sent it.`；L31 补 `today`；L74 补 `him this morning`；L97/L100 改为 `finished half of the slides`、`Sara's notes`（笔记）及 `I've waited for them since Wednesday.`；L115 补统计对象 `three boxes` | **已关闭** |
| B2.1 | L8 术语失准、L19/L41 表格后列悬空、L21 将美式一般过去时误述为「偶省 `'ve`」及教研词「宽容」、L76 未说明 `done` 作形容词 | 现 L8 明确区分助动词“缩写或弱读”与过去分词尾音“省音或连读”；L19 补全 `/t/ /d/` 词干留 `/ɪd/`、`just` 尾音省 `/t/` 及 `been` 弱读 `/bɪn/` 例句；L21–L22 拆出「简答规范」与「特殊读音与口语变体」，准确表述美式口语常见 `just` 配一般过去时；L42 补全 `by` 说明与 `by four` 例句；L78 明确指出 `It's almost done.` 中 `done` 作形容词（`It's = It is`） | **已关闭** |
| B2.2 | 标题「微型晨会」与「周五下午」矛盾、表 2 括号错配、「不重算首尾」语义反置、「划」字两义、未定义伪拼写 `` `havn-` `` | 现 L92 改为「微型进度同步听辨与干扰排雷」；L29 拆清 `almost done / half ... so far` 说明；L40 与 L113 统一改为「不重复计算首尾两天」；L44 写明「划出……三栏」与「立刻划掉旧计划」；L110 改用规范 IPA `/ˈhævn/`、`/ˈhæzn/` 并补齐 `hasn't` | **已关闭** |

---

## 三、分维度详细审查记录

### 1. 英文对话自然度（含规则表、例题与常见错误示范句）

- **情景 1：周三项目晨会（L50–L57）**：
  - 时间线与语用逻辑闭环：周三上午同步周五活动进度——已筹备两周（`prepared for Friday's event for two weeks now`，在 A2 不引入 B1 现在完成进行时的课程边界内自然准确）；报告已完成并于周二发出（`I've finished the report. I emailed it yesterday.`）；照片从周一开始修且仍在进行（`I've worked on the photos since Monday, and I'm still editing them.`），承诺四点前发（`by four`）；链接刚发、二十位来宾已确认；原计划今天上午核对价格但仍在等米娅邮件（`I planned to check them this morning, but I'm still waiting for Mia's email.`）；汉娜即时决定立刻联系（`I'll message her right now.`）并说明欢迎卡打算明天打印（`I'm going to print them tomorrow.`），正确示范 `will` 与 `be going to` 分工；收尾 `so we're on track.` 流畅自然。
  - 英中逐句 1:1 对齐，无增译或漏译，口语节奏顺滑。
- **情景 2：新公寓近况分享（L61–L66）**：
  - 时间线与日常口语自然度闭环：周三晚语音留言，上周搬进新公寓、截至目前已住五天（对应上周五搬入至周三晚），厨房箱子已拆完、书桌刚摆好、书仍在整理；用 `Good news—` 自然转入无线网自周二起可用（在搬入之后、通话之前）；窗帘未买、沙发仍在等且周五上午送达；结尾 `Call me back tonight!`、回电 `I've just listened to your message. Glad you're settling in!` 与邀约 `Come over on Sunday to catch up!` 均符合真实英语朋友通话习惯。
  - 中译准确传达进行态（“正慢慢安顿下来”）与延续态（“从周二起就一直能正常用了”）。
- **规则表、例题与常见错误英文（L14–L42、L68–L120）**：
  - 全稿英文统一使用直撇号 `'`（`0` 处弯撇号），除 L115–L119 刻意加 `*` 的 5 处错例外零拼写与语法错误。
  - 例题 1（L72–L74）三组对比鲜明，例题 2（L84–L86）`on a client call`、`since Monday`、`We haven't sent the report yet, and we'll share it in two hours.` 语境明确，例题 3（L96–L97）问答切换时态自然（`Have you updated...` → `Yes, I finished it yesterday.`），且 `finished half of the slides so far` 与 `waiting for Sara's notes / waited for them since Wednesday` 紧扣 A2 职场词表。

### 2. 通用日常/职场语境一致性（无无关车间术语混入）

- **全量关键词与词形扫描**：逐行核验全篇 121 行与全部 188 个独立英文词形，并对 **181 个**中英文车间/制造/工业类关键词（110 个中文词如车间、产线、流水线、工位、工件、机床、车床、焊接、装配、分拣、质检、品控、料盒、托盘、叉车、传送带、领班、班长、工友、操作员、班次、交接班、点检、巡检、工装、夹具、模具、劳保、安全帽、护目镜、传感器、舵机、伺服、轴承、校准、卡尺、垫片、螺栓、线缆、端子、台账、公差、返工、报废、批次、工单、停机、急停、液压、冲压、注塑、仓库、备件、加工、数控、看板、安灯、工厂、厂房、机台、料架、装配线、质检员、作业指导书、工艺、工序、物料、领料、入库、出库、电焊、钳工、焊枪、扳手、螺丝刀、磨床、铣床、冲床、抛光、喷涂、零件、原料、成品、半成品、排产、产能、良率、不良品、漏检、抽检、作业员、维修工、机修、设备科、生产部、制造、车间主任、倒班、白班、夜班、机械、机加工、切削、钻孔、打磨、热处理、铸造、锻造、装配台、工作台；71 个英文词如 `workshop`、`factory`、`plant`、`shop floor`、`assembly`、`workstation`、`workbench`、`conveyor`、`foreman`、`operator`、`shift`、`handover`、`PPE`、`caliper`、`tolerance`、`work order`、`rework`、`scrap`、`QC`、`lathe`、`welding`、`fixture`、`gasket`、`sensor`、`calibration`、`downtime`、`warehouse`、`pallet`、`forklift`、`CNC`、`PLC`、`SOP`、`BOM`、`OEE`、`helmet`、`goggles`、`bolt`、`bearing`、`servo`、`machining`、`spindle`、`stamping`、`molding`、`jig`、`tooling`、`defect`、`inspection`、`production line`、`factory floor`、`part`、`batch`、`machinery`、`wrench`、`screwdriver`、`clamp`、`gauge`、`inventory`、`line leader`、`supervisor`、`safety boots`、`gloves`、`grinder`、`mill`、`drill`、`hydraulic`、`pneumatic`、`torque`、`valve`、`shaft`、`gearbox`、`boiler`）执行检索：
  - **中文命中**：`0` 处；
  - **英文检索**：70 词 `0` 命中，仅常规词 `part` 在 L52 `How's your part going?` 出现 1 次，语境为项目分工（“你这边负责的部分进展如何”），非工业“零件”；**语义层车间/制造/工业术语命中 `0` 处**。
- **场景与角色核验**：全部人物（汉娜/Hannah、卢卡斯/Lucas、米娅/Mia、克洛伊/Chloe、艾玛/Emma、玛雅/Maya、本/Ben、萨拉/Sara）与事项（周五活动筹备、报告、修照片、活动链接、来宾确认、价格核对、欢迎卡、新公寓搬家拆箱、书桌、书本、无线网、窗帘、沙发、周日叙旧、幻灯片、预算、客户电话、日程更新、笔记）均 100% 契合通用日常与现代办公语境。

### 3. 中文讲解清晰度

- **概念与规则精度**：
  - 导语（L3）平实衔接先修知识点，未泄露内部讲次编号；
  - 语音与语法讲解无事实偏差：区分助动词缩写/弱读与过去分词省音/连读（L8）、覆盖 `haven't / hasn't` 及其重读音节（L18、L110）、准确交代美式口语 `just + 一般过去时`（L22）、明确说明 `It's almost done.` 中 `done` 作形容词（L78）、完整交代 `for / since / ago / in / by` 方向与换算（L39–L42、L90），且全文数学换算（`11 − 9 = 2` 小时、周一至周四 `3` 天、11 点后两小时为下午 1 点、周三至周五 `2` 天）全部准确。
- **表达与体例一致性**：
  - 原版过度压缩导致的电报体已全部清理（如「锁定状态」「区别于」「尚未全部完成」「表还没打电话」「锁定“更新日程”已完成」「仅完成一半」「把部分完成当成全部完成」「未完信号」）；
  - 任务状态标签全篇统一（表 2「未完成 / 待办（含等待）」与三步三栏法、例题 1、常见错误保持一致）；
  - `*` 错例标记仅在 L108 明确给出图例（`*` 标错句或错搭）后于 L115–L119 使用，L21 改用文字说明「不可说 `Yes, I've.`」，无超前引用符号。

### 4. Markdown 结构可读性

- **渲染与语法实测**（基于仓库已安装依赖 `react-markdown@10.1.0` + `remark-gfm@4.0.1`，模拟 `web/src/features/guide/LessonReader.tsx` 的 `skipHtml: true`、`disallowedElements: ['img']`、`h1–h5 → h3–h6` 映射）：
  - **原始 HTML 与占位文本**：除 L6 合法概念锚点 `<!-- concepts: progress-update-listening -->` 外，原始 HTML 标签 `0` 处；`TODO / TBD / FIXME / 无资料 / 待补 / Replace this lesson` 占位文本 `0` 处；行尾空白 `0` 行，制表符 `0` 处，文件末尾含标准换行符。
  - **标题层级**：`H1`（L1）→ `H2`（L5）→ `H3`（L10/46/68/80/92/106，共 6 处）→ `H4`（L12/24/35/48/59，共 5 处），映射后为 `h3`（1）、`h4`（1）、`h5`（6）、`h6`（5），无跳级或层级溢出。
  - **表格与列表**：3 张 3 列 GFM 表格（表 1 L14–L19 共 6 行、行长 19–200 字符；表 2 L26–L31 共 6 行、行长 19–148 字符；表 3 L37–L42 共 6 行、行长 19–116 字符），渲染产出 `3` 个 `<table>`、`15` 个 `<tr>`、`9` 个 `<th>`、`36` 个 `<td>`，列数齐整且表格前后空行完整；全文 `6` 个 `<ul>`、`4` 个 `<ol>`、共 `33` 个 `<li>` 均为紧凑列表（`<li><p>` 为 `0`）；L114–L119 3 空格缩进严格嵌套为 `<ol>` 第 5 项内的子 `<ul>`，极大改善原版长段可读性。
  - **行内格式与符号闭合**：渲染产出 `51` 处 `<strong>`、`194` 处 `<code>`、`0` 处意外 `<em>`、`0` 处相邻 `</code><code>`、`0` 处行内代码首尾冗余空格；代码块外残留 `*`、`` ` ``、`_`、`|`、`$`、`~` 均为 `0`；全篇 121 行反引号、中文括号、中文双引号均逐行严格配对。

---

## 四、非阻断观察（无需为此返工）

1. **L33 主语承接与单行密度**：L33 单条要点达 250 字符，且后半句「`wait for` 接等待对象或 `人 + to do`（如 `waiting for Mia to reply`），接 `to + 动词原形` 表等自己做某事时不加 `for`（`waiting to hear back`）」在逗号后省去了主语 `wait`。由于后文紧跟「不加 `for`」与例词 `waiting to hear back`，读者不会产生误解；未来若做例行排版微调，可顺手拆为两条并补全 `wait`。
2. **前端组件侧通用备注（非本稿缺陷）**：`web/src/features/guide/LessonReader.tsx` 当前未显式挂载 `remarkGfm`，本次表格渲染核验沿用同批次讲义的 GFM 约定。

---

## 五、最终结论

本讲义修订后四维度全面达标，无阻断性问题，无需继续修改，**审查通过（PASS）**。
