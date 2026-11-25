# 事实复核报告：第 6 讲「问路、交通出行与地点导航（`directions-transport`）」

- **复核对象**：`docs/research/beginner-english-a2-expansion/directions-transport/lesson_draft.md`（129 行，10,348 字节）
- **核查基准**：`docs/research/beginner-english-a2-expansion/directions-transport/budget_plan.json`、`docs/research/beginner-english-a2-expansion/syllabus.json`（目标级别 `CEFR A2`，`skill_focus: listening_speaking`，`min_read_units = 2180`，`min_examples = 3`，规划 10 道计分题，非零题自评节点）、`scripts/lib/effort-audit.mjs`、`web/src/features/guide/LessonReader.tsx`、先修课程讲义（`courses/beginner-english/lessons/numbers-places.md`、`requests.md`、`daily-routine.md`）及本讲三份研究笔记（`topic_1`–`topic_3`）
- **复核结论**：**通过（PASS）**——上一轮指出的 3 项阻断问题（例题 1 第 1 句改错正解不地道、情景二电话对话与地铁广播硬拼接及出口动词/口语细节缺陷、表 1 第 21 行“前者无 `to`”指代歧义）及听说专项空心化、词块缺中文释义、例题 2 角色混拼等修订要点均已落实到位；全文英语语法、搭配、语音语调、CEFR A2 级别梯度与例句地道度均准确自然，无 `无资料` 或占位文本，无自相矛盾解释，概念锚点、Markdown 渲染安全及等效阅读量门禁全部达标。无阻断项，附 3 条可选非阻断微调建议与 1 条下游课时门余量提示供参考。

---

## 一、核心门禁、锚点与等效阅读量核查

| 核查维度 | 要求基准 | 实测结果 | 判定 |
| --- | --- | --- | --- |
| `<!-- concepts: <id> -->` 锚点 | 每个知识点小节含 `<!-- concepts: directions-transport -->` | 第 5 行 `## 问路、交通出行与地点导航` 下一行（第 6 行）精确写入 `<!-- concepts: directions-transport -->`；经 `scripts/lib/effort-audit.mjs` `attributeLesson()` 实测精确匹配 1 个小节 | **通过** |
| `effort-lab` 锚点与编号步骤+清单 | 仅零题自评/实操知识点须配置 | `budget_plan.json`、`syllabus.json` 与本次复核基准均未配置 `effort_lab`；本讲为 `listening_speaking`，规划 10 道计分题（`planned_item_design_min = 29.2`），非零题自评节点 | **不适用（合规）** |
| 无 `无资料` 及占位文本 | 严禁 `无资料`、`TODO`、`TBD`、`FIXME`、`Replace this lesson` | 全文 0 处匹配；中英文车间/工厂等离题术语扫描亦为 0 命中 | **通过** |
| 例题与常见错误结构 | `min_examples >= 3`，含 `### 例题` 与 `### 常见错误` | 含 3 道 `### 例题`（L72、L86、L102）与 1 节 `### 常见错误`（L118）及自查口诀（L129） | **通过** |
| 等效阅读量（`中文字数 + 3×英文词数`） | `directions-transport >= 2180` | `effort-audit.mjs` 归属口径（导语池 + `##` 正文，不含 `##` 标题行）：中文 `1453` 字 + 英文 `719` 词 = **`3610`**（1.656 倍；去 HTML 注释 `1453 + 3×717 = 3604`，1.653 倍）；仅 `##` 正文：中文 `1397` 字 + 英文 `718` 词 = **`3551`**（去注释 `3545`，1.626 倍）；全文件原始：`1464 + 3×719 = 3621`（去注释 `3615`，1.658 倍） | **通过**（各口径均达标且下游课时门安全） |
| Markdown 渲染与 HTML 安全 | 无会被 `LessonReader.tsx`（`skipHtml`）剥离的原始 HTML 标签，语法完整闭合 | 除 L6 概念注释锚点外 **0 处**原始 HTML 标签；经仓库 `micromark` + `micromark-extension-gfm`（`allowDangerousHtml: false`）实测：2 张 3 列表格（7 行与 6 行）完整解析，61 处 `<strong>` 与 187 处 `<code>` 全部闭合，0 处意外 `<em>`，0 处代码块外未解析 `*`/`_`/反引号，全部 16 处错句星号 `*` 均置于反引号内，0 处行尾空白 | **通过** |
| CEFR A2 级别适配 | 词汇与句法适配 CEFR A2，衔接先修 `positions`、`imperatives`、`wh-questions` | 剔除注释后共 `165` 个不重复英文词元，主体为 A1–A2 核心日常与职场词汇；实用出行词（`transfer`、`fare`、`crosswalk`、`zebra crossing`、`elevator`、`lift`、`pull over`、`Mind the gap`、`taxi stand`）均有清晰中文释义；以祈使句、一般现在时及基础一般过去时（`I just arrived`）为主，未超前引入现在完成时或被动语态 | **通过** |
| 英语语法准确性与内部自洽 | 规则、搭配、语音语调、例题解答与先修讲义无误且无自相矛盾 | 表 1–2、听说重读语调与连读、三道例题、6 类常见错误全部准确且前后一致，与先修 `positions`、`imperatives`、`wh-questions` 无冲突 | **通过** |
| 例句与情景对话地道度 | 例句、双语对话与译文自然合乎真实日常/职场交际逻辑 | 情景一（8 轮）与情景二（8 轮）节奏自然、逻辑闭环、礼貌收尾完整；地铁广播独立成节；例题 1–3 正解均地道自然 | **通过** |

> **下游课时门余量提示（非阻断）**：按 `scripts/lib/effort-audit.mjs` 实测，当前讲义归属阅读时长 `readMin = 14.4009 min`（`1453/250 + 719/90 + 0.15×4`），折合讲义设计学习工时 `1.8 × 14.4009 = 25.92 min`（高于 `budget_plan.json` 初始讲义预算 `15.7 min`，但与上一轮语言审查建议的 `readMin ≈ 12.5–14.5 min` 吻合）。叠加规划题库工时 `29.2 min` 后，预计概念总工时约 `55.12 min`（对比声明 `45 min`，`η = 1.225`），稳定落于 `[0.70, 1.40]` 健康区间，距 `strict_effort: true` 告警上限 `63.0 min` 尚余 **`7.88 min`** 余量。后续命制 10 道 v2 题库时将题库设计工时控制在 `29–36 min` 内即可顺利通过严格课时门。

---

## 二、上一轮阻断项修订核验

1. **原 B1（例题 1 第 1 句改错正解不地道，L76–84）——已修复**：
   - 第 1 句改为 `Let's get on the taxi so we can arrive to the office on time.` → 正解 `Let's get in the taxi so we can arrive at the office on time.`，补齐了目的与准点时限语境（`so we can arrive ... on time`），彻底消除原稿 `*Let's ... and arrive at the office.` 的中式直译失真；
   - 第 2 句改为 `When I arrive in the station, I usually go home by foot or by a bus.` → 正解 `When I arrive at the station, I usually go home on foot or by bus.`，补全习惯时间从句，解答给出完整正确句，2 句共 5 处介词或冠词错误（`get on→get in`、`arrive to→arrive at`、`arrive in→arrive at`、`by foot→on foot`、`by a bus→by bus`）与题干计数严密一致。
2. **原 B2（情景二叙事断裂、口语失真及出口动词省略，L44–70、L106）——已修复**：
   - **情景一（L44–53）**：扩充为 8 轮自然对话，中段补入问路人复述确认（`Got it—turn left at the second traffic light, right?`），末尾补全致谢与道别闭环（`Thank you so much!` / `You're welcome. Have a great day!`），空间顺序清晰无误；
   - **情景二（L55–64）与地铁广播（L66–70）**：第 58 行补全出口动词 `Then get off at Park Square and take Exit B.`；第 59 行补入大卫携带行李箱改问打车的合理过渡；第 60 行改为自然口语 `You can take a taxi outside—just get in at the taxi stand. It takes about twenty minutes, and the fare is around eighteen dollars.`，补齐估算副词 `about / around` 并去除书面分号；第 62 行自然示范 `When you get out of the taxi, take the elevator to the sixth floor.`；第 63–64 行补全致谢道别收尾；地铁报站广播已移出电话对话，独立为 `#### 地铁车厢广播示范` 引用块，附完整中英对照（`The next station is Central Station. Transfer is available to Line 4. Doors will open on the right—please mind the gap.`）；
   - **例题 3（L106）**：同步补全出口动词为 `Get off at West Square and use Exit C.`，并将长段落改为 `>` 引用块呈现。
3. **原 B3（表 1 第 21 行“前者无 `to`”指代歧义，L21）——已修复**：
   - 第 21 行右栏已明确修订为 `` `arrive` 不配 `to`（禁 `*arrive to`），`reach` 直接接地点（无介词）；`home / here / there` 零介词 ``，与 `get to` 彻底区分，消除表面自相矛盾。
4. **同步落实的听说专项、例题 2 与规则表精度优化**：
   - 第 3 行导语补齐三项先修衔接（方位表达、祈使句与特殊疑问句）；
   - 第 16–20 行与第 27–31 行补齐了 `opposite`、`Platform 3`、`the Green Line`、`Mind the gap.`、`drop me off`、`crosswalk / zebra crossing`、`elevator / lift` 的中文释义与例证，并统一了 `go past / pass` 与 `go across / cross` 的词性标注及对照顺序；
   - 第 33–40 行听说专项补齐重读与升降调图例、3 组带重音与调号示范句、`/f/`（唇齿音）vs `/θ/`（咬舌音）发音要领及 `get‿off‿at`、`get‿out‿of`、`straight‿ahead` 辅元连读示例；
   - 例题 2（L86–100）题干改为“按要求改写或改正下列 3 组表达”，第 3 组清晰标注 `指路人` / `问路人` 角色；
   - 常见错误（L118–127）收紧了 `*get down the bus`、`接车名勿省 of`、`*drop off me`、`*take by bus`、`*It needs 15 minutes` 与 `*spend ... to get there` 的语法边界。

---

## 三、逐段语法与事实复核明细

1. **表 1：问路、步行指路、到达与耗时（L12–21）**：
   - 礼貌问路开场（`Excuse me, how do I get to ...?`、`Could you tell me the way to ...?`）、句尾 `right?` 复述核对、直行转弯（`go straight ahead`、`turn left / right at ...`、`take the second left`）、介词与动词辨析（`go past` / `pass`、`go across` / `cross`、`go through`）、到达定位（`on your right / left`、`across from` / `opposite`）、耗时句型（`How long does it take ...?`、`It takes 15 minutes.`、`a five-minute walk`）及到达动词（`arrive in / at`、`get to`、`reach`、`home / here / there` 零介词）全部语法准确，与先修 `positions`、`imperatives`、`wh-questions` 一致。
2. **表 2：公共交通、上下车、出行方式与英美对照（L23–31）**：
   - 名词加编号/字母零冠词（`Line 2`、`Platform 3`、`Exit B`）vs 普通车种与颜色线带冠词（`take the subway / a taxi`、`the Green Line`）、站数 `for ... stops`、换乘广播（`transfer to Line 4 at ...`、`change at ... for Line 4`、`Doors will open on the right.`、`Mind the gap.`）、上下车空间规则（`get on / off` vs `get in / out of`、`drop me off`、`fare`、`pull over`）、交通方式（`by subway / train`、`on foot`、`on the bus` / `in a car`、`take + 冠词 + 车`）及英美对照均事实准确。
3. **听辨与语调要点（L33–40）**：
   - `ExCUSE me ↗, how do I get to the BANK ↘?`（轻升开场 + 特殊疑问句降调）、`Does this bus go to the AIRport ↗?`（一般疑问句尾升，重音在 `AIR-`）、`Sorry, the FIRST left ↗ or the THIRD left ↘?`（选择疑问句前升后降 + 对比重读）、`So I take Exit B, right ↗?`（复述核对尾升）重音音节与语调走势均准确；`/f/` 唇齿音与 `/θ/` 咬舌音描述准确；三组辅元连读（`get‿off‿at`、`get‿out‿of`、`straight‿ahead`）音段衔接准确。
4. **双语情景对话与地铁广播（L42–70）**：
   - 两段对话与 1 段独立地铁车厢广播语法零错误，英中语义对应清晰，职场与日常语境纯粹。
5. **三道例题、常见错误与自查口诀（L72–129）**：
   - 例题 1（5 处错误改错）、例题 2（3 组礼貌改写与词性/耗时改错）、例题 3（换乘站 `Park Station` / `Line 3`、经过首个红绿灯后第二个路口左转、银行对面右手边、`a five-minute walk` → `It takes five minutes on foot.`）全部解答与解析无误；6 类常见错误与 4 句口诀与正文完全一致。

---

## 四、非阻断可选微调建议（无需单独返工）

以下 3 处均为细粒度润色提示，不构成事实错误或阻断问题，后续版本顺手微调即可：

1. **L28 换乘介词归属微调**：右栏 `站点用 at、线用 to` 针对主列 `transfer to Line 4 at ...` 准确无误，但紧邻括号中的英式 `change at ... for Line 4` 用的是 `for`（英式亦可用 `change to`）；后续若修订可写为 `` `transfer` 站点用 `at`、换线用 `to`（英式 `change` 常配 `for`） ``，表述更周延。
2. **L29 短语动词完整写法**：`drop 接代词居中` 语境清晰且后附 `（禁 *drop off me）`，可顺手补全为 `` `drop ... off` 接代词居中 ``。
3. **L59 译文贴合度**：`I have a heavy suitcase` 译作“我带了个大行李箱”口语流畅；若求逐词精准，亦可作“我带了个很重的行李箱”。
