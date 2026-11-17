---
id: 0050
type: feat
status: closed
closed-by: 388f1f4300dc0bd8ff1c1306253b1d11d52abc53
labels: []
branch: feat/0050-add-a-full-width-lesson-reading-view-to-course-guides
created: 2026-11-13
---
# Add a full-width lesson reading view to course guides

## 背景 / 目标

The subject guide renders a course package unit in the driving guide's three
columns: 学习建议, 学习内容 and 考试内容. The two outer columns hold one generated
sentence each, so a unit lesson of 150–230 lines reads in a third of the article.
Global style resets also flatten its Markdown: headings, lists and code blocks
render as plain body text. Give course lessons a full-width reading view.

## 关键功能清单（Key Feature List，KFL）

- In course guides the lessons fill the article body as one scrolling reading
  pane with a bounded line length.
- 学习建议 and 考试内容 move into the summary row beside 考试形式.
- Lesson Markdown keeps its structure: headings move below the unit heading
  (`#` → h3, `##` → h4, `###` → h5) with distinct sizes; bulleted and numbered
  lists, inline code and code blocks are styled with the shared tokens.
- Changing the unit opens the next lesson at its beginning.

## 改造面

`web/src/features/guide/`, `web/src/styles/guide.css`, the guide browser tests
and the subject-guide feature documentation. No API or course package changes.

## 非目标

The driving guide layout, lesson anchors for individual concepts, tables or
images in lessons, and a table of contents.

## 验收标准（Acceptance Criteria，AC）

- At 1440×900 a course lesson pane spans the article width; its text column is
  bounded for reading.
- Lesson headings are exposed at levels 3–5 and code blocks render as
  preformatted text.
- 学习建议 and 考试内容 appear in the summary row; a unit without questions
  omits 考试内容.
- Switching units resets the lesson scroll position.
- At 390×844 in the dark theme the page does not overflow the viewport.
- The driving guide cases keep passing; `npm run check` passes.

## 讨论

Course guides reuse the driving guide's data shape, whose prerequisite and exam
lists hold one generated sentence for package units.
