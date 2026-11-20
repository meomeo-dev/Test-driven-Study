---
name: design-course-vocabulary
description: >-
  指导为 v2 课程包设计、编写与审计生词本词表（course.json 声明的 vocabulary_file，
  例如 courses/<id>/assets/vocabulary/english.json）：规划单元选词粒度与 question_ids 锚定、
  区分 6 类词条分类（category）与词性（pos）分工、编写与生词按需匹配的极简中文语法/时态点拨（grammar_note，不强制、
  不画蛇添足）、配对双语例句并协调 term_tts/example_tts 边界，再通过脚本检查与课程校验。
  新建英语或外语生词本、扩充词条与语法注释、或审查词表结构与教学匹配度时使用。
  term_tts/example_tts 文本净化与音色规则由 design-course-tts 负责，课程课时与题库配比由
  design-course-package 负责。
---

# 课程生词本设计与语法点拨

为启用了 `vocabulary_file` 的 v2 课程包设计轻量、准确且与题目强关联的生词本：让学习者在背题界面能随时查看「词条 + 发音 + 释义 + 按需语法点拨 + 双语例句」。本文是索引：只保留入口判断、字段边界、工作流程与命令；详细编写判据与正反例在 `references/vocabulary-spec.md`，执行到对应环节再加载。

## 触发与形态

- [主观] 为新课程包或现有课程包开启生词本（`course.json` 声明 `vocabulary_file`），从单元讲义和题库挑选高频词条与搭配。
- [主观] 为现有生词本补充或精简 `pos`（词性）与 `grammar_note`（极简词法/时态/用法点拨），修正“所有词条硬塞语法”或“单词缺词性”的问题。
- [自动+主观] 审计词表 ID、单元与题号绑定、例句配对、极简注解比例及单元覆盖度。
- [主观] 边界划分：`term_tts` / `example_tts` 的读音改写（省略号、斜杠、括号、全大写等）与音色选择交由 `design-course-tts`；单元知识图谱与课时预算交由 `design-course-package`。

## 场景到命令

`<skill-root>` 指本 SKILL.md 所在目录。

| 场景 | 命令 |
| --- | --- |
| 审计整门课程的生词本与单元/题号绑定 | `node <skill-root>/scripts/audit-course-vocabulary.mjs courses/<id>` |
| 严格模式检查全部警告（含词性分工与单元覆盖） | `node <skill-root>/scripts/audit-course-vocabulary.mjs courses/<id> --strict` |
| 输出机器可读 JSON 审计结果 | `node <skill-root>/scripts/audit-course-vocabulary.mjs courses/<id> --json` |
| 仅校验单个独立词表 JSON 文件 | `node <skill-root>/scripts/audit-course-vocabulary.mjs --file courses/<id>/assets/vocabulary/english.json` |

退出码：`0` 通过；`1` 发现词表或严格模式问题；`2` 用法错误；`3` 路径或 JSON 读取失败。

## 分类与字段边界决策

| 字段 | 何时填写 | 何时省略 / 禁止 |
| --- | --- | --- |
| `id` / `unit_id` / `question_ids` | 每条用课内唯一 kebab-case `id`；`unit_id` 对应所属单元，`question_ids` 只填该单元内实际出现的原始题号 | 禁重复 `id`；`question_ids` 不可跨单元填写 |
| `category` | 必选 6 选 1：`word`、`word_group`、`phrase`、`collocation`、`idiom`、`function_phrase` | 不把多词固定搭配勉强塞进 `word` |
| `pos` | **仅用于 `category === "word"`**（9 选 1：`n`/`v`/`adj`/`adv`/`prep`/`pron`/`num`/`conj`/`interj`），在前端与分类同排展示 | 多词类目（`word_group` 等）**默认省略 `pos`**，避免与 `category` 语义重复 |
| `grammar_note` | 仅当存在易错复数/不可数、动词时态变化/分合规则、分词形容词、比较级双写、固定介词搭配或易混拼写时，写 `<= 120` 字精准中文点拨 | **普通名词、透明复合词、固定寒暄与套话直接省略**；禁止写 `"无"`/`"不适用"` 占位符或长篇教材定义 |
| `example` / `example_translation` | 配贴近单元工位或生活语境的单句双语例句，便于结合听力/阅读复习 | 两者必须成对出现；例句不承载考核答案剧透 |
| `term_tts` / `example_tts` | 仅在原文含 `…`、斜杠、缩写或需指定 `stella`/`tide` 与 `speed` 时声明 | 干净纯英文词句直接省略，交由系统按用户默认音色合成（规范由 `design-course-tts` 审查） |

## 流程

- [交互] **确认开关与受众语言**：确认目标课程使用 `protocol_version: 2`，并在 `course.json` 声明 `vocabulary_file`（通常位于 `courses/<id>/assets/vocabulary/english.json`）；明确语言水平（如零基础工科英语优先实用词块与短例句）。
- [主观] **按单元选词与题号映射**：遍历各单元题干、选项与阅读/听力语料挑选高复用词条，保证每个有题单元都有覆盖，并为每条关联同单元 `question_ids`。
- [主观] **区分 `category`/`pos` 与精简 `grammar_note`**：按上表与 `references/vocabulary-spec.md` 为 `word` 补全 `pos`，只对确有形态/时态/用法卡点的词条撰写 1 句 `grammar_note`，其余保持留白。
- [主观] **配双语例句并移交音频审核**：补全 `example` + `example_translation`；若 `term`/`example` 含省略号等非直读字符，补 `*_tts.text` 并交由 `design-course-tts` 复核。
- [自动] **四门联检验收（递增版本号后生效）**：修改词表必须递增 `course.json` `version`，依次执行：
  1. 词表审计：`node <skill-root>/scripts/audit-course-vocabulary.mjs courses/<id> --strict`
  2. 语音审计：`node .agents/skills/design-course-tts/scripts/audit-course-tts.mjs courses/<id>`
  3. 包校验：`npm run course:check -- courses/<id>`
  4. 本地安装激活：`npm run course:install -- courses/<id>`（背题页刷新即可生效）

## 失败与纠正反馈

1. 若 `audit-course-vocabulary` 报 `WORD_MISSING_POS` 或 `NON_WORD_WITH_POS`：为 `word` 补全 `pos`，把多词条目的冗余 `pos` 删掉。
2. 若报 `FILLER_GRAMMAR_NOTE`、`OVERLONG_GRAMMAR_NOTE` 或出现大量硬写语法注解：删除空白/敷衍文案与教科书套话，只保留学习者真正会踩坑的点拨。
3. 若发现字段约束或 UI 行为变更未在本文覆盖，及时更新本技能并在 `references/vocabulary-spec.md` 补充对应正反例（不要改用户目录安装副本）。

## 贯穿原则

- **服务于当下做题**：生词本在背题页按「本题 / 本单元 / 全课程」随查随用，选词和例句必须紧贴本单元语料，而非堆砌通用字典。
- **宁缺毋滥的极简语法**：语法点拨是对具体词条规则的“一句话提醒”，适合的写清痛点，不适用的干脆省略，绝不画蛇添足。
- **契约唯一、升版安装**：所有结构真值以 `vocabulary.schema.json` 为准，修改词表后务必升版并用 `course:install` 激活。

## 指针

- `references/vocabulary-spec.md` —— Schema 约束、6 类与 9 词性映射、极简语法书写准绳及课程正反例。
- `scripts/audit-course-vocabulary.mjs` —— 零依赖生词本设计审计工具（支持 `--help`、`--json`、`--strict`、`--file`，退出码 0–3）。
- `tests/audit-course-vocabulary.test.mjs` —— 审计工具的 Node 单元测试。

执行到具体词表编写、字段核对或正反例对照时加载 `references/vocabulary-spec.md`，不要一次全读。
