---
id: 0059
type: feat
status: closed
closed-by: 8185fff075b70ec269db614f42ebd679133f43be
labels: []
branch: feat/0059-add-design-course-tts-repository-skill
created: 2026-11-18
---
# Add design-course-tts repository skill

## 背景 / 目标

仓库已有 `.agents/skills/maintain-deepseek-tts-audio/` 用于静态句库的离线预合成维护，但缺少指导课程包（`courses/<id>/questions/*.json`）声明式 TTS 与本地音频设计的仓库级技能。通过对 `beginner-english`、`elementary-chinese` 及代码库 TTS 引擎/前端渲染逻辑的调研，需要将“何时使用 TTS、哪些内容应避免直出 TTS、如何切分 `ContentSegment[]` 与 `transcript[]`、如何设置音色与选项一致性”沉淀为仓库技能 `design-course-tts`，并据此对 `courses/step-up-english-1/` 做系统审查。

## 关键功能清单（Key Feature List，KFL）

1. **新建仓库技能 `.agents/skills/design-course-tts/`**：
   - 遵循 `meta-create-skills` 与仓库 `.agents/skills/maintain-deepseek-tts-audio/` 规范编写中文 `SKILL.md`、`agents/openai.yaml` 与 `references/`（含放置矩阵、内容筛查与 `tts.text`/本地拼音替代规则、切分与标点边界规范、常见代码陷阱与正反案例）。
   - 提供可独立运行的 Node 标准库自检脚本 `scripts/audit-course-tts.mjs`（支持 `--help`、`--json`、退出码 `0–3`）及单元测试，可自动检测课程包题库中的 TTS 设计缺陷（如混用 `tts: true`、选项漏配、挖空与 `tts` 共存、片段首尾空白/反引号/引号未剥离、裸字母/音标/错拼/数字符号未处理、听力原文泄漏到题干等）。
2. **基于新技能审查 `courses/step-up-english-1/`**：
   - 使用新技能规则与审查脚本对 `courses/step-up-english-1/` 进行逐题 TTS 审查，输出清晰的问题清单与改造建议。

## 改造面

- `.agents/skills/design-course-tts/`（`SKILL.md`、`agents/openai.yaml`、`references/`、`scripts/`、`tests/`）

## 非目标

- 本 Issue 仅创建课程 TTS 编写技能并完成对 `courses/step-up-english-1/` 的审查报告；除非明确要求，不在此分支直接重写 `step-up-english-1` 题库。
- 不修改运行时后端 `internal/tts/` 或离线句库维护技能 `maintain-deepseek-tts-audio`。

## 验收标准（Acceptance Criteria，AC）

1. `.agents/skills/design-course-tts/SKILL.md` 及关联 `references/`、`agents/openai.yaml` 符合仓库与 `meta-create-skills` 结构要求，清晰覆盖位置决策、内容过滤、分段切分、音色与协议坑点。
2. 审查脚本 `scripts/audit-course-tts.mjs` 自带帮助与 JSON 输出且自身单元测试通过；在 `elementary-chinese`、`beginner-english`、`step-up-english-1` 上运行结果可复现、符合预期。
3. `npm run issue:check` 与相关脚本测试通过，并输出针对 `courses/step-up-english-1/` 的完整 TTS 审查结论。

## 讨论

- 与 `maintain-deepseek-tts-audio` 明确分工：`maintain-deepseek-tts-audio` 负责静态音频文件的离线批处理与校验；`design-course-tts` 负责课程 JSON 题库中声明式 `tts`、`tts.text`、`pinyin`、`transcript`、`explanation_audio`、`sample_response_tts` 的设计与审查。
