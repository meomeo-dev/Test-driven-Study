---
id: 0062
type: feat
status: open
labels: []
branch: feat/0062-modularize-frontend-question-types-into-9-independent-module
created: 2026-11-18
---
# Modularize frontend question types into 9 independent modules

## 背景 / 目标

虽然 `#61` 已将前后端题型标识统一为 9 个语义化字符串并使用强类型联合分派，但前端 `web/src/features/question-types/` 的文件组织仍按横切环节拆分（`QuestionStimulus`、`ExtendedQuestion`、`ExtendedReference`、`ExtendedReview`、`ExtendedExplanations`），导致修改单一题型需跨多个文件寻找对应 `case`，且存在 `QuestionAudio.tsx` 反向依赖 `registry.ts`、`WrittenFeedback.tsx` 反向依赖 `WritingContent.tsx`、部分辅助组件超过 30/300 行信号阈值以及外部模式直接引用内部文件等问题。

依据已评审通过的架构与 UML 设计文档 [frontend-question-modules-design.md](../docs/features/question-types/frontend-question-modules-design.md)，本 Issue 将 `web/src/features/question-types/` 重构为单一 Package 下“5 层严格无环 DAG + 9 个独立题型模块 + 共享内部原语 + 统一出口 Facade”。

## 关键功能清单（Key Feature List，KFL）

1. **断开反向依赖（L0 解耦）**：在 `web/src/components/QuestionAudio.tsx` 本地定义 `QuestionAudioSource`（保留 5 种媒体题型判别式），移除对 `features/question-types/registry` 的向上引用；将 `writingRubricLabel` 移入 `shared/format.ts`。
2. **建立 L1 共享原语与契约（`shared/`）**：拆出 `contracts.ts`、`format.ts`、`ChoicePrimitives.tsx`、`PartOptions.tsx`、`SubQuestionParts.tsx`、`SubQuestionReview.tsx`、`WrittenFeedback.tsx`，保持单文件 `<= 300` 行与辅助函数 `<= 30` 行。
3. **拆出 L2 9 个独立题型模块（`types/`）**：建立 `single-choice.tsx`、`multiple-choice.tsx`、`true-false.tsx`、`numeric.tsx`、`cloze/{index,components}.tsx`、`listening/{index,components}.tsx`、`reading-comprehension/{index,components}.tsx`、`writing/{index,components}.tsx`、`translation/{index,components}.tsx`，互不交叉引用。
4. **建立 L3 注册表与 L4 统一出口（`registry.ts`, `facade/`, `index.ts`）**：实现 `QuestionTypeRegistry` 映射表与关联联合分派器（`dispatchQuestion`、`dispatchPublicQuestion`、`dispatchFullQuestion`、`dispatchCourseReview`），并收口 `practice/`、`memorization/`、`exam/`、`palace/`、`analysis/`，全部只从 `../question-types` 导入。
5. **不变量保护与全量测试**：完整保留 §6 全部交互、范文位置、解析隔离、空格跳转 `#clozeId-N`、快捷键、CSS 级联与 `@ts-expect-error` 类型隔离测试，补充结构边界/依赖检验并通过 `npm run check`。

## 改造面

- `web/src/components/QuestionAudio.tsx`
- `web/src/features/question-types/`（新结构 `shared/`、`types/`、`facade/`、`registry.ts`、`index.ts`，移除旧散落文件）
- `web/src/features/{practice,memorization,exam,palace,analysis}/`（收敛导入至 `../question-types` 并经由 facade 分派）
- `web/src/features/question-types/{registry,model}.test.ts` 与 `tests/browser/`

## 非目标

- 不改动 Go 后端、SQLite schema、OpenAPI 契约或课程包 JSON 内容。
- 不合并练习/背题/考试/宫殿各自不同的选择题按钮 DOM/CSS 壳。

## 验收标准（Acceptance Criteria，AC）

1. 依赖流向严格满足 `L5 -> L4 -> L3 -> L2 -> L1 -> L0`：L0 不导入 `features/question-types/`，L1 不导入 `types/`/`registry`/`facade`，9 个 `types/*` 互相零引用且不引用 `registry`/`index`，L5 模式文件不绕过 `question-types/index.ts` 导入内部实现。
2. 所有修改/新建的前端组件文件 `<= 300` 行、辅助函数保持精炼（遵循 `AGENTS.md`），CSS 样式与全部 9 题型练习/背题/考试/宫殿/分析行为无任何回归。
3. `npm run issue:check` 与完整 `npm run check`（含 `typecheck`、`test:unit`、`test:go`、`test:startup`、`build`、`test:e2e`）全部通过。

## 讨论

- 完整目录结构、UML 类图/包图/时序图与 TypeScript 关联联合签名见 [frontend-question-modules-design.md](../docs/features/question-types/frontend-question-modules-design.md)。
