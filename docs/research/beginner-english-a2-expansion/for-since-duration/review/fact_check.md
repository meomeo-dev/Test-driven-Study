# 事实复核报告（二审）：第 13 讲「持续时长与对比（`for / since` 与一般过去时辨析）」

- **复核对象**：`docs/research/beginner-english-a2-expansion/for-since-duration/lesson_draft.md`（128 行，8,729 字节）
- **核查基准**：`docs/research/beginner-english-a2-expansion/for-since-duration/budget_plan.json`、`docs/research/beginner-english-a2-expansion/syllabus.json`（目标级别 `CEFR A2`，`skill_focus: grammar_core`，`min_read_units = 2180`，`min_examples = 3`，规划 9 道计分题，非零题自评节点）、`scripts/lib/effort-audit.mjs`、首轮评审记录（`review/fact_check.md` 与 `review/language_precision.md`）及先修讲义（`present-perfect-forms/lesson_draft.md`、`ever-never-already-yet/lesson_draft.md`、`courses/beginner-english/lessons/daily-routine.md`、`courses/beginner-english/lessons/past-reports.md`）
- **复核结论**：**通过（PASS，0 项阻断问题）**——修订版完整闭环了首轮语言审查全部 5 项阻断问题与首轮事实复核 4 项可选润色项，未引入任何新的语法误差、自相矛盾或渲染缺陷。全文英语语法规则、时态与体貌边界精准自洽，CEFR A2 级别适配恰当，日常与职场例句、两段双语情景对话及 3 道梯度例题地道自然、英中译文贴切；全文无 `无资料`、占位文本或车间离题术语；知识点锚点 `<!-- concepts: for-since-duration -->` 匹配准确，Markdown 渲染安全，等效阅读量全口径达标（`effort-audit.mjs` 归属口径 `2,937 >= 2,180`），下游严格课时门预计 `η = 1.12`（距 `1.40` 严格告警上限尚余 `12.39` 设计分钟）。

---

## 一、核心门禁、锚点与等效阅读量核查

| 核查维度 | 要求基准 | 实测结果 | 判定 |
| --- | --- | --- | --- |
| `<!-- concepts: <id> -->` 锚点 | 每个知识点小节含 `<!-- concepts: for-since-duration -->` | L5 `## 持续时长与对比（for / since 与一般过去时辨析）` 下一行（L6）精确写入 `<!-- concepts: for-since-duration -->`；经 `scripts/lib/effort-audit.mjs` `attributeLesson()` 实测精确匹配 1 个小节 | **通过** |
| `effort-lab` 锚点与编号步骤+清单 | 仅零题自评/实操知识点须配置 | `budget_plan.json`、`syllabus.json` 与本次复核基准 `[{"id": "for-since-duration", "min_read_units": 2180}]` 均未配置 `effort_lab`；本讲为 `grammar_core`，规划 9 道计分题（`planned_item_design_min = 29.3`），非零题自评节点 | **不适用（合规）** |
| 无 `无资料` 及占位文本 | 严禁 `无资料`、`TODO`、`TBD`、`FIXME`、`Replace this lesson` | 全文 0 处匹配；中英文车间/工厂离题关键词全量扫描亦为 0 命中 | **通过** |
| 例题与常见错误结构 | `min_examples >= 3`，含 `### 例题` 与 `### 常见错误` | 含 3 道 `### 例题`（L71、L87、L103）、1 节 `### 常见错误`（L117，含 6 类高频偏误对照）与三步自查（L128） | **通过** |
| 等效阅读量（`中文字数 + 3×英文词数`） | `for-since-duration >= 2180` | `effort-audit.mjs` 归属口径（导语池 + `##` 正文，不含 `##` 标题行）：中文 `1,218` 字 + 英文 `573` 词 = **`2,937`**（`1.347` 倍；去注释 `1,218 + 3×571 = 2,931`，`1.344` 倍）；仅 `##` 正文去注释：`1,162 + 3×569 = 2,869`（`1.316` 倍）；全文件去注释：`1,233 + 3×573 = 2,952`（`1.354` 倍） | **通过** |
| 下游严格课时门预测 | `audit-course-effort.mjs --strict` 要求 `0.70 <= η <= 1.40` | `readMin = 11.8387 min`（`1218/250 + 573/90 + 0.15×4`），讲义设计工时 `1.8 × 11.8387 = 21.31 min`；叠加规划题库 `29.30 min` 合计 `50.61 min / 45 min`，预计 **`η = 1.12`**（`1.1247`，距 `63.0 min` 严格告警上限尚余 `12.39 min` 空间） | **通过** |
| Markdown 渲染与 HTML 安全 | 无原始 HTML 标签（注释除外），GFM 语法完整闭合 | 除 L6 概念注释锚点外 **0 处**原始 HTML 标签；经 `micromark` + `micromark-extension-gfm`（`allowDangerousHtml: false`）实测：3 张 3 列表格（6 + 5 + 6 = 17 行源码，解析为 14 个 `<tr>`、9 个 `<th>`、33 个 `<td>`）、51 处 `<strong>` 与 143 处 `<code>` 全部闭合；0 处意外 `<em>`、0 处相邻 `</code><code>`、0 处行内代码首尾空格、0 处代码块外残余 `*`/`_`/反引号、0 处代码内弯引号/弯撇号、0 处行尾空白 | **通过** |
| CEFR A2 级别适配 | 词汇与句法适配 CEFR A2，衔接 `ever-never-already-yet`、`days-dates` 与一般过去时，不超前引入 B1 重点 | 去注释共 `573` 词次、`147` 个不重复英文词形，主体为 A1–A2 核心词；大纲要求或高频衔接表达（`marketing`、`sales`、`for ages`、`so far`、`practiced`、`sometime`、`I'd love to`）均附准确中文语境/释义对照；严格守住现在完成时基本形式（L35 明确将现在完成进行时留待进阶），未抢跑过去完成时、被动语态或条件句 | **通过** |
| 英语语法准确性与内部自洽 | 形态、时间标志、动词体貌、从句时态、例题及跨讲边界无错误与自相矛盾 | 全文 `for / since / ago` 规则、`How long...?` 与持续/瞬间动词限定、现在完成时与一般过去时对比及 9 处 `*` 错句标注全部准确且前后自洽 | **通过** |
| 例句与情景对话地道度 | 例句、双语情景对话与英中译文自然合乎真实交际与时间线 | 3 张核心表例句、两段双语对话（7 轮职场 + 6 轮日常）及 3 道梯度例题均自然流畅、时间线严密呼应、英中译文精准贴切 | **通过** |

---

## 二、首轮修订闭环核验

对照首轮 `review/language_precision.md`（5 项阻断问题）与 `review/fact_check.md`（4 项润色观察），逐项核实当前稿件修改结果与语法准确性：

1. **对话 1 尾轮重构（L58–60，原 B1.1）**：由原重复句改为 `That's great! How long have you lived in this city?` → `For five years. I moved here from Hangzhou for my first job.` → `So you know the city well! Let's have coffee next week.`。消除 `five years` 同义反复并增加真实迁入信息与自然收尾，更换 `Hangzhou` 避免与例题 2 `Chengdu` 撞词，且工作经历时间线（两年销售 + 2023 年至今市场 ≈ 在本市居住五年）严密自洽。
2. **对话 2 尾轮重构（L69，原 B1.2）**：改为 `Cool! I'd love to visit Spain too. I haven't practiced my Spanish since last month—maybe we can practice together sometime!`。自然回应西班牙旅行话题，补齐宾语 `my Spanish` 与合乎聚会语境的起点 `since last month`，顺接邀约收尾；`I'd love to` 与第 12 讲已学表达一致，美式拼写 `practiced / practice` 全文统一，英中译文精准地道。
3. **持续动词时态边界表述（L35，原 B2.1）**：改为「本讲统一用现在完成时基本形式（`have / has + 过去分词`），现在完成进行时留待进阶学习」，消除「A2 简单式」歧义。
4. **瞬间动作状态替换补全（L36，原 B2.2）**：改为 `（have、be on a team / be in a club、live in、be married）`，与 `join` 的职场团队/社团两类宾语（L93 `join the club`、L124 `be on our team`）精确对齐，避免误造 `*be on a club`。
5. **`When` 作用域限定与术语统一（L101、L128，原 B2.3）**：L101 改写为「第 3 题追问过去发生时间（`When did...?`）并配 `ago`，均须用一般过去时」；L128 改写为「① 查时间标志（见 `yesterday / last week / ago` 或问过去时间 `When did...?` 用一般过去时）」，消除对 `When` 的过度泛化、移除「锁死」与未铺垫的「查窗口」，直接呼应表 3「标志词」。
6. **四项可选润色同步落地**：L3 导语动宾结构对称化；表 1 L19 补入月度例词（`three months`、`May`）；表 2 L32 改用 `Since university.` 并统一译文句末标点；表 3 L44 为 `so far` 加注「（截至目前）」；例题 1 L83 备用解改为指代自足的 `He bought this bike a year ago.`；常见错误 L119/L122 体例统一。

---

## 三、逐段语法、事实与自洽性复核明细

1. **标题、导语与跨讲边界（L1–8）**：
   - 一级与二级标题（L1、L5）与 `syllabus.json`、`budget_plan.json` 逐字一致；L3 准确承接第 11–12 讲现在完成时（`present-perfect-forms`、`ever-never-already-yet`）、先修 `days-dates` 与第 8 单元一般过去时（`past-reports.md`）。
   - L8 提出总括对比框架（「用**现在完成时**配 `for / since` 表延续至今，用**一般过去时**表已结束的过去」），与 L45 及 L126 明确说明「`for` 配一般过去时表已结束旧时段」互为总分关系，无自相矛盾。

2. **`for` + 时间段 vs. `since` + 起始时间点（L12–25）**：
   - 表 1（L16–21）按钟点与天、周/月/年、模糊与事件、接从句四维切分，`for ten minutes / three days / two weeks / three months / five years / a long time` 与 `since 9:00 / yesterday / Monday / May / 2023 / university / lunch` 均符合 Cambridge *English Grammar Today* 规范，星期与月份首字母大写正确；时长介词 `for` 不可接从句，规则准确。
   - L23 清晰区分无 `the` 起点（`since last year`）与带 `the` 最近时段（`for the last two weeks`，并限定「指最近时段，禁用 `since`」，不误伤 `since the last meeting`）。
   - L24 核实准确：`all day / all my life` 前不加 `for`；A2 阶段 `ago` 只配一般过去时，不与 `for / since` 叠用。
   - L25 严谨限定「**引导过去起始事件时**，主句用现在完成时，从句用一般过去时（`I've known her since I moved here.`）」，与 L126「过去起点 `since` 从句用过去时（`*since we have met` → `since we met`）」完全自洽。

3. **`How long...?` 句型与持续/瞬间动词（L27–36）**：
   - 表 2（L29–33）完整覆盖问至今时长、肯定与简答、否定持续三类句型；`How long have you known Maya?`、`I've known her for six years.` / `Since university.`、`I haven't seen him for ages.` 均自然地道、译文准确。
   - L35 明确 6 个 A2 高频持续/状态动词（`be / have / know / live / work / study`）延续至今禁用一般现在时，并划清与现在完成进行时的级别边界。
   - L36 严谨限定「**肯定句中** `buy / join / move / get married` 不直配 `for / since`」，给出完整对应替换（`have`、`be on a team / be in a club`、`live in`、`be married`）或改过去时加 `ago`；「肯定句中」限定与 L33（`I haven't seen him for ages.`）、L69（`I haven't practiced my Spanish since last month`）、L85 及 L124 逻辑完全闭环。

4. **现在完成时 vs. 一般过去时与对话切换（L38–48）**：
   - 表 3（L40–45）从时间轴、提问词（`How long have / has...?` vs. `When did...?` / `How long did...?`）、标志词（`for / since`、`so far`（截至目前）、`today`（未完） vs. `yesterday`、`last week`、`ago`、`in 2022`）及 `for` 语义四维对比准确清晰。
   - L47 以说话时刻对比 `this morning`（上午 10:00 常用 `I've had two meetings this morning.` vs. 下午 3:00 转 `I had two meetings this morning.`）经典严谨；L48 对话切换策略与前后文情景示例完全呼应。

5. **自然双语情景对话（L50–69）**：
   - **对话 1（茶水间结识新同事，L52–60，7 轮）**：覆盖入职时间（`When did you join us?` / `I joined last Monday.`）、市场部持续从业时长（`How long have you worked in marketing?` / `Since 2023.`）、已结束销售经历（`Before that, I worked in sales for two years.`）、城市居住时长与迁移原因（`For five years. I moved here from Hangzhou for my first job.`）及自然寒暄收尾（`So you know the city well! Let's have coffee next week.`）。语法零误、语气自然、人物与时间线自洽。
   - **对话 2（周末聚会聊朋友与学习，L62–69，6 轮）**：覆盖结识时长（`How long have you known Maya?` / `I've known her since university.`）、切过去时追问细节（`Where did you meet?`）、当下习惯转述（`Maya said you study Spanish`，保留现在时表当前仍在学，合乎规范与 A2 语义）、学习时长与过去起点（`For eight months. I started before my trip to Spain.`）及否定持续与自然邀约（`Cool! I'd love to visit Spain too. I haven't practiced my Spanish since last month—maybe we can practice together sometime!`）。语法地道、情感连贯、译文贴切。

6. **三道梯度例题（L71–115）**：
   - **例题 1（高频偏误改错，L71–85）**：3 题分别考查一般现在时代替持续（加注「现仍居住」确保唯一解 `I've lived here for five years.`）、`for / since` 错配（`since 2021`）、肯定句瞬间动词直配 `for`（`He has had this bike for a year.` 或 `He bought this bike a year ago.`），解答自足、解析严谨。
   - **例题 2（语境选词填空，L87–101）**：3 题线索充分无双解（`Since`、`lived`、`did you join; ago`），解析精准统一称「第 1–3 题」。
   - **例题 3（日常与职场汉译英，L103–115）**：2 组译文（`I've lived here for four years, and I started a new job last month.` 与 `How long have you known Lisa? — Since last spring. We met at a book club.`）自然地道、季节词小写规范，题量与解析编号一致。

7. **常见错误与三步自查（L117–128）**：
   - L119 明确给出 `*` 错句图例。全文共 9 处 `*` 错句标注（`*I have emailed him yesterday.`、`*since three years`、`*since two weeks ago`、`*for all my life`、`*I live here for four years.`、`*She's joined our team for a year.`、`*When have you started?`、`*How long do you live here?`、`*since we have met`），在各自限定语境下均确属语法错误，改写全部准确；L126 已搬离句仅列正解 `I lived there for two years.`，未滥标 `*`。
   - L128 三步自查（① 查时间标志 → ② 查延续 → ③ 查搭配）与全文所有规则、表格及 6 类偏误 100% 一致。

---

## 四、非阻断观察（可选参考，不影响通过）

以下 2 点均不构成语法、事实或门禁阻断问题：

1. **表 2（L32）肯定公式缩写展示**：公式栏写作 `主语 + 've / 's + 过去分词 + for / since ...`，与右侧口语例句 `I've known her for six years.` 呼应良好；全文其余位置（L35、表 3 L40、例题 1 L82 `Lena has known Leo since 2021.`）均完整覆盖 `have / has` 全称，无理解障碍或矛盾。
2. **等效阅读量增幅与下游题库余量**：因落实首轮全部修订建议，等效阅读量由 `2,690`（`1.234` 倍）增至 `2,937`（`1.347` 倍），略高于撰写提示中的 `1.25` 倍软性建议值，但经 `effort-audit.mjs` 实测 `lectureDesignMin = 21.31 min`，叠加规划题库 `29.30 min` 后预计 `η = 1.12`（距 `--strict` 告警上限 `1.40` / `63.0 min` 尚余 `12.39 min`）。后续题库编写保持总题库设计工时不超过 `41.6 min` 即可稳定通过严格课时审计。

---

## 五、最终结论

本讲义二审版英语语法准确严谨、CEFR A2 级别适配恰当、日常与职场例句及双语情景对话地道自然、无 `无资料` 或自相矛盾表述，首轮评审问题已全部闭环修复；概念锚点、Markdown 渲染安全、等效阅读量（`2,937 >= 2,180`，全口径达标）及下游严格课时门余量（预计 `η = 1.12`）均符合要求，**准予通过（PASS）**。
