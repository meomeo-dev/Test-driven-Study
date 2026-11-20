执行到具体词表编写、字段核对或正反例对照时加载。

# 课程生词本规范与编写细则

## 1. 启用条件与基准指标

- **清单声明**：在 v2 `course.json` 顶层添加 `"vocabulary_file": "assets/vocabulary/english.json"`（可按语言命名，路径相对课程根目录），学习者切换至对应课程的「背题模式」时顶栏自动出现「生词本」按钮。
- **版本与激活**：每次增删或修改词表后必须递增 `course.json` 的 SemVer `version`，通过 `npm run course:check -- courses/<id>` 后再用 `npm run course:install -- courses/<id>` 写入本地库激活，保持题目 ID 不变以保留学习记录。
- **基准参考**：
  - `courses/golden-course-template@1.4.0`：`1` 个单元、`12` 条词条（全部绑定 `question_ids` 与双语例句）。
  - `courses/beginner-english@2.4.0`：`10` 个单元全覆盖、`71` 条词条（约 `5–10` 条/单元，15 条 `word` 全标 `pos`，32 条确有规则痛点的词条配 `grammar_note`，2 条含省略号占位配 `term_tts.text`）。

## 2. Schema 约束速查（`vocabulary.schema.json`）

- 顶层为非空 JSON 数组，条目开启 `additionalProperties: false`：
  - **必填字段**：`id`（全课程唯一 kebab-case slug）、`unit_id`（必须存在于 `course.json` `units[]`）、`term`（非空白字符串）、`meaning`（非空白中文释义）、`category`。
  - **可选关联与例句**：`question_ids`（同一 `unit_id` 下的去重题号数组）、`example` 与 `example_translation`（强依赖必须成对）。
  - **可选语法字段**：`pos`（仅 `n`/`v`/`adj`/`adv`/`prep`/`pron`/`num`/`conj`/`interj`）、`grammar_note`（非空白字符串，最长 `120` 字符）。
  - **可选语音字段**：`term_tts`、`example_tts`（均为 `TTSConfig`：`{voice?, text?, speed?}`；`example_tts` 依赖 `example`）。

## 3. `category` 与 `pos` 的分工边界

前端分类下拉只按 `category` 过滤，`pos` 只作为 `word` 词条旁的轻量词性补充：

| `category` | 前端展示标签 | 用途 | `pos` 规则 |
| --- | --- | --- | --- |
| `word` | `单词` | 独立单词（含需关注词尾变化的派生词） | **必填**对应词性（如 `glove` → `n`，`spell` → `v`，`flat` → `adj`） |
| `word_group` | `词组` | 复合名词、固定名词短语（如 `visitor badge`、`air pressure`） | **省略**（避免和词类混用） |
| `phrase` | `短语` | 句型片段、动宾/动副词组（如 `be from`、`put on`） | **省略** |
| `collocation` | `固定搭配` | 常见动作+宾语或形容词+介词搭配（如 `take a break`、`ready for packing`） | **省略** |
| `idiom` | `习语／惯用语` | 固定口语套话与惯用表达（如 `Nice to meet you.`、`run late`） | **省略** |
| `function_phrase` | `介词／功能短语` | 方位、时间、条件等功能框格（如 `on the left`、`without permission`） | **省略** |

## 4. `grammar_note` 极简编写准绳（不画蛇添足）

`grammar_note` 只在“不点破就容易用错”时写一句话（建议 12–45 字，严禁超 120 字）：

### 值得写的 5 类高信号情形

1. **名词数/复数特例**：如 `shelf` → `可数名词，复数 shelves（变 f 为 ves）`；`goggles` → `常用复数形式，作主语时谓语用复数`；`air pressure` → `不可数名词短语，作主语时谓语用单数（is / was）`。
2. **动词时态变化与短语分合**：如 `spell` → `过去式／过去分词 spelled 或 spelt`；`put on` → `put 过去式仍为 put；代词作宾语须放中间（put them on）`；`be from` → `be 随主语与时态变为 am / is / are / was / were`。
3. **分词转化与比较级双写**：如 `scratched` → `由 scratch 过去分词转化，可作定语或表语`；`flat` → `比较级 flatter（双写 t），最高级 flattest`；`run late` → `run 随时间变化（running / ran），现在分词须双写 n`。
4. **后续成分 / 固定槽位**：如 `Could you please …?` → `后接动词原形，用于礼貌提出请求`；`without permission` → `介词 without 后接名词或动名词（V-ing）`。
5. **易混拼写 / 专有名词规范**：如 `every day` → `分开写为时间状语“每天”；合写 everyday 为形容词“日常的”`；`Phillips screwdriver` → `Phillips 为专有名词，首字母须大写`。

### 必须省略的 4 类情况（禁止强行凑字）

- **规则可数名词且无拼写坑**：`glove`、`bolt`、`checklist`（只保留 `pos: "n"`）。
- **透明名词复合词**：`visitor badge`、`torque wrench`、`loading door`。
- **直观动宾常规搭配**：`tighten a bolt`、`sign the checklist`。
- **固定礼貌语与简单方位词**：`Nice to meet you.`、`Copy that.`、`on the left`、`at all times`。
- **严禁占位废话**：禁止写 `"无"`、`"无特殊变化"`、`"不适用"`。

## 5. 与 `design-course-tts` 的交接边界

- `meaning`、`grammar_note` 与 `example_translation` 不设 TTS 字段。
- 当 `term` 含有教学占位省略号（如 `"My name is …"`、`"Could you please …?"`）或斜杠/括号时：展示字段保留原貌给学习者看，**同时增加 `term_tts: {"voice": "stella", "text": "My name is"}`** 防止 TTS 引擎误读符号。
- 完成后同时跑 `audit-course-vocabulary.mjs --strict` 与 `design-course-tts` 的 `audit-course-tts.mjs` 双重审计。
