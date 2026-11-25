# 事实复核报告：第 3 讲「购物、点餐与价格询问（`shopping-dining-phrases`）」

- **复核对象**：`docs/research/beginner-english-a2-expansion/shopping-dining-phrases/lesson_draft.md`（131 行，12,149 字节）
- **核查基准**：`docs/research/beginner-english-a2-expansion/shopping-dining-phrases/budget_plan.json`、`docs/research/beginner-english-a2-expansion/syllabus.json`（目标级别 `CEFR A2`，`skill_focus: listening_speaking`，`min_read_units = 2180`，规划 10 道计分题，非零题自评小节）、`scripts/lib/effort-audit.mjs`、`web/src/features/guide/LessonReader.tsx`、`docs/research/beginner-english-a2-expansion/countable-articles/lesson_draft.md`、`docs/research/beginner-english-a2-expansion/quantifiers-amounts/lesson_draft.md`、`courses/beginner-english/lessons/requests.md`、`courses/beginner-english/lessons/daily-routine.md`
- **复核结论**：**通过（PASS）**——上一轮指出的 4 项阻断问题已全部修订到位；全文英语语法、搭配、算术、音标与语调标注准确无误，词汇与句法适配 CEFR A2，双语情景对话自然合乎真实交际逻辑，无 `无资料` 或占位文本，无自相矛盾解释，概念锚点、Markdown 渲染完整性及等效阅读量门禁全部达标。无阻断项，附 1 条可选非阻断微调建议与 1 条下游课时门余量提示供参考。

---

## 一、核心门禁、锚点与等效阅读量核查

| 核查维度 | 要求基准 | 实测结果 | 判定 |
| --- | --- | --- | --- |
| `<!-- concepts: <id> -->` 锚点 | 每个知识点小节含 `<!-- concepts: shopping-dining-phrases -->` | 第 5 行 `## 购物、点餐与价格询问` 下一行（第 6 行）精确写入 `<!-- concepts: shopping-dining-phrases -->`；经 `scripts/lib/effort-audit.mjs` `attributeLesson()` 实测精确匹配 1 个小节 | **通过** |
| `effort-lab` 锚点与编号步骤+清单 | 仅零题自评/实操知识点须配置 | `budget_plan.json` 与 `syllabus.json` 均未设 `effort_lab`，本讲为 `listening_speaking` 并规划 10 道计分题（`planned_item_design_min = 29.2`），非零题自评知识点（零题口语自评在同单元第 5 讲 `oral-shopping-roleplay`） | **不适用（合规）** |
| 无 `无资料` 及占位文本 | 严禁 `无资料`、`TODO`、`TBD`、`FIXME`、`Replace this lesson` | 全文 0 处匹配；中英文车间/制造等离题术语扫描亦为 0 命中 | **通过** |
| 例题与常见错误结构 | `min_examples >= 3`，含 `### 例题` 与 `### 常见错误` | 含 3 道 `### 例题`（第 72、88、104 行）与 1 节 `### 常见错误`（第 120 行）及四步自查口诀（第 131 行） | **通过** |
| 等效阅读量（`中文字数 + 3×英文词数`） | `shopping-dining-phrases >= 2180` | `effort-audit.mjs` 归属口径（导语池 + `##` 正文，不含 `##` 标题行）：中文 `1544` 字 + 英文 `861` 词 = **`4127`**（去注释 `4121`）；仅 `##` 正文：中文 `1474` 字 + 英文 `860` 词 = **`4054`**（去注释 `4048`）；全文件原始：`1553 + 3×861 = 4136`（去注释 `4130`） | **通过**（各口径均超出基准 85.7%–89.7%） |
| Markdown 渲染与 HTML 安全 | 不含会被 `LessonReader.tsx`（`skipHtml`）剥离的原始 HTML 标签，表格与格式闭合无误 | 全文除第 6 行注释锚点外 **0 处**原始 HTML 标签（上一轮 12 处 `<br>` 已清零）；经仓库 `micromark` + `micromark-extension-gfm`（`allowDangerousHtml: false`）实测：2 张 3 列表格完整解析，0 处未解析 `**`、0 处未闭合反引号、0 处意外斜体 `<em>` | **通过** |
| 英语语法准确性 | 规则、搭配、音标、算术、例题解答无误 | 全文规则表、听说语音说明、两段对话、3 道例题及 6 类常见错误全部核验无误 | **通过** |
| 无自相矛盾解释 | 规则、例句、题干、解答与先修讲义内部自洽 | 全文规则与示例严格一致；上一轮 2 处矛盾（`size` 冠词规则、例题 1 第 3 小题时间线）均已彻底消除 | **通过** |
| CEFR A2 级别适配与例句地道度 | 词汇与句法适配 CEFR A2，对话与例句自然地道 | 剔除注释后 200 个不重复英文词元均属 A1–A2 核心生活/职场词或带中文释义的消费核心词（已移除超纲词 `itemized`），两段情景对话节奏自然、逻辑闭环 | **通过** |

> **下游课时门余量提示（非阻断）**：按 `scripts/lib/effort-audit.mjs` 实测，当前讲义归属阅读时长 `readMin = 16.3427 min`（`1544/250 + 861/90 + 0.15×4`），折合讲义设计学习工时 `1.8 × 16.3427 = 29.42 min`（高于 `budget_plan.json` 预算的 `15.7 min`）。叠加规划题库工时 `29.2 min` 后，预计概念总工时约 `58.62 min`，对应 45 分钟声明课时 `η = 1.30`，处于 `[0.70, 1.40]` 平衡区间内，距 `strict_effort: true` 告警上限 `63.0 min` 尚余 `4.38 min`。后续命制 10 道 v2 题库时请贴近 `29.2 min` 题库预算（控制在约 `33.5 min` 以内），避免触发超载告警。

---

## 二、上一轮阻断项修订核验

1. **原阻断项 1（`in a larger size` 与 `带 size 不加 a` 矛盾）——已修复**：
   - 第 20 行左栏为 `Do you have this in (a) medium / in a larger size / in blue?`，右栏已修订为精确边界：`size` + 具体码号/字母不加 `a`（`in size 42` / `in size M`），形容词修饰 `size` 须加 `a`（`in a larger / smaller size`），并与第 126 行常见错误第 3 条保持一致。
2. **原阻断项 2（例题 1 第 3 小题「付款后」与「请求刷卡付款」时间线冲突）——已修复**：
   - 第 78 行括号场景已改为 `（超市结账刷卡并索要报销小票）`，与第 84 行解答 `I'd like to pay by card, please. Could I have a receipt?` 及第 30、86、128 行「付款前账单 `bill / check` vs 付款后凭证 `receipt`」时间线完全自洽；第 74 行题干亦同步改为「改写下列 3 组」，第 83 行改为 `Could I / we have the bill, please?`。
3. **原阻断项 3（超纲词 `itemized` 与两段对话交际逻辑失真/收尾悬空）——已修复**：
   - 情景一（第 46–56 行）：标题更新为「写字楼咖啡馆点单与价格核对（职场日常）」；第 49 行具体化为 `a chicken sandwich`，第 50–51 行自然衔接选择问句 `For here or to go?` / `To go, please.`；第 52 行改为咖啡师直接报总价 `That comes to fourteen fifty in total.`，使第 53 行听混 `fourteen fifty or forty fifteen` 合理可信；第 55 行将 C1 词 `itemized` 替换为 A2 词 `printed` 并拆分为两句自然问句（`Card, please. Can I tap my phone? And could I have a printed receipt for work?`）；第 56 行补全咖啡师确认收款、递交小票与取餐指引的收尾话轮。
   - 情景二（第 58–70 行）：第 63、65 行补入 `（试穿后）` 与 `（换试大号后）` 过渡标注；第 64、70 行统一口语缩略 `here's` / `Here's`；第 66 行改为自然转折 `but it's 20% off today`；第 67–70 行拆出第 68 行店员回应 `Of course. Please come to the counter—that's forty dollars.` 后再由凯文递出现金、店员找零并递小票，交际节奏真实完整。
4. **原阻断项 4（两张表格 12 处 `<br>` 标签导致 `skipHtml` 剥离粘连）——已修复**：
   - 全部 12 处 `<br>` 已清除，表 1 拆分为 6 个清晰数据行（「当场决定」与「礼貌点单」分行），同一单元格改用 `；` 与 ` / ` 分隔，经 `micromark` + GFM 实测渲染清洁无粘连。

---

## 三、英语语法、语音、算术与例题逐段核验

1. **礼貌点单、选码试穿与退换货（第 12–21 行）**：
   - 当场决定（`I'll have the soup.` / `I'll take it.`）、礼貌梯度（`I'd like a latte, please.` / `Can I have a bag?` / `Could I / we have the bill, please?`）及语法说明（`would` 全人称不变、`I'd like` vs `I like`、`would like to + 原形`、此处 `Could` 表委婉礼貌）全部准确，且已明确区分语法错句（`*`）与语用偏生硬表达（`I want...`、`Give me...`、`No.`、`I wouldn't like...`）。
   - 可分离短语动词 `try ... on`（`try this jacket on` = `try on this jacket`、代词 `it / them` 必放中间、禁 `*try on it/them`）及成双复数名词（`shoes, jeans, trousers, glasses` 配 `these / them / are / do`）准确无误。
   - 选码介词 `in` 与冠词边界、`fitting room` vs `changing room`、`a bit tight / loose` 缓和评价、`fit / suit / match` 辨析、`exchange A for B`、`get a refund` 与 `tags still on` 全部准确。
2. **询价、折扣换算、结账支付与英美对照（第 23–31 行）**：
   - 询价双体系（`How much is/are ...?` vs `How much does/do ... cost?`，禁多余 `money`、禁 `*is it cost`、`does` 后用原形 `cost`）、单价表达（`$3 a kilo` / `$2 each`）、消费动词主语分工（`cost` 物作主语，`spend ... on` 与 `pay for` 人作主语）及 `price` 配 `high / low`、商品配 `expensive / cheap` 全部准确。
   - 折扣逆向换算（`20% off` = 减 20% = 实付 80% = 八折、`实付比例 = 100% − X%`、`10% off` 九折、`50% off / half price` 半价、`a 20% discount on coats`、`on sale` vs `for sale`、`5% off` vs `$5 off`）算术与搭配完全准确。
   - 支付搭配（`pay by card` 零冠词、`pay in cash`、`pay with my phone`、`That comes to ...`、`pay separately` / `split the bill`）、单据区分（`bill` 英 / `check` 美 vs 可数 `receipt`，`p` 不发音 `/rɪˈsiːt/`）、找零 `change` 不可数（`Here's your change.`）及英美对照（`For here or to go?` / `Eat in or take away?`、`pants, sneakers` / `trousers, trainers`、动词分写 `take away` vs 名词 `takeaway` / `takeout`）全部准确。
3. **价格听辨、语调与连读专项（第 33–42 行）**：
   - 价格简读（`$14.50` `fourteen fifty`、`$40.15` `forty fifteen`、`$8.05` `eight oh five` ≠ `$8.50`）与 `-teen / -ty` 听辨法（重音位置 `four-TEEN` vs `FOR-ty`、鼻音 `/n/`、美音 `/t/` 轻读似 `/d/` `for-dy`）准确易懂。
   - 图例（大写重读、`↗` 升调、`↘` 降调）清晰，四类语调示范句（`Could I pay by CARD, please ↗?`、`For HERE ↗ or to GO ↘?` / `CASH ↗ or CARD ↘?`、`I'd like a MEdium LATte ↘, please ↗.`、`ExCUSE me ↗, how much is this JACKet ↘?`）的重音音节标注（`MEdium`、`LATte`、`ExCUSE`、`JACKet`）与升降调走势均准确。
   - 三组高频连读音标体例统一且准确：`I'd like a`（`/aɪd laɪk‿ə/`，勿吞 `/d/`）、`Can I`（`/kənaɪ/`）、`try it on`（`/traɪ‿ɪt‿ɒn/`，美音近 `/traɪ‿ɪd‿ɑːn/`）。
4. **三道例题、常见错误与四步口诀（第 72–131 行）**：
   - **例题 1**（3 组改写）：`I'd like two lattes to go, please.`（英：`to take away`）、`Could I / we have the bill, please?` / `I'd like an orange juice, please.`、`I'd like to pay by card, please. Could I have a receipt?`，解答与解析完全准确。
   - **例题 2**（3 组改错）：`How much are these sneakers? Can I try them on?`、`This sweater is too expensive, and that color doesn't suit me.`（或 `The price of this sweater is too high`）、`Could I exchange this shirt for a medium?`，解答与解析完全准确。
   - **例题 3**（3 问综合）：`$14.50 / $40.15 / $8.05` 与两条听辨法；原价 `$50.00` 打 `20% off`（八折）实付 `$40.00`、付 `$50.00` 找零 `$10.00` 及找零句；`For HERE ↗ or to GO ↘?`、英式 `Eat IN ↗ or take aWAY ↘?` 及答句 `For here, please.`（英：`Eat in, please.`），算术、重音、语调与解析全部准确。
   - **常见错误与四步口诀**：6 类高频错因与 4 步自查口诀紧扣正文规则，无遗漏或前后冲突。

---

## 四、CEFR A2 级别适配、地道度与先修一致性核查

- **CEFR A2 词汇与句法适配**：剔除 HTML 注释后全文含 200 个不重复英文词元（含音标片段与词缀），全部位于 A1–A2 核心生活消费词汇或带中文释义的消费场景词（如 `refund`、`separately`、`split`、`tags`、`tap`、`printed receipt`），无 B2+/C1 超纲词；句法严格停留在一般现在时、礼貌情态词（`can / could / would like`）、当场决定 `I'll` 与简单一般过去时复核问句（`did you say`），未超前引入现在完成时、被动语态或复杂从句。
- **情景对话地道度与逻辑完整性**：
  - 情景一（写字楼咖啡馆）：饮品定制（`a medium iced latte with less ice`）、堂食外带确认、直接报总价触发 `-teen / -ty` 复核、手机感应支付与纸质小票请求、柜台取餐收尾，共 9 轮自然顺畅，中译贴切。
  - 情景二（服装店）：选码试穿、试穿反馈与换大号、`fit` 与 `suit` 自然对照、八折心算（`$50 → $40`）、征询现金支付后到收银台付款找零，共 11 轮符合真实购物节奏，中译贴切。
- **先修与同单元一致性**：
  - 与 `countable-articles`（点单饮品兼类可数 `a latte / a green tea / two lattes`、`pay by card` / `in cash` 零冠词、`receipt` 可数且 `p` 不发音）、`quantifiers-amounts`（`How much` 问价单复数变化、`Can / Could I have`）、`polite-requests`（`Can / Could ... please?`、逗号规范、婉拒不用生硬 `No!`）及 `wh-questions`（`Where is ...?`、`How much ...?` 倒装语序与 `does` 后还原动词原形）完全一致，无术语或规则冲突。
  - 全面覆盖 `syllabus.json` 的 `topic_1`–`topic_3` 核心要点。

---

## 五、非阻断微调建议（可选）

1. **第 125 行反例补全句境**：`禁 *How much money...` 在本条「询价与主语错配」语境下指向明确；若后续顺手润色，可写作 `*How much money is it?`（或 `*How much money are these?`），避免个别学习者误以为询问金额数量的合法句子（如 `How much money do you have?`）也不可用。此项不影响当前通过判定。
