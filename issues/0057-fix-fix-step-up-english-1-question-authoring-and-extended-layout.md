---
id: 0057
type: fix
status: open
labels: []
branch: fix/0057-fix-step-up-english-1-question-authoring-and-extended-layout
created: 2026-11-18
---
# Fix step-up-english-1 question authoring and extended layout

## 背景 / 目标

对 `courses/step-up-english-1` 的只读审查发现两部分紧密相关的问题：

1. **题库编排与一致性缺陷**（`courses/step-up-english-1/questions/extended-practice.json` 等）：
   - `numbers-1`、`numbers-3`、`numbers-5` 的 `explanation` 硬编码了选项字母（如 `b`、`a 和 c`），在练习模式数字标号（`1–4`）、背题模式大写字母（`A–D`）以及模拟考选项洗牌（`shuffleExamOptions`）下会失效或误导。
   - 6 道复合题（`cloze`、`listening`、`reading_comprehension`）均缺少父级 `analysis` / `explanation`，导致背题解析区为空或模拟考复盘显示“原题暂无解析。”。
   - `sue1-extended-reading-single-choice` 父 `stem` 泛化且仅包裹 1 道子题；全单元混用 `explanation` 与 `analysis`、混用布尔 `tts: true` 与对象 `{"voice": "stella"}`、仅 3 题有 `chapter`、`sue1-extended-judgment` 缺少中文题干指令、缺少课程定位说明。
2. **扩展题前端区域边界混淆**（`web/src/features/`）：
   - `translation` 的待译原文 `source_text` 渲染在作答/参考答案栏（`.question-answers`）而非题干区（`.question-stem`），且练习提交后仍保留输入框导致“你的译文”重复展示。
   - `cloze` 与 `listening` 在背题模式下直接渲染交互式空白 `ExtendedQuestion` + `ExtendedReview`，把填空/小题的解析内容放进“选项与答案”栏，而“答案解析”栏为空；模拟考复盘在有小题解析时仍回退显示“原题暂无解析。”。

本 Issue 旨在逐项修复 `step-up-english-1` 题库质量问题，并使 `cloze`、`listening`、`translation` 的题干/作答/解析边界与现有 `reading_comprehension`、`writing` 保持一致。

## 关键功能清单（Key Feature List，KFL）

1. **修复 `courses/step-up-english-1` 题库内容与元数据**：
   - 改写 `numbers-1`、`numbers-3`、`numbers-5` 解析，仅引用选项或答案的真实内容文本，消除字母标号依赖。
   - 为全部 6 道复合题补充简洁准确的父级 `analysis`；完善 `sue1-extended-reading-single-choice` 题干并补充第 2 道单选题使其符合阅读理解体裁。
   - 统一 `chapter`、`analysis`、`tts` 对象格式（保留 `listening` 评测所需的 `speed: 0.9`），为 `sue1-extended-judgment` 增加中文题干包装，更新 `course.json` 版本号并在 `courses/step-up-english-1/README.md` 明确演示单元与 `syllabus_180h.json` 草案边界。
2. **统一扩展题题干、作答与解析的前端分层**：
   - 将 `translation` 的 `source_text` 与 `cloze` 的阅读短文移入题干区（`.question-stem`），练习提交后隐藏 `translation` 编辑框避免重复。
   - 参照 `reading_comprehension` 与 `writing` 的模式，在背题模式与详情弹窗中区分“选项与答案”和“答案解析”，将 `cloze` / `listening` / `translation` 的分项参考答案保留在答案区，分项解析渲染在 `QuestionExplanation` / `FullExplanation` 解析区。
   - 修正 `TerminalDialogs.tsx` 与 `PalaceSource.tsx` 对复合题的空解析兜底文案判断。
3. **测试与校验更新**：
   - 保持 `internal/course/extended_test.go`、`internal/study/extended_question_test.go`、`internal/palace/extended_prompt_test.go` 契约稳定并补充断言。
   - 更新并扩展 `tests/browser/question-types.spec.ts`，验证 `cloze`、`listening`、`translation`、`reading_comprehension` 在背题、练习与考试复盘下的区域分工。

## 改造面

- `courses/step-up-english-1/course.json`、`README.md`、`questions/extended-practice.json`
- `web/src/features/question-types/`、`web/src/features/memorization/`、`web/src/features/practice/`、`web/src/features/exam/`、`web/src/features/palace/`
- `internal/course/extended_test.go`、`internal/study/extended_question_test.go`、`tests/browser/question-types.spec.ts`

## 非目标

- 不在本 Issue 中把 `syllabus_180h.json` 扩充为完整的 90 小时正式课程包或将其加入 `courses/defaults.json`。
- 不修改 `courses/beginner-english/` 或 `courses/elementary-chinese/` 的题库内容。

## 验收标准（Acceptance Criteria，AC）

1. `npm run course:check -- courses/step-up-english-1` 通过，15 题全部保持 v2 schema 与语义校验通过，无硬编码字母选项引用，全部题目有规范 `chapter` 与父级解析。
2. 背题模式与练习模式下，`translation` 原文与 `cloze` 短文展示在“题干与图例”区；`cloze`、`listening`、`translation` 的分项解析展示在“答案解析”区而非混入“选项与答案”区；考试复盘在已有解析时不显示“原题暂无解析。”。
3. `npm run typecheck`、`npm run test:unit`、`npm run test:go`、`npm run test:e2e`（或完整 `npm run check`）全部通过。

## 讨论

- `internal/study/extended_question_test.go` 依赖 15 题顺序下标（如 `rows[3]`、`rows[5]`）及 `sue1-extended-listening` 的 `speed: 0.9` 设置，修改题库时需保持 15 题顺序与该语音参数不变。
