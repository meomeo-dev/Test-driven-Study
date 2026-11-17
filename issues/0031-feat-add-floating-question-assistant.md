---
id: 0031
type: feat
status: closed
closed-by: 3ccb88b489f0ee4a441383ac71eeb43960b696d3
labels: []
branch: feat/0031-add-floating-question-assistant
created: 2026-11-08
---
# Add floating question assistant

## 背景 / 目标

Add a floating AI tutor for questions in memorization and practice. Reuse the
existing Responses provider, credentials, proxy and web-search settings. Compare
chat dependencies using the local AI dependency knowledge base and current
primary sources. Generate an original cartoon traffic-officer avatar after
checking public uniform references.

## 关键功能清单（Key Feature List，KFL）

- Floating avatar opens an accessible, responsive conversation panel.
- Freely move and resize the panel, remember its geometry and restore defaults.
- Render assistant Markdown and hide the floating avatar while the window is open.
- Preserve source links, bound tables/code to the window, and block executable
  HTML, dangerous protocols and remote message-image requests.
- Conversations remain scoped to the current question and support follow-ups.
- Reuse the existing LLM settings and hosted web-search capability.
- Show generation, cancellation, failures and verified source links clearly.
- Document dependency selection and the avatar references and generation prompt.

## 改造面

Go LLM service and HTTP contract, memorization/practice/palace pages, chat components,
local provider fixtures, browser checks and feature documentation.

## 非目标

Mock-exam assistance, changes to study grading, new provider configuration,
automatic retries of paid requests and impersonation of an official service.

## 验收标准（Acceptance Criteria，AC）

- The avatar opens and closes the panel using pointer and keyboard controls.
- The floating launcher keeps submission, retry and question navigation reachable.
- Pointer and touch dragging/resizing, keyboard adjustment, preference recovery
  and viewport changes keep window controls visible without clearing messages.
- The server loads the selected question and its options, answer and explanation.
- Follow-up turns use only the same question's conversation history.
- Switching questions cancels in-flight work and prevents stale replies.
- Responses use the configured LLM and search setting through the existing proxy.
- No assistant appears in the independent mock-exam terminal.
- Local fixtures verify success, follow-ups, search citations, errors and aborts.
- Desktop/mobile layouts and production build pass relevant checks.

## 讨论

Requested on 2026-11-08. External dependency research uses an isolated subagent
with public requirements only. Local knowledge-base records are inspected locally.
The character is an original educational cartoon, with its AI identity visible.

Selected assistant-ui 0.15.33 with LocalRuntime and an owned Go NDJSON adapter.
The research agent also completed the explicitly requested local-only knowledge
base check after external research ended. The avatar uses checked summer-duty
colors and a fictional geometric cap mark. See the canonical
[feature description](../docs/features/assistant/README.md) and
[dependency comparison](../docs/technical-selection/question-chat/2026-11-08.md).

Acceptance on 2026-11-08 passed the full `npm run check` gate, with 90 browser
cases including 14 assistant cases, 17 frontend unit tests, all Go tests, four
startup checks, generated-file verification and the production build. Canonical
screenshots are linked from the feature description. Local fixtures exercised
the provider behavior without paid model calls. Vite's chunk-size advisory is
recorded in the dependency comparison.

Follow-up requested on 2026-11-08 adds freely adjustable window size and position.
Use the title bar for movement, the bottom-right grip for independent resizing,
and a restore-default control. Local browser preferences retain the geometry.

The subsequent feedback adds Markdown rendering and hiding the avatar entry
while the window is open. The isolated agent compared public rendering libraries
and reconciled local knowledge-base records. The selected adapter and GFM plugin
are documented in the dependency comparison.

Final combined acceptance passed 98 browser cases, 28 frontend unit tests, all Go
tests, four startup checks, generated-file verification and the production build.
