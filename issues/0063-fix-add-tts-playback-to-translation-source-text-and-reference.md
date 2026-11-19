---
id: 0063
type: fix
status: open
labels: []
branch: fix/0063-add-tts-playback-to-translation-source-text-and-reference
created: 2026-11-19
---
# Add TTS playback to translation source text and reference

## 背景 / 目标

翻译题（`translation`）的 `source_text` 与 `reference_translation` 在 `contracts/course/v2/items.schema.json`、`contracts/http/openapi.yaml`、`internal/course/extended.go`、`internal/study/` 及前端 `types/translation/components.tsx` 中均仅作为纯字符串建模与渲染，缺少与写作题 `writing.sample_response_tts` 对齐的声明式 TTS 配置与内联播放控件。用户在背题与练习页查看 `#sue1-extended-translation`（“将下列交班提示译成中文。原文 Leave the signed checklist on the front desk.”）时无法朗读英文原文。

本 Issue 旨在参照 `sample_response_tts` 模式，为 `translation` 题型补齐 `source_text_tts` 与 `reference_translation_tts` 的全栈契约、后端投影、前端 `RichContent` 渲染、`step-up-english-1` 演示题目配置及审计/文档/测试覆盖。

## 关键功能清单（Key Feature List，KFL）

1. **契约与后端支持**：
   - 在 `contracts/course/v2/items.schema.json` 的 `translation` 属性中增加可选的 `source_text_tts` 与 `reference_translation_tts`（引用 `../v1/items.schema.json#/$defs/ttsConfig`）。
   - 在 `contracts/http/openapi.yaml` 中为 `TranslationContent` 和 `TranslationItemReview` 增加 `source_text_tts`（及为 `TranslationItemReview` 增加 `reference_translation_tts`），运行 `npm run generate:api` 更新 `web/src/api/generated/`。
   - 在 `internal/course/extended.go`、`internal/study/question_content.go` 与 `internal/study/type_projection.go` 增加对应字段与 `projectTranslation` 投影，保持非媒体题型边界（不触发 `QuestionAudio` 听力栏，也不在 `Content` 泄露参考译文）。
2. **前端 `translation` 模块渲染**：
   - 在 `web/src/features/question-types/types/translation/components.tsx` 的 `TranslationSource` 与 `TranslationReference` 中通过 `RichContent` 渲染带 `source_text_tts` / `reference_translation_tts` 的内容，保持 `lang` 属性与 5 层模块 DAG 约束（`<= 300` 行/文件）。
3. **课程内容、文档、Skill 审计与测试**：
   - 为 `courses/step-up-english-1/questions/extended-practice.json` 中的 `sue1-extended-translation` 补充 `source_text_tts: {"voice": "stella"}`，为 `sue1-extended-translation-zh-to-en` 补充 `reference_translation_tts: {"voice": "stella"}`，并递进 `courses/step-up-english-1/course.json` 版本号（`1.2.6` → `1.2.7`）。
   - 同步更新 `docs/features/question-types/` 与 `.agents/skills/design-course-tts/`（文档及 `audit.mjs` 检查规则与单测）。
   - 补充 Go 投影单测、前端模块单测与 Playwright 端到端测试（验证背题与练习模式下翻译原文/参考译文 TTS 合成与负载）。

## 改造面

- `contracts/course/v2/items.schema.json`、`contracts/http/openapi.yaml`、`web/src/api/generated/`
- `internal/course/extended.go`、`internal/study/question_content.go`、`internal/study/type_projection.go` 及 Go 单测
- `web/src/features/question-types/types/translation/components.tsx` 及前端单测
- `courses/step-up-english-1/course.json`、`courses/step-up-english-1/questions/extended-practice.json`
- `docs/features/question-types/`、`.agents/skills/design-course-tts/`、`tests/browser/question-types.spec.ts`

## 非目标

- 不更改 `translation` 的 `source_text` / `reference_translation` 为 `ContentSegment[]` 数组结构（继续沿用 `string + *_tts` 对象模式，与 `writing.sample_response_tts` 一致）。
- 不为纯中文的翻译文本强行开启 TTS。

## 验收标准（Acceptance Criteria，AC）

1. `npm run course:check -- courses/step-up-english-1` 与 `node .agents/skills/design-course-tts/scripts/audit-course-tts.mjs courses/step-up-english-1 --json` 全部通过（0 issue）。
2. 在背题、练习与复盘页面中，`#sue1-extended-translation` 的“原文”栏显示内联播放按钮并携带 `{ text: "Leave the signed checklist on the front desk.", voice: "stella" }` 请求 `/api/tts/synthesize`；`zh_to_en` 参考译文同样支持朗读；不暴露参考译文或触发听力 `QuestionAudio`。
3. `npm run check:generated`、`npm run issue:check` 与 `npm run check`（typecheck、unit、Go、startup、e2e）全部通过。

## 讨论

- 沿用 `writing.sample_response_tts`（commit `711325c`）已确立的 `string + *_tts` 设计，保持 v2 课程题库向后兼容。
