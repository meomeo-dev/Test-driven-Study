---
id: 0053
type: feat
status: closed
closed-by: 80e22ebf8e28eadff3c413efafcd47534048005e
labels: []
branch: feat/0053-add-elementary-chinese-pinyin-worksheet
created: 2026-11-17
---
# Add elementary Chinese pinyin worksheet

## 背景 / 目标

Add an elementary Chinese course and digitize the supplied first-grade, first-term
pinyin worksheet, exercise four of the 2026 school year.

## 关键功能清单（Key Feature List，KFL）

- A bundled course with a first-grade pinyin unit.
- The tracing and copying exercise in the subject guide for paper practice.
- Seven final-and-tone blanks, three whole-syllable selections in worksheet row
  order, and six illustrated pronunciation choices in the graded question bank.

## 改造面

Course manifest, lesson, question data, cropped illustrations, and the bundled
course list. Use the shared catalog and study workspace.

## 非目标

Handwriting recognition, changes to the question protocol, and the rest of the
elementary Chinese curriculum.

## 验收标准（Acceptance Criteria，AC）

- The local catalog opens 小学语文 and lists all 16 graded items in worksheet order.
- Each choice item has at most four options.
- The guide presents the `míng liàng` tracing and copying exercise.
- The practice screen serves the original diagrams and grades finals, tones,
  whole syllables and illustrated choices with the worksheet answer key.

## 讨论

The supplied photo is the transcription source. Store only cropped printed
illustrations in the package. The student's identifying details, responses and
teacher marks are excluded from the course data.
