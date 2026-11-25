# 事实复核报告：第 5 讲「口语购物与点餐情景演练（自评）（`oral-shopping-roleplay`）」

- **复核对象**：`docs/research/beginner-english-a2-expansion/oral-shopping-roleplay/lesson_draft.md`（104 行正文 / 末尾含换行共 9,425 字节）
- **核查基准**：`docs/research/beginner-english-a2-expansion/oral-shopping-roleplay/budget_plan.json`、`docs/research/beginner-english-a2-expansion/syllabus.json`（目标级别 `CEFR A2`，`skill_focus: oral_self_check`，`zero_item_self_check: true`，`min_read_units = 833`，`min_examples = 2`，`effort-lab: shadowing=8, script_outlining=8, mock_recordings=12, rubric_audit=6`）、`scripts/lib/effort-audit.mjs`、以及同单元前四讲草稿（`countable-articles`、`quantifiers-amounts`、`shopping-dining-phrases`、`receipts-menus-reading`）
- **复核结论**：**通过（PASSED，0 项阻断问题）**——知识点锚点（`concepts`）、自评锚点（`effort-lab`）、4 步编号实操与 6 条核对清单、两套示范脚本、零 `无资料`/占位符、等效阅读量、严格课时门（`auditCourseEffort --strict` 实测 `η = 1.39`，`0 error / 0 warning`）、英语语法与语音标注、CEFR A2 级别适配、对话地道度、金额与词数算术、内部自洽性及 Markdown 渲染安全性全部达标。

---

## 一、核心门禁、锚点、自评结构与等效阅读量核查

| 核查维度 | 要求基准 | 实测结果 | 判定 |
| --- | --- | --- | --- |
| `<!-- concepts: <id> -->` 锚点 | 每个知识点小节含 `<!-- concepts: oral-shopping-roleplay -->` | L5 `## 口语购物与点餐情景演练（自评）` 下一行（L6）精确写入 `<!-- concepts: oral-shopping-roleplay -->`；经 `scripts/lib/effort-audit.mjs` `attributeLesson()` 实测精确匹配 1 个小节 | **通过** |
| `effort-lab` 锚点与编号步骤+清单 | 零题自评须含 `<!-- effort-lab: shadowing=8, script_outlining=8, mock_recordings=12, rubric_audit=6 -->`、编号步骤与 `-` 自评清单 | L7 精确写入目标 `effort-lab` 锚点（合计 `8+8+12+6 = 34` 分钟，`labAnchored: true`）；L57–60 含 **4 条**编号实操步骤，键名与时长与锚点逐一对应；L64–71 含 10 分制量表（`3+3+2+2 = 10`）与 **6 条** `-` 核对清单；L21–53 含脚本 A、B 两套完整情景脚本 | **通过** |
| 无 `无资料` 及占位文本 | 严禁 `无资料`、`TODO`、`TBD`、`FIXME`、`Replace this lesson` | 全文 0 处匹配 | **通过** |
| 例题与常见错误结构 | `min_examples >= 2`，含 `### 例题` 与 `### 常见错误` | 含 2 道 `### 例题`（L73、L83）与 1 节 `### 常见错误`（L96） | **通过** |
| 等效阅读量（`中文字数 + 3×英文词数`） | `oral-shopping-roleplay >= 833` | `effort-audit.mjs` 归属口径（`lecCjk = 1426`、`lecEn = 530`）：`1426 + 3×530 =` **`3016`**（去注释 `1426 + 3×520 = 2986`）；仅 `##` 正文：`1378 + 3×530 =` **`2968`**（去注释 `2938`）；全文件原始：`1439 + 3×530 =` **`3029`**（去注释 `2999`） | **通过**（各口径均达标，超出基准 250% 以上） |
| 严格课时门（`auditCourseEffort --strict`） | `0 error`，`0 warning`（`0.70 <= η <= 1.40`） | 实测 `lectureMinutes = 12.04m`、`labMinutes = 34.00m`、`designMinutes = 55.68m` / 声明 `40m` → **`η = 1.39`**（`ok: true`，`errorCount: 0`，`warningCount: 0`） | **通过** |
| Markdown 渲染与 HTML 安全 | 无会被 `skipHtml` 剥离的原始 HTML 标签，语法完整闭合 | 除 L6–7 注释锚点外 **0 处**原始 HTML 标签；经 `micromark` + `micromark-extension-gfm`（`allowDangerousHtml: false`）实测：1 张 3 列表格（4 行）、4 个 `<ul>`、2 个 `<ol>`、4 个 `<blockquote>`、63 处 `<strong>`、118 处 `<code>`、`0` 处松散列表 `<li><p>`、`0` 处未解析 `**` 或反引号、`0` 处意外 `<em>`、`0` 处相邻 `</code><code>`、中文括号（66 对）与引号（5 对）全部配平、`0` 处行尾空白 | **通过** |
| 英语语法准确性与内部自洽 | 语法、音标、算术准确，全文无自相矛盾解释 | 全部语法规则、音标语调、金额与词数算术精准无误，前后表述严格一致 | **通过** |
| CEFR A2 级别适配与例句地道度 | 词汇句法适配 CEFR A2，双语对话与例句自然地道 | 144 个学习者可见不重复英文词元与全部句法结构严格适配 CEFR A2；两套 10 轮对话及例题改写地道自然 | **通过** |

---

## 二、逐段英语语法、语音、算术与自洽性核验

1. **导语与核心规则句型表（L1–17）**：
   - **预算与控时**：L3 总课时 `40 分钟 = 精读 6 + 实操 34 分钟`（与 `budget_plan.json` 及 L7 `effort-lab` 合计 34 分钟完全一致）；三段控时 `开场约 10 秒 + 规格询价约 20 秒 + 决策结账约 15 秒 = 45 秒` 严密闭合。
   - **语法与搭配**：点单 `I'd like (to)` 区别于生硬 `I want / Give me`；选码介词 `in` 与冠词规则（`in (a) medium`、`in a larger size` 须加 `a`、`in size 32` 零冠词）；`one / ones` 指代可数名词且 `a medium / large` 可直接名词化作尺码；可分离短语动词 `try it / them on` 代词居中；`by card / in cash` 零冠词；外带美式 `to go` / 英式 `to take away`；`receipt`（`/rɪˈsiːt/`，`p` 不发音）；`change`（找零）不可数；衣物单数轨（`this / it / fits`）与复数轨（`these / them / fit`）；改口缓冲词（`Let me see / Actually / Sorry, I mean`）及负面评价加 `a bit` 缓和（`a bit tight`）。全部准确无误。
   - **语音与节奏**：辅元连读 `Could‿I`（`/d/+aɪ`）与 `try it‿on`（`/t/+ɒ`，未在元音间误标连读）、虚词弱读 `/ə/`、内容词及改动项重读、陈述句末 `, please` 轻升 `↗`、请求句尾升 `↗`、选择与清单前升后降，均符合英语语音学与前序讲义体例。

2. **脚本 A：写字楼咖啡馆点单与改单（L21–36）**：
   - **算术与词数**：拿铁 `$5.50` + 可颂 `$3.00 × 2` = **`$11.50`**（L31 `eleven fifty`），精确无误；顾客 5 轮词数逐轮核点为 `14 + 15 + 14 + 15 + 6 = 64 词`（L26/28/30/32/34），与 L23 声明一致；按 100–120 词/分加 4 处 2 秒轮间留白折合 `40.0–46.4 秒`（104 词/分约 `45.0 秒`），落于 42–48 秒区间。
   - **地道度与节拍**：10 轮咖啡馆代买对话自然流畅（`make that iced`、`switch to oat milk, with less ice`、礼貌提议 `Would you like some?`、`take two for my team`、`tap my phone`、`a receipt for work`），中译准确；L36 `ACtually ↗, could‿I MAKE that‿ICED ↗?` 重音音节、辅元连读及升调标注全部准确。

3. **脚本 B：服装店选码试穿与折扣结账（L38–53）**：
   - **算术与词数**：原价 `$60.00`，`25% off` 七五折（实付 `75%`）= **`$45.00`**（L46/48 `forty-five dollars`），付现 `$50.00` 找零 **`$5.00`**（L50 `five dollars`），精确无误；顾客 5 轮词数逐轮核点为 `18 + 16 + 13 + 11 + 8 = 66 词`（L43/45/47/49/51，含 L49 破折号分隔的 `go—fifty` 两词），与 L40 声明一致；按 100–120 词/分加 4 处 2 秒留白折合 `41.0–47.6 秒`（107 词/分约 `45.0 秒`），契合目标区间。
   - **地道度与节拍**：10 轮对话轮次衔接完整——询中号并试穿 → 反馈偏紧换大号问打折 → 试穿大号合身问付现 → 店员应答并引至收银台报总价 → 收银台交 `$50` 并要袋子 → 店员递袋、`$5` 找零与小票 → 道别，无跳步或语用生硬；L53 `Can‿I TRY it‿ON ↗?` 连读（`/n/+aɪ`、`/t/+ɒ`）、短语动词副词重读及升调准确，5 步思路与 5 轮台词一一对应。

4. **实操步骤、自评标准与核对清单（L55–71）**：
   - 4 步实操时长 `8 + 8 + 12 + 6 = 34` 分钟，英文键名（`shadowing`、`script_outlining`、`mock_recordings`、`rubric_audit`）与 L7 `effort-lab` 锚点完全一致。
   - 练习过渡与脱稿验收口径完全自洽：步骤 2 制作 5–6 行关键词卡（禁写整句）→ 步骤 3 第 1 录看卡、第 3 录盖住提示卡全脱稿定稿 → 核对清单要求扣盖文稿与卡片完成录音 → 常见错误 #1 明确“练习期借关键词卡过渡，脱稿按三段思路推进”，无任何矛盾。
   - 10 分制量表（`3 + 3 + 2 + 2 = 10`）、达标线（`>= 7` 且无硬伤）及 6 条 `-` 核对清单覆盖全面、逻辑闭环。

5. **两道例题与常见错误（L73–104）**：
   - **例题 1（L73–81）**：题干“5 类失分点”与解析 ①–⑤ 严密对应；改写句 `I'd like two lattes, please. Actually, could I make them iced with less ice? I'll take two sandwiches, too. Can I pay by card and have a receipt?` 语法精准、自然地道；复数尾音（`lattes` `/z/`、`sandwiches` `/ɪz/`）、`them`、`less ice`、`by card`、`receipt` 讲解无误。
   - **例题 2（L83–94）**：题干“4 类错误”与解析 ①–④ 严密对应，三段跨时段回合以 ` / ` 分隔清晰；改写句 `I like these black trousers. Can I try them on? / They're a bit tight. Do you have a larger size? / They fit well! I'll take them, please.` 全程锁定复数轨、无语法疏漏（替代方案 `any larger ones` 亦自然地道）；第二句标调 `Can‿I TRY them‿ON ↗?` 连读（`/n/+aɪ`、`/m/+ɒ`）、重音与请求升调准确。
   - **常见错误（L96–104）**：5 条失误与引导句“5 类常见失误”一致；复数三类尾音例词（`cups` `/s/`、`lattes` `/z/`、`sandwiches` `/ɪz/`）、不可数名词（`change` 禁 `*changes`、奶类）、复数衣物轨与代词居中（禁 `*it fits`、`*try on it / them`）、生硬表达/命令句与 `I'd like (to)` vs `I like` 辨析（禁 `*I'd like pay`）、选码与支付介词（禁 `*by a card / *by cash`）、折扣换算（`25% off` 七五折）、`receipt` 静音 `p` 及 `clothes` 单音节英音标准 IPA（`/kləʊðz/` 或 `/kləʊz/`）全部精准无误。

---

## 三、CEFR A2 级别适配与跨讲一致性核查

- **CEFR A2 词汇与句法适配**：剔除 HTML 注释、IPA 音标片段、`effort-lab` 英文步骤键名与元语言字母/词缀（`b`、`p`、`-s`、`-teen/-ty`）后，全文含 **144 个**学习者可见不重复英文词元，主体为 CEFR A1–A2 核心高频词；少量日常消费场景实用词（`croissants`、`latte`、`oat milk`、`regular milk`、`switch to`、`tap`、`navy`、`fitting room`、`tight`、`counter`、`percent`、`instead of`、`receipt`）均已在前序讲义铺垫或紧附中文释义，无超纲生僻词、无工业/车间类离题词汇。句法结构限定于一般现在时、现在进行时、礼貌情态请求、当场决定 `I'll`、基础比较级与可分离短语动词，未超前引入 B1+ 语法。
- **同单元跨讲一致性**：与第 1 讲 `countable-articles`（复数 `/s/ /z/ /ɪz/`、零冠词 `by card / in cash`、`receipt` 可数且 `p` 不发音、二次提及用 `the`）、第 2 讲 `quantifiers-amounts`（礼貌提议用 `some`）、第 3 讲 `shopping-dining-phrases`（`in (a) medium / in a larger size / in size ...`、`try it / them on`、英美 `to go / to take away`、`X% off` 实付 `100% − X%`、`change` 不可数、禁 `*by a card / *by cash`、礼貌语调与 `-teen / -ty`）及第 4 讲 `receipts-menus-reading`（小票 `receipt` 与折扣算术）完全一致。

---

## 四、结论

`docs/research/beginner-english-a2-expansion/oral-shopping-roleplay/lesson_draft.md` 经全面事实复核**通过**，无阻断问题，无需修订。
