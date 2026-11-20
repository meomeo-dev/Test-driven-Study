---
name: design-course-tts
description: >-
  为课程包（courses/<id>/questions/*.json，v1 与 v2）设计、编写和审查声明式 TTS 语音与本地拼音
  音频（stem、options、transcript、audio、passage、passage_tts、sub_questions、
  explanation_audio、analysis、sample_response_tts、source_text_tts、
  reference_translation_tts）：决定哪些字段放语音或留纯文本、如何做 ContentSegment 切片与标点
  归属、何时用 tts.text 改写或改用 pinyin 本地录音、如何选 stella/tide 音色与遵守选项全有
  全无（uniformOptionAudio）及听力防剧透规则。新建或修改题库语音、审查 TTS 切片、
  为 v2 阅读或听力编写英中对照逐字稿（study_translation）时使用。
  不用于静态句库离线批量预合成或维护 .wav/.mp3 文件（那属于
  maintain-deepseek-tts-audio）。
---

# 课程题库：声明式 TTS 与本地音频设计

为 `courses/<id>/questions/*.json` 的每一道题设计清晰、可合成、不剧透且符合引擎渲染行为的
声明式语音与本地拼音音频。本文是索引：只保留流程骨架、核心判据、边界与指针；完整字段
矩阵、引擎细节与正反例在 `references/placement-and-segmentation.md`，执行到对应环节再加载。

## 触发与形态

- [主观] 为新课程或现有课程的 v1/v2 题库（`single_choice`、`multiple_choice`、
  `true_false`、`numeric`、`cloze`、`listening`、`reading_comprehension`、`writing`、
  `translation`）规划或改造语音标注（`tts`、`tts.text`、`tts_text`、`pinyin`、`audio`、
  `transcript`、`passage_tts`、`sub_questions`、`explanation_audio`、
  `sample_response_tts`、`source_text_tts`、`reference_translation_tts`）。
- [自动+主观] 审查已有题库的音频覆盖一致性、切片边界、选项均一性、听力防剧透与不可读符号。
- [主观] 为 v2 阅读和听力对齐原文与 `study_translation`，检查译文是否影响原音或提前泄露。
- [主观] 不属于本技能：离线批量合成静态句库、清理过期 `.wav`/`.mp3` 文件、配置或排查
  DeepSeek API Key（由 `maintain-deepseek-tts-audio` 负责）。

## 场景到命令

`<skill-root>` 指本 SKILL.md 所在目录。

| 场景 | 命令 |
| --- | --- |
| 审计整个课程包的 TTS 与音频设计 | `node <skill-root>/scripts/audit-course-tts.mjs courses/<id>` |
| 以 JSON 输出全课程审计结果（供机器消费） | `node <skill-root>/scripts/audit-course-tts.mjs courses/<id> --json` |
| 只审计单个题库 JSON 文件 | `node <skill-root>/scripts/audit-course-tts.mjs --file courses/<id>/questions/<unit>.json` |

退出码：`0` 通过；`1` 发现语音设计问题；`2` 用法错误；`3` 路径或 JSON 读取失败。

## 放置与切片决策

| 位置 | 何时加语音 | 禁止 / 留纯文本 |
| --- | --- | --- |
| `stem`（顶层非听力、非填空） | 需要示范朗读的目标外语词句，或中文指令朗读（如低龄识字/拼音题） | **父级 `listening.stem` 禁放 TTS**（防逐字稿剧透）；含 `blank` 段的填空题干禁与 TTS 共存；纯语法术语/代码/算式留纯文本 |
| `sub_questions[].stem` | `listening` 与 `reading_comprehension` 的英文小题提问/陈述句应配 `tts`（混合中英时拆出英文段） | 含 `blank` 的小题题干禁配 TTS；纯中文/公式题干留纯文本 |
| `passage` / `passage_tts` | `reading_comprehension.passage` 拆为标题 + 1–2 句英文 `tts` 切片（用 `"\n"` 与 `" "` 纯文本分隔）；`cloze` 完整读音单配 `passage_tts: {"voice", "text"}`（单个 `TTSConfig` 含 1–2+ 句填入后文本，Go 强制要求 `text` 非空，仅背题与交卷/作答后复盘通过 `ClozeItemReview` 下发）；`listening` `mode: "passage"` 由 `audio.voice_female` 朗读 `Passage.String()` | **`cloze.passage` 切片禁挂 `tts`**；`listening` `mode: "passage"` 忽略段落内联 `tts` 且只认 `voice_female` |
| `options` / `blanks[].options` / `sub_questions[].options` | 选项为自然朗读短语/句子，或需逐项听音辨析的拼音词；标准 `true_false` 省略 `options`（自动合成 `正确`/`错误`，无 TTS） | **防剧透均一法则（`uniformOptionAudio`）**：同组选项（含自定义 `true_false` 选项）`tts` 必须全有或全无；`Option.text` 仅支持 `string`（不可用 `ContentSegment[]` 或 `tts_text`）；纯中文/IPA/错拼干扰项不加 |
| `transcript` / `audio` | v2 `listening` 三模式：`dialogue` 配 `audio: {mode, voice_male, voice_female}`，台词行可省略 `voice`/`tts` 或仅设 `tts: {speed}`；`passage` 用 `audio.voice_female` 读 `passage`；`recording` 配 `.mp3` `audio.src` 与可选不配 `tts` 的 `transcript[]`；v1 逐行显式配说话人 `tts` 或 `.mp3` | 不把多轮对话揉进单一字符串，也不用 `tts: true` 简写；`passage` 模式禁配 `transcript`；非 `"M"` 男性说话人不可省 `line.tts.voice` |
| `explanation` / `analysis` / `blanks[].explanation` / `sub_questions[].analysis` | v2 要求提供 `analysis`（及 `sub_questions[].analysis`）；`analysis`、`blanks[].explanation` 与 `sub_questions[].analysis` 为 `RichContent`，可为外语例句内嵌 `tts`；v1 整段讲解单列 `explanation_audio[]` | `explanation` 仅为纯字符串；`sub_questions[]` 禁止 `explanation_audio`；`explanation_audio` 中所有非 `blank`/非 `pinyin` 且非空切片都会被串联朗读 |
| `writing` / `translation` | `writing` 单段英文范文（`sentence_making`）用字符串 `sample_response` + `sample_response_tts`，多段范文（`short_essay`/`full_essay`）拆成按段落配 `tts` 的 `ContentSegment[]` 并以 `"\n\n"` 纯文本分隔（**省略** `sample_response_tts`）；`translation` 英译中为 `source_text` 配 `source_text_tts`（`TranslationContent`，作答前可见），中译英为 `reference_translation` 配 `reference_translation_tts`（`TranslationItemReview`，仅背题与复盘下发） | `writing` 的 `requirements`/`keywords`/`rubric` 为纯文本或整数权重，不可加 TTS；`translation` 的 `source_text`/`reference_translation` 仅支持纯 `string`（改写放 `*_tts.text`），`acceptable_alternates`/`key_terms` 无 TTS；纯中文不强配英语音色 |

核心硬规则（细节与反例见 `references/placement-and-segmentation.md`）：

1. **切片边界**：中英混排采用 `['text', 'tts', 'text']` 包夹；TTS 切片内**去掉首尾空格与外围引号/反引号**，保留句末英文 `.?!` 在 TTS 内，把分隔空格放在相邻纯 `text` 切片（多句英文同理用 `{"type": "text", "text": " "}` 间隔）。
2. **TTS vs `tts.text` vs `pinyin`**：裸汉语拼音字母/韵母、带下划线遮罩空（如 `l___ yǔ`）、IPA、箭头、算式/代码、错误码**禁止直接送入 TTS**。中文含数字（`第 1 行` → `第一行`）或符号（`“√”` → `勾`）、英文冒号钟点时间（`"At 10:30 a.m."` → `"At ten thirty a.m."`；整点简写如 `"8 a.m."` 可直读）、段落内视觉换行（`"Best,\nSam"` → `"Best, Sam"`）以及需要朗读的英文**全大写标题/词**（`"LOCKER ROOM NOTICE"` → `"Locker room notice."`），必须配 `tts.text` 改写。`tts_text` 仅存在于 `ContentSegment`，`Option` / `TranscriptLine` / `*_tts` 均需使用 `tts.text`。拼音优先用 `pinyin: [...]`（渲染优先级高于 `tts`，勿同时声明）。
3. **音色与引擎陷阱**：英文 TTS 一律显式写 `{"voice": "stella" | "tide"}`（v2 `listening` `dialogue` 可从 `audio` 继承，但 `resolveListeningLines` 仅对 `M` 映射 `voice_male`，其余说话人全落 `voice_female`；`mode: "passage"` 固定读取 `audio.voice_female`）。`RichContent.tsx` 按 `pinyin`/`tts`/`tts_text` 触发按钮而非 `type: "speech"`，`type: "blank"` 会屏蔽音频，`speed` 仅在浏览器 `playbackRate` 生效。

## 流程

- [交互] **确认课程受众与协议**：确认课程处于 `v1` 还是 `v2`、目标学习语言、中文指令是否需要朗读，以及拼音题是否使用课程的本地拼音录音库。
- [主观] **逐字段定放置与音色**：按上表与 `references/placement-and-segmentation.md` 确定每个题型在 `stem`、`sub_questions`、`passage`、`passage_tts`、`options`、`transcript`、`analysis`/`explanation_audio`、`sample_response_tts`、`source_text_tts`、`reference_translation_tts` 的开关与音色。
- [主观] **切片与文本净化**：拆分混排段，剥离引号与多余空格，为数字/符号/钟点时间/段内换行/全大写标题补 `tts.text` 改写，将拼音词/残缺提示改为 `pinyin[]`，保证每段 TTS 只含 1–2 句自然语流（多段范文/逐字稿/短文按段落或句界切片）。
- [主观] **对齐英中逐字稿**：将中文保存在 `study_translation.material`，按非空原文段
  或结构化逐字稿行一一对应。独白可用富文本数组划分显示段，拼接后的英文须与原文一致，
  继续使用整段合成。按 `references/study-transcripts.md` 核对三种听力形态及复习可见性。
- [自动] **脚本审计**：运行 `node <skill-root>/scripts/audit-course-tts.mjs courses/<id>`，清零全部 `error`（结构/防剧透/符号/内联禁用违规）与 `warning`（过粗切片、`pinyin`/`tts` 冲突、漏配语音的纯英文小题/选项/题干/短文句子，以及 `analysis`/`writing`/`translation` 一致性警告）。
- [自动] **包校验与交付**：修改课程后配合仓库校验命令 `npm run course:check -- courses/<id>` 确认 Schema 与 `uniformOptionAudio` 全数通过。

## 失败与纠正反馈

审计脚本报告错误或学习者在前端遇到错读、漏读、剧透时：记录具体题号、字段路径与缺陷类别，按本技能规则修正题库 JSON 并重跑 `audit-course-tts.mjs` 与 `course:check`；若发现引擎渲染或 Schema 本身限制未在本技能覆盖，向维护者反馈更新本技能（不要直接修改已安装副本）。

## 贯穿原则

- **防剧透第一**：同组选项 `tts` 全有或全无；听力逐字稿、完形 `passage_tts` 与解析/范文/中译英参考译文音频绝不提前暴露在作答前题干中。
- **所听即自然语流**：不让 TTS 硬读下划线、箭头、孤立字母、IPA、raw `\n` 或未转写数字符号。
- **显式声明、最小切片**：显式写 `voice`（英文）与 `tts.text`（改写），一句一段、边界干净。

## 指针

- `references/study-transcripts.md` —— v2 英中对照的字段结构、按段对齐、播放和验收。
- `references/placement-and-segmentation.md` —— v1/v2 全字段矩阵、切片与改写细则、引擎/UI 陷阱与课程正反例。
- `scripts/audit-course-tts.mjs` —— 零依赖课程 TTS 审计工具（支持 `--help`、`--json`、退出码 0–3）。
- `tests/audit-course-tts.test.mjs` —— 审计工具的 Node 单元测试。

执行到对应环节再加载对应 reference，不要一次全读。
