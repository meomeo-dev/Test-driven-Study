# 事实复核报告：第 14 讲「日常分享与工作进度同步听力」（二轮复核）

- **复核对象**：`docs/research/beginner-english-a2-expansion/progress-update-listening/lesson_draft.md`（121 行，10,179 字节）
- **核查基准**：`docs/research/beginner-english-a2-expansion/progress-update-listening/budget_plan.json`、`docs/research/beginner-english-a2-expansion/syllabus.json`（第 14 讲，目标级别 `CEFR A2`，`skill_focus: listening_speaking`，`min_read_units = 2430`，`min_examples = 3`，规划 10 道计分题，非零题自评节点）、`scripts/lib/effort-audit.mjs` 以及先修讲义（`present-perfect-forms/lesson_draft.md`、`ever-never-already-yet/lesson_draft.md`、`for-since-duration/lesson_draft.md`、`future-will/lesson_draft.md`）
- **复核结论**：**通过（PASS，0 项阻断问题）**——初审检出的 2 项阻断缺陷（L21 美式 `I just finished.` 错释为「偶省 `'ve`」及跨讲冲突；L51 `We've planned Friday's event for two weeks.` 体貌与搭配失当）及一轮联审全部清晰度/地道度修订点均已闭环修复且未引入新问题；全文英语语法与 26 处 IPA 音标准确无误、无自相矛盾解释、CEFR A2 级别适配清晰、两段情景对话与 3 道例题逻辑和时间换算严密地道、无 `无资料` 或占位文本、无原始 HTML 与车间离题术语、`<!-- concepts: progress-update-listening -->` 锚点精确匹配、非零题自评节点无需 `effort-lab`，等效阅读量达标（`3,367 >= 2,430`）且满足下游严格课时门预算（预计 `η = 1.14`）。

---

## 一、核心门禁、锚点与等效阅读量核查

| 核查维度 | 要求基准 | 实测结果 | 判定 |
| --- | --- | --- | --- |
| `<!-- concepts: <id> -->` 锚点 | 每个知识点小节含 `<!-- concepts: progress-update-listening -->` | L5 `## 日常分享与工作进度同步听力` 下一行（L6）精确写入 `<!-- concepts: progress-update-listening -->`；经 `scripts/lib/effort-audit.mjs` `attributeLesson()` 实测精确匹配 1 个小节 | **通过** |
| `effort-lab` 锚点与编号步骤+清单 | 仅零题自评/实操知识点须配置 | `budget_plan.json`、`syllabus.json` 与本次复核基准 `[{"id": "progress-update-listening", "min_read_units": 2430}]` 均未配置 `effort_lab`；本讲为 `listening_speaking`，规划 10 道计分题（`planned_item_design_min = 32.7`），非零题自评节点 | **不适用（合规）** |
| 无 `无资料` 及占位文本 | 严禁 `无资料`、`TODO`、`TBD`、`FIXME`、`Replace this lesson`、`待补`、`待完善` | 全文 `0` 处匹配；中英文车间/制造/工业离题词扫描（180+ 词项）亦为 `0` 命中 | **通过** |
| 例题与常见错误结构 | `min_examples >= 3`，含 `### 例题` 与 `### 常见错误` | 含 3 道 `### 例题`（L68、L80、L92）、1 节 `### 常见错误`（L106，含 5 类偏误及 5 组 `*` 错例对照）与 `**听辨三查**`（L121） | **通过** |
| 等效阅读量（`中文字数 + 3×英文词数`） | `progress-update-listening >= 2430` | `effort-audit.mjs` `attributeLesson()` 归属口径（导语池 + `##` 正文，不含 `##` 标题行）：中文 `1,480` 字 + 英文 `629` 词 = **`3,367`**（`1.386` 倍；去注释 `1,480 + 3×627 = 3,361`，`1.383` 倍）；仅 `##` 正文去注释：`1,429 + 3×624 = 3,301`（`1.358` 倍）；全文件去注释：`1,493 + 3×627 = 3,374`（`1.389` 倍） | **通过** |
| 下游严格课时门预测 | `audit-course-effort.mjs --strict` 要求 `0.70 <= η <= 1.40` | `readMin = 13.5089 min`（`1480/250 + 629/90 + 0.15×4`），`lectureDesignMin = 1.8 × 13.5089 = 24.32 min`；叠加 `budget_plan.json` 规划题库 `32.70 min` 合计 `57.02 / 50 min`（**`η = 1.14`**，距 `70.00 min` 上限尚余 `12.98 min`）；即便按同构 10 题听力课 `directions-transport` 实测题库工时（`33.78 min`）折算，合计 `58.10 / 50 min`（**`η = 1.16`**），仍留有 `11.90 min` 安全裕量 | **通过** |
| Markdown 渲染与 HTML 安全 | 无原始 HTML 标签（注释除外），GFM 语法完整闭合 | 除 L6 概念注释锚点外 **0 处**原始 HTML 标签；经 `micromark` + `micromark-extension-gfm`（`allowDangerousHtml: false`）实测：3 张 3 列表格（各 5 `<tr>` / 3 `<th>` / 12 `<td>`）、51 处 `<strong>`、194 处 `<code>` 全部精确闭合；`0` 处意外 `<em>`、`0` 处代码块外残留 `*`/`` ` ``/`_`/`|`、`0` 处代码内弯引号/弯撇号、`0` 处中英文成对标点失配、`0` 处行尾空白或制表符 | **通过** |
| 英语语法、语音准确性与跨讲自洽 | 语法规则、IPA 音标、例题及跨讲口径无事实错误与自相矛盾 | 全部语法规则、26 处 IPA 音标、5 处 `*` 错例对照与先修第 8、11、12、13 讲口径完全一致，无内部或跨讲矛盾 | **通过** |
| CEFR A2 级别适配 | 词汇与句法适配 CEFR A2，衔接先修且不抢跑 B1 重点 | 去注释共 `627` 英文词次、`200` 个不重复小写词形（含音标片段），主体为 A1–A2 核心生活与职场词汇；场景关键词（`check-in`、`so far`、`on track`、`make progress`、`unpack`、`settle in`、`catch up`、`notes`）均有清晰中文释义或语境支架；严守 A2 时态边界，未抢跑 B1 现在完成进行时、过去进行时、被动语态或条件句 | **通过** |
| 例句与情景对话地道度 | 规则例句、两段双语情景对话、三道例题及英中译文自然地道、时间线闭环 | 两段双语情景对话（6 轮职场晨会 + 4 轮日常语音与回电）及全部表格/例题示范句合语法、自然流畅，时间推算与英中译文严格吻合 | **通过** |

---

## 二、前轮阻断项与修订点闭环核验

1. **原事实复核阻断 #1（L21 美式 `I just finished.` 错释为「偶省 `'ve`」）→ 已闭环修复（现 L21–22）**：
   - 肯定简答禁缩已独立成条（L21：`Yes, I have.，不可说 Yes, I've.`），不再在 `*` 图例定义前提前使用 `*`。
   - L22 修订为「美式口语常见 `just` 直接配一般过去时（`I just finished.`），加之 `'ve` 弱读难辨，听力均判刚完成，本课书面与产出统一用现在完成时」，准确区分“美式一般过去时用法”与“`'ve` 弱读听感”，与先修第 12 讲（`ever-never-already-yet/lesson_draft.md` L37）口径完全一致。
2. **原事实复核阻断 #2（L51 `We've planned Friday's event for two weeks.` 体貌与搭配失当）→ 已闭环修复（现 L52）**：
   - L52 已改为 `We've prepared for Friday's event for two weeks now.`，采用持续性活动短语 `prepare for` 替代终结性动词 `plan`，消除“把活动规划为两周长”的搭配歧义，并与第 13 讲（`for-since-duration/lesson_draft.md` L35）A2 持续动词配 `for / since` 约束及 L53 `worked on` 错词呼应。
3. **原事实复核非阻断建议与语言审查联审阻断项 → 全部准确落地且无副作用**：
   - **语音与规则精度**：L8 准确区分助动词“缩写或弱读”与过去分词尾音“省音或连读”；L16 补入信号词 `We've already sent it.`；L18 补齐 `hasn't /ˈhæzn(t)/` 并精确限定“句中非重读的完整肯定助动词 `have / has` 常省 `/h/`”；L19 补足词干尾音 `/t/ /d/` 留 `/ɪd/` 条件、`just finished` 省 `just` 尾音 `/t/` 及 `been` 弱读短音 `/bɪn/`（`He's been busy.`）；L29 拆清 `She's still working on it.` 与 `almost done / half ... so far` 均表尚未全部完成；L30 补 `hasn't`；L31 补原计划时间 `I planned to call today, but I'll call tomorrow.`；L33 补齐 `waiting for Mia to reply` 与 `waiting to hear back` 对比；L40/L113 将“不重算首尾”改为准确的“不重复计算首尾两天”；L41 补全 `started two days ago` 换算例；L42 补齐 `by four`（四点前）规则与示例；L44 明确“划出三栏”与“划掉旧计划”。
   - **对话地道度与英中对齐**：L52–57 补 `How's your part going?` / `Hi Hannah! Pretty well.`、拆分 `just sent the event link` 与 `already confirmed twenty guests`、改为 `this morning` 与 `Mia's email`、补齐 `the welcome cards` 实现英中 1:1 对齐并去除对话分号；L63–66 消除 `five days ago` 与 `since last Friday` 同日重复（改用 `moved into my new apartment last week, and I've lived here for five days now`）、补 `my books` 与 `Good news—` 自然过渡、将 `heard your message` 改为 `listened to your message`、同步修正 `settling in` 进行态译文与 `Come over on Sunday to catch up!`。
   - **例题与常见错误自洽性**：L70 统一量词为 `3 组` / `第 1–2 组`，L74 补对象与时间 `call him this morning`，L78 明确点破 `It's almost done.` 中 `done` 作形容词表状态（`It's = It is`），与 L17 无缝呼应；L84/L86/L90 润色为 `on a client call`、`sent the report yet, and we'll share it` 并补充对应 `for two hours / for three days`；L92 标题改为「微型进度同步听辨与干扰排雷」消除与 L94「周五下午」的时间冲突，L97 改用 A2 通用词 `Sara's notes`、`finished half of the slides` 与完整宾语 `I've waited for them since Wednesday.`；L110 移除伪拼写 `havn-` 改用标准音标 `/ˈhævn/`、`/ˈhæzn/`；L115 精确限定“汇总至今进度时 `so far` 禁配过去时”并补统计对象 `three boxes`。

---

## 三、逐段复核明细

1. **标题、导语与概念锚点（L1–8）**：
   - L1、L5 标题与 `syllabus.json`、`budget_plan.json` 逐字一致；L6 锚点准确；L3 准确衔接先修概念且无内部大纲讲次号泄露；L8 语音与四态框架概括精准。
2. **表 1 与语音规则（L12–22）**：
   - 全文 26 处 IPA 音标（`/aɪv/`、`/wiːv/`、`/v/`、`/hiːz/`、`/ʃiːz/`、`/ˈhævn(t)/`、`/ˈhæzn(t)/`、`/əv/`、`/əz/`、`/æ/`、`/t/`、`/h/`、`/bɪn/`、`/d/`、`/ɪd/`、`/red/`、`/e/`、`/iː/`、`/ˈhævn/`、`/ˈhæzn/`）全部准确且体例统一（与先修第 11 讲一致）。
   - 辅音前省音、元音前连读、`/t/ /d/` 词干保留 `/ɪd/`、`been` 弱读、肯定简答禁缩、美式 `just` 配一般过去时全部核实无误。
3. **表 2、表 3 与三步三栏法（L24–44）**：
   - 四态信号词归类清晰，`so far`（已完成汇总）与 `half ... so far`（部分完成属进行中）分工明确无矛盾；`finish + 名词/-ing`、`wait for + 对象/人 to do` vs. `wait to do`、`on track`、`progress` 不可数全部准确。
   - `for / since / ago / in / by` 换算方向与减法示例（周四 `since Monday` = 3 天）准确无误。
4. **双语情景对话（L46–66）**：
   - **情景 1（周三上午晨会，L48–57）**：时间线与状态完全闭环——周五活动已筹备两周（`for two weeks now`）；报告已完成并于周二发出（`yesterday`）；照片从周一修至周三且仍在编辑；活动链接刚发、20 位来宾已确认；原计划今天上午核对价格但因等米娅邮件未完成；汉娜临时决定马上联系她（`I'll message`）；欢迎卡未打、计划周四打印（`going to print them tomorrow`）；卢卡斯承诺今日四点前发照片（`I'll send ... by four`），整体按计划推进。
   - **情景 2（周三晚语音与回电，L59–66）**：时间线严密自洽——以周三晚为基准，往前推 5 天为上周五，落入 `last week`（无论按周一至周日或周日至周六周历均准确成立），与 `I've lived here for five days now` 精准吻合；无线网自周二起可用（在搬入之后、当前之前）；沙发周五上午送达，周日邀约叙旧合情合理。
5. **三道梯度例题（L68–104）**：
   - **例题 1（L68–78）**：3 组任务状态判定（已完成 / 进行中 / 待办）与第 1–2 组 `'s` 还原（`has`；两处均为 `is`）及 `done` 作形容词解析完全正确。
   - **例题 2（L80–90）**：周四上午 11 点基准下，`since nine a.m.` = `11 − 9 = 2 小时`（`for two hours`）、`since Monday` = `3 天`（`for three days`）、`haven't sent ... yet` + `in two hours` = `未完成，下午 1 点发`，算术与语用完全精确。
   - **例题 3（L92–104）**：周五下午场景下，已完成任务为**更新日程**（`half of the slides so far` 为半成干扰项），等萨拉的笔记 `since Wednesday` 至周五间隔 **2 天**（防误算 3 天），主谓与代词指代（`notes` → `them`）严密无误。
6. **常见错误与听辨三查（L106–121）**：
   - 5 类偏误及 5 组 `*` 错例/错搭（`*So far I packed three boxes.`、`*waiting the reply`、`*No, yet.`、`*finished to write`、`*a progress`）均准确命中中文母语负迁移高发点，正解全部地道无误。

---

## 四、备注（非阻断提示）

- **下游命题工时控制**：二轮补全自然对话衔接与中文解析后，本讲义等效阅读量为 `3,367`（为基线 `2,430` 的 `1.386` 倍，`lectureDesignMin = 24.32 min`），在 `budget_plan.json` 规划题库（`32.70 min`）下预计 `η = 1.14`、按同构 10 题听力课基准（`33.78 min`）预计 `η = 1.16`，均远低于严格课时门上限 `1.40`（`70.00 min`）。后续编写本知识点 10 道 v2 题目时，将题库设计工时控制在约 `32–42 min` 内即可稳妥通过 `--strict` 课时门。

---

## 五、最终结论

`docs/research/beginner-english-a2-expansion/progress-update-listening/lesson_draft.md` 已全部通过事实复核（**PASS，0 项阻断问题**），准予进入后续定稿与题库编写阶段。
