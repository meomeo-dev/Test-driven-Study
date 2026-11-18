---
id: 0060
type: fix
status: closed
closed-by: ae89c9524e2fc57e468dd8b12fcb3003d2f64c0b
labels: []
branch: fix/0060-fix-step-up-english-1-tts-design-and-segmentation
created: 2026-11-18
---
# Fix step-up-english-1 TTS design and segmentation

## 背景 / 目标

依据 `.agents/skills/design-course-tts/` 对 `courses/step-up-english-1/questions/extended-practice.json` 进行审查后发现 28 条 TTS 审计警告及若干一致性问题：

1. 两道 `reading_comprehension` 的 `passage` 把全大写标题、换行符和正文 3 句话揉进同一个 `tts` 切片（`COARSE_TTS_SEGMENT`）。
2. 三道 `listening` 题的纯英文 `sub_questions[].stem` 与 `options` 完全未加 `tts`，与阅读题全量配音的做法割裂。
3. 全部 15 题的 `analysis`（以及 `cloze` `blanks[].explanation`）存在英文词句混排未切分或同句只配一半的问题（如 `sue1-extended-writing` 只给 `has been moved to Friday` 配音却漏掉 `The delivery`）。
4. `sue1-extended-judgment` 题干含刻意构造的错词 `equipments`，需只对合法词形配音或谨慎处理，避免让 TTS 读出错误词形。

本 Issue 按 `design-course-tts` 规范逐项修复 `courses/step-up-english-1/` 的 TTS 与切片设计，并同步更新关联测试。

## 关键功能清单（Key Feature List，KFL）

1. **细化阅读短文 `passage` 切片**：将 `sue1-extended-reading` 与 `sue1-extended-reading-single-choice` 的 `passage` 拆分为标题与单句 `tts: {"voice": "stella"}` 切片，空格与 `\n` 留在纯 `text` 切片。
2. **统一听力子题干与选项 TTS**：为 `sue1-extended-listening`、`sue1-extended-listening-passage`、`sue1-extended-listening-recording` 的纯英文 `sub_questions[].stem` 与 `options` 均匀补全 `tts: {"voice": "stella"}`（时间表达 `"At 10:00 a.m."` 等按需配 `tts.text`），保留 `sue1-extended-listening` 测试要求的 `speed: 0.9`。
3. **补全 `analysis` 与 `blanks[].explanation` 切片**：将全部题目解析中内嵌的英文词句拆分为规范的三段包夹 `tts` 切片（去掉包裹引号，标点归位）。
4. **安全处理 `sue1-extended-judgment`**：仅对有效单词 `equipment` 配 `tts: {"voice": "stella"}`，不将错误词形 `equipments` 送入 TTS。
5. **版本与测试对齐**：将 `courses/step-up-english-1/course.json` 升级至 `1.2.6`，更新 `tests/browser/question-types.spec.ts` 中对分段后阅读短文朗读的断言（如需要），确保 `audit-course-tts.mjs`、`course:check` 与 `npm run check` 全部通过。

## 改造面

- `courses/step-up-english-1/course.json`、`courses/step-up-english-1/questions/extended-practice.json`
- `tests/browser/question-types.spec.ts`、`internal/course/extended_test.go`（如需）

## 非目标

- 不重新合成离线录音文件 `courses/step-up-english-1/assets/audio/delivery-delay.mp3`。
- 不改变 `courses/beginner-english/` 或 `courses/elementary-chinese/` 的题库内容。

## 验收标准（Acceptance Criteria，AC）

1. `node .agents/skills/design-course-tts/scripts/audit-course-tts.mjs courses/step-up-english-1 --json` 输出 `issueCount: 0`（退出码 `0`）。
2. `npm run course:check -- courses/step-up-english-1`、`npm run issue:check` 与 `npm run check`（含 `test:go`、`test:unit`、`test:e2e`）全部通过。

## 讨论

- `internal/study/extended_question_test.go` 依赖 15 题顺序及 `sue1-extended-listening` 的 `transcript[1].tts.speed: 0.9`；改造过程中保持其不变。
