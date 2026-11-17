---
id: 0041
type: feat
status: closed
closed-by: 845575c9d0cf66cdd9d08c633a7612d8eb4a8662
labels: []
branch: feat/0041-version-course-ai-teaching-profiles
created: 2026-11-11
---
# Version course AI teaching profiles

## 背景 / 目标

Let each course release supply its own teaching guidance for the question assistant and memory palace.

## 关键功能清单（Key Feature List，KFL）

- Optional validated assistant guidance and palace templates.
- Version-specific profile resolution with shared provider and execution policy.
- Persistent profile provenance for conversations and image jobs.

## 改造面

Course manifest and installation, question context, assistant and memory palace flows, and the bundled IELTS and Yunnan courses.

## 非目标

Provider configuration changes, essay or recording submission, and new generation stages.

## 验收标准（Acceptance Criteria，AC）

- The same course can resolve two installed profile versions independently.
- IELTS and Yunnan use their own teaching content. Existing history, pause, resume, and image-only retries remain valid.

## 讨论

See the [design](../docs/features/course-platform/course-ai-prompts.md) and [execution plan](../plans/20261111_course-ai-profiles_execution-plan.yaml).
