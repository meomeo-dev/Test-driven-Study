# Recorded Subject 1 simulator: BV1PS4y1J7qb

Reviewed: 2026-11-03. Reference classification: **historical third-party simulator**.

## Source

| Attribute | Value |
| --- | --- |
| Video | [科目一考场真实模拟](https://www.bilibili.com/video/BV1PS4y1J7qb/) |
| Uploader | 八十岁老学姐 |
| Platform upload date | 2022-07-13 |
| Downloaded media | 1440 × 1080, 4:3, H.264 video and AAC audio |
| Duration | 17:38.112 |
| File size | 93,445,214 bytes |
| Transport | Explicit configured proxy; no direct fallback |
| Local video | `var/research/exam-terminal/bv1ps4y1j7qb/source.mp4` |

The application visibly identifies itself as **驾校一点通**. The result dialog
explicitly describes a simulated examination. The opening screen includes a
remaining-use allowance, and the ending offers score sharing. These are direct
indicators of a training product. The video does not establish the actual
candidate software, examination center, province or deployment version in 2026.

Upload date and the device's July 13 clock do not establish the date or provenance
of an official terminal. The video's title is not evidence of official deployment.

The completed video and extraction working files remain in the ignored `var/` tree.
The opening screen's identification number is not reproduced in this report.

## Layout visible in the recording

Coordinates are approximate pixels in the recorded 1440 × 1080 image, not CSS
dimensions or measurements of a physical examination monitor.

| Region | Approximate bounds | Contents |
| --- | --- | --- |
| Device overlay | y=0–25 | Tablet status indicators; outside the simulated terminal. |
| Candidate column | x=32–183, y=32–483 | Station, avatar, candidate fields, vehicle class, subject and countdown. |
| Question area | x=191–950, y=32–417 | Question number, stem and vertically listed A–D descriptions. |
| Selection strip | x=191–950, y=417–492 | Selected answer at left; compact √/× or A–D buttons at right. |
| Answer table | x=950–1412, y=32–492 | Ten column headers, ten row headers and 100 answer cells. |
| Operation strip | x=32–1412, y=493–582 | Question-type instruction at left; previous, next and submit at right. |
| Picture area | x=32–1412, y=583–1060 | Large centered question illustration; otherwise blank. |

The active examination does not retain the opening screen's large title banner.
Its visual treatment uses a pale warm background, blue fieldset labels and
separators, a light-blue table header, black question text, and rectangular white
buttons with gray borders. The question, selection and operation areas retain
their geometry when an illustration appears below them.

The watermark and tablet status bar are recording/device elements. A small
circular back control is also visible at the lower left; its ownership by the
exam application or its host is not established. These elements do not establish
required PC examination controls, desktop scaling or a 16:9 layout.

## Observed interaction sequence

Times refer to the downloaded video, not its on-screen countdown.

| Time | Visible state or transition | Supported conclusion |
| --- | --- | --- |
| 00:00–00:04 | Two-column preparation screen with instructions, candidate details and start control. | A separate pre-exam step is present. |
| 00:06 | Question 1 appears; remaining time is 44:58. | Starting enters the fixed examination workspace and runs the countdown. |
| 04:35 | Question 26 has √ selected; the same choice appears in the blue current table cell. | Selection is shown before the wrong-answer feedback. |
| 04:40 | A wrong-answer dialog for question 26 overlays question 27; it shows expected × and selected √. | Assessment occurs on leaving the question; next content can already be loaded behind the dialog. |
| 04:45 | Question 27 is available; question 26's selected √ is red in the table. | The incorrect committed response remains visible. |
| 07:00 | Question 44 has A–D controls and a large illustration below the operation strip. | The picture occupies its own lower region. |
| 13:27–13:35 | B is selected for question 89, then its wrong-answer dialog appears; the countdown continues behind it. | This example displays corrective feedback without pausing the examination timer. |
| 15:19–15:20 | The current question changes directly from 100 to 34. | Returning nonsequentially to an unanswered question is supported. The exact touch target is not visible. |
| 15:26 | Question 14 becomes current while the rest of the paper remains filled. | Additional skipped questions can be revisited. |
| 17:15 | Submission confirmation shows 96 correct, 4 incorrect and 0 unanswered, with confirm/continue controls. | This simulator exposes correctness counts before final confirmation. |
| 17:31 | A result dialog reports 96 points and a pass; close and share controls are present. | The completed simulated paper produces a scored result. |

The opening instructions explicitly state that **下一题** evaluates the selected
answer and that an answer cannot be changed after feedback. The sequence above
supports the next-question assessment path. Selection alone is not equivalent to
the separate submit-current-answer action in the existing learning-style mock UI.
The recording does not establish all assessment triggers for previous-question,
table-cell navigation, missing selections or final submission.

The wrong-answer dialog contains the original stem, an illustration when present,
expected and selected answers, a confirmation button, and an automatic-close
countdown. Its observed countdown starts at ten seconds in the later example.
No long explanation column is displayed in this workflow.

## Answer-table semantics

- Empty cells represent unanswered positions; blue identifies the current cell.
- Judgment cells contain the chosen √ or ×. A black × means the candidate chose
  “false”; it is not itself an incorrect-answer marker.
- Single-choice cells contain the chosen letter. Incorrect committed selections
  are red; correct committed selections remain dark.
- The completed example has judgment symbols in its first 40 positions and
  letters in its final 60. This establishes this simulator's example order.
- The four red responses agree with the confirmation's four errors and 96-point
  result. Numerous black × symbols must not be counted as errors.

## Applicability to the application

The mock page implements the user-selected recording's geometry, compact option
controls, persistent answer table, lower picture region, modal feedback and
submission flow. It uses its own fixed light palette, independently of the site's
themes. Answer commitment and navigation share one database transaction.

The implementation extends commitment to previous-question and answer-table
navigation. These paths, keyboard shortcuts and multi-choice adaptations are
explicit application behaviors.

The source does not demonstrate Subject 4, keyboard shortcuts, timeout handling,
the five-minute warning, failure-limit termination or every answer-revision path.
Its four-error result cannot establish the automatic-stop threshold.


