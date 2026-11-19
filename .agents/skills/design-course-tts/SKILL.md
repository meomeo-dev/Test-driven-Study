---
name: design-course-tts
description: >-
  为课程包（courses/<id>/questions/*.json，v1 与 v2）设计、编写和审查声明式 TTS 语音与本地拼音
  音频（stem、options、transcript、audio、passage、explanation_audio、analysis、
  sample_response_tts）：决定哪些字段放语音或留纯文本、如何做 ContentSegment 切片与标点
  归属、何时用 tts.text 改写或改用 pinyin 本地录音、如何选 stella/tide 音色与遵守选项全有
  全无（uniformOptionAudio）及听力防剧透规则。新建或修改课程题库语音、审查课程 TTS 切片
  质量时使用。不用于静态句库离线批量预合成或维护 .wav/.mp3 文件（那属于
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
  `transcript`、`explanation_audio`、`sample_response_tts`）。
- [自动+主观] 审查已有题库的音频覆盖一致性、切片边界、选项均一性、听力防剧透与不可读符号。
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
| `stem` / `sub_questions[].stem` | 非听力题中需要示范朗读的目标外语词句，或中文指令朗读（如低龄识字/拼音题） | **听力题干禁放 TTS**（防逐字稿剧透）；含 `blank` 段的填空题干禁与 TTS 共存；纯语法术语/代码/公式留纯文本 |
| `passage` | `reading_comprehension` 可为全文或段落加 `tts`；`cloze` 需朗读完整句时在题级单独配 `passage_tts: {"voice": ..., "text": "填入答案的完整句"}` | `cloze.passage` 短文切片**禁直接挂 `tts`**（`passage_tts` 仅在背题/复盘下发）；`listening` 无 `transcript` 时整段由 `ListeningLines()` 自动朗读 |
| `options` / `blanks[].options` | 选项为自然朗读短语/句子，或需逐项听音辨析的拼音词 | **防剧透均一法则**：同组选项必须全开或全不开 `tts`；纯中文翻译选项、IPA 音标、刻意拼错的干扰项不加 TTS |
| `transcript` / `audio` | `listening` 优先用 `transcript[]`（逐行配说话人与音色）或本地 `.mp3` | 不把多轮对话揉进单一字符串，也不用 `tts: true` 简写 |
| `explanation` / `analysis` / `explanation_audio` | v2 可用 `analysis` 富文本切片；v1 需整段解析朗读时单列 `explanation_audio[]` | `explanation` 是纯字符串；`explanation_audio` 中每段带 `text` 的非 `blank`/非 `pinyin` 切片都会被串联朗读 |
| `writing` / `translation` | `writing` 单句范文配 `sample_response_tts`，多段范文将 `sample_response` 拆成按段落配 `tts` 的切片数组；`translation` 的英文原文配 `source_text_tts`，中译英英文参考译文配 `reference_translation_tts` | 不将多段范文揉进单个 TTS 切片，也不将纯中文译文/原文强行送入英语音色 TTS |

核心硬规则（细节与反例见 `references/placement-and-segmentation.md`）：

1. **切片边界**：中英混排采用 `['text', 'tts', 'text']` 包夹；TTS 切片内**去掉首尾空格与外围引号/反引号**，保留句末英文 `.?!` 在 TTS 内，把分隔空格放在相邻纯 `text` 切片。
2. **TTS vs `tts.text` vs `pinyin`**：裸汉语拼音字母/韵母、带下划线遮罩空（如 `l___ yǔ`）、IPA、箭头、错误码、数学式**禁止直接送入 TTS**；中文题干含阿拉伯数字（`第 1 行` → `第一行`）或符号（`“√”` → `勾`），以及英文**纯大写标题/词汇**（如 `"LOCKER ROOM NOTICE"` 会被按字母拼读），必须配正常大小写/口语化的 `tts: {"text": "..."}`；汉语拼音优先用 `pinyin: [...]` 本地录音（且 `pinyin` 在渲染时优先级高于 `tts`）。
3. **音色与引擎陷阱**：英文 TTS 一律显式写 `{"voice": "stella" | "tide"}`（男声/指令多用 `tide`，女声/词汇/选项多用 `stella`；听力对话 `M` → `tide`、`W` → `stella`）；`RichContent.tsx` 按 `pinyin`/`tts`/`tts_text` 触发按钮而非 `type: "speech"`，`type: "blank"` 会屏蔽音频，`speed` 仅在浏览器 `playbackRate` 生效。

## 流程

- [交互] **确认课程受众与协议**：确认课程处于 `v1` 还是 `v2`、目标学习语言、中文指令是否需要朗读，以及拼音题是否使用课程的本地拼音录音库。
- [主观] **逐字段定放置与音色**：按上表与 `references/placement-and-segmentation.md` 确定每个题型在 `stem`、`passage`、`options`、`transcript`、`analysis`/`explanation_audio`、`sample_response_tts` 的开关与音色。
- [主观] **切片与文本净化**：拆分混排段，剥离引号与多余空格，为数字/符号补 `tts.text` 改写，将拼音词/残缺提示改为 `pinyin[]`，保证每段 TTS 只含 1 句（至多 2–3 句）自然语流。
- [自动] **脚本审计**：运行 `node <skill-root>/scripts/audit-course-tts.mjs courses/<id>`，清零全部 `error`（结构/防剧透/符号违规）与 `warning`（过粗切片、漏配语音的纯英文小题/选项/题干句子及部分漏配的 `analysis`）。
- [自动] **包校验与交付**：修改课程后配合仓库校验命令 `npm run course:check -- courses/<id>` 确认 Schema 与 `uniformOptionAudio` 全数通过。

## 失败与纠正反馈

审计脚本报告错误或学习者在前端遇到错读、漏读、剧透时：记录具体题号、字段路径与缺陷类别，按本技能规则修正题库 JSON 并重跑 `audit-course-tts.mjs` 与 `course:check`；若发现引擎渲染或 Schema 本身限制未在本技能覆盖，向维护者反馈更新本技能（不要直接修改已安装副本）。

## 贯穿原则

- **防剧透第一**：同题选项 `tts` 全有或全无；听力逐字稿与解析音频绝不提前暴露在题干中。
- **所听即自然语流**：不让 TTS 硬读下划线、箭头、孤立字母、IPA 或未转写数字符号。
- **显式声明、最小切片**：显式写 `voice`（英文）与 `tts.text`（改写），一句一段、边界干净。

## 指针

- `references/placement-and-segmentation.md` —— v1/v2 全字段矩阵、切片与改写细则、引擎/UI 陷阱与课程正反例。
- `scripts/audit-course-tts.mjs` —— 零依赖课程 TTS 审计工具（支持 `--help`、`--json`、退出码 0–3）。
- `tests/audit-course-tts.test.mjs` —— 审计工具的 Node 单元测试。

执行到对应环节再加载对应 reference，不要一次全读。
