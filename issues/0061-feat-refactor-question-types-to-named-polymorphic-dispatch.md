---
id: 0061
type: feat
status: closed
closed-by: 4d2c69a254a9bc32005fb8881864267564516c50
labels: []
branch: feat/0061-refactor-question-types-to-named-polymorphic-dispatch
created: 2026-11-18
---
# Refactor question types to named polymorphic dispatch

## 背景 / 目标

当前运行链路把课程协议中的 9 种语义题型压平为魔法数字 `1..9` 与扁平大结构体，并通过负向黑名单（如 `internal/course/extended.go` 的 `item.Type != Reading` 与 `web/src/components/QuestionAudio.tsx` 的 `question_type === readingQuestionType`）过滤不合法字段，导致完形填空（`cloze`）因其 `passage` 字段被误投影为听力逐字稿并渲染“听力录音 / 查看逐字稿”。

完整架构设计见 [polymorphic-question-type-architecture.md](../docs/features/question-types/polymorphic-question-type-architecture.md)。本 Issue 将全栈题型标识与分派机制升级为语义命名枚举 + 编译期/运行期穷举多态分派。

## 关键功能清单（Key Feature List，KFL）

1. **统一语义类型 `QuestionType`**：以 `single_choice`、`multiple_choice`、`true_false`、`numeric`、`cloze`、`listening`、`reading_comprehension`、`writing`、`translation` 替代 Go、SQLite、OpenAPI 与 TypeScript 中的 `1..9` 数字编号。
2. **Go 领域与存储穷举注册表**：在 `internal/course` 与 `internal/study` 建立覆盖全部 9 种题型的 `ItemKind` / `TypeHandler` 注册表；取消 `Item.ListeningLines()` 对非听力题 `passage` 的泛化投影及 `workspace.go` 预投影；用显式 `ToPublic(vis)` 替代 JSON 往返脱敏。
3. **OpenAPI 可辨识联合与前端类型收窄**：在 `contracts/http/openapi.yaml` 用 `oneOf` + `discriminator` 拆分 `PublicQuestion`、`Question`、`CourseItemReview`（5 种支持媒体的题型 vs 4 种非媒体扩展题型严格隔离），重新生成 TS 类型，在前端建立 `QUESTION_TYPE_REGISTRY` 与穷举 `switch` + `assertNever`，移除 `QuestionAudio` 的 `!== readingQuestionType` 黑名单与各处数字编号/字段猜测。
4. **SQLite 迁移与历史快照兼容**：通过 `00016_semantic_question_type.sql` 重建 `questions` 表（`TEXT NOT NULL CHECK (...)`）并清理 `workspace:%` 重投影状态，同时通过自定义 `UnmarshalJSON` 只读兼容历史 `mock_exams`、`practice_question_snapshots` 与 `palace_jobs` 中的数字编号并清洗旧脏逐字稿。
5. **9 题型全矩阵回归测试**：补全 Go 投影/泄题/拒答矩阵、`tsc` 负向类型约束及 Playwright 跨题型正/负向隔离断言。

## 改造面

- `contracts/course/v2/items.schema.json`、`contracts/http/openapi.yaml`、`web/src/api/generated/`
- `internal/course/`、`internal/storage/`（含 `migrations/` 与 `storedb/`）、`db/queries.sql`、`sqlc.yaml`、`internal/study/`、`internal/palace/`、`internal/httpapi/`
- `web/src/components/`、`web/src/features/{question-types,practice,memorization,exam,palace,analysis}/`
- `tests/browser/` 及 Go / Vitest 单元测试

## 非目标

- 不改写历史 `mock_exams`、`practice_question_snapshots`、`answer_attempts` 或 `palace_jobs` 中的原始 JSON 快照记录。
- 不变更现有课程包 JSON 的业务语义与题库内容。

## 验收标准（Acceptance Criteria，AC）

1. Go、SQLite `questions.question_type`、OpenAPI 与 TypeScript 全部使用 9 个语义类型字符串，不再依赖魔法数字 `1..9` 或黑名单判断；`cloze`、`reading_comprehension`、`writing`、`translation` 在类型系统与运行时均不可产出或渲染听力音频与逐字稿。
2. 含历史数字编号及旧 `cloze` 脏逐字稿的快照可正常解码且不泄露听力 UI；`sqlc` 与 `@hey-api/openapi-ts` 生成无漂移。
3. `npm run check`（`check:generated`、`test:unit`、`test:go`、`test:startup`、`build`、`test:e2e`）与 `npm run issue:check` 全部通过。

## 讨论

- 详细迁移步骤、Schema 约束与组件拆分契约见 [polymorphic-question-type-architecture.md](../docs/features/question-types/polymorphic-question-type-architecture.md)。
