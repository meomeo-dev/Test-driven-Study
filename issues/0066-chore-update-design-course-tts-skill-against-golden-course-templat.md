---
id: 0066
type: chore
status: closed
closed-by: b359144f50dc13fbb726a019e787c4c4bf1cd78d
labels: []
branch: chore/0066-update-design-course-tts-skill-against-golden-course-templat
created: 2026-11-19
---
# Update design-course-tts skill against golden-course-template

## 背景 / 目标

随着 `courses/golden-course-template`（含全部 9 类题型、v2 扩展字段 `passage_tts`、`sample_response` 分段数组、`source_text_tts`、`reference_translation_tts`、全大写 `tts.text` 改写、钟点时间/换行改写、听力三模式等）及前后端多态重构的落地，`.agents/skills/design-course-tts/` 原有的字段矩阵、引擎陷阱、代码符号及审计脚本规则需要全面对齐最新实现。本 Issue 通过 9 路分题型 Swarm 审查汇总并修订 `design-course-tts` 技能包，并明确 `.gitignore` 对仓库技能目录 `.agents/skills/`（含 `.agents/skills/design-course-tts/`）的放行追踪边界。

## 关键功能清单（Key Feature List，KFL）

1. **技能文档与元数据同步**：
   - 更新 `.agents/skills/design-course-tts/SKILL.md`、`references/placement-and-segmentation.md` 与 `agents/openai.yaml`，补全 9 类题型放置决策、`listening` 三模式、防剧透可见性、真实 Go/TS 符号、`tts.text` 改写细则及 `golden-course-template` 全 9 类题型正例。
2. **审计工具、规则与单测升级**：
   - 同步 `scripts/audit-course-tts.mjs` `--help` 文案，扩展 `scripts/lib/audit.mjs`（28 条规则：18 `error` + 10 `warning`，修复 `override` 绕过、代码行误报、数学算符、`listening.passage`/非听力 `transcript`、`writing` `\n`、反向译文与 `cloze` 占位符校验），并将 `tests/audit-course-tts.test.mjs` 扩充至 6 组覆盖全部 9 类题型的单测。
3. **版本控制边界明确与提交**：
   - 在 `.gitignore` 显式保留 `!.agents/skills/` 与 `!.agents/skills/design-course-tts/`，确认全部技能文件纳入仓库提交。

## 改造面

- `.agents/skills/design-course-tts/`（`SKILL.md`、`agents/openai.yaml`、`references/placement-and-segmentation.md`、`scripts/audit-course-tts.mjs`、`scripts/lib/audit.mjs`、`tests/audit-course-tts.test.mjs`）
- `.gitignore`

## 非目标

- 不修改业务课程包 `courses/golden-course-template/` 内容或应用 Go/React 运行代码。

## 验收标准（Acceptance Criteria，AC）

1. `node --test .agents/skills/design-course-tts/tests/audit-course-tts.test.mjs` 6/6 通过。
2. `node .agents/skills/design-course-tts/scripts/audit-course-tts.mjs courses/golden-course-template --json` 与 `courses/elementary-chinese` 返回 0 issue；`pnpm run course:check courses/golden-course-template` 与 `pnpm run issue:check` 通过。
3. `.agents/skills/design-course-tts/` 全部文件均被 Git 追踪且无未合并分支或遗留 worktree。

## 讨论

- `.agents/skills/design-course-tts/` 此前未被 `.gitignore` 忽略（仅 `.claude/skills/` 被忽略）；本 Issue 仍于 `.gitignore` 显式追加否定规则作为防护性声明。
