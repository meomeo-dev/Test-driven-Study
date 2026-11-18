# V2 question types

The v2 course contract adds five types. The existing four types remain
available. [The sample unit](../../../courses/step-up-english-1/questions/extended-practice.json)
contains an example of each new type and a v2 true/false item.

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

Practice and mock exams grade objective parts with the same rules. Every
blank or sub-question is weighted equally; omitted parts earn zero credit.
Mock exams sum fractional credit across the whole paper and round down once
to the integer score used by the terminal. Analysis still counts full-credit
attempts as correct.

Writing uses the server-computed word count and normalized keyword coverage;
the sample can also match exactly after normalization. Translation awards full
credit for a normalized reference or authored alternative. Key-term matching
can earn up to half credit, since terms alone cannot establish meaning. These
local checks do not assess fluency or fully judge an original answer. With
the LLM configured, learners can explicitly request rubric feedback after a
written practice submission. Feedback does not change practice history or
exam scores.

Install or upgrade the example course through the normal versioned import.
The questions appear under **零基础阶梯进阶英语（一）→ 综合题型练习**:

```sh
npm run course:check -- courses/step-up-english-1
npm run course:install -- courses/step-up-english-1
```

See the [v2 schemas](../../../contracts/course/v2/README.md) and the original
[design specification](v2-question-types-specification.md). The application
supports nine total types: the specification counted the revised true/false
contract as an additional type.

Related: [TTS architecture](../tts/deepseek-tts-architecture.md) and
[workspace projection](../../../internal/storage/workspace.go).
