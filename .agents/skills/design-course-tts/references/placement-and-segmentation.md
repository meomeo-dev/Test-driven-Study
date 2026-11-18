# 课程题库 TTS 与本地音频：放置矩阵、切片规范与引擎行为

执行到设计具体题型的音频放置、切片边界、`tts.text` 改写或核对引擎/UI 行为时加载。

> **真相源与核验日期（2026-11-18）**：本文结论核验自仓库源码与契约：
> - Schema：`contracts/course/v1/items.schema.json`、`contracts/course/v2/items.schema.json`
> - 后端校验与合成：`internal/course/{model,extended,load}.go`、`internal/tts/{service,phrase_key,wav}.go`、`internal/study/exam_audio.go`、`internal/httpapi/exam_audio.go`
> - 前端渲染：`web/src/components/{RichContent,AudioControls,OptionAudio,QuestionAudio}.tsx`、`web/src/features/question-types/`
> - 课程样本：`courses/beginner-english/`、`courses/elementary-chinese/`、`courses/step-up-english-1/`

## 目录

1. [v1 与 v2 全字段放置矩阵](#1-v1-与-v2-全字段放置矩阵)
2. [内容判定：TTS vs tts.text 改写 vs pinyin vs 纯文本](#2-内容判定tts-vs-ttstext-改写-vs-pinyin-vs-纯文本)
3. [切片边界与标点规范](#3-切片边界与标点规范)
4. [音色选择与 Schema 约定](#4-音色选择与-schema-约定)
5. [引擎与前端 UI 行为陷阱](#5-引擎与前端-ui-行为陷阱)
6. [正反例对照（来自真实课程）](#6-正反例对照来自真实课程)

---

## 1. v1 与 v2 全字段放置矩阵

| 字段 / 题型 | Schema 类型 | TTS / 音频策略 | 禁止与边界 |
| --- | --- | --- | --- |
| `stem`（非听力、非填空） | `string \| ContentSegment[]` | 需示范朗读的外语词句或低龄中文指令拆成 `tts` 切片，中文说明保持 `type: "text"` | 语法术语/报错码/公式留纯文本 |
| `stem`（含 `blank` 填空） | `ContentSegment[]` | `['text', 'blank', 'text']`，**`stem` 内零 TTS** | `blank` 切片与 `tts` 切片**不得共存**于同一题干 |
| `stem`（`listening` / 含 `transcript`） | `string` | **保持纯文本字符串**，零内联 TTS | 严禁在 `stem` 泄露听力原文或按钮 |
| `options` / `blanks[].options` / `sub_questions[].options` | `Option[]`（含 `tts` / `pinyin`） | 英文词句/听说选项可配 `{"voice": ...}`；拼音题全配 `pinyin: [...]` | **`uniformOptionAudio`**：同组选项 `tts` 必须**全有或全无**；纯中文选项/IPA/错拼干扰项不加 |
| `audio` + `transcript`（`listening`） | `string \| ListeningAudio` + `string \| TranscriptLine[]` | v1 用 `transcript[]` 逐行配 `speaker` + `tts`；v2 用 `audio: {mode, voice_male, voice_female}` 或 `mode: "recording"` 配 `.mp3` | `mode: "dialogue"` 必有 `transcript[]`；`mode: "passage"` 必有 `passage`；`mode: "recording"` 必有 `audio.src` |
| `cloze.passage` | `string \| ContentSegment[]` | 使用 `"Every worker {{1}} ..."` 字符串或 `['text', 'blank', ...]` | **`cloze` 短文禁挂 `tts`**（防止跨越或读出空格占位符） |
| `reading_comprehension.passage` | `string \| ContentSegment[]` | 可用 `ContentSegment[]` 为短文（整段或逐段）配 `tts` | 仅渲染段落旁内联喇叭；绝不会触发 `QuestionAudio` 听力栏 |
| `writing.sample_response` + `sample_response_tts` | `string` + `TTSConfig` | 英文写作题配置 `sample_response_tts: {"voice": "stella"\|"tide"}` | 不写进 `sample_response` 本身；仅作答后在范文区展示播放 |
| `translation.source_text` / `reference_translation` | `string` | 纯字符串展示 | 不支持 `ContentSegment[]` 或 `tts` |
| `explanation` / `analysis` / `blanks[].explanation` | `string`（v1/v2） / `richContent`（v2 `analysis`、`blanks[].explanation`） | v2 可在 `analysis` / `blanks[].explanation` 内嵌例句 `tts` 切片；`explanation` 仅纯文本 | `explanation` 不支持切片；解析中不硬编码选项字母（`是 a` 等） |
| `explanation_audio` | `ContentSegment[]` | 需整段语音讲解时使用，可交替混排汉语文段与 `pinyin` 片段 | 见第 5 节 `sequence` 模式陷阱 |

---

## 2. 内容判定：TTS vs tts.text 改写 vs pinyin vs 纯文本

### 适合直接送入 DeepSeek TTS
- 自然完整的英文单词、短语、祈使句、问句、对话台词、短文范文。
- 纯汉字教学指令或讲解正文（如 `"看图，在正确的音节后面打勾。"`、`"水壶读。"`）。

### 必须使用 `tts: {"text": "..."}`（或 `tts_text`）改写
- **中文语境中的阿拉伯数字**：如原文 `"圈出第 1 行的整体认读音节..."` → `tts: {"text": "圈出第一行的整体认读音节..."}`。
- **中文语境中的符号**：如原文 `"看图，在正确的音节后面打“√”。"` → `tts: {"text": "看图，在正确的音节后面打勾。"}`。
- **口语可读形式与视觉文本不一致时**：用 `tts.text` 提供展开的口语文本，保留屏幕视觉原样。

### 必须改用本地 `pinyin: [...]`（不送入 TTS）
- **孤立字母、声母、韵母、音节**：DeepSeek TTS 会把孤立拼音读成英文字母名或错调。
  - 独立韵母映射到标准独立音节录音（`assets/audio/pinyin/README.md`）：`ie` → `ye1`、`iu` → `you1`、`ui` → `wei1`；带调如 `ié` → `ye2`、`uǐ` → `wei3`。
  - 未标调的示例韵母/字母统一用**第一声**：`ei` → `ei1`、`en` → `en1`、`iao` → `yao1`、`e` → `e1`、`i` → `yi1`、`u` → `wu1`。
- **带下划线遮罩的拼音填空提示**（如 `l___ yǔ`、`d___ yī fu`、`ch___ qì q___`）：不要设成 `type: "blank"`（会屏蔽音频），而用 `{"type": "speech", "text": " l___ yǔ", "pinyin": ["lei2", "yu3"]}` 保留视觉遮罩同时播放完整词音。
- **拼音选项**：全部使用 `"pinyin": ["chun1", "jie2"]`，不混用 `tts`。

### 必须保持纯文本（不加 TTS）
- **IPA 音标**：如 `'/t/'`、`'/d/'`、`'/ɪd/'`。
- **刻意拼错的干扰项**：如 `` `stoped`（动词原形为 stop） ``。
- **错误码、符号变换、纯算式**：如 `` `ERR_DIRTY` ``、`operate -> operating`、`good -> better`、`15 mm`、算术与单位换算题。
- **括号内附带翻译的中文选项**：如 `"需要的物品是托盘（trays）"`，中文为主且已有读音辅助价值低，留纯文本。

---

## 3. 切片边界与标点规范

1. **三段包夹模板**：中文叙述中的英文例句采用 `['text', 'tts', 'text']`，首尾皆为纯 `text`。
2. **引号、反引号与空格剥离**：
   - 将包裹英文例句的 `` ` ``、`"`、`'`、`「」` 放在外围纯 `text` 切片或直接去掉；**TTS 切片内禁止出现首尾空白或成对包裹引号**。
   - TTS 切片之后的中文续接若需要视觉空隙，把 `' '` 放在**后置纯 `text` 切片开头**（如 `" 此时你应该："`）。
3. **句末标点归属**：英文自身的终止标点 `.`、`!`、`?` **保留在 TTS 切片内**（帮助合成语调）；中文标点 `：`、`、`、`。`、`（`、`）` 留在纯 `text` 切片中。
4. **片段粒度**：
   - `stem` 与 `reading_comprehension.passage` 中每个 TTS 切片优先放 **1–2 句自然语流**，禁止把标题、`\n` 换行和 3 句以上正文揉进同一切片（如 `"WORKSHOP NOTICE\n..."` 应拆成标题与逐句切片；长篇对话拆成 `transcript[]`）。
   - `explanation_audio[]` 中汉语文段以中文句号 `。` 结尾再切到下一段 `pinyin` 片段（`AudioControls` 会在每个片段 `onended` 后顺次播放下一段，`。` 可提供自然停顿）。
   - `transcript[]` 按说话人轮次拆行，单轮通常 1–3 句。

---

## 4. 音色选择与 Schema 约定

- **仅有两个官方音色**：`"stella"`（女声，服务端默认）与 `"tide"`（男声）。
- **显式对象优先于布尔简写**：
  - 英文内容一律写 `"tts": {"voice": "stella"}` 或 `{"voice": "tide"}`，**不用 `"tts": true`**。
  - 纯中文内容若希望跟随学习者系统默认音色（如 `elementary-chinese`），可写 `"tts": {"text": "..."}` 省略 `voice`；若在 `explanation_audio[]` 写纯汉字且无需改写文本，可省略 `tts` 键。
- **说话人与语境绑定**：
  - `transcript[]` 严格绑定：`M` → `tide`，`W` / 女名说话人 → `stella`。v2 可在 `audio` 写 `{"mode": "dialogue", "voice_male": "tide", "voice_female": "stella"}` 由 `ListeningLines()` 自动补全各行默认音色。
  - 非对话场景经验：男声/班长/安全指令/祈使句多用 `tide`；女声/系统播报/词汇发音/选项朗读多用 `stella`。
- **`speed` 限制**：DeepSeek `/v1/tools/tts` API **不支持**语速参数；`tts.speed`（Schema 允许 `0.5`–`2.0`）仅由浏览器 `<audio>.playbackRate` 在播放端调节。

---

## 5. 引擎与前端 UI 行为陷阱

1. **`RichContent.tsx` 不看 `type: "speech"`**：
   - 渲染优先级：`blank` 直接跳过音频 → `segment.pinyin?.length`（走本地 MP3，**屏蔽 `tts`**）→ `segment.tts || segment.tts_text`（走 TTS）。
   - 若把某切片写成 `{"type": "speech", "text": "Hello"}` 却**漏写 `tts`/`tts_text`/`pinyin`**，`RichContent` 只会把它当普通文本渲染，没有任何播放按钮！
2. **`ExplanationAudio` (`AudioControls` `sequence` 模式) 会朗读全部普通文本段**：
   - 在 `explanation_audio[]` 中，`audioTracks()` 对所有非 `blank`、非 `pinyin` 且 `text` 非空的切片**一律生成 TTS 轨道**，即使该切片是 `type: "text"` 且未写 `tts`。因此 `explanation_audio` 中不要放“只想显示不想读”的切片，要把字母/音节重述为汉字指代句（如 `"它的声调标在这个字母上。"`）+ 紧随其后的 `{"type": "speech", "pinyin": ["yi1"]}`。
3. **`uniformOptionAudio` 的 v1 vs v2 差异**：
   - Go 后端仅在 `protocol_version == 2`（`validateV2()`）强制检查 `options`/`blanks[].options` 的 `tts` 全有全无。
   - 但前端 `ChoiceOptions`、`AnswerOptionList`、`ExamQuestion`、`ExtendedQuestion`（`studyRows` 模式）用 `hasAnyTts = options.some(o => Boolean(o.tts))` 判断：只要有一个选项开了 `tts`，**所有选项都会渲染喇叭按钮**（缺 `tts` 的会退回用 `stella`/默认音色读 `item_title`）。因此 **v1 与 v2 都必须严格遵守全有或全无**。
4. **阅读题与考试听力隔离**：
   - `ListeningLines()` 显式排除 `reading_comprehension`；`QuestionAudio.tsx` 对 `readingQuestionType` 直接返回 `null`，避免把阅读短文当成听力条播放。
   - 模拟考试中 `ExamQuestion.tsx` 通过 `protectedAudio` 调用 `POST /api/exams/{exam}/audio`（`ExamSpeech`），服务端按题号与行号合成返回音频 URL，**不会向活跃考试端下发 `transcript` 原文**。
5. **缓存键算法**：
   - `PhraseKey` 对文本先做 Unicode 空白折叠与首尾 trim，再算 UTF-8 64-bit FNV-1a 十六进制键，存放在 `<dataDir>/audio/{voice}/{key}.wav`。改写 `tts.text` 时需保持语义等价、空白规范，避免产生冗余缓存碎片。

---

## 6. 正反例对照（来自真实课程）

### 例 1：中英混排题干（`beginner-english :: yes-no-questions-4`）
```json
"stem": [
  { "type": "text", "text": "班长巡视工位时问你：" },
  { "type": "text", "text": "Are you OK?", "tts": { "voice": "tide" } },
  { "type": "text", "text": " 你回答：" },
  { "type": "text", "text": "No, it isn't.", "tts": { "voice": "stella" } },
  { "type": "text", "text": " 判断：你的回答在语法和语意上是正确的。" }
]
```
- 正确之处：去掉引号、保留问号/句号在 TTS 内、空格留在相邻纯 `text` 切片，两位说话人分别绑定 `tide` 与 `stella`。

### 例 2：汉语拼音 + 汉字指令混排（`elementary-chinese :: pinyin-04-2-1` & `4-1`）
```json
"stem": [
  {"type": "text", "text": "看图，从「"},
  {"type": "speech", "text": "ie", "pinyin": ["ye1"]},
  {"type": "text", "text": "」和「"},
  {"type": "speech", "text": "ei", "pinyin": ["ei1"]},
  {"type": "text", "text": "」中选择合适的韵母，并加上声调。"},
  {"type": "speech", "text": " l___ yǔ", "pinyin": ["lei2", "yu3"]}
]
```
```json
"stem": [
  {"type": "speech", "text": "看图，在正确的音节后面打“√”。", "tts": {"text": "看图，在正确的音节后面打勾。"}}
]
```
- 正确之处：孤立韵母映射到 `ye1`/`ei1` 本地录音；遮罩词用 `pinyin` 保留下划线而不误用 `blank`；符号 `“√”` 用 `tts.text` 改写为 `勾`。

### 例 3：反例（审计脚本会拦截的常见错误）
- **反例 A（中文选项配英文 TTS + 箭头符号）**——见 `beginner-english :: workbench-listen-sc-1`：
  `"text": "拿起红螺栓 -> 用扳手紧固 -> 放入2号盒", "tts": {"voice": "stella"}`（应省略选项 `tts`，仅保留英文 `transcript`）。
- **反例 B（语法箭头转换直接送 TTS）**——见 `beginner-english :: comparatives-3`：
  `"text": "good -> better", "tts": {"voice": "stella"}`（`->` 会被读错或吞掉，应留纯文本）。
- **反例 C（中英混杂单段直出 TTS）**——见 `beginner-english :: intro-listen-sc-1`：
  `"text": "David, 装配部 (Assembly Department)", "tts": {"voice": "stella"}`（带中文括号解释的选项不应整体送 TTS，或应省略选项 `tts`）。
- **反例 D（`blank` 与 `tts` 共存于同一题干 / 在 `cloze.passage` 挂 TTS）**：会导致语音误读下划线或破坏完形空格交互。
