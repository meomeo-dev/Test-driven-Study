# 语言与结构审查报告：`status-summary-writing/lesson_draft.md`

- **审查对象**：`docs/research/beginner-english-a2-expansion/status-summary-writing/lesson_draft.md`（100 行，7,949 字节；去注释中文 1,184 字，英文 483 词，136 个独立英文词形）
- **课程定位**：`beginner-english` 第 13 单元「个人经历与进度追踪（`experiences-progress`）」第 5 讲「阶段总结与进度汇报写作」（`status-summary-writing`，扩展大纲 `syllabus.json` 批次内第 15 讲，CEFR A2，`writing_application`，45 分钟，通用日常与现代职场英语，无车间背景）
- **课时门余量实测**：经 `scripts/lib/effort-audit.mjs` 的 `attributeLesson()` 实测，概念 `status-summary-writing` 精确匹配 1 个小节，`cjk = 1,173`、`en = 485`（等效阅读量 `2,628`，高于 `budget_plan.json` 基线 `target_read_units = 2,180`）、`readMin = 10.6809`、`lectureDesignMin = 19.23`（`LAMBDA_STUDY = 1.8`）；叠加规划题库 `30.40` 设计分钟合计 `49.63` 分钟 / 声明 `45` 分钟（`ratio = 1.103`），处于 `[0.70, 1.40]` 区间内，距 `63.00` 分钟严格上限尚余 **`13.37` 设计分钟**。修订扩充自然对话并补全语法正例与关键解析不存在课时溢出风险。
- **总体结论**：**不通过（FAIL，存在 2 大类 5 项阻断性问题，需修订 1 轮后复核）**
- **审查摘要**：本稿在**通用日常/职场语境一致性**（473 个中英文车间/制造/工业关键词检索 **0 命中**）与 **Markdown 结构可读性**（经 `react-markdown@10.1.0` + `remark-gfm@4.0.1` 实测零非法原始 HTML、零未闭合标记、零表格或列表异常，两篇示范短文均正确使用 `>` 引用块）两个维度通过；但在**英文对话自然度（含范文与例题英文）**（两段情景对话仅 4 轮且存在 `so` 因果断裂、`them` 指代歧义、`fixed three errors` 缺载体、`here` 无场景锚点、B2 词 `steady` 与中式搭配 `catch up on speaking`；例题 1 存在跨复数名词的 `them` 指代错位、`Next week ... by Monday` 别扭及句首四连撞车；两篇范文均叠用 `So far, I have/I've already...`；例题 2 出现中式直译 `record two speaking updates` 与偏技术词 `short log`；例题 3 合并后 `already` 错笼罩 `made good progress`）以及**中文讲解清晰度**（表 1 三要素顺序与建议词数和例题 1、例题 2 全面矛盾；L21/L96 零介词漏限「时间名词」；L20 与 L30 关于 `still` 打架且全文缺 `still haven't/hasn't` 正例；L37「介词不省」与 L96 矛盾；L22「省重复主语或助动词」不准确；L64 误将 `yet` 归给进行时；L88 漏解 `I do → I'll do`；L8「完成时简单式」与 L95「极性混用」属生硬/超阶术语；常见错误多处缺正误完整对照）两个维度存在阻断性问题，须定向修订后复核。

---

## 一、四维度审查总览

| 审查维度 | 判定 | 核心评估 |
| --- | --- | --- |
| 1. 英文对话自然度（含范文与例题英文） | **不通过** | 对话 1（L44–47）仅 4 轮，`fixed three errors` 缺载体、职场裸用 `the notes`（笔记），L47 `I'm still working on the slides, so I'll wrap them up by Monday.` 存在 `so` 因果断裂与 `them`（指 `notes` 还是 `slides`）歧义且漏答何时核对笔记；对话 2（L51–54）`studied here` 无场景锚点、`steady` 超 A2 且偏评估腔、话轮跳脱、`catch up on speaking` 搭配不地道。例题 1（L62）`them` 跨过紧邻复数 `the notes` 回指 `the slides`、`Next week ... by Monday` 别扭、4 句连续 `时间词, I...` 撞车且与例题 2（L72）同样叠用冗余的 `So far, I have/I've already...`；例题 2 出现中式直译 `record two speaking updates` 及不自然的 `wrote a short log`；例题 3（L86）合并后 `already` 错笼罩 `made good progress`。 |
| 2. 通用日常/职场语境一致性 | **通过** | 逐行通读全文 100 行并核验全部 136 个独立英文词形，同时对 473 个中英文车间/制造/工业关键词（275 中文 + 198 英文）执行全量检索：**中文命中 0 处、英文命中 0 处**。全部人物、场景与任务均落在远程团队周会/周报、英语学习打卡与日常复盘语境，无任何无关车间术语混入。 |
| 3. 中文讲解清晰度 | **不通过** | 表 1（L14–18）三要素顺序与建议词数（`22–28 / 18–24 / 18–26`）与例题 1（14/12/17/14 词）及例题 2（24/11/13/14 词）全面矛盾；L21/L96 零介词漏限「时间名词前」；L20 与 L30 对 `still` 冲突且通篇缺 `still haven't/hasn't` 正例；L37「介词不省」漏限「接宾语时」与 L96 自相矛盾；L22「省重复主语或助动词」表述失准、强调 `, but` 与礼貌收尾却全文零示范；L64 误写「进行时加句尾 `yet`」；L88 漏解 `do → 'll do`；L8「完成时简单式」与 L95「极性混用」晦涩；表 3 偷塞 `finish` 且漏注 `went / gone` 及过去分词；常见错误多处缺完整正误对照且 L98 突现无对比的「周报用 `weekly update`」。 |
| 4. Markdown 结构可读性 | **通过** | 经 `react-markdown@10.1.0` + `remark-gfm@4.0.1`（对齐 `web/src/features/guide/LessonReader.tsx` 的 `skipHtml: true`、`disallowedElements: ['img']`、`h1–h4 → h3–h6` 映射）实测，除 L6 合法概念锚点 `<!-- concepts: status-summary-writing -->` 外零原始 HTML、零残留未解析符号、零意外 `<em>`、零松散列表、零行尾空白与占位词，两篇范文均采用 `>` 引用块呈现，标题树与 3 张 3 列 GFM 表格语法完整（仅建议在 L30 与 L32 两张紧邻表格间增加一行过渡小标）。 |

---

## 二、阻断性问题清单

### B1：英文对话自然度、示范短文与例题英文缺陷

#### B1.1 两段双语情景对话过压缩（仅 4 轮），存在逻辑断裂、指代歧义、缺场景锚点与中式搭配（L44–54）

- **原句位置与内容**：
  - 对话 1（L45–47）：
    - 丹尼尔：`Good! So far, I've sent out the newsletter. On Tuesday, I fixed three errors.`（不错！目前我发出了简报。周二修了三处错误。）
    - 瑞秋：`Nice! Have you checked the notes yet?`（很好！笔记核对了吗？）
    - 丹尼尔：`Not yet. I'm still working on the slides, so I'll wrap them up by Monday.`（还没。我还在做幻灯片，周一前会收尾。）
  - 对话 2（L51–54）：
    - 克莱尔：`Hey Kevin, you've studied here for four weeks! How's it going?`（嗨，凯文，你在这学满四周啦！感觉怎样？）
    - 凯文：`Great! I've made steady progress. Yesterday, I went over my notes.`（很棒！我稳步进步。昨天复习了笔记。）
    - 克莱尔：`Awesome! Have you practiced speaking yet?`（真好！练口语了吗？）
    - 凯文：`Not yet. Next week, I'm going to catch up on speaking and review new words.`（还没。下周我打算补上口语并复习生词。）
- **问题分析**：
  1. **L47 因果衔接断裂、代词 `them` 歧义且漏答问题**：瑞秋刚问 `the notes`（笔记核对了吗），丹尼尔答 `I'm still working on the slides, so I'll wrap them up by Monday.`。“还在做幻灯片”并非“周一前收尾”的因果理由（误用 `so`）；同时 `the notes` 与 `the slides` 均为复数，`them` 极易被误读为指代瑞秋刚问的 `the notes`；更关键的是，丹尼尔只说了幻灯片何时收尾，完全没回答什么时候核对笔记；中译还漏译了 `so` 与代词宾语，显得生硬跳脱。
  2. **L45–46 孤立缺上下文且职场用词不准**：`On Tuesday, I fixed three errors.` 未说明三处错误出现在哪份材料（如网站、报告或用户指南），读来空洞；职场语境中 `the notes` 译「笔记」偏校园化，改为 `the meeting notes`（会议记录）更贴合现代办公；`newsletter` 译「简报」易与演示幻灯片（台湾亦称简报）混淆，宜统一译为「电子简讯」或「通讯」。
  3. **L51 `here` 悬空**：对话 2 标题为「英语学习搭子复盘（日常生活）」，并未交代两人在某所语言学校或学习班，直接说 `you've studied here for four weeks` 会令学习者困惑 `here` 指代何处。
  4. **L52 超纲词与话轮跳脱**：`steady` 属 CEFR B2 词汇且在朋友口语中带书面评估腔（中译「我稳步进步」亦不口语化）；未交代任何已完成的具体进展就直接跳到 `Yesterday, I went over my notes.`，导致 L53 克莱尔对「复习笔记」回复 `Awesome!` 并突兀追问 `Have you practiced speaking yet?` 显得刻意。
  5. **L54 `catch up on speaking` 中式搭配**：`catch up on` 后通常接落下的具体任务、练习或功课（如 `my speaking practice`、`the speaking lessons`），直接接抽象技能 `speaking` 不自然；两段对话均仅 4 轮，缺少对方收尾回应，对话戛然而止。
- **修改要求**：
  - 将两段对话扩充至自然流畅的 **5–6 轮**，补齐上下文、修复逻辑衔接与收尾话轮。
  - **对话 1 修订方向**：明确 `three errors` 的载体（如 `three errors on the website` / `in the user guide`），将 `the notes` 改为 `the meeting notes`（会议记录），`newsletter` 译「电子简讯」；修正 L47 逻辑与指代，使原因、幻灯片收尾与核对会议记录形成闭环，并补瑞秋收尾，例如：
    - 丹尼尔：`Not yet. I'm still working on the slides, so I haven't had time. I'll wrap up the slides by Monday and check the meeting notes right after.`（或拆为两轮，先交代原因与 `wrap them up`，再由瑞秋确认节点收尾）。
  - **对话 2 修订方向**：去掉悬空 `here`（改为 `you've studied English for four weeks now!` 或明确 `in this study group`）；将 `steady progress` 改为 A2 口语自然的 `good progress`，补入已完成具体进展（如 `So far, I've finished ten listening lessons, and yesterday I went over my notes.`）以自然引出克莱尔对口语的追问；将 `catch up on speaking` 改为 `catch up on my speaking practice`（或 `the speaking lessons`），并补克莱尔邀约或鼓励收尾（如 `Good plan! Let's practice together next Tuesday.`）。

#### B1.2 例题 1、例题 2 示范短文与例题 3 改写句存在代词错位、时间搭配别扭、冗余叠用与中式直译（L58–86）

- **原句位置与内容**：
  - 例题 1（L62，64 词）：`Hi team, here is my weekly update. So far, I have already finished the user guide and sent out the newsletter. On Tuesday, I met our design team online and fixed three errors. Right now, I am still working on the slides, and I have not checked the notes yet. Next week, I will wrap them up by Monday and follow up with clients.`
  - 例题 2（L72，62 词）：`I've studied English here for four weeks, and I've made good progress. So far, I've already finished ten listening lessons and learned eighty words. Yesterday, I went over my notes and wrote a short log. I haven't practiced phone calls yet because I'm still working on fast speech. Next week, I'm going to review my word list and record two speaking updates.`
  - 例题 3 解答 2（L86）：`I've already written the draft and made good progress. I haven't finished checking it yet, so I'll do that tonight.`
- **问题分析**：
  1. **例题 1 S4→S5 代词 `them` 指代错位（明确语病）**：S4 先提 `the slides`，后提 `the notes`，紧接 S5 写 `I will wrap them up by Monday`。按就近回指原则，`them` 会绑定到紧邻的复数名词 `the notes`，但英语不对会议记录用 `wrap up`；且范文通篇未交代何时处理 `the notes`。
  2. **例题 1 S5 `Next week, I will wrap them up by Monday` 时间搭配别扭**：周一即下周伊始，同时说 `Next week` 和 `by Monday` 既冗余又压缩时间窗口（对比表 1 L18 的 `Next week, I'll ... by Friday.` 明显更合理）。
  3. **两篇范文均冗余叠用 `So far, I have/I've already...`**：`so far`（截至目前）与 `already`（已经）叠放同一分句显得堆砌考点、不够地道；此外例题 1 S2–S5 连续四句机械使用 `时间词, I + 动词`（`So far, I...` / `On Tuesday, I...` / `Right now, I...` / `Next week, I...`），与本讲力推的「去流水账」背道而驰；S3 `fixed three errors` 缺错误载体，且题干 L58 未提「设计团队」却在范文中凭空出现 `our design team`。
  4. **例题 2 多处中式直译与非 A2 词**：
     - `record two speaking updates`（「录两条口语更新」）属生硬中式直译，地道日常表达为 `record two short voice notes` / `two short voice messages` / `two speaking clips`；
     - `wrote a short log` 中 `log` 偏航海/系统日志色彩且超 A2，学习复盘宜用 `wrote a short summary` / `short study note` / `short journal entry`；
     - `practiced phone calls` 对应题干「电话对话」宜改为 `practiced phone dialogues` 或 `practiced making phone calls`，`working on fast speech` 宜补明为 `working on listening to fast speech`；
     - S1 `studied English here` 同样缺少 `here` 的语境锚点（题干 L68 未提任何机构或课程）。
  5. **例题 3 解答 2 `already` 辖域失当**：`I've already written the draft and made good progress.` 中 `already` 连带修饰 `made good progress`（相当于 `I've already made good progress`），语义生硬。
- **修改要求**：
  - **例题 1**：① 同步完善题干 L58（写明设计团队、错误所在材料、会议记录及截止日）；② 消除 `So far` + `already` 叠用（例如本篇用 `This week, I have already finished...`，例题 2 用 `So far, I've finished...`，或句间错开）；③ 调整 S4 分句顺序使 `the slides` 紧邻下句 `wrap them up`（例如 `I have not checked the meeting notes yet, because I am still working on the slides. Next week, I will wrap them up by Tuesday, review the notes, and follow up with our clients.`），同时打破 S2–S5 四连 `时间词, I...` 模板，并确保总词数严格落在 **60–80 词**且与标注词数完全一致（建议按需加入一句简短礼貌收尾如 `Please let me know if you have any questions.` 以呼应 L22）。
  - **例题 2**：① 去掉悬空 `here`（或题干与范文明确为 `in this English course`）；② 消除 `So far` + `already` 叠用；③ 将 `short log` 改为 `short summary` / `short study note`，将 `record two speaking updates` 改为 `record two short voice notes`（同步润色题干 L68，去掉生硬的「攻克快语速中」「口语更新」）；④ 改为 `practiced phone dialogues`（或 `making phone calls`）与 `working on listening to fast speech`；确保总词数严格落在 **60–80 词**且与标注一致。
  - **例题 3 解答 2**：改为 `I've already written the draft, and I've made good progress.`（或删 `already`：`I've written the draft and made good progress.`；若按题目要求合并前两句保留并列去重，建议将原错句微调使两个动作同属 `already` 自然辖域，如 `*I already have written the draft. I already sent the notes.` 或把 `already` 与 `make progress` 分置于前后分句）。

---

### B2：中文讲解清晰度、规则边界与内部一致性缺陷

#### B2.1 表 1 谋篇顺序与建议词数和例题 1、例题 2 全面矛盾（L14–18 vs L62–64、L72–74）

- **原句位置与内容**：
  - L16–18（表 1）：
    - `**已完成与待办**（22–28 词）`
    - `**关键过去节点**（18–24 词）`
    - `**下一步与收尾**（18–26 词）`
  - L64（例题 1 解析）：`开场 7 词；完成时汇总成果（14 词）；周二节点切过去时（12 词）；进行时加句尾 yet（17 词）；will 配 by 与代词中置承诺交付（14 词），通篇统一完整形。`
  - L72（例题 2 实测分句词数）：已完成 24 词（S1 12 + S2 12）→ 过去节点 **11 词**（S3）→ 未完与进行中 13 词（S4，合入已完成共 **37 词**）→ 下一步 **14 词**（S5）。
- **问题分析**：
  - 两篇范文**没有一篇符合表 1 任何一行的词数范围或推进顺序**：
    1. 表 1 将「已完成与待办」合并放在第 1 步（22–28 词），但两篇范文均采用「① 已完成成果 → ② 关键过去节点 → ③ 进行中与待办 → ④ 下一步计划」的四段式推进，且「已完成 + 进行中/待办」合计分别达 **31 词**（例题 1）与 **37 词**（例题 2），双双超出 22–28 词；
    2. 表 1 规定「关键过去节点」占 **18–24 词**，但两篇范文分别只有 **12 词**与 **11 词**（L64 甚至自己印出了 `12 词`）；
    3. 表 1 规定「下一步与收尾」占 **18–26 词**，但两篇范文均只有 **14 词**，且均不含「收尾」句。
- **修改要求**：
  - 统一表 1 与两篇范文的谋篇结构与词数区间：若保留大纲「三要素」框架（① 现状进度：已完成与进行中/待办；② 关键过去节点；③ 下一步与可选收尾），可注明「进行中与待办也可紧接过去节点后写」，并将建议词数调整为贴合 60–80 词实战的真实区间（例如：现状进度 `28–38 词`、关键过去节点 `10–18 词`、下一步与可选收尾 `14–22 词`），同时核对修订后的例题 1 与例题 2 每一段词数均严格落入表 1 区间内（如例题 1/2 中含一句礼貌收尾，则与「下一步与收尾」名实相符）。

#### B2.2 多处语法规则过度泛化、前后打架或解析漏项（L20、L21、L22、L37、L64、L88、L96）

- **原句位置与内容**：
  - L20：`right now / still` 用**现在进行时**……交付承诺用 `will`，个人打算用 `be going to`，均接原形。
  - L21 & L96：`this / last / next` 前零介词……句首时间锚点加逗号。
  - L22：用 `and` 省重复主语或助动词，`, but` 对举已完与未完，`, so` 引出计划
  - L37（表 3）：`| wait for / catch up on | 等待；补进度 | 不可分，介词不省 |`
  - L64（例题 1 解析）：`进行时加句尾 yet（17 词）`
  - L88（例题 3 解析）：`第 2 组调 already 位置、删 a 并用 and 合并，yet 移分句末、finish 接 -ing，去逗号黏连补 so。`
- **问题分析**：
  1. **L21 & L96 零介词漏限「时间名词」**：直接写「`this / last / next` 前零介词」属过度泛化，只有当其后接**时间名词**（如 `this week / last Tuesday / next Monday`）时才省介词，接地点或普通名词（`in this room / on the next page`）不可省略。此外 L21「句首时间锚点加逗号」语气过于绝对，宜改为「句首时间状语后常加逗号」。
  2. **L20 与 L30 关于 `still` 冲突**：L20 笼统将 `still` 归为现在进行时，L30 却又讲 `still` 在完成否定中置 `haven't` 前，且漏提三单 `hasn't`。
  3. **L37「介词不省」与 L96 自相矛盾**：L96 正例写 `I'm still waiting`（不及物无宾语，不带 `for`），L37 却无条件写「介词不省」，须限定为「**接宾语时**不可省介词」。
  4. **L22「省重复主语或助动词」失准**：并列同主语同时态动作时，可省略重复主语（或在省略主语的同时连同助动词一并省略，如 `have finished ... and sent ...`），但**不能保留主语而单独省助动词**（`*I have finished ... and I sent ...` 会改变时态，`*I will wrap ... and I follow ...` 直接成病句）。
  5. **L64 误把 `yet` 绑定给进行时**：`I am still working on the slides, and I have not checked the notes yet.` 中 `yet` 属于后半句**现在完成时否定**，写作「进行时加句尾 `yet`」极易误导初学者把 `yet` 用到进行时里。
  6. **L88 漏解关键时态改动**：例题 3 第 2 组把 `*I do it tonight` 改成了 `so I'll do that tonight`（一般现在时 → `will` 表决定/承诺，且 `it → that` 指代核对动作），L88 解析仅写「去逗号黏连补 `so`」，遗漏了 `do → 'll do` 这一重要修正。
- **修改要求**：
  - L20 改为「`right now` 与表持续动作的 `still` 用**现在进行时**……均接**动词原形**」。
  - L21 与 L96 统一明确为「`this / last / next` 接**时间名词**前零介词（如 `next week`，禁 `*in next week`）」，并将 L21「句首时间锚点加逗号」改为「句首时间状语后常加逗号」。
  - L22 改为「用 `and` 省略重复主语（同时态下连同助动词一并省略）」。
  - L37 改为「不可分，**接宾语时**介词不省（`wait for the reply`、`catch up on my speaking practice`）」。
  - L64 改为「进行时交代推进中任务，并列完成时否定配句尾 `yet`（17 词）」（按修订后实际句式与词数同步更新）。
  - L88 补全第 2 组解析，明确说明将一般现在时 `I do` 改为表当下决定/承诺的 `I'll do`（以及代词 `that` 回指核对动作，或保持简洁一致的宾语）。

#### B2.3 术语生硬/超阶、表文脱节与常见错误缺完整正误对照（L8、L21–22、L30、L35–36、L94–98）

- **原句位置与内容**：
  - L8：`持续推进用现在进行时或完成时简单式（不引入完成进行时）；完整邮件格式与条件句留待后续单元（* 标错句）。`
  - L30（表 2）：`| still | 进行时置 be 后；完成否定置 haven't 前 | I'm still working. |`
  - L35–36（表 3）：`| work on / go over | 推进；复查 | 不可分，代词后置；work on 与 finish 接名词或 -ing |` / `| send out / hand in / wrap up | 发出；提交；收尾 | 可分，代词中置（wrap it up）；过去式 sent / wrapped |`
  - L94–98（常见错误）：
    - L94：`*Yesterday, I have sent → sent`
    - L95：`2. **副词错位与极性混用**：肯定 already 置助动词后（禁 *already have / *haven't already）；yet 置分句末（禁 *yet haven't）；still 置 be 后或 haven't 前（禁 *haven't still）。`
    - L98：`……周报用 weekly update。`
- **问题分析**：
  1. **生硬/超阶术语影响 A2 可读性**：L8「完成时简单式」是英语 *present perfect simple* 的生硬直译，建议与同单元先修课 `for-since-duration`（L35）统一口径，改称「现在完成时（不引入现在完成进行时）」；L8 句尾「（`*` 标错句）」挂在「后续单元」之后归属含糊且未涵盖短语级误用，建议独立写明「下文用 `*` 标出误用或语法错句」；L95「极性混用」属语言学术语，初学者难以理解，宜改为「肯否定句型混用」或与 `ever-never-already-yet` 一致称「混用 `already` 与 `yet`」。
  2. **规则表与正文多处悬空、缺正例**：
     - L21 提到 `until`（配延续动作），但全文无一处 `until` 正例；
     - L22 强调 `, but` 对举已完与未完、可配礼貌收尾，但全文对话与范文中 `but` 与礼貌收尾均出现 **0 次**；
     - L30 表 2 `still` 栏声明了「完成否定置 `haven't` 前」，但示范栏只有 `I'm still working.`，全文零 `still haven't / hasn't` 正例；
     - L35 表 3 在 `work on / go over` 行的语法要点中突兀塞入第一列未出现的 `finish`，缺 `work on it / go over them` 与 `finish checking it` 示例，且漏标 `go over` 的不规则过去式/过去分词 `went / gone`；L36 将 `sent / wrapped` 仅标为「过去式」，遗漏其同时作为**过去分词**（如 `I've sent out`）。
  3. **常见错误多处缺完整正误对照或语境不清**：L94 `*Yesterday, I have sent` 缺少及物动词宾语 `it` 且右侧残缺；L95 全部 4 个错例均缺 `→` 正确表达；L96 `截止用 by 非 until` 缺实例对照；L98 末尾孤立写「周报用 `weekly update`」未点明对应中式错误（且易让学习者误以为 `weekly report` 是错的）。
- **修改要求**：
  - L8 改为「持续推进用现在进行时或现在完成时基本形式（不引入现在完成进行时）；完整邮件格式与条件句留待后续单元。下文用 `*` 标出误用或语法错句。」（另建议 L3 同步将「完成时、过去时、进行时与将来时」写全为「现在完成时、一般过去时、现在进行时与将来时」）。
  - L21 补入 `until` 简短正例（如 `I'll work until 5:00.`）；在修订后的对话或范文中至少自然示范 1 处 `, but` 对举已完与未完（并按需示范 1 句礼貌收尾）。
  - L30 表 2 `still` 栏改为「进行时置 `be` 后；完成否定置 `haven't / hasn't` 前」，示范栏补齐双例：`I'm still working on it.` / `I still haven't checked it.`。
  - L35–36 表 3：将 `finish` 单独列明或单列一行（如 `finish` | 完成 | 接名词或 `-ing`，禁 `to do`：`finish checking it`），为 `work on / go over` 补实例与不规则变形（`work on it / go over them`；`go–went–gone`），并将 L36「过去式 `sent / wrapped`」改为「过去式/过去分词 `sent / wrapped`」（并核实 `hand in` 是否在对话/范文中复用或替换为本文高频词）。
  - L94–98 常见错误：将 L95「极性混用」改为「肯否定句型混用」，统一「逗号串句 / 逗号黏连」措辞，为 5 类错误补全带完整语境的 `错例 → 正例` 对照（如 `*Yesterday, I have sent it. → Yesterday, I sent it.`、`*I already have sent it. → I've already sent it.`、`*I haven't checked it already. → I haven't checked it yet.`、`*I haven't still checked it. → I still haven't checked it.`），并将 L98 末条改写明确（如「周报常说 `weekly update` 或 `weekly report`，禁中式直译 `*week report`」，或聚焦删除该无关尾缀以保持第 5 条紧凑）。

---

## 三、已通过维度详细核验记录

### 1. 通用日常/职场语境一致性（通过）

- **全量关键词扫描**：针对 473 个中英文车间/制造/工业类关键词（275 个中文词如车间、产线、流水线、工位、工件、机床、车床、焊接、装配、分拣、质检、品控、料盒、托盘、叉车、传送带、领班、班长、工友、操作员、班次、交接班、点检、巡检、工装、夹具、模具、卡尺、垫片、螺栓、线缆、端子、传感器、舵机、校准、台账、公差、返工、报废、批次、工单、停机、劳保、安全帽、冲压、注塑、仓库、备件、看板、安灯、SOP、5S 等；198 个英文词如 `workshop`、`factory`、`plant`、`shop floor`、`assembly`、`workstation`、`conveyor`、`foreman`、`operator`、`shift`、`handover`、`PPE`、`caliper`、`tolerance`、`work order`、`rework`、`scrap`、`QC`、`lathe`、`welding`、`fixture`、`gasket`、`sensor`、`calibration`、`downtime`、`warehouse`、`pallet`、`forklift`、`terminal`、`CNC`、`PLC`、`SOP`、`BOM`、`OEE` 等）全量检索：
  - **中文命中**：`0` 处；
  - **英文命中**：`0` 处。
- **场景与词汇核查**：全部 136 个独立英文词形与 100 行中文内容均严格限定在远程团队周报/同步、英语日常学习打卡与病句改写语境中，无车间或工厂背景残留。（例题 2 中的 `short log` 偏技术/日志感，已归入 B1.2 英文自然度建议替换为 `short summary / study note`。）

### 2. Markdown 结构可读性（通过）

- **渲染实测**（`react-markdown@10.1.0` + `remark-gfm@4.0.1`，对齐 `web/src/features/guide/LessonReader.tsx` 的 `skipHtml: true`、`disallowedElements: ['img']`、`h1–h4 → h3–h6` 配置）：
  - **原始 HTML**：除 L6 课程概念锚点 `<!-- concepts: status-summary-writing -->` 外为 `0`；
  - **标记完整度**：可见正文（代码块外）残留 `*`、`` ` ``、`_`、`~`、`|`、裸 `$` 均为 `0`，异常 `<em>` 为 `0`；`32` 处 `<strong>`、`116` 处行内 `<code>`（均无首尾冗余空格、无 `</code><code>` 粘连）与 `2` 处 `<blockquote>` 闭合正确；松散列表（`<li><p>`）为 `0`，行尾空白与制表符为 `0`，占位文本为 `0`；中文括号（44 对）、中文双引号（1 对）及逐行反引号均精确配对；英文直撇号 `'` 统一，零弯撇号混用。
  - **层级与表格**：标题树为 `H1`（L1）→ `H2`（L5）→ `H3`（L10/40/56/66/76/90，共 6 处）→ `H4`（L12/24/42/49，共 4 处），映射为 `h3–h6` 无跳级溢出；3 张 GFM 表格（表 1 L14–18：5 行 3 列、行长 19–109 字符；表 2 L26–30：5 行 3 列、行长 19–66 字符；表 3 L32–38：7 行 3 列、行长 19–94 字符）列数齐整；两篇 60–80 词示范短文均采用标准 `>` 引用块呈现，在 `web/src/styles/guide.css` 下阅读舒适。
  - *前端组件侧通用备注（非本稿缺陷）*：`web/src/features/guide/LessonReader.tsx` 当前未显式挂载 `remarkGfm`，本项表格语法核验沿用仓库既有课程的 GFM 约定。

---

## 四、可选结构与排版润色建议（非阻断）

1. **L30 与 L32 两张紧邻表格间增加过渡小标**：当前表 2（副词位置，L26–30）与表 3（进展短语，L32–38）在 `#### 2. 进度副词位置与高频进展短语` 下仅隔一个空行（L31），而 `web/src/styles/guide.css` 未为相邻表格设置额外间距，渲染时容易视觉粘连。建议拆分为 `#### 2. 进度副词位置` 与 `#### 3. 高频进展短语`，或在 L31 插入一行简短引导语（如 `**高频进展短语速查**：`）。
2. **统一「时间词 / 时间锚点」与「逗号串句」措辞**：文中混用了「一逗到底」「禁逗号直连两完整句」「逗号串句」「逗号黏连」四种说法，且首次出现「时间锚点」（L8）未作通俗注脚；建议首次写作「时间标志词（锚点）」，并将逗号错误统一为「逗号串句（逗号黏连）」，同时略微舒展 L100「四步自检」的压缩表达（当前余量达 `13.37` 设计分钟，有充足空间保持清晰自然）。
