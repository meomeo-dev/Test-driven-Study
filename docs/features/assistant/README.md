# Question assistant

Open **交规小助手** from the practice toolbar or the floating traffic-officer
cartoon in memorization and memory palace. The assistant can discuss the current
question, options, explanation and memory aids.

## Conversation behavior

- The panel identifies the current question and provides three starter prompts.
- Opening the panel hides its launcher. Closing it restores the launcher.
- Each opening fills the viewport height with 12-pixel top/bottom margins, including
  when old preferences contain a short window. The title and one-line question
  context use a compact header; hovering the question exposes the full text.
- The chat runtime is downloaded on first activation. The library owns request
  cancellation when its question-scoped runtime unmounts.
- The floating launcher sits above the question action footer. The practice
  launcher shares the toolbar. Drag the title bar to move the window and the
  bottom-right grip to resize it.
- Focus the title bar or resize grip and use arrow keys for 10-pixel adjustments.
  Hold Shift for 1-pixel adjustments. **恢复默认窗口** restores the initial layout.
- Saved width and horizontal placement are restored across reloads and study pages.
  Height and vertical placement expand on each opening. Manual dragging/resizing
  remains available while open. Viewport changes keep controls within visible bounds.
  When browser storage is blocked, adjustments remain available in page memory.
- Enter sends a message. Shift+Enter inserts a newline. Composition through a
  Chinese input method follows the composer library's IME handling.
- Replies stream incrementally. Stop cancels local waiting and the upstream
  HTTP request. Upstream processing or billing can continue after cancellation.
- Closing the panel preserves its conversation while that question stays mounted.
- Changing questions or selecting another conversation cancels in-flight work.
  Saved conversations restore when returning to their question or reloading.
- **新建对话** preserves earlier conversations. **历史对话** lists the current
  question or all questions; selecting another question switches its context too.
- Conversations, messages, citations and interrupted states are saved in SQLite.
  See [conversation persistence](conversations.md) for storage and recovery.
- Each user message is limited to 2,000 Unicode characters. Requests contain at
  most 24 messages and 32,000 total characters. Replies are capped at 8,192 output
  tokens and 8,000 accepted text characters, within the configured output limit.
- Failed or stopped assistant messages are excluded from subsequent model input.
  Errors remain visible and require a deliberate new submission.
- Assistant text supports Markdown headings, paragraphs, lists, emphasis, links,
  quotes, GFM tables, strikethrough and code fences. User messages remain plain text.
  Raw HTML and message-image loading are disabled; links accept HTTP(S) only.

## Provider and question context

The panel's **LLM 设置** control opens the existing provider dialog on its
Responses tab. Base URL, OS credentials, explicit proxy, default model, reasoning
effort, output budget and search preference come from the same LLM service used
for palace planning. No credentials are sent to the browser.

The UI uses `POST /api/llm/conversations/{conversation}/messages` with a unique
turn ID and new user text. The server supplies saved conversation history.
The legacy `POST /api/llm/chat` also accepts bounded user/assistant history.
The server loads the original question, option signs, answer, explanation and
memory skill from SQLite. The existing image resolver supplies local original
images and animation-frame samples to the model. Client-supplied question facts
are rejected by the request contract.

The endpoint reuses the existing HTTP provider and Responses stream parser.
NDJSON events are `status`, `delta`, `done` and `error`. Only a completed provider
response produces `done`. An interrupted stream remains a failed reply, and
uncertain paid requests are not automatically replayed.

When existing search settings require retrieval, the same hosted `web_search`
tool and `gov.cn` domain restriction are applied. A completed reply must contain
actual retrieval activity and usable official source records. Source links appear
below the reply, with at most 12 source links. The search-off setting keeps
question-bank explanation available and labels it **未联网核验**.

The service bounds each request to three minutes. Its HTTP write deadline is
extended only for this streaming handler. The ordinary API deadlines retain
their existing behavior.

## References and acceptance

- [Dependency decision](../../technical-selection/question-chat/2026-11-08.md)
- [Avatar references and exact generation prompt](../../ui/assistant/README.md)
- [HTTP contract](../../../contracts/http/openapi.yaml)
- [Browser acceptance cases](../../../tests/browser/question-assistant.spec.ts)
- [Window layout checks](../../../tests/browser/assistant-window.spec.ts)
- [Markdown rendering checks](../../../tests/browser/assistant-markdown.spec.ts)
- [Persistence acceptance](../../../tests/browser/assistant-history.spec.ts)
- [LLM regression cases](../../../internal/llm/chat_test.go)

Current verification and service state are recorded in the dated
[development handoff](../../../handoff.md).

The floating container uses the existing non-modal Radix dialog primitive so its
coordinates and dimensions are independent of the avatar's anchor. Native pointer
capture supports mouse, pen and touch. The shared geometry rules keep controls
visible after dragging, resizing, viewport changes or obsolete saved preferences.
Conversation state remains owned by assistant-ui throughout layout changes.

The #31 repository gate on 2026-11-08 passed 98 browser cases, including 22
assistant cases, 28 frontend unit tests, all Go tests, four startup checks,
generated-file validation and the production build. Browser checks used local
provider fixtures. Layout checks cover pointer/touch, keyboard, saved geometry,
viewport recovery and hidden entry behavior. Markdown checks cover structure,
early streamed output, narrow viewports and blocked HTML/image/protocol content.

The #32 layout follow-up on the same date passed 28 frontend unit tests, the
production build and 26 targeted browser cases. Four viewport cases verify a
full-height opening from old short preferences and a combined header height at
most 80 CSS pixels. Reopening restores height while preserving saved width and
horizontal placement; manual resizing, touch, keyboard, Markdown and question
changes retain their verified behavior.
