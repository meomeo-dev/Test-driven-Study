# 事实复核报告：第 8 讲「临时决定、承诺与预测（`will / won't / Shall we`）」

- **复核对象**：`docs/research/beginner-english-a2-expansion/future-will/lesson_draft.md`（122 行，9,567 字节；二审复核）
- **核查基准**：`docs/research/beginner-english-a2-expansion/future-will/budget_plan.json`、`docs/research/beginner-english-a2-expansion/syllabus.json`（目标级别 `CEFR A2`，`skill_focus: grammar_core`，`min_read_units = 2180`，`min_examples = 3`，规划 9 道计分题，非零题自评节点）、`scripts/lib/effort-audit.mjs` 及先修讲义（`docs/research/beginner-english-a2-expansion/future-going-to/lesson_draft.md`、`courses/beginner-english/lessons/safety-problems.md`、`courses/beginner-english/lessons/requests.md`）
- **复核结论**：**通过（PASS，0 项阻断问题）**——修订版完整修复了前轮语言审查与事实复核提出的全部条目，且未引入任何新的语法误差、逻辑矛盾或渲染风险。全文英语语法规则、术语、IPA 音标、CEFR A2 级别适配、日常与职场例句及双语情景对话地道度、英中译文对齐与跨讲边界全部准确自洽；无 `无资料`、占位符或无关车间术语；知识点锚点 `<!-- concepts: future-will -->`、Markdown 渲染安全、等效阅读量（`3,192 >= 2,180`，全口径均达标）及下游严格课时门预测（预计 `η = 1.17`，低于 `1.40` 上限，余量 `10.56` 设计分钟）全部通过。

---

## 一、核心门禁、锚点与等效阅读量核查

| 核查维度 | 要求基准 | 实测结果 | 判定 |
| --- | --- | --- | --- |
| `<!-- concepts: <id> -->` 锚点 | 每个知识点小节含 `<!-- concepts: future-will -->` | L5 `## 临时决定、承诺与预测（will / won't / Shall we）` 下一行（L6）精确写入 `<!-- concepts: future-will -->`；经 `scripts/lib/effort-audit.mjs` `attributeLesson()` 实测精确匹配 1 个小节 | **通过** |
| `effort-lab` 锚点与编号步骤+清单 | 仅零题自评/实操知识点须配置 | `budget_plan.json`、`syllabus.json` 与本次复核基准 `[{"id": "future-will", "min_read_units": 2180}]` 均未配置 `effort_lab`；本讲为 `grammar_core`，规划 9 道计分题（`planned_item_design_min = 29.3`），非零题自评节点 | **不适用（合规）** |
| 无 `无资料` 及占位文本 | 严禁 `无资料`、`TODO`、`TBD`、`FIXME`、`Replace this lesson` | 全文 0 处匹配；中英文车间/工厂离题关键词扫描亦为 0 命中 | **通过** |
| 例题与常见错误结构 | `min_examples >= 3`，含 `### 例题` 与 `### 常见错误` | 含 3 道 `### 例题`（L67、L81、L97）、1 节 `### 常见错误`（L111，含 6 类正误对照）与三步自查（L122） | **通过** |
| 等效阅读量（`中文字数 + 3×英文词数`） | `future-will >= 2180` | `effort-audit.mjs` 归属口径（导语池 + `##` 正文，不含 `##` 标题行）：中文 `1,464` 字 + 英文 `576` 词 = **`3,192`**（`1.464` 倍；去注释 `1,464 + 3×574 = 3,186`，`1.461` 倍）；仅 `##` 正文去注释：`1,418 + 3×569 = 3,125`（`1.433` 倍）；全文件去注释：`1,473 + 3×578 = 3,207`（`1.471` 倍） | **通过** |
| 下游严格课时门预测 | `audit-course-effort.mjs --strict` 要求 `0.70 <= η <= 1.40` | `readMin = 12.856 min`（`1464/250 + 576/90 + 0.15×4`），讲义设计工时 `1.8 × 12.856 = 23.14 min`；叠加规划题库 `29.30 min` 合计 `52.44 min / 45 min`，预计 **`η = 1.17`**（`1.165`，距 `63.0 min` 严格告警上限尚余 `10.56 min` 空间） | **通过** |
| Markdown 渲染与 HTML 安全 | 无原始 HTML 标签（注释除外），GFM 语法完整闭合 | 除 L6 概念注释锚点外 **0 处**原始 HTML 标签；经 `micromark` + `micromark-extension-gfm`（`allowDangerousHtml: false`）实测：3 张 3 列表格（6 + 6 + 5 = 17 行源码，解析为 14 个 `<tr>`、9 个 `<th>`、33 个 `<td>`）、51 处 `<strong>` 与 160 处 `<code>` 全部闭合；0 处意外 `<em>`、0 处代码块外未解析 `*`/反引号、0 处代码内弯引号/弯撇号、0 处行尾空白 | **通过** |
| CEFR A2 级别适配 | 词汇与句法适配 CEFR A2，衔接 `can-permission` 与 `future-going-to`，不抢跑后续单元 | 剔除注释与 IPA 后共 `568` 词次、`160` 个不重复英文词形，主体为 A1–A2 核心词；实用日常/职场表达（`price list`、`client`、`copies`、`definitely`、`Saturday works`、`Wi-Fi won't connect`、`walking there will be nice`）均在语境中附清晰中文对照；背景动作用已学一般过去时（`forgot`、`bought`），未超前引入第 13 单元现在完成时，第 15 单元第一条件句亦在 L45 明确留界 | **通过** |
| 英语语法准确性与内部自洽 | 形态、语音、语用、语序、例题及跨讲边界无错误与自相矛盾 | 全文情态助动词规则、IPA 标音、四大语用功能、否定放至 `think`、副词语序、`Shall I / Shall we` 人称与美式平替对应、三轨将来表达分工及 `*` 错句标注全部准确且前后自洽 | **通过** |
| 例句与情景对话地道度 | 例句、双语情景对话与英中译文自然合乎真实交际与时间逻辑 | 3 张核心表例句、两段 6 轮双语对话及 3 道梯度例题均地道自然、语义连贯、时间线闭环、英中译文精准对应 | **通过** |

---

## 二、前轮修订落地复验

| 修订关注点 | 当前稿件位置与核验结果 | 复验判定 |
| --- | --- | --- |
| 表 1 否定/疑问示范地道度与边界 | L17 改为 `I won't be late.`（典型承诺，不与已定日程混淆）；L18 改为 `Will you join us for lunch?` / `When will it arrive?`（补全 `join` 宾语，与 L19 `Yes, I will. / No, I won't.` 呼应）；L16 明确写 `动词原形` | **已准确落实** |
| L8 导语、L21 缩写、L37 美式替换、L45 指代边界 | L8 明确区分 `will / won't` 与第一人称提议 `Shall I / Shall we`；L21 写「否定常用缩写为 `won't`（无 `*willn't`）」并补地点状态例句 `I'll be at the office.`；L37 精准对应 `Shall we...?` → `Let's... / Should we...?` 与 `Shall I...?` → `Should I...? / Would you like me to...?`；L45 明写 `will` 与 `be going to` 均可使用 | **已准确落实** |
| 表 2 点餐例句与 `café` 译文 | L28 补齐点餐短句 `I'll have a coffee, please.`（请给我来杯咖啡）；L31 译作「我觉得你会喜欢这家咖啡馆」，完整还原 `I think` 与 `café` | **已准确落实** |
| 对话 1、对话 2 衔接与译文细节 | 对话 1 L52–54 补定冠词 `the old numbers`、宽慰语气「我们三点半才见客户」与动作闭环 `I'll check the numbers and send the new file before 2:00.`；对话 2 L63–64 改译「那时候大概人会很多」、句号分句并大写 `Shall I book a table?`，L64 以 `so walking there will be nice` 自然回扣 L62 步行邀约 | **已准确落实** |
| 例题线索匹配与计数统一 | 例题 1（L69/L79）与例题 3（L99/L109）统一使用「2 组 / 第 1 组 / 第 2 组」；例题 2 L86 改为 `I bought train tickets.`、L87 改为 `Look at those dark clouds!` 与 L95「眼前乌云」严格一致 | **已准确落实** |
| 常见错误记号与三步自查精度 | L113 明确图例（`*` 标出语法错句），L117–119 删除无图例前置 `?` 并以平实中文说明语境不当；L122 修正为「临时决定」「校读音与语序」并精确限定「`probably / definitely` 等表可能性的副词放在 `will / 'll` 后、`won't` 前」 | **已准确落实** |

---

## 三、逐段语法、事实与自洽性复核明细

1. **导语与课程定位（L1–8）**：
   - 标题（L1、L5）与 `syllabus.json`、`budget_plan.json` 逐字一致；L3 准确衔接先修 `can-permission`（情态动词 `can`）与第 7 讲 `future-going-to`；L8 准确切分三轨将来表达及第一人称提议分工。
2. **句型结构、形态铁律与语音听辨（L12–22）**：
   - 表 1（L14–19）覆盖肯定、否定、一般/特殊疑问与简答，句型公式、职场/日常例句及中文释义准确无误。
   - L21 语法界定严谨：`will` 与 `can` 同属情态助动词、全人称同形、后接动词原形（禁加 `to / -s / -ing / -ed`）、否定常用缩写 `won't`（无 `*willn't`）、疑问不借 `do / does`、肯定简答不缩写、形容词或地点状态前补系动词 `be`（`It will be sunny.` / `I'll be at the office.`）。
   - L22 语音与 IPA 逐字符编码核验准确：`'ll` 弱读 `/l/` 或 `/əl/` 并重读实义动词；`won't`（美 `/woʊnt/`、英 `/wəʊnt/`，`U+0259`、`U+028A`）与 `want`（美 `/wɑːnt/`、英 `/wɒnt/`，`U+0251`、`U+02D0`、`U+0252`）的元音特征及句法搭配对比（动词原形 vs `to + 动词原形` 或名词）均无误。
3. **四大语用功能与预测语序（L24–33）**：
   - 表 2（L26–31）完整覆盖临时决定（含点餐）、主动帮忙、承诺保证、看法预测四大核心功能，5 句例句均自然地道、译文准确。
   - L33 规则精确：用 `think` 表否定预测习惯将否定置于 `think`（`I don't think he'll come.`，通常不说 `I think he won't come.`）；`probably / definitely` 等表可能性的副词肯定置 `will / 'll` 后（`It'll probably be busy.`）、否定置 `won't` 前（`It probably won't take long.`）；口语 `won't` 表物品失灵（`The Wi-Fi won't connect.`“Wi-Fi 连不上”）准确且与 L120（`The door won't open.`）一致。
4. **提议句式与三轨将来表达辨析（L35–45）**：
   - L37 准确区分 `Shall I + 动词原形?`（主动帮忙 + `Yes, please.` / `No, thanks.`）与 `Shall we + 动词原形?`（共同邀约 + `Good idea!`），限定第一人称 `I / we`、请对方帮忙改用 `Could / Will you...?`（与先修 `requests.md` 一致），美式口语替代关系映射准确。
   - 表 3（L39–43）与第 7 讲 `future-going-to` 口径完全统一：决策时机对比、预测依据对比（明确标注“进行时不用于预测”）、帮忙承诺分工以及 L45 中性预测兼容边界（明确 `will` 与 `be going to`）与第一条件句留界均无矛盾。
5. **自然双语情景对话（L47–65）**：
   - **对话 1（会前核对文件，L49–56，6 轮）**：时间链严密闭环（当前发现旧数据 → 两点前发新文件 → 两点半打印四份 → 三点半见客户），依次自然融入临场决定（`I'll send it now.`）、已定日程复现（`We're meeting the client at 3:30.`）、限时承诺与主动提议（`Shall I print four copies at 2:30?`），职场交际自然。
   - **对话 2（周末聚餐邀约，L58–65，6 轮）**：准确复现 `on Saturday evening`、进行时日程（`I'm visiting my parents on Sunday`）、自然口语 `Saturday works`，完整贯通 `Shall we walk to that new restaurant at 6:00?`（先地点后时间）、`It'll probably be busy. Shall I book a table?`、回扣步行的否定预测（`And I don't think it'll rain, so walking there will be nice.`）及守时承诺（`See you at 6:00 on Saturday—I won't be late!`，小时间在前），语用衔接自然流畅。
6. **三道梯度例题（L67–109）**：
   - **例题 1（形态与 `won't` 改错，L67–79）**：准确考查去 `to`、补系动词 `be`、肯定简答不缩写与 `won't / want` 辨析，解答与解析无误。
   - **例题 2（语境辨析选词，L81–95）**：3 题语境线索明确（突发忘笔当场借笔 `will`、已购火车票日程 `are visiting`、眼前乌云迹象 `is going to`），句法槽位严密匹配、无双解争议，解答与解析准确。
   - **例题 3（日常与职场汉译英，L97–109）**：2 组译文（`I won't forget to send the file. The meeting probably won't take long.` 与 `I don't think it will rain tomorrow. Shall we meet at the café at 3:00?`）忠实地道，与前文语序、否定位置及先地点后时间规则完全自洽。
7. **常见错误与三步自查（L111–122）**：
   - 6 类高频错因覆盖全面；`*` 严格限定于不合语法或拼写错误的句子（10 处），语用不当或欠自然的句子（`I will fly tomorrow.`、`It will rain.`、`Will we meet?`、`I think it won't rain.`）不滥标 `*` 也不引入生僻记号，处理严谨；L122 三步自查与全文全部规则 100% 一致。

---

## 四、最终结论

本讲义二审稿英语语法精准、CEFR A2 级别适配恰当、日常与职场例句及双语情景对话地道自然、全文无 `无资料` 或自相矛盾表述，概念锚点、Markdown 渲染安全、等效阅读量（`3,192 >= 2,180`）及下游严格课时门余量（预计 `η = 1.17`）全部达标，**准予通过（PASS）**。
