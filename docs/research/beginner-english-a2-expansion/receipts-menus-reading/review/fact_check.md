# 事实复核报告：第 4 讲「菜单、价签与消费小票阅读（`receipts-menus-reading`）」

- **复核对象**：`docs/research/beginner-english-a2-expansion/receipts-menus-reading/lesson_draft.md`（174 行正文 / 末尾含换行共 14,823 字节）
- **核查基准**：`docs/research/beginner-english-a2-expansion/receipts-menus-reading/budget_plan.json`、`docs/research/beginner-english-a2-expansion/syllabus.json`（目标级别 `CEFR A2`，`skill_focus: reading_comprehension`，`min_read_units = 2180`，`min_examples = 3`，规划 10 道计分题，非零题自评节点）、`scripts/lib/effort-audit.mjs`、`web/src/features/guide/LessonReader.tsx`、`docs/research/beginner-english-a2-expansion/shopping-dining-phrases/lesson_draft.md`、`docs/research/beginner-english-a2-expansion/countable-articles/lesson_draft.md`、`courses/beginner-english/lessons/describing-parts.md`（`comparatives`）
- **复核结论**：**通过（PASS，0 项阻断问题）**——前轮事实复核与语言审查提出的全部阻断项均已精准闭环且未引入新错误；概念锚点、零 `无资料`/占位符、零车间离题术语、等效阅读量、英语语法准确性、CEFR A2 级别适配、例句地道度、价格/税费/2026 公历日期算术、前后文自洽性及 Markdown 渲染完整性全部达标。

---

## 一、核心门禁、锚点与等效阅读量核查

| 核查维度 | 要求基准 | 实测结果 | 判定 |
| --- | --- | --- | --- |
| `<!-- concepts: <id> -->` 锚点 | 每个知识点小节含 `<!-- concepts: receipts-menus-reading -->` | 第 5 行 `## 菜单、价签与消费小票阅读` 下一行（第 6 行）精确写入 `<!-- concepts: receipts-menus-reading -->`；经 `scripts/lib/effort-audit.mjs` `attributeLesson()` 实测精确匹配 1 个小节 | **通过** |
| `effort-lab` 锚点与编号步骤+清单 | 仅零题自评/实操知识点须配置 | `budget_plan.json`、`syllabus.json` 与本次复核要求均未设 `effort_lab`；本讲定位为 `reading_comprehension`，规划 10 道计分题（`planned_item_design_min = 28.6`），非零题自评节点（同单元零题口语自评在第 5 讲 `oral-shopping-roleplay`） | **不适用（合规）** |
| 无 `无资料` 及占位文本 | 严禁 `无资料`、`TODO`、`TBD`、`FIXME`、`Replace this lesson` | 全文 0 处匹配；中英文车间/工业离题术语扫描为 0 命中 | **通过** |
| 例题与常见错误结构 | `min_examples >= 3`，含 `### 例题` 与 `### 常见错误` | 含 3 道 `### 例题`（L110、L126、L148）与 1 节 `### 常见错误`（L164）及「三扫两算」自查口诀（L174） | **通过** |
| 等效阅读量（`中文字数 + 3×英文词数`） | `receipts-menus-reading >= 2180` | `effort-audit.mjs` 归属口径（导语池 + `##` 正文，不含 `##` 标题行）：中文 `1998` 字 + 英文 `797` 词 = **`4389`**（去注释 `4383`）；仅 `##` 正文：中文 `1923` 字 + 英文 `796` 词 = **`4311`**（去注释 `4305`）；全文件原始：`2009 + 3×797 = 4400`（去注释 `4394`） | **通过**（各口径均超出基准 97.5%–101.8%） |
| Markdown 渲染与 HTML 安全 | 不含会被 `LessonReader.tsx`（`skipHtml`）剥离的原始 HTML 标签，格式闭合无误 | 除 L6 概念注释锚点外 **0 处**原始 HTML 标签；经 `micromark` + `micromark-extension-gfm`（`allowDangerousHtml: false`）实测：3 张表格（列数 4/3/3 齐整）、3 个 `text` 代码块完整解析且价格列严格右对齐，66 处粗体、267 处行内代码均正常闭合，0 处意外 `<em>`、0 处未解析标记、0 处括号失配、0 处行尾空白 | **通过** |
| 英语语法准确性与内部自洽 | 规则分类、搭配、音标、算术、日期、例题与前后文无错误或冲突 | 全文 174 行语法规则、词性/语态归类、IPA 音标、英美差异、金额税费算术、2026 公历日期及例题解答均准确自洽，0 处自相矛盾 | **通过** |
| CEFR A2 级别适配与例句地道度 | 词汇与句法适配 CEFR A2，消费文本与对话自然地道 | 去注释、代码语言标识与 IPA 后共 274 个不重复英文词元，均属 A1–A2 核心词或带中文释义的消费文本高频词（避开超纲词 `itemized / discretionary / gratuity`）；`BOGO` 已前置释义，例题 2 改用 `Excluded from BOGO`，两段双语对话及三份消费文本自然地道 | **通过** |

> **下游课时门余量提示（非阻断）**：按 `scripts/lib/effort-audit.mjs` 实测，当前讲义归属阅读时长 `readMin = 17.8976 min`（`1998/250 + 797/90 + 0.15×(3+4)`），折合讲义设计学习工时 `1.8 × 17.8976 = 32.22 min`（高于 `budget_plan.json` 原预算 `15.7 min`）。叠加规划题库工时 `28.60 min` 后，预计概念总工时约 `60.82 min`，对应 45 分钟声明课时 `η = 1.35`，处于 `[0.70, 1.40]` 平衡区间内，距 `strict_effort: true` 告警上限 `63.00 min` 尚余 `2.18 min`。下游编写 10 道 v2 题目时，请将题库设计工时控制在 `<= 30.7 min` 以内，以稳定通过严格课时门。

---

## 二、前轮阻断项修订闭环核验

| 修订项 | 修订后原文位置与核验结果 | 状态 |
| --- | --- | --- |
| 原事实复核 B1（L8 `must be unused` 误归被动语态、悬空词块、缺祈使句示例） | **L8** 已改为：`用形容词、过去分词或 \`No + 名词\` 短语写明条件（如 \`Available Mon–Fri.\`、\`Served with a side salad.\`、\`No refunds on sale items.\`），也用祈使句标示加购或优惠（如 \`Add cheese +$1.50.\`）。条款里的 \`served with\`、\`reduced to / by\`、\`cannot be combined\`、\`is marked\` 等本讲按**固定实用词块**整块认读，完整被动语态将在后续单元学习。` 逐项复核：形容词、过去分词、`No + 名词` 与祈使句四类均有对应正例；所列 4 组词块均属真实被动结构且全部出现在正文（L17/60/91/122、L31/138/169、L36/170、L106），与第 15 单元 `basic-passive-voice` 衔接无误。 | **已闭环** |
| 原事实复核 B2（L33 `半价扣 $8，共 $16` 算价歧义与 `BOGO` 未释义） | **L33** 已改为：`` `Buy one, get one 50% off`（常简写为 `BOGO 50% off`） `` 与 `` `$12` 配 `$8`：对低价件 `$8` 打半价（减 `$4`），共 `$16`（对比 `Buy one, get one free` 买一送一） ``。`BOGO` 在首次进入示范 2（L73）与例题 2（L135/146）前已清晰释义，算价逻辑零歧义。 | **已闭环** |
| 关联语言/结构修订回归核验（L17/21/23/37/90/101–104/130–136/146/169–174） | L17 `才算已含`、L21 `choice of A or B` 表二选一、L23/170/174 改用“限制警示词/限制细则”、L37/170 改用“说明标价不含税费或附加项时用 `excluding`”、L90 改用 `lunch special`、L101–104 改用 `this travel mug and this desk organizer` / `原始小票` / 先核票再确认 14 天内 / `ninety-six cents in tax`、L130–136 改为 5 行对齐 ```` ```text ```` 海报并改用 `Excluded from BOGO`、L146 改用“第二件半价（`BOGO 50% off`）”、L169/172 同步修正措辞与 `Add cheese +$1.50`——全部复核准确且未引入新问题。 | **已闭环** |

---

## 三、逐段英语语法、算术、日期与例题核验明细

1. **餐厅菜单分区、描述与英美差异（L12–21）**：
   - 表 1 四组英美对照准确：`Starters / Mains`（英）vs `Appetizers / Entrées`（美，准确点明美式 `Entrée` 指主菜、英式传统指前菜，重音符拼写准确）；`Sides / Side Dishes` vs `Sides / Side Orders` 及 `served with / comes with`；`Desserts / Puddings` 与偏正式的 `Beverages`；`Set Menu / Eat in / Takeaway` vs `Lunch Specials / Combo / Dine-in / Takeout`，动词分写 `take away` 与第 3 讲完全一致。
   - 烹饪过去分词（`grilled / baked / roasted / steamed / fried`）、`choice of A or B`（二选一）、`Add cheese +$1.50` 与饮食/过敏标识（`V` `Vegetarian` / `VG` / `GF` / `Contains nuts / dairy`）准确无误。
2. **价签折扣换算与限制警示词（L23–37）**：
   - 实付比例公式 `100% − X%`、`20% off` = 八折（`$10 → $8`）、`half price` 作表语不加冠词、`Up to 50% off` 表上限、`Reduced to $28` vs `Reduced by $12`（原价 `$40`，现价同为 `$28`）、`$4.50 each` vs `2 for $8.00`、`Buy one, get one 50% off`（`BOGO 50% off`）与 `of equal or lesser value`（`$12` 配 `$8`，低价件 `$8` 打半价减 `$4`，共 `$16`）、`on sale / for sale / not for sale / final sale` 全部准确。
   - 时间与范围表达（`Valid until May 10`、`Valid through Sunday` 商业促销均含截止日、`While supplies / stocks last`、`Selected items only`、`Minimum spend $30`、`Cannot be combined with other offers`）及 `including / excluding (exclude) / except` 语法边界（`Prices exclude sales tax.`、禁 `*costs $10 except tax`）准确无误。
3. **消费小票字段与退换货四条件（L39–51）**：
   - 表 3 六类票面字段与公式准确，L47 明确区分“折扣已在行内扣减时 `Total = Subtotal + Tax (+ Service Charge)`”与“整单优惠列在小计下则再减 `Discount`”，与示范 2 小票版面（L72–77）及例题 3 解析（L162）完全自洽；美式 `Sales Tax` 与英式 `VAT included` 差异、`change`（找零）不可数不加 `-s` 准确。
   - 音标与词义准确：`receipt` `/rɪˈsiːt/`（可数，`p` 不发音）、`recipe` `/ˈresəpi/`、`bill`（英）/ `check`（美）、`a printed receipt for work`、`return / refund / exchange A for B / store credit`（不可数）。
   - 全额退款四条件（`within 14 days of purchase` 含第 14 天对比 `after 14 days`、`with the original receipt` vs `without a receipt`、`unused / unworn / unopened`、`in original packaging`、`with price tags attached`、`Clearance / FINAL SALE` 为 `non-returnable and non-refundable` 及 `damaged` 例外、折后品按实付折后价及对应税费退款）均准确无误。
4. **两份消费示范文本与两段双语情景对话（L53–108）**：
   - **示范 1（L57–66）与情景一（L87–95）**：工作日菜单版式地道（价格列对齐至第 53 列）；对话中 `Coffee or iced tea is two dollars extra` 单复数一致，算价精准：烤鸡肉三明治 `$11.50` + 牛油果 `+$1.50` + 咖啡 `+$2.00` = 税前 `$15.00`，加 8% 税（`$1.20`）= `$16.20`（`sixteen twenty`）；烤蔬菜卷 `$10.00` + 冰茶 `+$2.00` = `$12.00`（含税 `$12.96`），确实更便宜（`it's cheaper!` 自然衔接先修 `comparatives`）。
   - **示范 2（L70–83）与情景二（L97–108）**：
     - 金额逐分验算：`2 × $10.00 − $5.00 = $15.00`（8% 税 `$1.20`）、`$15.00 − $3.00 = $12.00`（8% 税 `$0.96`）、`$8.00`（8% 税 `$0.64`），`SUBTOTAL = $35.00`、`SALES TAX (8%) = $2.80`（逐项税额之和 `1.20 + 0.96 + 0.64 = 2.80`，零舍入误差）、`TOTAL = $37.80`、`CASH TENDERED = $40.00`、`CHANGE DUE = $2.20`、`SAVINGS = $5.00 + $3.00 = $8.00`，全部精确，价格列对齐至第 54 列。
     - 日历核验：`2026-05-08` 周五、`2026-05-09` 周六、`2026-05-10` 周日、`2026-05-18` 周一（距 5 月 9 日确为 9 天）、`2026-05-09 + 14 天 = 2026-05-23` 周六，全部与真实公历一致。
     - 对话交际自然闭环：先出示原始小票 → 店员确认在 14 天内 → 保温杯退实付折后价及税费 `$12.00 + $0.96 = $12.96`（`twelve ninety-six back in cash`，与原现金支付一致）→ 收纳盒标 `FINAL SALE` 不可退换不可退款 → 顾客接受只退保温杯并领取现金与退货凭证。
5. **三道例题、常见错误与自查口诀（L110–174）**：
   - **例题 1（L110–124）**：周六不适用午市特惠；非节假日周二 12:30 烤蔬菜卷 `$10.00` + 冰茶 `+$2.00` = `$12.00`，加 8% 税 `$0.96` 得 `$12.96`；配菜沙拉已含，瓶装果汁属瓶装饮品不参与午市特惠加购，答案与解析准确。
   - **例题 2（L126–146）**：海报 5 行排版对齐（价格列对齐至第 58 列），`Excluded from BOGO` 地道；台灯 `$25.00 × 80% = $20.00`；外套 `Reduced to $28` 与 `Reduced by $12` 现价同为 `$28.00`；5 月 9 日周六位于 `Fri–Sun, May 8–10` 内，咖啡豆 `$12.00` + 绿茶 `$8.00` 依 `equal or lesser value` 绿茶半价减 `$4.00` 共 `$16.00`；会员单买保温杯 `$15.00 × 80% = $12.00`（省 `$3.00`），答案与解析全部准确。
   - **例题 3（L148–162）**：小票验算准确、最晚退换日 `2026-05-23` 准确、无原票仅退 `store credit`（不退现金）与 `FINAL SALE` 有原票亦不可退换不可退款判断准确。
   - **常见错误 1–5 与「三扫两算」口诀（L164–174）**：覆盖 5 类中文母语典型偏误，与正文规则、示范文本和例题严格一致。

---

## 四、CEFR A2 级别适配、地道度与先修一致性核查

- **CEFR A2 级别适配**：去除 HTML 注释、代码围栏语言标识与 IPA 音标后，全文共 274 个不重复英文词元，均落在 A1–A2 核心日常/办公词表或配有清晰中文释义的真实消费文本词汇范围内，未引入超纲学术/商务生僻词（如 `itemized`、`discretionary`、`gratuity`）或无关车间术语；句法聚焦一般现在时、一般过去时（`bought / paid / missed`）、`will` 当场决定（`I'll get / take / return`）、礼貌情态词（`May I / Can I`）与消费文本实用省略结构，被动短语明确按词块整块认读而不超前展开完整被动语态变换。
- **先修与同单元一致性**：
  - 与 `shopping-dining-phrases`（`100% − X%` 折扣换算、`on sale / for sale`、`take away` 动词分写 vs `takeaway / takeout`、`bill / check / receipt` `/rɪˈsiːt/` `p` 不发音、`a printed receipt for work`、`exchange A for B`、`change` 不可数、价格两段简读）完全一致；
  - 与 `comparatives`（`cheaper`、`equal or lesser value`）及 `countable-articles`（`receipt` 可数、`cash` 不可数）无缝衔接；
  - 完整覆盖 `syllabus.json` 的 `topic_1`–`topic_3` 与 `budget_plan.json` 要求。

---

## 五、非阻断可选备注

以下 2 处极细微之处均不构成事实错误或门禁阻断，无需再次返工，供后续修订或题库编写时顺带参考：

1. **L21 体例细节**：`VG`（纯素）、`GF`（无麸质）可按需补注英文全称 `Vegan`、`Gluten-Free`，与同行 `V（素食 Vegetarian）` 保持一致；日常咖啡馆菜单里的 `grilled` 除“炭烤”外也涵盖铁板/烤架煎烤。
2. **L48 / L171 义项限定**：两处均已处于消费小票找零语境，无歧义；若后续编写辨析题，可提醒学生仅“找零/零钱”义 `change` 不可数（表“变化”时可作复数 `changes`）。
