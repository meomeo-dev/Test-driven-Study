# V2 question types

The v2 course contract adds five types. The existing four types remain
available. [The sample unit](../../../courses/golden-course-template/questions/extended-practice.json)
demonstrates all nine types, including the three writing subtypes, both
translation directions, all three listening modes, and reading sub-questions
with single-choice, multiple-choice, and numeric responses. The standalone
single-choice, multiple-choice, and numeric examples come from the
[numbers unit](../../../courses/beginner-english/questions/numbers-places.json).

| Type | Authored content | Submitted answer |
| --- | --- | --- |
| `cloze` | `passage` and indexed `blanks` | `{"blanks":{"1":["a"]}}` |
| `listening` | Recording, dialogue or spoken passage; `sub_questions` | `{"sub_answers":{"sq-1":["a"],"sq-2":false}}` |
| `reading_comprehension` | `passage` and `sub_questions` | `{"sub_answers":{"sq-1":["a"],"sq-2":"8.0"}}` |
| `writing` | Subtype, requirements, optional word limits and keywords, sample, rubric | `{"text":"The delivery has been moved to Friday."}` |
| `translation` | Direction, source, reference, optional alternatives and key terms | `{"translation":"请把清单放在前台。"}` |
| `true_false` (existing) | V2 Boolean `grading.value` and `analysis` | `{"value":false}` (old option signs also accepted) |

In cloze passages, use `{{1}}` in plain text or a rich blank segment with an
`index`. Each declared blank must appear exactly once. Listening and reading
accept single choice, multiple choice, true/false and decimal sub-questions.
Sub-question IDs are unique within the parent item. Enable option TTS on
every option in a group or leave it disabled on the whole group. Playback uses
each declared speed without changing the cached audio.

The listening `audio` field accepts an MP3 asset path or an object with
`mode`: `recording` uses `src`, `dialogue` uses transcript lines (with
optional default voices for `M` and `W`), and `passage` uses spoken passage
text. A structured transcript may also omit the audio object. In a mock exam,
the player requests audio by line index from the saved paper. The transcript
is released after the paper finishes.

### Study translations

All nine v2 question types support an optional `study_translation` object for
aligned Chinese translations. Translations are review-only: they are never
exposed on unanswered practice presentations or active in-progress mock exams.
Memorization and post-submission practice show translations when allowed, mock
exams release them only after the whole paper finishes, and Typing Study and
Memory Palace read them when enabled for those surfaces.

- `display_in` is an optional array of unique surface names chosen from
  `memorize`, `practice_review`, `exam_review`, `typing`, and `palace`.
  Omitting `display_in` defaults to all five surfaces. Use a subset when an
  item should only show translations on selected surfaces (for example
  `["memorize", "typing"]`).
- `stem` provides a plain-text translation of the question prompt (or the
  English sentence embedded in it) on any question type.
- `options` maps authored option IDs to plain-text translations on
  `single_choice`, `multiple_choice`, and custom-option `true_false` items.
- `material` is an array of plain strings in source order for `cloze`,
  `reading_comprehension`, and `listening` (required when `study_translation`
  is set on `reading_comprehension` or `listening`). For a rich `passage`,
  count each segment with nonblank `text`, including any title. A plain
  `passage` string is one part (on `cloze`, translate the completed passage
  with the correct blank answers filled in). For dialogue and recorded
  listening, count one part per authored `transcript` line; recordings need a
  structured transcript to use study translations.
- `sample_response` is an array of plain strings for `writing`, matching one
  entry per nonblank text segment in `sample_response` (length 1 for a plain
  string).
- To align a spoken passage to multiple translations, use `ContentSegment[]`
  for `passage`. Preserve whitespace between parts so that joining the segment
  text reproduces the original English. The passage still plays as one track.
- `sub_questions` (on `reading_comprehension` and `listening`) may map existing
  sub-question IDs to a plain `stem`, an `options` map keyed by existing option
  IDs, or both. Omit entries that already have sufficient Chinese text. Apply
  the same level of literal detail to correct options and distractors.

The [sample unit](../../../courses/golden-course-template/questions/extended-practice.json)
demonstrates `study_translation` across all question types, including
multi-surface (`sue1-extended-cloze`, `numbers-1`, `sue1-extended-writing`) and
selective `display_in` (`numbers-3` and `numbers-5`).

### Grading and feedback

Practice and mock exams grade objective parts with the same rules. Every
blank or sub-question is weighted equally; omitted parts earn zero credit.
Cloze items may also set `passage_tts` with a complete `text` (exposed only
in review surfaces such as memorization and post-submission review) to read
the completed passage aloud without spoiling unanswered blanks.
Mock exams sum fractional credit across the whole paper and round down once
to the integer score used by the terminal. Analysis still counts full-credit
attempts as correct.

Writing uses the server-computed word count and normalized keyword coverage;
the sample can also match exactly after normalization. Set `sample_response`
to `ContentSegment[]` with segment-level `tts` for multi-paragraph playback, or
set the optional `sample_response_tts` object on a single-string sample to
enable playback on writing review surfaces. Both accept the shared `voice`,
`text`, and `speed` settings. Translation supports the same optional `source_text_tts`
(on source prompts and review) and `reference_translation_tts` (on reference
review) objects alongside `source_text` and `reference_translation`. Translation
awards full credit for a normalized
reference or authored alternative. Key-term matching
can earn up to half credit, since terms alone cannot establish meaning. These
local checks do not assess fluency or fully judge an original answer. With
the LLM configured, learners can explicitly request rubric feedback after a
written practice submission. Feedback does not change practice history or
exam scores.

Install or upgrade the example course through the normal versioned import.
The questions appear under **黄金标准课程模板 → 题型展示**. The template also
includes a [working learning path example](../../../courses/golden-course-template/README.md#学习路径示例).

```sh
npm run course:check -- courses/golden-course-template
npm run course:install -- courses/golden-course-template
```

See the [v2 schemas](../../../contracts/course/v2/README.md) and the original
[design specification](v2-question-types-specification.md). The application
supports nine total types: the specification counted the revised true/false
contract as an additional type.

Related: [TTS architecture](../tts/deepseek-tts-architecture.md) and
[workspace projection](../../../internal/storage/workspace.go).
