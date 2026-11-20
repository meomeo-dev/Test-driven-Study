# 课程题库 TTS 与本地音频：放置矩阵、切片规范与引擎行为

执行到设计具体题型的音频放置、切片边界、`tts.text` 改写或核对引擎/UI 行为时加载。

> **真相源与核验日期（2026-11-20）**：本文结论核验自仓库源码与契约：
> - Schema：`contracts/course/v1/items.schema.json`、`contracts/course/v2/items.schema.json`、`contracts/course/v2/vocabulary.schema.json`、`contracts/http/openapi.yaml`
> - 后端校验、投影与合成：`internal/course/{model,extended,item_kind,load,vocabulary}.go`、`internal/study/{type_projection,type_handler,question_content,exam_audio,exam_session}.go`、`internal/tts/{service,phrase_key,wav}.go`、`internal/httpapi/exam_audio.go`
> - 前端渲染：`web/src/components/{RichContent,AudioControls,OptionAudio,QuestionAudio,AnswerOptionList,ListeningTranscript}.tsx`、`web/src/features/question-types/{shared,types}/...`
> - 课程样本：`courses/beginner-english/`、`courses/elementary-chinese/`、`courses/golden-course-template/`

## 目录

1. [v1 与 v2 全字段放置矩阵](#1-v1-与-v2-全字段放置矩阵)
2. [内容判定：TTS vs tts.text 改写 vs pinyin vs 纯文本](#2-内容判定tts-vs-ttstext-改写-vs-pinyin-vs-纯文本)
3. [切片边界与标点规范](#3-切片边界与标点规范)
4. [音色选择与 Schema 约定](#4-音色选择与-schema-约定)
5. [引擎与前端 UI 行为陷阱](#5-引擎与前端-ui-行为陷阱)
6. [正反例对照（来自真实课程）](#6-正反例对照来自真实课程)

---

## 1. v1 与 v2 全字段放置矩阵

覆盖全部 9 类题型（`single_choice`、`multiple_choice`、`true_false`、`numeric`、`cloze`、`listening`、`reading_comprehension`、`writing`、`translation`）及复合题 `sub_questions[]`：

| 字段 / 题型 | Schema 类型 | TTS / 音频策略 | 禁止与边界 |
| --- | --- | --- | --- |
| `stem`（顶层非听力、非填空） | `string \| ContentSegment[]` | 需示范朗读的外语词句或低龄中文指令拆成 `tts` 切片，中文说明保持 `type: "text"` | 语法术语/报错码/公式/代码留纯文本 |
| `stem`（含 `blank` 填空） | `ContentSegment[]` | `['text', 'blank', 'text']`，**`stem` 内零 TTS** | `blank` 切片与 `tts` 切片**不得共存**于同一题干 |
| `stem`（父级 `listening` / 带 `transcript` 题） | `string` | **保持纯文本字符串**，零内联 TTS | 严禁在父级 `stem` 泄露听力原文或按钮 |
| `sub_questions[].stem`（`listening` / `reading_comprehension`） | `string \| ContentSegment[]` | 英文小题提问/陈述句应拆出或整句配 `tts`（即使父级是 `listening` 也允许且建议配音） | 含 `blank` 的小题题干禁配 TTS；纯中文或纯代码题干留纯文本 |
| `options` / `blanks[].options` / `sub_questions[].options` | `Option[]`（`text` 仅 `string`，含 `tts` / `pinyin`） | 英文词句/听说选项可配 `{"voice": ...}`；拼音题全配 `pinyin: [...]`；**标准 `true_false` 省略 `options`**（自动合成 `正确`/`错误`，无 TTS） | **`uniformOptionAudio`**：同组选项（含 `true_false` 自定义 `options`，最多 2 项且含 `value: boolean`）`tts` 必须**全有或全无**；`Option.text` 不支持 `ContentSegment[]` 或 `tts_text`；纯中文/IPA/错拼干扰项不加 |
| `numeric`（顶层与 `sub_questions[]`） | 无 `options`；`grading: {value, absolute_tolerance}` | 英文情境题干（如 `numbers-5`）与 `analysis` 中的英文数字词配 `tts`；十进制字符串判分 | 纯算式、单位换算与代码保持纯文本；**仅 `type: "listening"` 支持模拟考受保护音频**，因此需在考试播放音频的听力数值题必须写成 `listening` + `numeric` 小题 |
| `audio` + `transcript` / `passage`（`listening`） | v1: `string` + `string \| TranscriptLine[]`；v2: `ListeningAudio` + `TranscriptLine[]` / `richContent` | v1 用 `transcript[]` 逐行配 `speaker` + `tts` 或 `.mp3`；v2 三模式：`dialogue` 设 `voice_male`/`voice_female`（台词可省略 `tts` 或仅设 `speed`）；`passage` 由 `audio.voice_female` 朗读 `Passage.String()`；`recording` 配 `.mp3` `audio.src` 与可选不配 `tts` 的 `transcript[]` | `dialogue` 必有 `transcript[]` 且禁 `passage`；`passage` 必有 `passage` 且禁 `transcript`（段落内 `tts` 被忽略）；`recording` 必有 `audio.src` 且禁 `passage` |
| `cloze.passage` + `passage_tts` | `string \| ContentSegment[]` + `TTSConfig` | `passage` 仅放 `"Every worker {{1}} ..."` 或 `['text', 'blank', ...]`；完整短文/完整句朗读单配 `passage_tts: {"voice": ..., "text": "..."}`（单个 `TTSConfig` 容纳 1–2+ 句填入后文本，Go `Cloze.Validate` 强制要求 `text` 非空） | **`cloze.passage` 内片禁挂 `tts`**；`passage_tts` 仅通过 `ClozeItemReview` 在背题与交卷/作答提交后复盘的 `question_review` 下发，不在 `PublicQuestion` 或未作答练习/考试泄露 |
| `reading_comprehension.passage` | `string \| ContentSegment[]` | 拆分为标题 + 1–2 句英文 `tts` 切片，用 `{"type": "text", "text": "\n"}` 与 `{"type": "text", "text": " "}` 纯文本片段隔开 | 仅渲染段落旁内联喇叭；绝不会触发 `QuestionAudio` 听力栏，且禁止 `audio`/`transcript` |
| `writing`（`sample_response` + `sample_response_tts`） | `string \| ContentSegment[]` + `TTSConfig` | 单段英文范文（`sentence_making`）用字符串 `sample_response` + `sample_response_tts: {"voice": ...}`；多段范文（`short_essay`/`full_essay`）将 `sample_response` 拆为按逻辑段落配 `tts` 的 `ContentSegment[]` 并以 `{"type": "text", "text": "\n\n"}` 分隔，**省略** `sample_response_tts` | 仅作答后在范文区展示；`requirements`/`keywords`/`rubric` 为纯文本或整数权重，不可加 TTS；数组态时 `WritingSample` 会忽略 `sample_response_tts` |
| `translation`（`source_text` / `reference_translation` + `*_tts`） | `string` + `TTSConfig` | 英译中（`en_to_zh`）为 `source_text` 配 `source_text_tts`（随 `TranslationContent` 作答前可见）；中译英（`zh_to_en`）为 `reference_translation` 配 `reference_translation_tts`（仅随 `TranslationItemReview` 在背题与复盘下发） | 仅支持纯 `string`（不可用 `ContentSegment[]`），口语改写只能写进 `*_tts.text`；`acceptable_alternates`/`key_terms` 无 TTS；纯中文原文/译文不配英语音色 |
| `explanation` / `analysis` / `blanks[].explanation` / `sub_questions[].analysis` | `string`（`explanation`） / `RichContent`（v2 `analysis`、`blanks[].explanation`、`sub_questions[].analysis`） | v2 **要求**填写 `analysis`（及 `sub_questions[].analysis`）；纯中文可写字符串，含英文例句/短语时用 `ContentSegment[]` 为外语片段内嵌 `tts` | `explanation` 不支持切片；`sub_questions[]` 禁止 `explanation_audio`；解析中禁止硬编码选项字母（`是 a` 等，因模拟考会洗牌选项） |
| `explanation_audio` | `ContentSegment[]` | 顶层题需整段语音讲解时使用，可交替混排汉语文段与 `pinyin` 片段 | 见第 5 节 `sequence` 模式陷阱 |
| `vocabulary_file`（`term` / `example` + `term_tts` / `example_tts`） | `VocabularyEntry[]`（`TTSConfig`） | 干净词条与例句省略 `*_tts`（跟随学习者默认音色）；仅在需要改写读音或指定 `voice`/`speed` 时写 `term_tts` / `example_tts` | 未经 `*_tts.text` 改写时禁止出现 `…`、`...`、`a/b`、`(sb.)`、全大写词或不可直读符号；`voice` 仅限 `"stella"`/`"tide"`；`example_tts` 依赖 `example` 存在；`meaning`/`grammar_note`/`example_translation` 无 TTS |

---

## 2. 内容判定：TTS vs tts.text 改写 vs pinyin vs 纯文本

> **字段写法范围**：`tts_text` **仅存在于 `ContentSegment`**；`Option`、`TranscriptLine`、`passage_tts`、`sample_response_tts`、`source_text_tts`、`reference_translation_tts`、`term_tts`、`example_tts` 均只支持 `tts: {"voice", "text", "speed"}`（顶层与词表 `*_tts` 直接写 `{"voice", "text", "speed"}`）。全仓库推荐统一使用 `tts.text`。

### 适合直接送入 DeepSeek TTS
- 自然完整的英文单词、短语、祈使句、问句、对话台词、短文范文与整点时间简写（如 `"8 a.m."`）。
- 纯汉字教学指令或讲解正文（如 `"看图，在正确的音节后面打勾。"`、`"水壶读。"`）。

### 必须使用 `tts: {"text": "..."}` 改写
- **中文语境中的阿拉伯数字**：如原文 `"圈出第 1 行的整体认读音节..."` → `tts: {"text": "圈出第一行的整体认读音节..."}`。
- **中文语境中的符号**：如原文 `"看图，在正确的音节后面打“√”。"` → `tts: {"text": "看图，在正确的音节后面打勾。"}`。
- **带冒号的英文钟点时间**：如 `"At 10:00 a.m."`、`"At 10:30 a.m."`、`"At 11:30 a.m."` 应保留视觉数字格式并配 `tts: {"voice": "stella", "text": "At ten a.m."}` / `"At ten thirty a.m."` / `"At eleven thirty a.m."`（对比 `"8 a.m."` 无冒号可直接送入 TTS）。
- **段落内的视觉单换行 `\n`**：如邮件落款 `"Best,\nSam"` 需要保留 `\n` 配合 `.extended-passage`（`white-space: pre-wrap`）换行显示，但必须配置 `tts: {"voice": "stella", "text": "Best, Sam"}`，避免把原始 `\n` 送入 DeepSeek。
- **纯大写英文标题或词汇（4 字母及以上的全大写单词）**：DeepSeek TTS 会把 `"LOCKER ROOM NOTICE"` 这类全大写词按字母拼读。若标题需要配 TTS，必须保留屏幕视觉大写并配正常大小写的 `tts.text`（如 `tts: {"voice": "stella", "text": "Locker room notice."}`，否则触发 `ALL_CAPS_TTS_WITHOUT_OVERRIDE`）；在有正文的阅读短文中，短标题也可像 `"WORKSHOP NOTICE"` 一样直接保留为无 `tts` 的纯文本标题（而正文句子若部分漏配会触发 `PARTIAL_PASSAGE_TTS`）。
- **翻译口语形式与数字备选的区分**：在 `translation`（`zh_to_en`）中，把带 `reference_translation_tts` 的 `reference_translation` 写成自然口语形式（如 `"before three p.m."`），把阿拉伯数字写法（如 `"before 3 p.m."`）留在无 TTS 的 `acceptable_alternates`。
- **词表（`vocabulary_file`）占位符、斜杠备选与括号说明**：`term` 或 `example` 若含 `…` / `...`（如 `"My name is …"`、`"Could you please …?"`）、斜杠备选（如 `"he/she"`、`"yes/no"`）或括号注记（如 `"ask (sb.)"`、`"(optional)"`），必须通过 `term_tts.text` / `example_tts.text` 改写为可直读自然短语（去掉省略号或展开为自然词形，如 `"term_tts": {"voice": "stella", "text": "My name is"}`），否则会被 `audit-course-tts.mjs` 拦截；干净词条保持省略 `*_tts`。

### 必须改用本地 `pinyin: [...]`（不送入 TTS）
- **孤立字母、声母、韵母、音节**：DeepSeek TTS 会把孤立拼音读成英文字母名或错调。
  - 独立韵母映射到标准独立音节录音（`assets/audio/pinyin/README.md`）：`ie` → `ye1`、`iu` → `you1`、`ui` → `wei1`；带调如 `ié` → `ye2`、`uǐ` → `wei3`。
  - 未标调的示例韵母/字母统一用**第一声**：`ei` → `ei1`、`en` → `en1`、`iao` → `yao1`、`e` → `e1`、`i` → `yi1`、`u` → `wu1`。
- **带下划线遮罩的拼音填空提示**（如 `l___ yǔ`、`d___ yī fu`、`ch___ qì q___`）：不要设成 `type: "blank"`（会屏蔽音频），而用 `{"type": "speech", "text": " l___ yǔ", "pinyin": ["lei2", "yu3"]}` 保留视觉遮罩同时播放完整词音。
- **拼音选项**：全部使用 `"pinyin": ["chun1", "jie2"]`，**不要在同一切片或选项同时声明 `pinyin` 和 `tts`**（前端优先走 `pinyin` 并忽略 `tts`，审计脚本会报 `PINYIN_TTS_CONFLICT`）。

### 必须保持纯文本（不加 TTS）
- **IPA 音标**：如 `'/t/'`、`'/d/'`、`'/ɪd/'`。
- **刻意拼错的非词干扰项 / 解析中的错误拼写**：如 `` `stoped`（动词原形为 stop） `` 或 `*equipments`（`analysis` 只为正确词 `equipment` 与 `pieces of equipment` 配 TTS）。但若干扰项是语法误用下的**真实英文单词句子**（如 `numbers-1` 中的 `"I see third boxes."`），为遵守 `uniformOptionAudio` 仍需保留 `tts`。
- **错误码、符号变换、算式与代码**：如 `` `ERR_DIRTY` ``、`operate -> operating`、`good -> better`、`15 mm`、`8 + 7 = 15`、`1 ÷ 4`、`for i in range(2, 9, 2): total += i` 等留纯文本。
- **中文为主或括号附带英文提示的选项**：如 `"需要的物品是托盘（trays）"`，中文为主且已有读音辅助价值低，留纯文本。

---

## 3. 切片边界与标点规范

1. **三段包夹模板**：中文叙述与解析中的英文例句采用 `['text', 'tts', 'text']`，首尾皆为纯 `text`。
2. **多句纯英文间距模板**：连续多句纯英文（如 `reading_comprehension.passage` 正文或两句英文小题题干）应拆成独立 `tts` 切片，并用单独的空格纯文本切片隔开：`[{"type": "text", "text": "S1.", "tts": ...}, {"type": "text", "text": " "}, {"type": "text", "text": "S2.", "tts": ...}]`，保证每句可独立点播且 TTS 文本无首尾空格。
3. **引号、反引号、括号与换行剥离**：
   - 将包裹英文例句的 `` ` ``、`"`、`'`、`「」`、`“...”` 与中文括号 `（...）` 放在外围纯 `text` 切片或直接去掉；**TTS 切片内禁止出现首尾空白或成对包裹引号**。
   - TTS 切片之后的中文续接若需要视觉空隙，把 `' '` 放在**后置纯 `text` 切片开头**（如 `" 此时你应该："`）。
   - 混排题干的视觉换行（如 `"判断下列英语语法说法是否正确：\n"`）放在前置纯 `text` 切片末尾，绝不放入 TTS 切片。
4. **句末标点归属**：英文自身的终止标点 `.`、`!`、`?` **保留在 TTS 切片内**（帮助合成语调）；中文标点 `：`、`、`、`。`、`（`、`）`、`“`、`”` 留在纯 `text` 切片中。
5. **片段粒度与例外（`allowCoarse`）**：
   - `stem` 与 `reading_comprehension.passage` 中每个 TTS 切片优先放 **1–2 句自然语流**，禁止把标题、`\n` 换行和 3 句以上正文揉进同一切片（`reading_comprehension` 标题与正文间插入 `{"type": "text", "text": "\n"}`）。
   - **`writing.sample_response` 段落级例外**：`short_essay` / `full_essay` 的 `ContentSegment[]` 按**逻辑段落**切片（单段可包含 3–4 句，对应审计脚本的 `allowCoarse` 放行），段落间插入 `{"type": "text", "text": "\n\n"}` 纯文本分隔符以配合 `.extended-passage` 的 `white-space: pre-wrap` 渲染。同理 `listening.transcript[]` / `listening` `passage` 模式、`cloze.passage_tts` 与 `translation` 字符串允许整段或 1–3 句合并。
   - `explanation_audio[]` 中汉语文段以中文句号 `。` 结尾再切到下一段 `pinyin` 片段（`AudioControls` 会在每个片段 `onended` 后顺次播放下一段，`。` 可提供自然停顿）。
   - `transcript[]` 按说话人轮次拆行，单轮通常 1–3 句。

---

## 4. 音色选择与 Schema 约定

- **仅有两个官方音色**：`"stella"`（女声，服务端默认）与 `"tide"`（男声）。
- **显式对象优先于布尔简写**：
  - 英文内容一律写 `"tts": {"voice": "stella"}` 或 `{"voice": "tide"}`，**不用 `"tts": true`**。
  - 纯中文内容若希望跟随学习者系统默认音色（如 `elementary-chinese`），可写 `"tts": {"text": "..."}` 省略 `voice`；若在 `explanation_audio[]` 写纯汉字且无需改写文本，可省略 `tts` 键。
- **说话人与 `resolveListeningLines` 继承规则（`internal/course/item_kind.go:196-223`）**：
  - v2 `listening` 在 `mode: "dialogue"` 时写 `{"mode": "dialogue", "voice_male": "tide", "voice_female": "stella"}`，`transcript[]` 行可省略 `tts` 或仅写 `{"speed": 0.9}` 继承音色；但 Go 的 `resolveListeningLines` **仅在 `strings.EqualFold(line.Speaker, "M")` 时映射到 `VoiceMale`**，**其余任何说话人标签**（如 `"W"`、`"Man"`、`"Bob"`）都会回退到 `VoiceFemale`！因此非 `"M"` 的男性说话人必须显式写 `line.tts.voice: "tide"`。
  - v2 `listening` 在 `mode: "passage"` 时，Go 将 `item.Passage.String()` 包装为单条 `Speaker: ""` 的 `TranscriptLine`，**永远只读取 `audio.voice_female`**（仅写 `voice_male` 会被静默忽略并触发 `ENGLISH_TTS_MISSING_VOICE`），且 `passage` 若写成 `ContentSegment[]`，其段内 `tts`/`tts.text` 全部被忽略（`LISTENING_PASSAGE_INLINE_TTS`）。
  - v2 `listening` 在 `mode: "recording"` 时主播放器播放 `audio.src`（`.mp3`）；若附带 `transcript[]` 且省略行内 `tts`，练习/复盘页的 `ListeningTranscript` 仍会按行渲染播放按钮（或显式配 `tts` 指定音色）。
  - 非对话场景经验：男声/班长/安全指令/祈使句多用 `tide`；女声/系统播报/词汇发音/选项朗读多用 `stella`。
- **`speed` 限制**：DeepSeek `/v1/tools/tts` API **不支持**语速参数；`tts.speed`（Schema 允许 `0.5`–`2.0`）仅由浏览器 `<audio>.playbackRate` 在播放端调节。

---

## 5. 引擎与前端 UI 行为陷阱

1. **`RichContent.tsx` 不看 `type: "speech"`**：
   - 渲染优先级：`blank` 直接跳过音频 → `segment.pinyin?.length`（走本地 MP3，**屏蔽 `tts`**）→ `segment.tts || segment.tts_text`（走 TTS）。
   - 若把某切片写成 `{"type": "speech", "text": "Hello"}` 却**漏写 `tts`/`tts_text`/`pinyin`**，`RichContent` 只会把它当普通文本渲染，没有任何播放按钮。
2. **`ExplanationAudio` (`AudioControls.tsx` `sequence` 模式) 会朗读全部普通文本段**：
   - 在 `explanation_audio[]` 中，`audioTracks()` 对所有非 `blank`、非 `pinyin` 且 `text` 非空的切片**一律生成 TTS 轨道**，即使该切片是 `type: "text"` 且未写 `tts`。因此 `explanation_audio` 中不要放“只想显示不想读”的切片，要把字母/音节重述为汉字指代句（如 `"它的声调标在这个字母上。"`）+ 紧随其后的 `{"type": "speech", "pinyin": ["yi1"]}`。
3. **`uniformOptionAudio` 校验与前端渲染差异**：
   - 后端由 `Item.validateCommonOptions(protocol)`（`internal/course/load.go:190-195`）调用 `uniformOptionAudio(options)`（`internal/course/extended.go:151-162`），在 `protocol == 2` 时强制要求同组选项的 `tts` 全有或全无（覆盖顶层选择题、`true_false`、`sub_questions[]` 与 `blanks[].options`）。
   - 前端由 `ChoiceOptionButtons` / `OptionTextList` / `PreviewChoiceList` / `PalaceChoiceList`（`web/src/features/question-types/shared/ChoicePrimitives.tsx`）、`AnswerOptionList`（`web/src/components/AnswerOptionList.tsx`）和 `PartOptions`（`web/src/features/question-types/shared/PartOptions.tsx`）消费：
     - `ChoicePrimitives`、`AnswerOptionList` 及 `studyRows` 为 `true` 时的 `PartOptions`（`ReadingQuestions` 只要有 `passage` 或 `review` 即为 `true`；`ListeningQuestions` 仅在交卷/复盘有 `review` 时为 `true`）以 `hasAnyTts = options.some(o => Boolean(o.tts))` 驱动 `OptionAudio`，只要任一选项开了 `tts`，全部选项都会渲染喇叭（缺 `tts` 项会退回默认音色读 `item_title`）。
     - 而在活跃 `listening` 作答中 `studyRows` 为 `false`，`PartOptionAudio` 仅对各自声明了 `tts`/`pinyin` 的选项渲染 `AudioControls`。因此 **v1 与 v2 都必须严格遵守选项 `tts` 全有或全无**。
   - 当 `true_false` 自定义 `options` 时，`hasDetailedJudgmentOptions`（`ChoicePrimitives.tsx:28-37`）变为 `true`，会在考试与作答反馈视图额外渲染 `OptionTextList` 与 `OptionAudio`；且顶层单选/多选题在模拟考中走 `PrepareExamItem: shuffleQuestionItems`（`internal/study/type_handler.go:43,59`）打乱选项顺序，所以 `analysis` 必须引用选项文本而非字母序号。
4. **阅读题与考试听力隔离（`QuestionAudioSource` 与 `ExamAudioSpeeds`）**：
   - 隔离由后端与 TypeScript 类型联合共同保证：后端 `Reading.MediaCapable: false` / `ListeningLines: nil`（`internal/course/item_kind.go:119-136`）、`validateComposite()` 拒绝 `audio`/`transcript`（`internal/course/extended.go:165-169`，审计对应 `READING_FORBIDS_MEDIA`）、`publicNonMedia`（`internal/study/type_handler.go:134`）；前端 `readingModule.spec.hasMedia: false`（`reading-comprehension/index.tsx:17`）及 `QuestionAudioSource`（`web/src/components/QuestionAudio.tsx:14-24`）将可用类型严格限定为 `single_choice | multiple_choice | true_false | numeric | listening`。
   - 模拟考中 `ExamQuestion.tsx` 通过 `protectedAudio` 调用 `POST /api/exams/{exam}/audio`（`internal/httpapi/exam_audio.go` → `study.ExamSpeech` → `h.ExamSpeechLine`），且 `publicMedia` 在 `VisibilityActiveExam` 下会剥离 `TranscriptLines` / `TranscriptURL`。**仅 `type: "listening"`** 注册了 `ExamAudioSpeeds: listeningAudioSpeeds` 与 `ExamSpeechLine: listeningSpeechLine`（`internal/study/type_handler.go:124-125`）；`single_choice` / `multiple_choice` / `true_false` / `numeric` 均绑定 `noExamAudioSpeeds` / `noExamSpeechLine`。因此无 `.mp3`、靠 `transcript` 合成的听力选择/判断/数值题若要支持模拟考，在 v2 必须写成 `type: "listening"` + `sub_questions[]`。
5. **非媒体题型的投影、防泄露与换行渲染陷阱**：
   - `cloze` / `reading_comprehension` / `writing` / `translation` 走 `publicNonMedia` 与 `keepNonMediaReview`（`internal/study/type_handler.go`），答案与解析只在背题或提交后的 `question_review`（`internal/study/exam_session.go:64-80`）下发。
   - **`Cloze.Validate` 不拦 `cloze.passage` 内联 `tts`**：`item_kind.go:76-87` 与 `extended.go:211-235` 仅校验 `passage_tts.text` 非空与空格索引，并不拒绝 `cloze.passage` 切片挂 `tts`；一旦误挂，`RichContent` 会在作答前泄露按钮，必须依赖 `audit-course-tts.mjs`（`BLANK_TTS_COOCCURRENCE`）把关。
   - **`WritingSample` 忽略数组态 `sample_response_tts` & `pre-wrap`**：`writing/components.tsx:42-46` 在 `sample_response` 为 `ContentSegment[]` 时直接跳过 `sample_response_tts`（审计报 `WRITING_REDUNDANT_SAMPLE_TTS`）；`.extended-passage`（`question-types.css:8-12`）使用 `white-space: pre-wrap`，而 `internal/tts/service.go:403` 直接把 `text` 发给 DeepSeek，因此多段范文需用 `"\n\n"` 纯文本分隔、省略 `sample_response_tts`，且 `"Best,\nSam"` 必须写 `tts.text: "Best, Sam"`（否则报 `WRITING_UNNORMALIZED_NEWLINE`）。
   - **`translation` 显隐边界**：`projectTranslation` 将 `source_text` + `source_text_tts` 放入作答前 `TranslationContent`，而 `reference_translation` + `reference_translation_tts` 仅存于 `TranslationItemReview`；前端 `speechText()`（`translation/components.tsx:10-12`）把它们包装为单段 TTS。非外语方向（纯中文原文/译文）附带 `*_tts` 会触发 `TRANSLATION_OFF_DIRECTION_TTS`。
6. **缓存键算法**：
   - `PhraseKey`（`internal/tts/phrase_key.go:14-32`）对文本先做 `NormalizeText`（Unicode 空白折叠与首尾 trim），再算 UTF-8 64-bit FNV-1a 十六进制键，存放在 `<dataDir>/audio/{voice}/{key}.wav`。改写 `tts.text` 时需保持语义等价、空白规范，避免产生冗余缓存碎片。

---

## 6. 正反例对照（来自真实课程）

### 例 1：`golden-course-template` 全 9 类题型核心正例

- **`cloze`（`sue1-extended-cloze`）**——`passage` 留占位符、`passage_tts` 填完整句、`blanks[].options` 均一配音、`blanks[].explanation` 用 `RichContent`：
```json
{
  "id": "sue1-extended-cloze",
  "type": "cloze",
  "passage": "Every worker {{1}} sign the checklist. Do not {{2}} the equipment without permission.",
  "passage_tts": {
    "voice": "stella",
    "text": "Every worker must sign the checklist. Do not start the equipment without permission."
  },
  "blanks": [
    {
      "index": 1,
      "options": [
        { "id": "must", "text": "must", "tts": { "voice": "stella" } },
        { "id": "has", "text": "has", "tts": { "voice": "stella" } }
      ],
      "grading": { "choice_ids": ["must"] },
      "explanation": [
        { "type": "text", "text": "must", "tts": { "voice": "stella" } },
        { "type": "text", "text": " 后接动词原形，表示必须遵守的要求。" }
      ]
    }
  ]
}
```

- **`listening`（`sue1-extended-listening` & `sue1-extended-listening-recording :: arrival-time`）**——父级 `stem` 纯中文、`dialogue` 继承 `voice_male`/`voice_female` 与 `speed`、`recording` 钟点时间改写：
```json
{
  "id": "sue1-extended-listening",
  "type": "listening",
  "stem": "听库房里的对话，再回答两个问题。",
  "audio": { "mode": "dialogue", "voice_male": "tide", "voice_female": "stella" },
  "transcript": [
    { "speaker": "M", "text": "Where are the gloves for the new shift?" },
    {
      "speaker": "W",
      "text": "They are on the second shelf. Please sign the checklist before taking a pair.",
      "tts": { "speed": 0.9 }
    }
  ],
  "sub_questions": [
    {
      "id": "location",
      "type": "single_choice",
      "stem": [{ "type": "text", "text": "Where are the gloves?", "tts": { "voice": "stella" } }],
      "options": [
        { "id": "second", "text": "On the second shelf.", "tts": { "voice": "stella" } },
        { "id": "desk", "text": "On the desk.", "tts": { "voice": "stella" } }
      ],
      "grading": { "choice_ids": ["second"] },
      "analysis": "第二位说话者明确说了在第二层架子上。"
    }
  ]
}
```
```json
"options": [
  { "id": "ten", "text": "At 10:00 a.m.", "tts": { "voice": "stella", "text": "At ten a.m." } },
  { "id": "ten-thirty", "text": "At 10:30 a.m.", "tts": { "voice": "stella", "text": "At ten thirty a.m." } },
  { "id": "eleven-thirty", "text": "At 11:30 a.m.", "tts": { "voice": "stella", "text": "At eleven thirty a.m." } }
]
```

- **`reading_comprehension`（`sue1-extended-reading-single-choice`）**——全大写标题用 `tts.text` 改写，标题与逐句间插 `"\n"` 与 `" "`：
```json
"passage": [
  { "type": "text", "text": "LOCKER ROOM NOTICE", "tts": { "voice": "stella", "text": "Locker room notice." } },
  { "type": "text", "text": "\n" },
  { "type": "text", "text": "The main locker room will close at four p.m. on Friday for cleaning.", "tts": { "voice": "stella" } },
  { "type": "text", "text": " " },
  { "type": "text", "text": "After four, staff can use the small locker room next to the canteen.", "tts": { "voice": "stella" } }
]
```

- **`writing`（`sue1-extended-writing-short`）**——多段范文使用 `ContentSegment[]` + `"\n\n"` 分隔、省略 `sample_response_tts`，段内单换行配 `tts.text`：
```json
"sample_response": [
  { "type": "text", "text": "Hi Mia,", "tts": { "voice": "stella" } },
  { "type": "text", "text": "\n\n" },
  { "type": "text", "text": "The truck needs repairs, so today's delivery has been moved to Friday at ten in the morning. Please confirm that someone will be available to receive the boxes at that time. I'm sorry for the change and thank you for your help.", "tts": { "voice": "stella" } },
  { "type": "text", "text": "\n\n" },
  { "type": "text", "text": "Best,\nSam", "tts": { "voice": "stella", "text": "Best, Sam" } }
]
```

- **`translation`（`sue1-extended-translation` & `sue1-extended-translation-zh-to-en`）**——英译中配 `source_text_tts`；中译英在 `reference_translation` 用口语展开（配 `reference_translation_tts`），数字写法放 `acceptable_alternates`：
```json
{
  "id": "sue1-extended-translation",
  "type": "translation",
  "direction": "en_to_zh",
  "stem": "将下列交班提示译成中文。",
  "source_text": "Leave the signed checklist on the front desk.",
  "source_text_tts": { "voice": "stella" },
  "reference_translation": "把已签字的清单留在前台。"
}
```
```json
{
  "id": "sue1-extended-translation-zh-to-en",
  "type": "translation",
  "direction": "zh_to_en",
  "stem": "将下列交班指令翻译成英文。",
  "source_text": "请把签字后的清单交给下一班，并在下午三点前把空箱放到装货门旁。",
  "reference_translation": "Please hand the signed checklist to the next shift and put the empty boxes by the loading door before three p.m.",
  "reference_translation_tts": { "voice": "stella" },
  "acceptable_alternates": [
    "Please give the signed checklist to the next shift and leave the empty boxes next to the loading door before 3 p.m."
  ]
}
```

- **`true_false`（`sue1-extended-judgment`）**——省略 `options`、换行保留在纯文本前缀、`analysis` 只朗读正确词汇而不朗读错误词 `*equipments`：
```json
{
  "id": "sue1-extended-judgment",
  "type": "true_false",
  "stem": [
    { "type": "text", "text": "判断下列英语语法说法是否正确：\n" },
    { "type": "text", "text": "The word equipment normally takes the plural form equipments.", "tts": { "voice": "stella" } }
  ],
  "grading": { "value": false },
  "analysis": [
    { "type": "text", "text": "equipment", "tts": { "voice": "stella" } },
    { "type": "text", "text": " 是不可数名词。要表达多件设备，可以说 " },
    { "type": "text", "text": "pieces of equipment", "tts": { "voice": "stella" } },
    { "type": "text", "text": "。" }
  ]
}
```

- **`numeric`（`numbers-5`）与 `single_choice` / `multiple_choice`（`numbers-1`、`numbers-3`）**——英文语境句与解析英文数字词加 TTS，算式 `8 + 7 = 15` 留纯文本；真实词干扰项 `"I see third boxes."` 保持 `tts` 均一性；纯中文带括号选项省略 `tts`，`analysis` 不写选项字母：
```json
{
  "id": "numbers-5",
  "type": "numeric",
  "stem": [
    { "type": "text", "text": "班长在工位清点零件时说：" },
    { "type": "text", "text": "There are eight red parts and seven blue parts on the table.", "tts": { "voice": "tide" } },
    { "type": "text", "text": " 工作台上一共有多少个零件？请用阿拉伯数字作答。" }
  ],
  "analysis": [
    { "type": "text", "text": "eight", "tts": { "voice": "stella" } },
    { "type": "text", "text": " 表示 8，" },
    { "type": "text", "text": "seven", "tts": { "voice": "stella" } },
    { "type": "text", "text": " 表示 7，零件总数为 8 + 7 = 15。" }
  ],
  "grading": { "value": "15", "absolute_tolerance": "0" }
}
```
```json
"options": [
  { "id": "a", "text": "需要的数量是 24" },
  { "id": "b", "text": "需要的数量是 42" },
  { "id": "c", "text": "需要的物品是托盘（trays）" },
  { "id": "d", "text": "需要的物品是螺丝（screws）" }
]
```

### 例 2：中英混排与汉语拼音（`beginner-english` & `elementary-chinese`）
```json
"stem": [
  { "type": "text", "text": "班长巡视工位时问你：" },
  { "type": "text", "text": "Are you OK?", "tts": { "voice": "tide" } },
  { "type": "text", "text": " 你回答：" },
  { "type": "text", "text": "No, it isn't.", "tts": { "voice": "stella" } },
  { "type": "text", "text": " 判断：你的回答在语法和语意上是正确的。" }
]
```
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

### 例 3：反例（审计脚本会拦截的常见错误）
- **反例 A（中文选项配英文 TTS + 箭头符号）**——见 `beginner-english :: workbench-listen-sc-1`：
  `"text": "拿起红螺栓 -> 用扳手紧固 -> 放入2号盒", "tts": {"voice": "stella"}`（应省略选项 `tts`，仅保留英文 `transcript`）。
- **反例 B（语法箭头转换直接送 TTS）**——见 `beginner-english :: comparatives-3`：
  `"text": "good -> better", "tts": {"voice": "stella"}`（`->` 会被读错或吞掉，应留纯文本）。
- **反例 C（中英混杂单段直出 TTS）**——见 `beginner-english :: intro-listen-sc-1`：
  `"text": "David, 装配部 (Assembly Department)", "tts": {"voice": "stella"}`（带中文括号解释的选项不应整体送 TTS，或应省略选项 `tts`）。
- **反例 D（`blank` 与 `tts` 共存于同一题干 / 在 `cloze.passage` 挂 TTS / `writing` 数组态仍挂 `sample_response_tts`）**：会导致误读下划线、作答前泄露完形全文音频或冗余字段被前端忽略。
- **反例 E（词表 `vocabulary_file` 占位符未配 `*_tts.text` 或使用无效 `voice`）**：如 `{"id": "my-name-is", "term": "My name is …"}` 缺 `term_tts.text`（应配 `"term_tts": {"voice": "stella", "text": "My name is"}`），或 `"example_tts": {"voice": "alloy"}`（仅允许 `"stella"` / `"tide"`）。
