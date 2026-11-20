# v2 英中逐字稿与阅读对照

编写或审查 `study_translation` 时加载。以下规则于 2026-11-20 对照
[课程 Schema](../../../../contracts/course/v2/items.schema.json)、
[Go 校验](../../../../internal/course/study_translation.go)、
[英文音频处理](../../../../internal/course/item_kind.go)和
[逐字稿视图](../../../../web/src/components/ListeningTranscript.tsx)核验。
实际样例见 [黄金模板](../../../../courses/golden-course-template/questions/extended-practice.json)
与 [零基础英语](../../../../courses/beginner-english/README.md)。

## 对齐英文原文

在 v2 `reading_comprehension` 或 `listening` 父题声明可选的
`study_translation`。其中 `material` 是必填的非空纯文本数组。按下表的原文顺序
给每段或每行写一条中文。可选的 `sub_questions` 用已有小题 ID 关联中文
`stem` 和/或 `options`，选项译文再以原选项 ID 为键。

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
