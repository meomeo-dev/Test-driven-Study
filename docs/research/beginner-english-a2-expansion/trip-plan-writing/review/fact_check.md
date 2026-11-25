# 事实复核报告：第 10 讲「出行与周末计划短文写作（`trip-plan-writing`）」

- **复核对象**：`docs/research/beginner-english-a2-expansion/trip-plan-writing/lesson_draft.md`（97 行，9,348 字节；修订版复审）
- **核查基准**：`docs/research/beginner-english-a2-expansion/trip-plan-writing/budget_plan.json`、`docs/research/beginner-english-a2-expansion/syllabus.json`（目标级别 `CEFR A2`，`skill_focus: writing_application`，`min_read_units = 1944`，`min_examples = 2`，规划 7 道计分题，非零题自评节点）、`scripts/lib/effort-audit.mjs` 及第 12 单元先修讲义（`directions-transport`、`future-going-to`、`future-will`、`hotel-trip-booking`）
- **复核结论**：**通过（PASS，0 项阻断问题）**——初审检出的 3 项阻断问题（B1 语法规则失实/跨讲冲突、B2 规则与例证脱节/内部语序矛盾/`*` 片段误标、B3 双语情景对话衔接断层）及排版建议均已准确修复且未引入新缺陷；全稿英语语法准确、无自相矛盾解释、CEFR A2 词汇与语法边界清晰、两篇示范短文（57 词 / 56 词）及两段 6 轮双语情景对话自然地道、无 `无资料` 或占位文本、无车间离题词、`<!-- concepts: trip-plan-writing -->` 锚点精确匹配、非零题自评节点无需 `effort-lab`、等效阅读量达标（`3,176 >= 1,944`）且满足下游严格课时门预算。

---

## 一、核心门禁、锚点与等效阅读量核查

| 核查维度 | 要求基准 | 实测结果 | 判定 |
| --- | --- | --- | --- |
| `<!-- concepts: <id> -->` 锚点 | 每个知识点小节含 `<!-- concepts: trip-plan-writing -->` | L5 `## 出行与周末计划短文写作` 下一行（L6）精确写入 `<!-- concepts: trip-plan-writing -->`；经 `scripts/lib/effort-audit.mjs` `attributeLesson()` 实测精确匹配 1 个小节 | **通过** |
| `effort-lab` 锚点与编号步骤+清单 | 仅零题自评/实操知识点须配置 | `budget_plan.json`、`syllabus.json` 与复核基准 `[{"id": "trip-plan-writing", "min_read_units": 1944}]` 均未配置 `effort_lab`；本讲为 `writing_application`，规划 7 道计分题（`planned_item_design_min = 27.2`），非零题自评节点 | **不适用（合规）** |
| 无 `无资料` 及占位文本 | 严禁 `无资料`、`TODO`、`TBD`、`FIXME`、`Replace this lesson` | 全文 0 处匹配；中英文车间/制造离题词扫描亦为 0 命中 | **通过** |
| 例题与常见错误结构 | `min_examples >= 2`，含 `### 例题` 与 `### 常见错误` | 含 2 道 `### 例题`（L63、L73）、1 节 `### 常见错误`（L87，覆盖 5 类中文母语负迁移失误）与四步自检（L97） | **通过** |
| 等效阅读量（`中文字数 + 3×英文词数`） | `trip-plan-writing >= 1944` | `effort-audit.mjs` `attributeLesson()` 归属口径（导语池 + `##` 正文，不含 `##` 标题行）：中文 `1,451` 字 + 英文 `575` 词 = **`3,176`**（`1.634` 倍；去注释 `1,451 + 3×573 = 3,170`）；仅 `##` 正文：`1,404 + 3×574 = 3,126`（去注释 `3,120`）；全文件原始：`1,462 + 3×575 = 3,187`（去注释 `3,181`） | **通过**（各口径均显著高于 `1,944`） |
| 下游严格课时门预测 | `audit-course-effort.mjs --strict` 要求 `0.70 <= η <= 1.40` | `readMin = 12.6429 min`（`1451/250 + 575/90 + 0.15×3`），`lectureDesignMin = 1.8 × 12.6429 = 22.76 min`；叠加 `budget_plan.json` 规划题库 `27.20 min` 合计 `49.96 / 40 min`（**`η = 1.25`**，距 `56.00 min` 上限余 `6.04 min`）；按 7 题细粒度常见参数估算（`29.29–31.82 min`）合计 `52.05–54.58 / 40 min`（**`η = 1.30–1.36`**），且全稿低于同批其他已通过讲义均值（`3,192–4,389`） | **通过** |
| Markdown 渲染与 HTML 安全 | 无原始 HTML 标签（注释除外），GFM 语法完整闭合 | 除 L6 概念注释锚点外 **0 处**原始 HTML 标签；经 `micromark` + `micromark-extension-gfm`（`allowDangerousHtml: false`）实测：2 张 3 列表格、2 处独立引用块（L38、L69）、41 处 `<strong>`、132 处 `<code>` 全部精确闭合，0 处意外 `<em>`、0 处代码块外残留标记、0 处括号/引号/反引号失配、0 处英文弯撇号混用、0 处行尾空白 | **通过** |
| 英语语法准确性与内部自洽 | 语法规则、例证、跨讲口径及 `*` 标注无错误或自相矛盾 | 全部语法规则、16 处 `*` 错例及其正解、双语译文均准确自洽，与第 12 单元前 4 讲先修口径完全一致 | **通过** |
| CEFR A2 级别适配 | 词汇与句法适配 CEFR A2，衔接先修且不抢跑后续单元 | 去注释共 `134` 个独立英文词形，0 拼写错误，全部处于 CEFR A1–A2 核心范围（`excited`、`relaxing`、`nearby` 均有明确中文释义）；L8 明确将第一条件句、现在完成时与动词后接 `to do` / `-ing` 完整用法留待后续单元 | **通过** |
| 例句与情景对话地道度 | 两篇短文、两段双语对话及改错解答自然地道、时间逻辑闭环 | 两篇示范短文实测精确 `57 词` / `56 词`，节奏自然；两段 6 轮双语对话起承转合流畅、时间链与语用逻辑严密 | **通过** |

---

## 二、初审阻断问题修复核验

| 原编号 | 原阻断问题 | 修订后位置与实测结果 | 核验状态 |
| --- | --- | --- | --- |
| **B1-1** | 例题 2 解析误写「晚间用 `on`」，与泛指晚间用 `in` 冲突 | L85 已改为“具体某天的晚间（星期 + 时段）用 `on`（泛指晚间用 `in`）”，与 L21、L93 及先修 `future-going-to` L43 完全一致 | **已解决** |
| **B1-2** | 表 2 `Next,` 与常见错误 3 泛写「置名词前零介词」 | L30 已改为“置**时间名词**前（如 `next week`）零介词”，L21、L93 同步限定为“`this / next` 接时间名词……零介词”，不与 `at the next station` / `in this hotel` 冲突 | **已解决** |
| **B1-3** | 常见错误 5 误写「邀约须留 `to`」，与 `Shall we` 冲突且缺 `Would you like to...?` 正例 | L95 已改为“`Would you like` 接动词须留 `to`（`*Would you like join us?` → `Would you like to join us?`；`Shall we` 后不加 `to`）”，并在 L60 对话 2 给出完整地道正例 `Would you like to join us?` | **已解决** |
| **B1-4** | L22 误将分词形容词简化为「人用 `-ed`」且缺 `excited` 中文释义 | L22 已改为“形容**人的感受**用 `-ed`（`excited` 兴奋的），形容**活动或事物特征**用 `-ing`（`relaxing` 令人放松的）”，并在 L47 与 L38/L52 完整示范 | **已解决** |
| **B2-1** | L21「小时间在前」示例 `at the station at 8:00` 缺失大时间 | L21 已补全为 `at the station at 8:00 on Saturday`，精确展示地点 → 小时间 → 大时间顺序，与先修 `future-going-to` L45 一致 | **已解决** |
| **B2-2** | 常见错误 2 写「句尾 `by + 交通`」，与 L21/L38/L83 语序冲突 | L92 已改为“或在**动词/目的地后**接 `by + 交通`（`*sit the train` → `take the train`；`*by subway go` → `go by subway`）”，与 L21、L38、L83 严密自洽 | **已解决** |
| **B2-3** | 孤立标 `*to see you` 不严谨且全文缺 `look forward to + -ing` 完整正例 | L22 明确 `look forward to` 中 `to` 为介词并给正例 `I'm looking forward to seeing you.`；L52 给出情景正例 `I'm looking forward to seeing Suzhou.`；L95 改为 `*look forward to see you` → `look forward to seeing you` | **已解决** |
| **B2-4** | L20/常见错误 1 未限定「表将来安排时」，与 `I hope ...` 表面冲突 | L20 与 L91 均明确限定为“**表将来安排时**，一般现在时仅用于车次与开放时刻等公共时刻表（不用于个人将来计划）”，与 L38 `Everything is ready`、L69 `I hope ...` 无冲突 | **已解决** |
| **B3-1** | 对话 1 仅 4 轮，缺目的地锚定、8:00 碰面直跳存行李且 `First,` 悬空 | L47–52 扩充为 6 轮自然对话：首轮点明苏州出行与发车时间，经 8:00 碰面与准时承诺，由萨姆追问 `What's our plan after we arrive?` 自然过渡到 `First, ... Then ... and ...`，并以 `Sounds relaxing! I'm looking forward to seeing Suzhou.` 收尾 | **已解决** |
| **B3-2** | 对话 2 仅 4 轮，9:00 接站直跳午饭、缺接站地点且与例题 1 脱节 | L56–61 扩充为 6 轮自然职场对话：L56 补全 `at the station`，L57 承接 9:00 接站（`pick him up there`），L58 补入 `Then we're going to show him around the office.` 打通上午日程，L60 以 `Leo and I are having lunch nearby—I booked a table. Would you like to join us?` 逻辑严谨地发出午餐邀约，L61 以 `I'd love to! I'll send him our plan tonight.` 自然收束 | **已解决** |

---

## 三、分模块深度事实核验

### 1. 语法规则与标点规范（L8–34、L87–97）

- **体例与符号先行**：L8 在首次使用 `*` 之前即明确图例（`下文用 * 标出语法错句`），并准确划定本讲 A2 边界（书面用 `going to` 不用 `gonna`；第一条件句、现在完成时与系统动词后接 `to do` / `-ing` 留待第 13、15 单元）。
- **时态、语序与介词（L14–21）**：
  - 表 1 三层词数配比（`8–15 / 30–42 / 6–15`，总目标 `50–70` 词）与两篇示范短文实测词数（`9 + 38 + 10 = 57`、`9 + 40 + 7 = 56`）严丝合缝。
  - 移动动词语序规则（目的地 + 交通 + 时间：`go home by train on Sunday`）符合标准英语状语语序惯例，且与 `directions-transport` L21（`home` 零介词）及本稿两篇短文、例题 2 完全一致。
  - 时间介词体系（钟点 `at`、星期及具体某天时段 `on`、泛指早晚 `in`、周末英 `at` / 美 `on the weekend`、`this / next` 接时间名词与 `tomorrow` 零介词）与 `future-going-to` L41–43 完全对齐。
- **高频搭配与顺序衔接词（L22–34）**：
  - 可分离动词短语代词中置（`pick him up`、`show him around`）、`look forward to + 名词/-ing`、`I hope + 完整从句`、`-ed / -ing` 情感与特征区分全部准确。
  - 表 2 对 `First,`（vs `At first,`）、`Then`（句首通常不加逗号、禁逗号黏连）、`Next,`、`After that,`（不可省 `that`；`After + 名词,`）与 `Finally,`（vs `At last`）的用法及逗号规范符合权威语法标准，且全稿所有示范句标点风格 100% 统一。
- **`*` 错例逐项复核（共 16 处）**：`*discuss about`（L71）、L77–78 两道改错原句、`*I go to Suzhou tomorrow.` / `*It will nice.`（L91）、`*sit the train` / `*by subway go` / `*Saturday will have a meeting.` / `*There have`（L92）、`*in the weekend` / `*on next Tuesday`（L93）、`*After,`（L94）、`*pick up him` / `*look forward to see you` / `*I hope you to come.` / `*Would you like join us?`（L95）均为确凿语法错例，无误标正确片段，且每项均有对应正确英文示范。

### 2. 两篇高分范文与词数验算（L36–41、L63–71）

- **高分范文示范（L38，日常生活）**：
  - **精确词数**：按空白分词共 **57 词**（`8:30` 计 1 词，纯字母词 56 词），其中开头点题 `9` 词（`This Saturday, my sister and I are visiting Suzhou.`）、行程主体 `38` 词（`Our train leaves at 8:30.` 5 词 + `First, we are going to leave our bags at the hotel.` 11 词 + `Then we are going to walk around a garden and try local noodles.` 13 词 + `Finally, we are going home by train on Sunday.` 9 词）、结尾收束 `10` 词（`Everything is ready, so it will be a relaxing weekend!`），与标题 `57 词` 及 L41 拆解（`9 + 38 + 10`）完全吻合。
  - **语言质量**：自然融合进行时、一般现在时时刻表、`be going to`、`and` 合并同主语动作、`so` 引出结果与 `will be` 收尾，消除了初稿中动词 `visit` 重复和连续三句 `we are going to` 的单调感；中文译文（L40）准确流畅。
- **例题 1 解答（L69，现代职场）**：
  - **精确词数**：按空白分词共 **56 词**（`9:00` 计 1 词，纯字母词 55 词），其中开头 `9` 词、主体 `40` 词（`5 + 9 + 10 + 7 + 9`）、结尾 `7` 词，与 L67 `56 词` 及表 1 区间完全吻合；已改用独立 `>` 引用块，与 L38 版式统一。
  - **要点与语法**：完整覆盖题干 4 项要点，准确运用 `is visiting`、`arrives at 9:00`、`I will pick him up at the station`、`show him around the office`、`are having lunch nearby`、`talk about our project`、`I hope he will enjoy his visit`；L71 解析对时态、代词中置、`discuss` 及物性（禁 `*discuss about`）及第二人称改写（`You are visiting...` 及 `you / your`）说明精准清晰。

### 3. 双语情景对话与例题 2 诊改（L43–61、L73–85）

- **对话 1（L47–52，6 轮）**：萨姆与玛雅围绕周六苏州行程对话，自然覆盖 `excited about`、`When does our train leave?`、`Shall we meet at the station at 8:00?`、`I'll be on time.`、`What's our plan after we arrive?`（时间状语从句用一般现在时表将来，符合 A2 地道口语）、`First, ... Then ...`、`Sounds relaxing!` 与 `I'm looking forward to seeing Suzhou.`，译文自然贴切。
- **对话 2（L56–61，6 轮）**：格蕾丝与汤姆确认下周二接待同事利奥的完整上午至午餐流程，L60 使用 `Leo and I are having lunch nearby—I booked a table. Would you like to join us?`（使用 `Leo and I` 而非泛指 `we` 使后句 `join us` 指代逻辑严密，使用一般过去时 `booked` 避开未学现在完成时），回应 `I'd love to! I'll send him our plan tonight.` 地道自然。
- **例题 2（L73–85）**：两组病句与解答句（L82–83）全部语法正确、语序地道，L85 逐项解释了将来表达（含 `go → are going`）、`stay at`、游玩/观光不用 `play`、拆逗号黏连、`After that,`、目的地 + 交通 + 小时间 + 大时间、具体某天晚间用 `on`（泛指用 `in`）及形容词前补 `be`，无遗漏或矛盾。

### 4. CEFR A2 词汇适配与下游衔接备注（非阻断）

- **词汇审计**：去注释共 `134` 个独立英文词形，无拼写错误，无超纲生僻词，无车间/工业离题词。
- **下游命题预算提醒（非阻断）**：本讲讲义设计工时 `22.76 min`（`η = 1.25` 对规划题库 `27.20 min`，按实际 7 题参数估算约 `1.30–1.36`），处于严格课时门 `[0.70, 1.40]` 安全区间内；建议后续 7 题命题保持精炼（如 `cloze` 3–4 空约 35–45 词、`translation` 源句约 15–25 字配 2–3 关键词、`writing` 严守 `short_essay` 50–70 词与 `sentence_making` 8–15 词），即可稳妥维持 `η <= 1.40`。

---

## 四、最终结论

- **判定**：**通过（`passed: true`）**
- **阻断问题（`blocking_issues`）**：无（`[]`）
- **修订指令（`revision_instructions`）**：无（`[]`）
