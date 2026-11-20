---
id: 0081
type: fix
status: open
labels: [ui, tts, vocabulary]
branch: fix/0081-align-vocabulary-tts-controls-with-shared-inline-pair
created: 2026-11-20
---
# Align vocabulary TTS controls with shared inline pair

## 背景 / 目标

In the vocabulary notebook dialog, `VocabularyNotebook.tsx` previously passed
`allowRegenerate={false}` (hiding the standard Regenerate button) and laid out
example sentences with `justify-content: space-between`, pushing TTS buttons to
the far right edge of the wide dialog instead of placing the standard
play/stop + regenerate pair directly after the text like `RichContent`.

## 关键功能清单（Key Feature List，KFL）

- Restore the standard two-button `(播放/停止 + 重新生成)` pair on both
  vocabulary terms and examples by removing `allowRegenerate={false}`.
- Scope `targetLabel` to regenerate button `aria-label` in `AudioControls.tsx`
  while preserving default labels when omitted.
- Flow example TTS controls inline directly at the end of the English example
  text instead of flexing them to the far right edge in `vocabulary.css`.
- Update `tests/browser/vocabulary.spec.ts` to assert both buttons, force-regen
  requests, inline proximity to text, and mobile layout.

## 改造面

- `web/src/components/AudioControls.tsx`
- `web/src/features/vocabulary/VocabularyNotebook.tsx`
- `web/src/features/vocabulary/vocabulary.css`
- `tests/browser/vocabulary.spec.ts`

## 非目标

- Changing schemas, course packages, or Go backend endpoints.

## 验收标准（Acceptance Criteria，AC）

- Both `term` and `example` entries show the two-button TTS pair inline right
  after the English text, matching `RichContent` layout across the app.
- Clicking regenerate triggers `{ force: true }` synthesis requests.
- `npm run typecheck`, `npm run test:unit`, and Playwright `vocabulary.spec.ts`
  pass cleanly on desktop and 375px mobile.

## 讨论

Using inline `<p className="vocabulary-example-line"><span>{example}</span><AudioControls /></p>`
inherits `.tts-audio-controls` inline spacing (`margin-left: 6px; vertical-align: middle`)
directly from `study.css` without drifting across wide modals.
