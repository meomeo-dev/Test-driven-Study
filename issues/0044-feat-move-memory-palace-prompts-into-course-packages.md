---
id: 0044
type: feat
status: closed
closed-by: 530f4976879d2ee0b1cf1c2f61fcc71727c1e54e
labels: []
branch: feat/0044-move-memory-palace-prompts-into-course-packages
created: 2026-11-12
---
# Move memory palace prompts into course packages

## 背景 / 目标

Course authors need to control how their material is researched, planned and
turned into a memory image. Generic and driving planner prompts currently
live in the platform even when the course supplies an image template.

## 关键功能清单（Key Feature List，KFL）

- Version the three memory palace prompt resources with each course.
- Use independent IELTS, Yunnan driving and Basic Math resources.
- Copy editable generic prompts into every newly scaffolded course.

## 改造面

Course manifests, package storage and scaffold, LLM planning, and image prompt
composition.

## 非目标

Changes to question assistant behavior, provider settings, tool permissions,
the structured plan contract, or historical saved images.

## 验收标准（Acceptance Criteria，AC）

- Research and planning receive the resources of the selected course version.
- The image endpoint receives the course image template and validated scene.
- Existing packages and paused tasks retain compatible defaults.
- A scaffolded package validates and works with the three generated resources.

## 讨论

The platform owns the execution protocol, including source validation and
structured output. The course owns the teaching prompts for each stage.

All three packages and a freshly scaffolded package passed validation.
`npm run check` passed, including 118 browser cases. The standalone planning
endpoint sent each course's two LLM prompts to a local provider fixture.
An upgrade rehearsal retained the prior course versions and learning records.
