---
id: 0063
type: fix
status: closed
closed-by: e5084ebe509e4328755724e2dda0d903c1529200
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
3. **写作多段范文分段 TTS 与判断题整句 TTS（验收补充）**：
   - 将 `contracts/course/v2/items.schema.json`、`contracts/http/openapi.yaml`、`internal/course/` 与前端 `WritingSample` 扩展为支持 `sample_response` 为按段拆分的 `ContentSegment[]` 数组（同时保留纯字符串 + `sample_response_tts` 兼容），并将 `sue1-extended-writing-short` 与 `sue1-extended-writing-full` 拆为每段独立可朗读的对象。
   - 将 `sue1-extended-judgment` 题干英文整句（`"The word equipment normally takes the plural form equipments."`）合并为完整 TTS 切片，避免仅朗读单词 `equipment`。
   - 检查全库纯大写英文 TTS，为 `sue1-extended-reading-single-choice` 的 `"LOCKER ROOM NOTICE"` 补充小写/句式化 `tts.text`（`"Locker room notice."`），并在 `audit-course-tts` 中增加 `ALL_CAPS_TTS_WITHOUT_OVERRIDE` 规则。
   - 为完形填空（`cloze`）增加仅下发至复盘载荷（`ClozeItemReview`）的 `passage_tts` 字段，支持在不向未作答练习/考试泄露答案的前提下，在背题与交卷后按完整填入句子播放 TTS（`sue1-extended-cloze`）。
4. **课程内容、文档、Skill 审计与测试**：
   - 为 `courses/step-up-english-1/questions/extended-practice.json` 中的 `sue1-extended-translation` 补充 `source_text_tts: {"voice": "stella"}`，为 `sue1-extended-translation-zh-to-en` 补充 `reference_translation_tts: {"voice": "stella"}`，并递进 `courses/step-up-english-1/course.json` 版本号（`1.2.6` → `1.2.7`）。
   - 同步更新 `docs/features/question-types/` 与 `.agents/skills/design-course-tts/`（文档及 `audit.mjs` 检查规则与单测）。
   - 补充 Go 投影单测、前端模块单测与 Playwright 端到端测试（验证背题与练习模式下翻译原文/参考译文、大作文逐段参考范文与判断题整句 TTS 合成与负载）。

## 改造面

- `contracts/course/v2/items.schema.json`、`contracts/http/openapi.yaml`、`web/src/api/generated/`
- `internal/course/extended.go`、`internal/course/item_kind.go`、`internal/course/extended_grading.go`、`internal/study/question_content.go`、`internal/study/type_projection.go` 及 Go 单测
- `web/src/features/question-types/types/translation/components.tsx`、`web/src/features/question-types/types/writing/components.tsx`、`web/src/features/question-types/types/cloze/` 及前端单测
- `courses/step-up-english-1/course.json`、`courses/step-up-english-1/questions/extended-practice.json`
- `docs/features/question-types/`、`.agents/skills/design-course-tts/`、`tests/browser/question-types.spec.ts`

## 非目标

- 不更改 `translation` 的 `source_text` / `reference_translation` 为 `ContentSegment[]` 数组结构（继续沿用 `string + *_tts` 对象模式，与单句写作 `sample_response_tts` 一致）。
- 不为纯中文的翻译文本强行开启 TTS。

## 验收标准（Acceptance Criteria，AC）

1. `npm run course:check -- courses/step-up-english-1` 与 `node .agents/skills/design-course-tts/scripts/audit-course-tts.mjs courses/step-up-english-1 --json` 全部通过（0 issue）。
2. 在背题、练习与复盘页面中，`#sue1-extended-translation` 的“原文”栏显示内联播放按钮并携带 `{ text: "Leave the signed checklist on the front desk.", voice: "stella" }` 请求 `/api/tts/synthesize`；`zh_to_en` 参考译文同样支持朗读；不暴露参考译文或触发听力 `QuestionAudio`。
3. `#sue1-extended-writing-full` 与 `#sue1-extended-writing-short` 的“参考范文”按段落拆分为多个切片对象，每段独立显示并播放该段 TTS；`#sue1-extended-judgment` 点击播放朗读完整英文判断句而非单个单词。
4. `npm run check:generated`、`npm run issue:check` 与 `npm run check`（typecheck、unit、Go、startup、e2e）全部通过。

## 讨论

- 沿用 `writing.sample_response_tts`（commit `711325c`）已确立的 `string + *_tts` 设计，保持 v2 课程题库向后兼容。
