# 事实复核报告：第 11 讲「现在完成时构成与过去分词（`have / has + done`）」

- **复核对象**：`docs/research/beginner-english-a2-expansion/present-perfect-forms/lesson_draft.md`（126 行，9,919 字节；二审复核）
- **核查基准**：`docs/research/beginner-english-a2-expansion/present-perfect-forms/budget_plan.json`、`docs/research/beginner-english-a2-expansion/syllabus.json`（目标级别 `CEFR A2`，`skill_focus: grammar_core`，`min_read_units = 2430`，`min_examples = 3`，规划 10 道计分题，非零题自评节点）、`scripts/lib/effort-audit.mjs`、先修讲义（`courses/beginner-english/lessons/past-reports.md` 中 `past-irregular` 与 `did-questions`）及后续第 12–13 讲边界（`ever-never-already-yet`、`for-since-duration`）
- **复核结论**：**通过（PASS，0 项阻断问题）**——一审提出的 3 项阻断问题（**B1** 疑问句首 `have / has` 语音弱读事实偏差、**B2** L22 `'s` 辨析范围越界与 `'s not` 对照缺失、**B3** 对话 2 L64 出发前误用 `brought two umbrellas`）及非阻断建议（**N1** 例题 1 解析补全错因）连同语言审查修订点已全部准确修复且未引入回归；概念锚点 `<!-- concepts: present-perfect-forms -->`、无 `无资料` / 占位符、无自相矛盾解释、CEFR A2 级别与跨讲边界、等效阅读量（`3,265 >= 2,430`）、下游严格课时门预测（预计 `η = 1.16`）及 Markdown 渲染安全均已通过实测核验。

---

## 一、核心门禁、锚点与等效阅读量核查

| 核查维度 | 要求基准 | 实测结果 | 判定 |
| --- | --- | --- | --- |
| `<!-- concepts: <id> -->` 锚点 | 每个知识点小节含 `<!-- concepts: present-perfect-forms -->` | L5 `## 现在完成时构成与过去分词（have / has + done）` 下一行（L6）精确写入 `<!-- concepts: present-perfect-forms -->`；经 `scripts/lib/effort-audit.mjs` `attributeLesson()` 实测精确匹配 1 个小节 | **通过** |
| `effort-lab` 锚点与编号步骤+清单 | 仅零题自评/实操知识点须配置 | `budget_plan.json`、`syllabus.json` 与本次复核基准 `[{"id": "present-perfect-forms", "min_read_units": 2430}]` 均未配置 `effort_lab`；本讲为 `grammar_core`，规划 10 道计分题（`planned_item_design_min = 34.5`），非零题自评节点 | **不适用（合规）** |
| 无 `无资料` 及占位文本 | 严禁 `无资料`、`TODO`、`TBD`、`FIXME`、`Replace this lesson`、`待补` | 全文 0 处匹配；中英文车间/工厂离题术语扫描亦为 0 命中 | **通过** |
| 例题与常见错误结构 | `min_examples >= 3`，含 `### 例题` 与 `### 常见错误` | 含 3 道 `### 例题`（L69、L85、L101）、1 节 `### 常见错误`（L115，含 6 类正误对照）与三步自查（L126） | **通过** |
| 等效阅读量（`中文字数 + 3×英文词数`） | `present-perfect-forms >= 2430` | `effort-audit.mjs` 归属口径（导语池 + `##` 正文，不含 `##` 标题行）：中文 `1,375` 字 + 英文 `630` 词 = **`3,265`**（基线 `1.344` 倍）；归属口径去注释：`1,375 + 3×628 = 3,259`（`1.341` 倍）；仅 `##` 正文去注释：`1,314 + 3×624 = 3,186`（`1.311` 倍）；全文件去注释：`1,387 + 3×631 = 3,280`（`1.350` 倍）；全文件去注释与音标：`1,387 + 3×603 = 3,196`（`1.315` 倍） | **通过** |
| 下游严格课时门预测 | `audit-course-effort.mjs --strict` 要求 `0.70 <= η <= 1.40` | `readMin = 13.1000 min`（`1375/250 + 630/90 + 0.15×4`），讲义设计工时 `1.8 × 13.1000 = 23.58 min`；叠加规划题库 `34.50 min` 合计 `58.08 min / 50 min`，预计 **`η = 1.16`**（`1.162`，处于 `[0.70, 1.40]` 健康区间，距 `70.00 min` 严格上限余量 `11.92 min`） | **通过** |
| Markdown 渲染与 HTML 安全 | 无原始 HTML 标签（注释除外），GFM 语法完整闭合 | 除 L6 概念注释锚点外 **0 处**原始 HTML 标签；经 `micromark` + `micromark-extension-gfm`（`allowDangerousHtml: false`）实测：3 张 3 列表格（`13` 个 `<tr>`、`9` 个 `<th>`、`30` 个 `<td>`）、`60` 处 `<strong>` 与 `222` 处 `<code>` 全部闭合；`0` 处意外 `<em>`、`0` 处代码外未解析 `*`/反引号/`_`/`\|`、`0` 处代码内弯引号/弯撇号、`0` 处行尾空白；中文括号 `58` 对、中文双引号 `6` 对严格配对；标题层级 `H1 → H2 → H3 → H4` 无跳级 | **通过** |
| CEFR A2 级别适配与跨讲边界 | 词汇与句法适配 CEFR A2，衔接 `past-irregular` 与 `did-questions`，不抢跑后续专题 | 去注释与音标后共 `603` 词次、`195` 个不重复词形，主体为 A1–A2 核心词及带清晰中文对照的常见日常/办公词（`updated`、`slides`、`copies`、`manager`、`client`、`replied`、`bakery`、`wallet`、`travel umbrellas`、`abroad` 等）；`ever / never / just / already / yet` 与 `for / since` 时长结构仅在 L40 以相对指代「留待下一讲 / 留待后续专题」留界（L63 `paid for the hotel` 为动介搭配而非时长），未在例句、对话或例题中超前混入 | **通过** |
| 英语语法准确性与内部自洽 | 语法规则、IPA 语音说明、术语、例题及前后文无错误与自相矛盾 | 全部语法规则、IPA 语音强弱读说明、`'s` 辨析前提与不及物完成时边界、不规则三态、例题解答与常见错误均事实准确且前后自洽（见第二节回归验证与第三节逐段明细） | **通过** |
| 例句与情景对话地道度 | 例句、双语情景对话与英中译文自然合乎真实交际与语境逻辑 | 3 张核心表例句、2 段 6 轮情景对话与 3 道例题均自然地道、英中对齐准确、语篇连贯，无中式直译与离题场景 | **通过** |

---

## 二、一审阻断项与修订回归验证

| 编号 | 一审问题 | 二审现稿验证（位置与内容） | 回归判定 |
| --- | --- | --- | --- |
| **B1** | L23 将疑问句首 `have / has` 与简答一并归为强读 `/hæv/`、`/hæz/` | **L23** 已修订为：`陈述句未缩写 have / has 常弱读 /həv/（/əv/）、/həz/（/əz/）；疑问句首虽保留 /h/，但在自然口语中仍常弱读 /həv/、/həz/（仅慢速清晰读或强调时读强式）；简短回答（Yes, I have. / Yes, she has.）与强调位必须强读 /hæv/、/hæz/；'ve 轻读 /v/，'s 读 /s/ 或 /z/；haven't / hasn't 常重读。` 符合标准英语语音学事实（Roach Ch. 12 弱读规则），IPA 字符编码全对。 | **已解决** |
| **B2** | L22 `'s` 辨析范围越界（与不及物完成时冲突）且 `优先 hasn't` 缺 `'s not` 对照 | **L22** 已补全对照项 `（否定缩写优先用 haven't / hasn't，少用 's not，以免与 is not 混淆；复数名词不配 've，肯定简答不缩写）`，并将末句严格限定为 `对 closed / broken 等既可作过去分词又可作状态形容词的词，无宾语表当前状态时按 is + 形容词 理解（The shop's closed.“店关着门”），带宾语表动作完成时为 has + 过去分词（He's broken his glasses.“他摔坏了眼镜”）；不及物动词的完成时（如 He's gone home.）虽无宾语，'s 仍为 has。` 与 L45/L47/L57 不及物完成时完全自洽。 | **已解决** |
| **B3** | 对话 2 L64 出发前一晚在家误用方向动词 `brought two umbrellas` | **L64** 已修订为 `Awesome! I've packed the bags and bought two travel umbrellas.`（太棒了！包都收好了，我也买了两把便携雨伞。），消除中文“带”的指示方向负迁移，同时在对话中自然激活表 2 的 `buy → bought`。 | **已解决** |
| **N1 & 联动润色** | 例题 1 解析补全错因、对话 1/2 与例题 3 语篇连贯性、L40 相对指代与 L47/L121 去除「面谈」 | **L40** 已改为相对指代「留待下一讲 / 留待后续专题」；**L47/L121** 已改为「谈论自己或对方的过往去处或经历只用 `been to`」并补全 `I have been to Tokyo.`；**L56/L58** 对话 1 改为 `Has Liam replied to our email?` 与 `Oh, and I've put some water in Room B.`；**L62/L65** 角色统一为「苏菲」并替换为 `wallet`；**L71/L83** 题干改为「动词形式错误」且解析补全「不可误用过去式 `wrote`，须改为过去分词 `written`（双写 `t`）」；**L90/L97** 补齐 `some bread` 与完整还原句 `He has booked it.` / `He is booking it.`；**L105/L110** 例题 3 第 1 组拆分为 `a) / b)` 对比子题。无任何回归。 | **已解决** |

---

## 三、全篇逐段事实核查明细

1. **标题、导语与课程定位（L1–8）**：标题（L1、L5）与 `syllabus.json`、`budget_plan.json` 逐字一致；L3 准确衔接先修 `past-irregular` 与 `did-questions`；L6 概念锚点精确无误；L8 中英对比准确。
2. **句型结构、主谓一致、缩写与语音（L10–23）**：
   - 表 1 四类句型公式与例句（`I've finished the report.`、`He hasn't paid the bill.`、`Have you sent it?` / `What has she written?`、`Yes, I have.` / `No, he hasn't.`）均语法准确、译文地道。
   - L21 主谓一致（含不可数名词与 `everyone / someone` 配 `has`）、禁借 `do / does / did`、三态句式均保留过去分词及合法双 `have`（`I've had lunch.`）无误。
   - L22 `'s` 辨析与 L23 语音弱读说明准确且前后自洽（IPA 字符逐一核验：`/həv/`、`U+0259`；`/əv/`；`/həz/`；`/əz/`；`/hæv/`、`U+00E6`；`/hæz/`；`/h/`、`/v/`、`/s/`、`/z/`）。
3. **过去分词与高频不规则三态（L25–36）**：
   - 规则动词 `-ed` 四类拼写（`finished`、`updated`、`replied`、`planned`）及 `/t/`、`/d/`、`/ɪd/`（`U+026A`）读音规则与先修 `past-reports.md` 一致。
   - 表 2 **AAA / ABB / ABA / ABC** 四组 22 个高频不规则动词覆盖全部 6 个大纲核心词（`be / go / do / see / write / send`），三态拼写、`get → got`（美式也用 `gotten`）、双写与单写对比（`written`、`forgotten` 双写 `t`，`eaten`、`taken` 单写）、`pay → paid` 及音标（`/riːd/` `U+02D0`、`/red/`、`/dʌn/` `U+028C`、`/ɡɒn/` `U+0261`+`U+0252`、`/ɡɔːn/` `U+0261`+`U+0254`+`U+02D0`）全部准确。
4. **基础语用与 `have been (to)` / `have gone (to)`（L38–47）**：当下结果与迄今经历定位清晰；已结束过去时间（`yesterday / last week`）与未结束时间段（`today / this week`）边界准确；表 3 `been to`（已返回）vs. `gone to`（未返回）、过往去处/经历只用 `been to` 及地点副词 `home / there / abroad` 省略 `to` 均严谨无矛盾。
5. **自然双语情景对话（L49–67）**：
   - 对话 1（L51–58，会前进度核对）6 轮围绕 3:30 会议准备展开，自然覆盖 `updated`、`printed`、`finished`、`sent`、`replied`、`gone to the bank`、`put some water in Room B`，衔接先修 `will`（`I'll call him.`），英中表达地道。
   - 对话 2（L60–67，周末出行准备）6 轮围绕明早出行筹备展开，自然覆盖 `booked`、`paid for`、`packed`、`bought two travel umbrellas`、`lost`、`left`，代词与语境严密衔接。
   - 两段对话均未超前引入 `ever / never / just / already / yet` 或时长 `for / since`。
6. **三道梯度例题（L69–113）**：例题 1（形态与简答改错）、例题 2（`been / gone` 与 `'s` 完整句还原）、例题 3（`a) / b)` 对比及职场问答汉译英）题目明确、解答唯一、解析与规则完全一致。
7. **常见错误与三步自查（L115–126）**：L117 明确 `*` 图例，L119–124 共 13 处 `*` 标记严格用于语法或拼写错误形式（语用不当句 `I have gone to Tokyo.` 未滥标 `*`）；6 类错误覆盖中文母语负迁移核心卡点；L126 三步自查与正文全部规则一致。

---

## 四、最终结论

本讲义在英语语法准确性、IPA 语音事实、CEFR A2 级别适配、例句与对话地道度、内部逻辑自洽性、概念锚点（`<!-- concepts: present-perfect-forms -->`）、无占位符与无离题术语、等效阅读量（`3,265 >= 2,430`，预计 `η = 1.16`）及 Markdown 渲染安全上均已全部达标，**不存在阻断性问题，二审复核判定通过（PASS）**。
