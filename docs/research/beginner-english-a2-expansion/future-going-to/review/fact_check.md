# 事实复核报告：第 7 讲「计划与打算（`be going to` 与进行时表安排）」

- **复核对象**：`docs/research/beginner-english-a2-expansion/future-going-to/lesson_draft.md`（124 行，9,908 字节；二审复核）
- **核查基准**：`docs/research/beginner-english-a2-expansion/future-going-to/budget_plan.json`、`docs/research/beginner-english-a2-expansion/syllabus.json`（目标级别 `CEFR A2`，`skill_focus: grammar_core`，`min_read_units = 2180`，`min_examples = 3`，规划 9 道计分题，非零题自评节点）、`scripts/lib/effort-audit.mjs`、先修课程讲义（`courses/beginner-english/lessons/workplace-dialogue.md`、`daily-routine.md`）及下讲边界（`future-will`）
- **复核结论**：**通过（PASS，0 项阻断问题）**——一审指出的全部阻断问题均已准确修复，全文英语语法规则、术语、IPA 音标、CEFR A2 级别适配、日常/职场例句与情景对话地道度、英中译文对齐及前后自洽性均无误；无 `无资料` 或占位符，知识点锚点 `<!-- concepts: future-going-to -->`、Markdown 渲染安全与等效阅读量（`3,460 >= 2,180`）及下游课时门余量（预计 `η = 1.20`，远低于 `1.40` 严格告警上限）均达标。

---

## 一、核心门禁、锚点与等效阅读量核查

| 核查维度 | 要求基准 | 实测结果 | 判定 |
| --- | --- | --- | --- |
| `<!-- concepts: <id> -->` 锚点 | 每个知识点小节含 `<!-- concepts: future-going-to -->` | L5 `## 计划与打算（be going to 与进行时表安排）` 下一行（L6）精确写入 `<!-- concepts: future-going-to -->`；经 `scripts/lib/effort-audit.mjs` `attributeLesson()` 实测精确匹配 1 个小节 | **通过** |
| `effort-lab` 锚点与编号步骤+清单 | 仅零题自评/实操知识点须配置 | `budget_plan.json`、`syllabus.json` 与本次复核要求均未配置 `effort_lab`；本讲为 `grammar_core`，规划 9 道计分题（`planned_item_design_min = 29.3`），非零题自评节点 | **不适用（合规）** |
| 无 `无资料` 及占位文本 | 严禁 `无资料`、`TODO`、`TBD`、`FIXME`、`Replace this lesson` | 全文 0 处匹配；中英文车间/工厂离题术语扫描亦为 0 命中 | **通过** |
| 例题与常见错误结构 | `min_examples >= 3`，含 `### 例题` 与 `### 常见错误` | 含 3 道 `### 例题`（L69、L83、L99）、1 节 `### 常见错误`（L113，含 6 类正误对照）与三步自查（L124） | **通过** |
| 等效阅读量（`中文字数 + 3×英文词数`） | `future-going-to >= 2180` | `effort-audit.mjs` 归属口径（导语池 + `##` 正文，不含 `##` 标题行）：中文 `1,420` 字 + 英文 `680` 词 = **`3,460`**（`1.587` 倍）；仅 `##` 正文去注释：`1,367 + 3×673 = 3,386`；全文件去注释：`1,432 + 3×681 = 3,475` | **通过** |
| 下游严格课时门预测 | `audit-course-effort.mjs --strict` 要求 `0.70 <= η <= 1.40` | `readMin = 13.84 min`（`1420/250 + 680/90 + 0.15×4`），讲义设计工时 `1.8 × 13.84 = 24.90 min`；叠加规划题库 `29.3 min` 合计 `54.20 min / 45 min`，预计 **`η = 1.20`**（距 `63.0 min` 严格上限仍有 `8.8 min` 余量，比同批已过审的第 11 单元各讲更轻盈） | **通过** |
| Markdown 渲染与 HTML 安全 | 无原始 HTML 标签（注释除外），GFM 语法完整闭合 | 除 L6 概念注释锚点外 **0 处**原始 HTML 标签；经 `micromark` + `micromark-extension-gfm`（`allowDangerousHtml: false`）实测：3 张 3 列表格（共 13 行）完整解析，0 处未解析 `**`/反引号/`*`，0 处意外 `<em>`，0 处行尾空白 | **通过** |
| CEFR A2 级别适配 | 词汇与句法适配 CEFR A2，衔接先修 `present-continuous-actions` 与 `days-dates`，不抢跑 `will` | 去注释与音标后共 `158` 个不重复英文词形，主体为 A1–A2 核心词；实用日常/职场词（`appointment`、`schedule`、`forecast`、`hike`、`pack`、`client`、`slides`）均在语境中附中文对照；背景动作使用基础课已学一般过去时（`booked`、`checked`、`made`），`will` 明确留待下讲 `future-will` | **通过** |
| 英语语法准确性与内部自洽 | 语法术语、规则、搭配、音标、例题与前后文无错误及自相矛盾 | 全部语法规则、术语、IPA 编码、例题解答解析及正误对照均准确且全文口径完全一致 | **通过** |
| 例句与情景对话地道度 | 例句、对话与英中译文自然合乎真实交际与目标语用边界 | 表内例句、6 轮对话 1、7 轮对话 2 及 3 道例题均自然地道、语用边界清晰、英中译文准确 | **通过** |

---

## 二、一审阻断项修复复验

| 一审问题 | 修订后位置与文本 | 复验结果 |
| --- | --- | --- |
| **B1**：例题 1 解析将助动词 `is` 误称为“系动词” | L81：`第 1 句补齐 be 动词 is（助动词）、to 后用原形并删 on；第 2 句疑问改用 Are（禁 Do）、删 in，肯定简答不缩写。` | **已彻底修复**。术语准确，与先修 `workplace-dialogue.md` L105（“助动词 `be`”）及本讲例题 2 静态动词 `be` 的区分完全一致。 |
| **B2**：对话 1 缺少事先知情衔接导致 `be going to` 与临场决定 `will` 边界混淆，且 `pack` 译作“带”偏松 | L55：`Yeah, I checked it earlier! We're going to hike on Saturday and visit a museum on Sunday. I'm going to pack an umbrella tonight.`（是啊，我早就看过了！我们打算周六徒步、周日逛博物馆，我今晚打算把雨伞装进行李包。）；L56–57 补全汉娜祝福与本道别收尾。 | **已彻底修复**。`Yeah, I checked it earlier!` 清晰锚定“说话前已知情并想好方案”，与下讲 `future-will`（临时决定）边界分明，`pack an umbrella` 译作“把雨伞装进行李包”精准对应。 |
| **B3**：规则表述两处绝对化压缩引发内部自相矛盾（L22“细节未定”与带时间例句冲突；L26/L115/L119“必配时间”与 L31/L53 语境承接冲突） | L22 改为 `说话前已有想法，细节未必已定`；L26、L31、L120、L124 全部统一为 `将来时间或明确将来语境`；同步修正 L35 `公共时刻表` 与完整短句示例、L18 一般疑问句 + L17/L19/L21 `I'm not`、L41–43 介词与例词、L117–122 六类常见错误正解对照及 L124 `next / this / tomorrow 等零介词`。 | **已彻底修复**。全文规则表、正文说明、对话、例题、常见错误与三步自查之间零矛盾。 |

---

## 三、逐段事实与语法复核明细

1. **核心句型表与形态规则（L12–22）**：
   - 表 1（L14–19）覆盖肯定、否定（含 `I'm not` 与 `We aren't`）、一般与特殊疑问（职场例句 `Are you going to join the meeting?` 与日常例句 `What are you going to do?`）及肯定/否定简答（`Yes, I am.` / `No, I'm not.` / `No, she isn't.`），问答行严格对应。
   - L21 主谓一致、`I'm not`（无 `*amn't`）、疑问禁 `do / does`、肯定简答不缩写 `*Yes, I'm.`、`to` 后接动词原形均准确；L22“事先打算（细节未必已定）”与“迹象预测”（`Traffic is heavy—we're going to be late.`）精准地道。
2. **现在进行时表日程与两者对比（L24–35）**：
   - L26–32 对“已敲定日程（`be + V-ing`）”与 `be going to` 的语义、时间/语境要求（`I'm working now.` vs `I'm working tomorrow.`）及预测/静态动词限制界定准确；`see a dentist`（打算）对比 `seeing the dentist at 3:30 on Tuesday`（已预约，动态义）精准。
   - L34 统一使用 `静态动词`，`be / want / need / know` 与 `have` 静/动态区分（`have a meeting / have dinner`）准确；L35 以完整句 `I'm going to the station.` / `She's coming tonight.` 示范省冗余 `go / come`、区分 `to + 动词` 与 `to + 地点`、明确时间明确个人计划的重叠原则、`公共时刻表` 用一般现在时（`The train leaves at 8:30.`）及 `will` 留待下讲，边界严谨。
3. **将来时间状语、语序与听口提示（L37–46）**：
   - 表 3（L39–43）准确区分零介词类（`next / this / tomorrow`、`tonight` 禁 `*this night`、`soon`）、`in + 时长`（`in ten minutes / in two weeks`）与 `on / at / in`（星期、具体日期、某天时段、钟点、泛指早晚及英 `at` / 美 `on the weekend`）。
   - L45 语序规则（默认置尾、强调置首加逗号、句末先地点后时间、小时间在前 `at the café at 6:00 on Friday`）准确，且全稿全部例句（L32、L61–64、L88、L108–109、L121）严格遵守。
   - L46 IPA 符号编码逐字符校验无误：`/ˈɡoʊɪŋ tə/`（美）、`/ˈɡəʊɪŋ tə/`（英）、`/ˈɡʌnə/`（`gonna`），且准确说明重读实义动词、书面写 `going to` 及接地点禁缩读。
4. **自然双语情景对话（L48–67）**：
   - **对话 1（周末湖畔出游，L50–57，6 轮）**：自然融合承接上文语境的 `are going to Green Lake`（省略冗余 `go`）、已定安排 `we're taking the 8:30 train`、天气依据预测 `it's going to rain on Sunday`、事先知情回应 `Yeah, I checked it earlier!` 与三项事先打算及道别闭环，英中均地道。
   - **对话 2（核对下周日程，L59–67，7 轮）**：自然示范动态 `We're having our team meeting`、句首时间 `On Tuesday,`、牙医预约与离开办公室安排、`Are you flying to Shanghai...` 与肯定简答 `Yes, I am.`、指代清晰的 `my slides for the client meeting`、迹象预测 `I'm going to miss the bus!` 及匆忙告辞收尾，职场交际流畅自然。
5. **三道梯度例题（L69–111）**：
   - **例题 1（形态与零介词改错）**：2 组错句覆盖漏 `be`、`to` 后误加 `-s`、`*on next Sunday`、`*Do you going to...`、`*in this evening` 与 `*Yes, I'm.`，解答与解析准确。
   - **例题 2（语境辨析选词）**：3 题依次考查天气预测（`is going to rain`）、已预约日程（`am seeing`，干扰项 `am going to seeing` 有效避免语用重叠双解）与静态动词（`is going to be`），解答与解析准确。
   - **例题 3（日常与职场汉译英）**：2 句译文（`She's flying to Chengdu at 9:30 next Tuesday and meeting a client at the hotel in the evening.` 与 `I'm going to clean my room this weekend. I'm not going to check emails.`）语法准确、自然地道，与语序及零介词规则完全自洽。
6. **常见错误与三步自查（L113–124）**：
   - 6 类中文负迁移错因覆盖全面，所有不合语法句均规范标注 `*` 并配英文正解，冗余表达（`I'm going to go to the park.`）与语序欠佳项（`at 6:00 at the café`）区分严谨不滥标 `*`；L124 三步自查与前文全部规则完全对齐。

---

## 四、最终结论

本讲义二审版语法严谨、层级清晰、语境自然、前后自洽，全部结构锚点与等效阅读量指标均达标，**准予通过（PASS）**，可直接进入后续定稿与题库编写阶段。
