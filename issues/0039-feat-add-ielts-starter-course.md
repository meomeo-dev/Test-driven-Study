---
id: 0039
type: feat
status: closed
closed-by: bab935cd382ab1a12237459651b7936a9087d95e
labels: []
branch: feat/0039-add-ielts-starter-course
created: 2026-11-11
---
# Add IELTS starter course

## 背景 / 目标

Provide an original IELTS starter set in the shared workspace and verify the configured AI providers.

## 关键功能清单（Key Feature List，KFL）

- Twenty numbered tasks across Listening, Reading, Writing and Speaking.
- Versioned local listening audio in the shared question screens.
- A decision on the ownership of course-specific AI teaching prompts.

## 改造面

Course package and v1 media validation, shared question screens, and a design note under course-platform.

## 非目标

Full-length IELTS simulation, band scoring, and a runtime change to AI prompt ownership.

## 验收标准（Acceptance Criteria，AC）

- Cover all six Listening and eleven Reading families, both Writing tasks, and all three Speaking parts.
- Install the package, play local audio, and access open response tasks in the guide.
- Exercise the app connection check for both configured providers without generating paid output.

## 讨论

Academic and General Training use common Listening and Speaking material. Include a General Training letter option in Writing Task 1 and a workplace reading text.
