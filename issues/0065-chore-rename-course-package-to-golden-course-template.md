---
id: 0065
type: chore
status: open
labels: []
branch: chore/0065-rename-course-package-to-golden-course-template
created: 2026-11-19
---
# Rename course package to golden-course-template

## 背景 / 目标

v2 全题型示范课程目前使用原历史命名 `courses/step-up-english-1` 与 `course_id: "step-up-english-1"`，与其“黄金标准课程模板”（涵盖全部 9 类题型、v2 声明式 TTS、复盘与记忆宫殿规范）定位不一致。本 Issue 将该课程包目录、包标识（`course_id`）及课程标题统一重命名为 `golden-course-template`（**黄金标准课程模板 → 题型展示**），将原 `syllabus_180h.json` 课程大纲草案归档至 `docs/research/step-up-english-1/`，并同步更新所有测试、文档与本地运行数据库。

## 关键功能清单（Key Feature List，KFL）

1. **重命名课程包目录与元数据**：
   - 将 `courses/step-up-english-1` 移动至 `courses/golden-course-template`，并将无关的 `syllabus_180h.json` 移入 `docs/research/step-up-english-1/syllabus_180h.json`。
   - 更新 `courses/golden-course-template/course.json`：`course_id` 为 `"golden-course-template"`、`title` 为 `"黄金标准课程模板"`、`version` 为 `"1.0.0"`，保留既有 `unit.id`（`"extended-practice"`，`title: "题型展示"`）及题目稳定 ID。
2. **更新测试与配置引用**：
   - 同步更新 `playwright.config.ts`、`tests/browser/question-types.spec.ts`、`internal/course/extended_test.go`、`internal/palace/extended_prompt_test.go`、`internal/storage/migration_00016_test.go`、`internal/study/type_matrix_test.go` 与 `internal/study/extended_question_test.go`。
3. **更新文档与重启验证**：
   - 更新 `courses/golden-course-template/README.md`、`docs/features/`、`.agents/skills/design-course-tts/`、`README.md`、`CHANGELOG.md`、`handoff.md`。
   - 从本地 `var/study.sqlite` 的 `active_courses` 移除旧 `step-up-english-1` 条目并安装 `golden-course-template@1.0.0`，通过全量校验并重启服务。

## 改造面

- `courses/golden-course-template/`（原 `courses/step-up-english-1/`）及 `docs/research/step-up-english-1/syllabus_180h.json`
- `playwright.config.ts`、`tests/browser/question-types.spec.ts` 与 `internal/{course,palace,storage,study}/*_test.go`
- `docs/features/`、`.agents/skills/design-course-tts/`、`README.md`、`CHANGELOG.md`、`handoff.md`

## 非目标

- 不修改历史已关闭 issue 文件与 `review/step-up-english-1/` / `docs/research/step-up-english-1/` 中已有研究报告正文。
- 不修改题目内既有的 `source_item_id`（如 `sue1-extended-*`），以免打破历史测试用例与答案格式兼容性。

## 验收标准（Acceptance Criteria，AC）

1. `pnpm run course:check courses/golden-course-template` 与 `node .agents/skills/design-course-tts/scripts/audit-course-tts.mjs courses/golden-course-template --json` 全部通过（0 issue）。
2. `pnpm run issue:check` 与 `pnpm run check`（`test:unit`、`test:go`、`test:startup`、`build`、`test:e2e`）全部通过。
3. 本地数据库安装 `golden-course-template@1.0.0` 且停用旧 `step-up-english-1` 后，`/api/courses` 返回 `id: "golden-course-template"`、`title: "黄金标准课程模板"`、`units[0].title: "题型展示"`，服务正常可用。

## 讨论

- 原 `step-up-english-1` 仅在本仓库早期演示环境使用，且从未放入 `courses/defaults.json`；本机 `var/study.sqlite` 通过停用旧 `active_courses` 并重新安装 `golden-course-template` 避免重复课程卡片。
