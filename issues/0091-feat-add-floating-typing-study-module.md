---
id: 0091
type: feat
status: closed
closed-by: f3b744b
labels: [frontend, study, english, typing]
branch: feat/0091-add-floating-typing-study-module
created: 2026-11-27
---
# Add floating typing study module

## 背景 / 目标

Learners studying language and general courses in memorization, post-submit
practice, and memory-palace review currently read or listen to questions and
reference answers passively without an interactive, sentence-by-sentence typing
drill.

Add a draggable, resizable floating 「打字学习」 module modeled on the existing
「问问本题」 floating window (`QuestionAssistant`), offering an interactive
sentence-by-sentence underline typing workflow built directly from the current
question and its correct answer. The drill must support English, Chinese, and
mixed-language sentences, guard Chinese IME composition against premature error
checks before Hanzi are committed, and provide a typewriter-style vertical
auto-scroll effect when a question spans multiple sentences.

## 关键功能清单（Key Feature List，KFL）

1. **Sentence extraction across all 9 question types (`web/src/features/typing/extract.ts`)**:
   - Extract ordered typing sentences from the current question and its correct
     answer (`single_choice`, `multiple_choice`, `true_false`, `numeric`,
     `cloze` with filled blanks and target-word highlights,
     `reading_comprehension` with aligned `study_translation` hints,
     `listening` with speaker transcripts and aligned translations, `writing`
     with `sample_response`, and `translation` with source text and reference
     translation).
   - Split multi-sentence text cleanly across English and Chinese punctuation
     without breaking abbreviations (`a.m.`, `p.m.`, `Mr.`, decimals) or
     parenthetical glosses.
   - Classify each sentence's language (`en`, `zh`, `mixed`, `neutral`) and
     preserve optional TTS/pinyin speech metadata when present.
   - Provide scope filters (`全部` for question + answer by default, `仅英文`
     when bilingual, `仅答案`) and guided vs. recall (`跟打` / `默写提示`)
     display modes.
2. **IME-safe typing engine (`web/src/features/typing/engine.ts`)**:
   - Evaluate committed characters against the active sentence with ergonomic
     typographic punctuation normalization (`‘’`/`'`, `“”`/`"`, `–—`/`-`,
     full-width/half-width punctuation) and case-insensitive English matching.
   - Defer error grading during active IME composition (`compositionstart`,
     `compositionupdate`, `compositionend`, and `isComposing`) so partial
     Pinyin never triggers false errors.
   - Apply a secondary CJK-target pending-Pinyin guard so trailing ASCII
     letters typed against a Chinese character position stay in a calm pending
     state until Hanzi are committed, while wrong committed Hanzi are flagged
     immediately.
   - Support incremental word/character hints (`Tab`) and recall masking.
3. **Floating underline typewriter UI (`web/src/features/typing/`)**:
   - Reuse the floating-window geometry/interaction model (draggable title bar,
     resizable corner handle, persistent geometry key, reset & close buttons)
     using `@radix-ui/react-dialog` (`modal={false}`) and `tokens.css` tokens.
   - Render one focused sentence at a time with an underline typing area
     (`横线区域`) that keeps native OS IME candidate popups anchored to the
     caret.
   - Render a typewriter vertical roll that automatically scrolls completed
     sentences upward and advances focus smoothly to the next sentence, plus a
     completion summary with accuracy, elapsed time, retry, and optional next
     question navigation.
4. **Study surface integration without answer leakage**:
   - Mount floating 「打字学习」 launchers on `MemorizationPage` and
     `PalacePage` (positioned cleanly alongside 「问问本题」).
   - Mount a compact 「打字学习」 button in `PracticePage` (`PageHeader`) that
     remains disabled before submission and activates only with the revealed
     graded question after answer submission.
   - Keep `ExamPage` completely untouched and independent.

## 改造面

- `web/src/features/assistant/windowGeometry.ts`,
  `web/src/features/assistant/useWindowGeometry.ts` (parameterize storage key
  and default window bounds while preserving existing defaults).
- `web/src/features/typing/` (`extract.ts`, `engine.ts`, `TypingLine.tsx`,
  `TypingPanel.tsx`, `TypingStudy.tsx`, `typing.css`, `extract.test.ts`,
  `engine.test.ts`).
- `web/src/features/memorization/MemorizationPage.tsx`,
  `web/src/features/practice/PracticePage.tsx`,
  `web/src/features/practice/PracticeSession.tsx`,
  `web/src/features/practice/PageHeader.tsx`,
  `web/src/features/palace/PalacePage.tsx`.
- `tests/browser/typing-study.spec.ts`.

## 非目标

- Adding backend endpoints, SQLite migrations, or persistent typing history
  storage.
- Exposing 「打字学习」 in mock exams or before practice answer submission.
- Modifying existing question-bank content, audio assets, or question-type
  registry cross-import boundaries.

## 验收标准（Acceptance Criteria，AC）

1. Unit tests (`npm run test:unit`) verify sentence extraction for all 9
   question types, Chinese IME composition deferral, CJK pending-Pinyin guard,
   punctuation normalization, recall masking, and hint progression.
2. Playwright browser E2E tests (`tests/browser/typing-study.spec.ts`) verify:
   - Opening the floating 「打字学习」 window in Memorization, typing on the
     underline area, and auto-scrolling through multi-sentence questions.
   - Chinese IME composition (`compositionstart` -> partial Pinyin ->
     `compositionend`) never flags premature errors before Hanzi commit.
   - Practice page disables 「打字学习」 before submission (no answer leak)
     and enables it with the revealed question after submission.
   - Responsive mobile viewport has zero horizontal overflow and clean Escape
     dismissal.
3. `npm run issue:check`, `npm run typecheck`, `npm run test:unit`,
   `npm run build`, and `npm run test:e2e` pass with every new source/CSS file
   staying within 300 lines.

## 讨论

- Keeping the typing drill strictly client-side preserves the offline-first
  study invariant (no account, AI credential, or backend dependency) while
  reusing existing `AudioControls` when course TTS metadata is present.
- Rendering a real auto-growing underline `<textarea>` directly beneath the
  character-by-character feedback line preserves native OS Chinese IME
  candidate popup positioning on macOS and Windows.

### Verification

- `npm run typecheck`: passed (`tsc --noEmit`, 0 errors).
- `npm run test:unit`: passed (`20/20` Vitest files, `96/96` tests, including
  `web/src/features/typing/engine.test.ts` and `extract.test.ts`).
- `npx vite build` & `node scripts/build-api.mjs`: passed (lazy
  `TypingPanel` chunk `8.78 kB` gzipped; compiled `var/bin/test-driven-study`).
- `npx playwright test tests/browser/typing-study.spec.ts`: passed (`3/3`
  Playwright browser tests covering cloze/writing typewriter auto-scroll,
  Chinese IME composition + uncommitted Pinyin guard, Practice pre-submit
  protection, and mobile viewport bounds).
- Full Playwright suite run observed `29/30` existing tests passing; one
  unrelated pre-existing failure in `tests/browser/courses.spec.ts:192` expects
  `10` `beginner-english` units while `main` (`8d0aa78`) expanded the course to
  `12` units.
- `node scripts/issue-check.mjs` and `git diff --check`: passed (`91/91`
  issues valid).
