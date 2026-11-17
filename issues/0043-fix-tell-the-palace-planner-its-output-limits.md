---
id: 0043
type: fix
status: closed
closed-by: 7488b9f020ae8983f4b0f0cb64b5ebf1b7ed8e04
labels: []
branch: fix/0043-tell-the-palace-planner-its-output-limits
created: 2026-11-11
---
# Tell the palace planner its output limits

## 背景 / 目标

The general-course planner requested structured JSON without telling the model
its field limits. A recorded IELTS plan returned ten pitfalls against a limit
of eight, and later drafts also exceeded the scene limit.

## 关键功能清单（Key Feature List，KFL）

- Include the validator's field limits in the first request's instructions and
  structured output schema.
- Record the specific validation error and include it in a replacement request.
- Store the general-course research and planning instructions as text files.

## 改造面

Memory palace planning instructions, field validation, and execution traces.

## 非目标

Changes to course package profiles, question assistant prompts, model budgets,
or image provider limits.

## 验收标准（Acceptance Criteria，AC）

- The first structured request includes character and array limits.
- A plan with ten pitfalls is replaced after the model receives the field limit.
- Search notes, source verification and image submission retain their roles.

## 讨论

The IELTS course image template is separate from the question assistant and
the shared planner's instructions. See the
[course AI prompt design](../docs/features/course-platform/course-ai-prompts.md).

Go tests and 13 browser cases passed. Provider fixtures verified the first
request's schema and instructions, correction of a ten-item draft, and use of
the base schema after explicit rejection of a length keyword.
