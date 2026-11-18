---
id: 0058
type: fix
status: open
labels: []
branch: fix/0058-align-http-contracts-v2-docs-palace-prompts-and-study-ui
created: 2026-11-18
---
# Align HTTP contracts, v2 docs, palace prompts, and study UI

## 背景 / 目标

对核心协议（`contracts/course/`、`contracts/http/openapi.yaml`、`docs/features/question-types/`）与核心代码库（`internal/`、`web/src/`）的交叉审计发现以下实质分叉与模式间不一致：

1. **HTTP 契约与生成类型漂移**（`contracts/http/openapi.yaml`、`web/src/api/generated/types.gen.ts`）：
   - `subject` / `subject_id` 参数及 `ReviewBook.subject_id` 仍硬编码 `enum: [1, 4]`（使 TS 生成 `subject_id: 1 | 4`），而实际 `course_units.id` 从 `101` 起分配并支持任意激活课程单元。
   - `Question` 缺少 `number_tolerance`；`CourseItemReview` 缺少 `course.Item` 已序列化的多数字段（`passage`、`subtype`、`requirements`、`min_words`、`max_words`、`direction`、`source_text`、`chapter`、`image`、`audio`、`transcript`、`explanation_audio`、`hint`）；部分接口缺少 `Error` 响应 schema。
2. **后端模型与记忆宫殿提示漂移**（`internal/study/question_content.go`、`internal/palace/prompt.go`）：
   - `ProjectExtended` 将原始 `course.Item`（含 `Concepts`）整体挂到 `QuestionReview`，违背 `internal/course/model.go` 关于概念标签不进入学习端/提示词的约束。
   - `renderExtendedPrompt` 对 `listening` 清理了 `Transcript` 却未清理 `Passage`，导致 `audio.mode: "passage"` 在 `QUESTION_TEXT` 与 `<listening_transcript>` 中重复发送短文。
3. **跨学习模式 UI 缺漏与 `true_false` 选项不一致**（`web/src/features/`）：
   - `PalaceSource.tsx` 遗漏 `numeric` 答案展示与选项 `OptionAudio`，且对扩展题仍渲染禁用空输入与未分离的 `ExtendedReview`。
   - `TerminalFeedback.tsx` 遗漏扩展题 `ClozePassage` / `ReadingPassage` / `WritingRequirements` / `TranslationSource` 与顶层 `analysis`/`skill`，并用硬编码字母代替 `optionSymbol`。
   - `ExamQuestion.tsx` / `ExamWorkspace.tsx` 对带自定义选项文本或选项音频的 `true_false` 隐藏了选项列表与音频，且键盘 `1`/`2` 按数组下标而非 `boolean_value` 映射。
   - 另有多处细节不一致：`practice/QuestionCard.tsx` 在仅含 `analysis_audio` 或 `skill` 时跳过 `QuestionExplanation`；`AnalysisPage.tsx` 对 `numeric` 和 v2 扩展题最近作答展示空白；`practice/QuestionPreview.tsx` 为写作展示禁用空框并缺少 `OptionAudio`；`TerminalDialogs.tsx` 中 `WritingCriteria` 与 `ReviewAnalysis` 顺序与练习/背题不一致。
4. **v2 规格文档滞后**（`docs/features/question-types/v2-question-types-specification.md`）：
   - 仍引用旧组件名、`ClozeBlank.explanation` 类型与过时的 `listening` / `writing` / `translation` 判分及示例描述。

## 关键功能清单（Key Feature List，KFL）

1. **修复 HTTP OpenAPI 契约与生成类型**：移除 `subject`/`subject_id` 的 `enum: [1, 4]` 限制，补齐 `Question.number_tolerance`、`CourseItemReview` 字段及缺失的 `Error` schema，并运行 `npm run generate:api` 同步生成类型。
2. **修复后端概念隔离与记忆宫殿提示去重**：在 `ProjectExtended` 中清除 `QuestionReview.Concepts`；在 `renderExtendedPrompt` 中对 `listening` 同时清理 `Passage`，并补充单元测试。
3. **对齐全学习模式 UI 与自定义判断题交互**：修复 `PalaceSource.tsx`、`TerminalFeedback.tsx`、`ExamQuestion.tsx` / `ExamWorkspace.tsx`、`practice/QuestionCard.tsx`、`practice/QuestionPreview.tsx`、`AnalysisPage.tsx`、`TerminalDialogs.tsx`，并补充单元测试或 E2E 验证。
4. **同步更新 `docs/features/question-types/v2-question-types-specification.md`**：与当前 v2 schema 和实现保持一致。

## 改造面

- `contracts/http/openapi.yaml`、`web/src/api/generated/`
- `internal/study/question_content.go`、`internal/palace/prompt.go` 及对应 Go 测试
- `web/src/features/{palace,exam,practice,analysis,question-types}/` 及对应测试
- `docs/features/question-types/v2-question-types-specification.md`

## 非目标

- 不改动 v1/v2 课程包协议的判分语义或已有课程包题库内容。
- 不修改数据库 schema 或历史迁移。

## 验收标准（Acceptance Criteria，AC）

1. `npm run check:generated` 无漂移，`openapi.yaml` 与 `types.gen.ts` 不再限制 `subject_id` 为 `1 | 4`，且包含 `number_tolerance` 与完整 `CourseItemReview` 字段。
2. `QuestionReview` 不再暴露 `Concepts`；`listening` `passage` 模式宫殿提示词不重复输出短文。
3. `PalaceSource`、`TerminalFeedback`、考试自定义 `true_false` 选项、`AnalysisPage`、`QuestionPreview` 与 `TerminalDialogs` 在全部 9 种题型下与课程/练习/背题规范一致。
4. `npm run check` 全套检查与 `npm run issue:check` 全部通过。

## 讨论

- 修改 `openapi.yaml` 后先执行 `npm run generate:api` 再进行前端类型检查与测试，确保前后端与 OpenAPI 契约零漂移。
