# 事实复核报告：第 12 讲「经历与进度副词（`ever / never / just / already / yet`）」

- **复核对象**：`docs/research/beginner-english-a2-expansion/ever-never-already-yet/lesson_draft.md`（117 行，9,159 字节，修订后当前版本）
- **核查基准**：`docs/research/beginner-english-a2-expansion/ever-never-already-yet/budget_plan.json`、`docs/research/beginner-english-a2-expansion/syllabus.json`（第 12 讲，第 13 单元「个人经历与进度追踪」，目标级别 `CEFR A2`，`skill_focus: grammar_core`，`min_read_units = 2180`，`min_examples = 3`，规划 9 道计分题，非零题自评节点）、`scripts/lib/effort-audit.mjs`、本讲三份研究笔记（`topic_1`–`topic_3`）以及相邻讲次草稿（`present-perfect-forms/lesson_draft.md`、`for-since-duration/lesson_draft.md`、`progress-update-listening/lesson_draft.md`）
- **复核结论**：**通过（PASS，0 项阻断问题）**——修订后讲义在英语语法准确性、CEFR A2 级别适配、日常与职场双语情景对话及例题地道度、前后自洽性与跨讲边界等方面均准确自然；无 `无资料`、占位文本、未解释术语或离题车间词汇；知识点锚点 `<!-- concepts: ever-never-already-yet -->`、GFM 渲染安全、等效阅读量（`effort-audit.mjs` 归属口径 **`2,920 >= 2,180`**，全口径均达标）及下游严格课时门预测（预计 **`η = 1.12`**，距 `1.40` 严格告警上限尚余 `12.39` 设计分钟）全部通过，且前轮润色与纠偏意见已全部落实到位、未引入回归问题。

---

## 一、核心门禁、锚点与等效阅读量核查

| 核查维度 | 要求基准 | 实测结果 | 判定 |
| --- | --- | --- | --- |
| `<!-- concepts: <id> -->` 锚点 | 每个知识点小节含 `<!-- concepts: ever-never-already-yet -->` | L5 `## 经历与进度副词（ever / never / just / already / yet）` 下一行（L6）精确写入 `<!-- concepts: ever-never-already-yet -->`；经 `scripts/lib/effort-audit.mjs` `attributeLesson()` 实测精确匹配 1 个小节 | **通过** |
| `effort-lab` 锚点与编号步骤+清单 | 仅零题自评/实操知识点须配置 | `budget_plan.json`、`syllabus.json` 与复核基准 `[{"id": "ever-never-already-yet", "min_read_units": 2180}]` 均无 `effort_lab` 要求；本讲为 `grammar_core`，规划 9 道计分题（`planned_item_design_min = 29.3`），非零题自评节点 | **不适用（合规）** |
| 无 `无资料` 及占位文本 | 严禁 `无资料`、`TODO`、`TBD`、`FIXME`、`Replace this lesson` | 全文 `0` 处匹配；129 个中英文车间/制造/工业关键词扫描 `0` 命中；前轮检出的未解释术语「极性」「A2 产出」亦为 `0` 残留 | **通过** |
| 例题与常见错误结构 | `min_examples >= 3`，含 `### 例题` 与 `### 常见错误` | 含 3 道 `### 例题`（L58、L74、L92）、1 节 `### 常见错误`（L106，含 6 类正误对照与 9 处 `*` 错句）及三步自查（L117） | **通过** |
| 等效阅读量（`中文字数 + 3×英文词数`） | `ever-never-already-yet >= 2180` | `effort-audit.mjs` 归属口径（导语池 + `##` 正文，不含 `##` 标题行）：中文 `1,429` 字 + 英文 `497` 词 = **`2,920`**（`1.339×`；去 HTML 注释 `1,429 + 3×495 = 2,914`，`1.337×`）；仅 `##` 正文去注释：`1,386 + 3×490 = 2,856`（`1.310×`）；全文件去注释：`1,436 + 3×500 = 2,936`（`1.347×`） | **通过** |
| 下游严格课时门预测 | `audit-course-effort.mjs --strict` 要求 `0.70 <= η <= 1.40` | `readMin = 11.8382 min`（`1429/250 + 497/90 + 0.15×4`），讲义设计工时 `1.8 × 11.8382 = 21.31 min`；叠加规划题库 `29.30 min` 合计 `50.61 min / 45 min`，预计 **`η = 1.12`**（`1.125`，居中稳健，距 `63.0 min` 严格告警上限尚余 `12.39 min`） | **通过** |
| Markdown 渲染与 HTML 安全 | 无原始 HTML 标签（注释除外），GFM 语法完整闭合 | 除 L6 概念注释锚点外 **0 处**原始 HTML 标签；经 `micromark` + `micromark-extension-gfm`（`allowDangerousHtml: false`）实测：2 张表格（`10` 个 `<tr>`、`7` 个 `<th>`、`29` 个 `<td>`）、`44` 处 `<strong>` 与 `146` 处 `<code>` 全部闭合；`0` 处意外 `<em>`、`0` 处 `<li><p>`、`0` 处代码块外残留 `*`/反引号/`|`/`_`、`0` 处代码内弯引号/弯撇号、`0` 处行尾空白与制表符，全部中英文引号/括号/反引号逐行成对闭合 | **通过** |
| CEFR A2 级别适配 | 词汇与句法适配 CEFR A2，衔接 `present-perfect-forms`，不抢跑后续专题 | 去注释后共 `500` 英文词次、`130` 个不重复小写词形，主体为 A1–A2 核心生活与职场词；全部实用职场与餐饮表达（`handouts` 会议资料、`parcel` 包裹、`price list` 报价单、`slides` 幻灯片、`spicy hot pot` 麻辣火锅、`brought out ... at the counter` 餐台端出）均配准确中文对照；自然复现 `have/has + V-pp`、`have had`、`been to`、`I'll`、`I'd love to` 与 `starts at 3:00`，严格不超前展开 `for / since`、完成时与过去时系统辨析、否定 `still` 及最高级从句 `ever` | **通过** |
| 英语语法准确性与内部自洽 | 五副词含义、句型分工、语序、简答、错句标注及跨讲边界无误且无自相矛盾 | 表 1、语序与句型分工、表 2 语用辨析、两段情景对话、三道例题、9 处 `*` 错句与三步自查完全闭环，与第 11 讲及第 13–14 讲口径完全一致 | **通过** |
| 例句与情景对话地道度 | 例句、双语情景对话与中译自然合乎真实交际与时间逻辑 | 两张对照表例句、修订后的咖啡馆对话与职场会前清单对话（3:00 开会 / 2:45 前测屏闭环）及三道例题均自然地道、英中译文贴切 | **通过** |

---

## 二、逐段语法、事实与自洽性复核明细

1. **标题、导语与知识点锚点（L1–8）**：
   - L1 与 L5 标题与 `syllabus.json`、`budget_plan.json` 逐字一致；L3 准确承接先修第 11 讲 `present-perfect-forms`；L6 精确写入 `<!-- concepts: ever-never-already-yet -->`。
   - L8 将中英差异平实概括为汉语副词常直接前置且不分句型，而英语区分**经历**与**进度**、严格区分肯定/否定/疑问句式并遵守语序规则，表述准确直观、无语言学晦涩术语。
2. **五副词全景对照表（L12–20）**：
   - 表 1 准确区分经历组（`ever / never`）与进度组（`just / already / yet`）；5 句核心示范句（`Have you ever tried Thai food?`、`I've never been abroad.`、`She's just sent the email.`、`We've already booked the room.`、`I haven't printed the report yet.`）均语法准确、自然地道、中译贴切。
   - `ever` 注明“一般疑问句（其他语境另见专题）”并标示疑问句标准槽位“主语与过去分词之间”，与 L26（否定配 `ever`）及 L37（最高级从句 `ever`）无矛盾；`just` 严谨表述为“肯定句为主”；`already` 位置补充了“（问句为主语）”与“（可置句末）”，与 L24、L32 严格闭环；`yet` 准确限定“仅用于否定和疑问句”及“句末”位置。
3. **语序铁律与句型分工（L22–27）**：
   - L24「四词进夹心」明确 `ever / never / just / already` 紧贴**过去分词之前**，覆盖完整形式与缩写（`have / has` 含 `'ve / 's`）并排除疑问句紧跟 `Have / Has` 后的错位，同时说明 `already` 可置句末强调（`She's finished already.`）且同句只放一处。
   - L25「一词站队尾」准确界定 `yet` 在日常交流与基础写作中固定置否定句和常规问句句末（`Has the parcel arrived yet?` 已配中文释义“包裹到了吗？”），并如实注明正式书面语偶见 `has not yet + 过去分词`（认出即可），与下文 L113 不误标 `*I haven't yet replied.` 完全自洽。
   - L26「句型搭配与否定红线」准确阐明 `never` 自带否定配肯定助动词、严禁双重否定、`haven't / hasn't` 可配 `ever`（给出自然例句 `I haven't ever tried it.`）但口语首选 `have / has never`；严格限定普通肯定陈述句禁用 `ever`（谈经历直接用完成时或句末加 `before`）、否定句禁用 `already`、肯定陈述句禁用 `yet`，符合 *Cambridge English Grammar Today* 与 CEFR A2 规范。
4. **语用辨析、简答与边界（L28–38）**：
   - 表 2 三组最小对立（`Have you finished yet?` vs `Have you finished already?`；`I've just eaten.` vs `I've already eaten.`；`I've never visited Paris.` vs `I haven't visited Paris yet.`）例句简明地道，语用区别（中性核对 vs 惊讶、刚吃完 vs 已吃不必再吃、迄今无经历 vs 暗示以后计划去）精准无误。
   - L36 准确衔接第 11 讲 `been to` vs `gone to`（并与 L17 `been abroad`、L44/L101 `been there` 省略 `to` 保持一致），肯定简答 `Yes, I have.`（不缩写）、经历否定简答 `No, I haven't.` / `No, never.` 及 `yet` 问句简答 `No, not yet.`（`Not yet.`）全部准确地道。
   - L37 准确表述“美式口语常见 `just / already / yet` 配一般过去时（如 `Did you eat yet?`），听懂即可，本课统一使用现在完成时”，符合美式英语实际语用频率与本课统一教学口径；同时准确划分边界，将 `for / since` 与一般过去时辨析留待第 13 讲，将否定句表“至今仍未”的 `still` 与最高级从句 `ever` 留待后续专题。
5. **自然双语情景对话（L39–56）**：
   - **对话 1（咖啡馆聊旅行与美食，L41–47，5 轮）**：修订后话轮过渡非常顺滑——L44 用 `No, I've never been there, but I'd love to go! Chengdu is famous for its food. Have you ever tried spicy hot pot?` 自然串联成都与麻辣火锅；L45 先自然评价 `Yes, I have! It's really delicious.`，再以咖啡馆真实细节 `Oh, look—they've just brought out fresh lemon cake at the counter.` 引出 `just` 并顺滑接入 L46 `It looks great! Have you tried their lemon cake yet?` 与 L47 `Not yet. I've already had lunch, so I'll try it next time.`。5 轮自然囊括全部 5 个目标副词（`ever` × 2、`never`、`just`、`yet` + `Not yet`、`already`），语法无瑕、语用自然、中译流畅。
   - **对话 2（会前核对清单，L49–56，6 轮）**：职场语境纯粹、时间逻辑闭环（`starts at 3:00` → `before 2:45`），`Room 2` 数字写法统一，`handouts` 译为「会议资料」贴合办公情境，L56 `She hasn't come back from lunch yet, so I'll test it before 2:45.` 准确复现不规则动词 `come – came – come` 并补足缺席原因；`already ... but haven't ... yet`、`I've just sent it!`、`Has Maya tested the screen yet?` 全部地道准确。
6. **三道梯度例题（L58–105）**：
   - **例题 1（高频偏误改错，L58–72）**：3 句错例（`*I haven't checked the list already.`、`*Tom hasn't never tried ramen.`、`*Have ever you visited Kyoto?`）精准覆盖否定误用 `already`、双重否定及疑问语序错位；解答无误，L72 解析明确写“把否定助动词 `hasn't` 改为肯定形式 `has`，消除双重否定”，彻底消除误删 `has` 的歧义。
   - **例题 2（语境辨析选词，L74–90）**：4 题答案唯一且表达地道（L78 `made some tea, and it's very hot` 锁 `just`；L79 `Don't buy snacks` 锁 `already`；L80 常规核对锁 `yet`；L81 `cooked curry` 搭配答句 `made it` 动词呼应严谨，锁 `ever; never`），L90 解析“已经买好了”分寸得当。
   - **例题 3（日常与职场汉译英，L92–104）**：题干计数统一为“下列 2 题”，第 1 题改用伦敦避免与对话 1 成都重复，明确标注问答分隔符（`——` / `—`）并补全自然否定回应 `No, I've never been there.`，L104 解析同步点明 `been to`、`No,` 回应与 `there` 前省 `to`；第 2 题 `I've already updated the slides, but I haven't sent them yet.` 语法准确、`slides` / `them` 单复数一致。
7. **常见错误与三步自查（L106–117）**：
   - L108 明确 `*` 错句图例并将成因准确归为“副词前置且不分句型”，覆盖全部 6 类偏误。
   - 全节 9 处带星错句（`*I haven't paid already.`、`*I've paid yet.`、`*I haven't never been abroad.`、`*I've ever visited Tokyo.`、`*We've arrived just.`、`*I yet haven't replied.`、`*She has called just now.`、`*I've already wrote it.`、`*No, yet.`）均确属标准英语 / CEFR A2 语法错句，对应正句全部地道准确；L113 完整覆盖 `have / has`（含 `'ve / 's`）且不再出现孤立术语；L114 严谨限定“表‘刚才’时 `just now` 配一般过去时”，避免与英式口语表“此刻”的 `just now` 冲突；L115 不对语用语气误判滥标 `*`。
   - L117 三步自查明确列出夹心四词 `ever / never / just / already`、补充“`already` 亦可置句末”并与全文规则、例题、常见错误 100% 一致。

---

## 三、最终结论

修订后的 `lesson_draft.md` 在英语语法准确性、CEFR A2 级别适配、日常与职场例句及情景对话地道度、内容前后自洽性、知识点锚点（`<!-- concepts: ever-never-already-yet -->`）、无 `无资料`/占位文本及等效阅读量（`2,920 >= 2,180`，严格课时门预测 `η = 1.12`）等全部核查维度均完全达标，无任何阻断问题，**准予通过（PASS）**。
