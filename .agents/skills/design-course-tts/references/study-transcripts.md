# v2 英中对照与显示范围

编写或审查 `study_translation` 时加载。以下规则于 2026-11-27 对照
[课程 Schema](../../../../contracts/course/v2/items.schema.json)、
[Go 校验](../../../../internal/course/study_translation.go)、
[英文音频处理](../../../../internal/course/item_kind.go)、
[显示范围辅助](../../../../web/src/features/question-types/shared/study-translation.ts)和
[逐字稿视图](../../../../web/src/components/ListeningTranscript.tsx)核验。
实际样例见 [黄金模板](../../../../courses/golden-course-template/questions/extended-practice.json)
与 [零基础英语](../../../../courses/beginner-english/README.md)。

## 全部 9 类题型与 `display_in` 显示范围

全部 9 类 v2 题型均可在题目顶层声明可选的 `study_translation`，并通过可选数组
`display_in` 控制该题译文出现在哪些学习位置（枚举：`memorize`、`practice_review`、
`exam_review`、`typing`、`palace`；省略时默认在全部 5 个位置显示）。

| 题型 | 可用字段 | 对齐规则 |
| --- | --- | --- |
| `single_choice` / `multiple_choice` / `true_false` | `stem`、`options` | `stem` 译题干英文；`options` 以原选项 ID 为键映射英文选项译文（仅含自定义选项的判断题可用 `options`）。 |
| `numeric` | `stem` | 译题干中的英文句，数字与单位须与原文一致。 |
| `cloze` | `stem`、`material` | `material` 按 `passage` 非空文本段对齐（纯字符串为长度 1，须译出填入正确答案后的完整句子）。 |
| `writing` | `stem`、`sample_response` | `sample_response` 按范文非空文本段对齐（纯字符串为长度 1，多段富文本逐段对应，保留段内换行）。 |
| `reading_comprehension` / `listening` | `stem`、`material`（必填）、`sub_questions` | 见下表原文与逐字稿对齐规则。 |
| `translation` | `stem`（可选） | `source_text` 与 `reference_translation` 天然成对。 |

## 对齐阅读与听力原文

在 v2 `reading_comprehension` 或 `listening` 父题声明 `study_translation` 时，
`material` 是必填的非空纯文本数组。按下表的原文顺序给每段或每行写一条中文，
且在同一段/行包含多句英文时尽量保持句界与中文一致（便于打字练习逐句配对）。
可选的 `sub_questions` 用已有小题 ID 关联中文 `stem` 和/或 `options`，选项译文再以原选项 ID 为键。

| 原文 | 中文译文对应单位 | 播放来源 |
| --- | --- | --- |
| 阅读 `passage` | 字符串对应一条。富文本数组逐个计入非空 `text`，含标题。空格、换行或纯音频片段不占译文位置。 | 英文段内已有音频声明。 |
| 听力 `audio.mode: "dialogue"` | 结构化 `transcript[]` 每轮一条，按作者声明的行序。 | `speaker`、英文 `text` 与行内或默认音色配置。 |
| 听力 `audio.mode: "passage"` | 字符串对应一条。长独白用 `ContentSegment[]` 划分短段，按非空文本对齐。 | 拼接原文片段，用 `audio.voice_female` 整段合成。 |
| 听力 `audio.mode: "recording"` | 添加译文时使用结构化 `transcript[]`，每行一条。纯字符串稿和逐字稿文件路径无法建立这一逐行对齐。 | 主播放器使用 `audio.src` 的录音。 |

黄金模板手套对话的顺序与译文如下。整题包含的其他字段在示例中省略。

```json
{
  "transcript": [
    { "speaker": "M", "text": "Where are the gloves for the new shift?" },
    {
      "speaker": "W",
      "text": "They are on the second shelf. Please sign the checklist before taking a pair.",
      "tts": { "speed": 0.9 }
    }
  ],
  "study_translation": {
    "material": [
      "下一班要用的手套放在哪里？",
      "在第二层架子上。领一副之前，请先在清单上签名。"
    ],
    "sub_questions": {
      "location": {
        "stem": "手套放在哪里？",
        "options": { "second": "在第二层架子上。", "desk": "在桌上。" }
      },
      "checklist": {
        "stem": "工人不用在清单上签名也可以领手套。"
      }
    }
  }
}
```

## 核对原音与可见性

- 保留英文原文、说话人、行序、音色和语速。独白切段时保留分隔空格与标点字符，
  确认拼接结果逐字符等于原英文，并省略段内 `tts` 和 `tts_text`。译文只用于显示。
- 用 `course:check` 验证段数、非空译文和小题/选项 ID，用 `audit-course-tts.mjs`
  核对英文播放输入与既有 TTS 规则。逐段审阅译文的数字、时间、否定、方位和选项差异。
- 在背题模式展开「查看英中逐字稿」，检查段序、双语开关与英文播放。阅读对照应在
  材料原位显示。旧题缺少译文时使用原文视图。
- 译文通过 `question_review` 可供背题与练习提交后复盘。模拟考试交卷后才下发译文，
  活动整卷的已答单题复习响应也须裁剪译文。用
  [可见性回归](../../../../internal/study/study_translation_test.go)核对边界。
