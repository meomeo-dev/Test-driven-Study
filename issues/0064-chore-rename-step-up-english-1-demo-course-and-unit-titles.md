---
id: 0064
type: chore
status: closed
closed-by: 1b49fe8d98ef5e0c374dfa6b8a971404735af6ea
labels: []
branch: chore/0064-rename-step-up-english-1-demo-course-and-unit-titles
created: 2026-11-19
---
# Rename step-up-english-1 demo course and unit titles

## 背景 / 目标

`courses/step-up-english-1` 当前在 `course.json` 中的课程名称为“零基础阶梯进阶英语（一）”，唯一激活的单元名称为“综合题型练习”。由于该课程包目前作为所有 9 种题型与前端组件的演示/模板课程，名称应更准确地体现其组件与题型展示用途：课程名改为“标准课程模板”，单元（Lesson）名改为“题型展示”，同时保持 `course_id`（`step-up-english-1`）与 `unit.id`（`extended-practice`）稳定不变以保留既有学习记录。

## 关键功能清单（Key Feature List，KFL）

1. 将 `courses/step-up-english-1/course.json` 的 `title` 改为 `"标准课程模板"`、单元 `title` 改为 `"题型展示"`、描述改为对应说明，并将 `version` 递进至 `"1.2.8"`（保持 `course_id` 和单元 `id` 不变）。
2. 同步更新 `courses/step-up-english-1/README.md`、`docs/features/question-types/README.md` 与 `handoff.md` 中的课程名与单元名。
3. 验证课程包、安装更新到 `var/study.sqlite` 并重启本地服务。

## 改造面

- `courses/step-up-english-1/course.json`、`courses/step-up-english-1/README.md`
- `docs/features/question-types/README.md`、`handoff.md`

## 非目标

- 不修改 `course_id`（`step-up-english-1`）与单元 `id`（`extended-practice`），也不修改未接入的 `syllabus_180h.json` 草案或题目内容。

## 验收标准（Acceptance Criteria，AC）

1. `pnpm run course:check -- courses/step-up-english-1` 与 `pnpm run issue:check` 全部通过。
2. `step-up-english-1@1.2.8` 安装至本地数据库后，`/api/courses` 返回课程标题 `标准课程模板` 与单元标题 `题型展示`，既有题目 ID 与学习记录保持不变。
3. 相关单元测试、Go 测试、前后端构建与浏览器测试通过，本地服务正常运行。

## 讨论

- `syllabus_180h.json` 为独立历史大纲草案（未接入 `course.json`），保持原样。
