# Saved assistant conversations

The assistant stores conversations in the application's existing SQLite database,
under the configured data directory. Back up `study.sqlite` with the other learner
records. No provider-side history service or additional dependency is required.
Previously lost browser-only transcripts cannot be recovered.

## User behavior

- Opening restores the selected conversation for the question, or its latest one.
- The browser remembers only the selected conversation ID; messages live on the
  server. If browser storage is blocked, the latest server conversation restores.
- **新建对话** creates a separate conversation and retains existing records.
- **历史对话** provides current-question and all-question lists, newest first.
  Selecting another question navigates the current study mode to that question.
- Reload restores message text, Markdown, official citations and completion state.
- Closing the window preserves an active request. Changing conversation or question,
  stopping, and reloading cancel the old request and retain received text.
- A refreshed window polls an already-active conversation until its final local
  state is saved. No additional model request is made by this synchronization.

## Question navigation markers

Memorization, practice and palace question navigation show a speech-bubble icon
for questions with saved conversation messages. Empty newly opened conversations
are excluded. Interrupted or failed saved turns retain the marker. The icon and
memory-palace image icon can appear together in a reserved row below the original
question number. The legend and accessible tile label identify both resources.

`GET /api/llm/conversations/coverage?subject=1|4` returns only question IDs and
nonempty-conversation counts across the complete subject, without transcript
text or the history list's 50-item page limit. Accepted turns invalidate this
summary immediately; a five-second refresh also discovers updates in other tabs.

## Storage and request ownership

`chat_conversations` stores bounded messages as JSON with question ID, title,
timestamps, revision and active turn ID. History uses a bounded 50-item keyset
page without returning complete transcripts. Titles derive from the first prompt.

A compare-and-swap revision update reserves a turn before calling the provider.
Another writer receives a conflict. Progress is checkpointed at most every 250 ms;
the first delta and final response are saved immediately. Graceful cancellation
performs a final local save independently of the canceled request context.

Successful turn IDs return their stored reply on duplicate submission. Failed or
interrupted IDs conflict and never silently replay. A deliberate new submission
uses a new ID. On service startup, abandoned running replies become interrupted;
partial text remains available. A sudden process exit can lose text since the last
checkpoint. Interrupted requests may still have incurred provider charges.

The server builds context from successful prior turns and original question facts.
Failed turns remain visible but are omitted from model context. Existing limits
remain: 24 context messages, 32,000 combined characters, 2,000 characters per user
message and 8,000 per reply. Stored conversations additionally cap at 48 messages;
reaching a bound asks the learner to create a new conversation.

## HTTP surface

- `GET /api/llm/conversations?question_id=…&before=…`: bounded history; zero lists all.
- `POST /api/llm/conversations`: idempotent creation with UUID and question ID.
- `GET /api/llm/conversations/{conversation}`: full saved messages and revision.
- `POST /api/llm/conversations/{conversation}/messages`: new UUID and text; NDJSON.

The original stateless chat endpoint remains compatible. The product uses the
saved-conversation endpoints. LLM credentials, proxy, search and question-image
handling remain owned by the existing service.

[Browser checks](../../../tests/browser/assistant-history.spec.ts) cover reload,
selection, citations, cross-question navigation, cancellation and request validation.
[Go checks](../../../internal/llm/conversations_test.go) cover durable replies,
deduplication, concurrent writers and abandoned-request recovery across restart.

## Acceptance on 2026-11-08

Verification used isolated databases and local model fixtures, with no paid calls.
The first `npm run check` passed issue validation, generated-file checks, 28
frontend unit tests, all Go packages, four startup tests and the production build.
Its browser stage passed 105 of 106 cases; the remaining case still asserted the
old clear-on-question-change behavior. That case now uses an explicitly empty
question session and checks question-scoped cancellation.

After the history/cache adjustments, the production build and HTTP regression
checks passed, followed by 31 assistant browser checks across persistence,
cross-question selection, cancellation, blocked storage, Markdown and window
layout. After deferring unopened-question initialization, 30 cases passed and
one configuration-disabled case was interrupted by Vite reloading during a
documentation edit. That case passed separately with unchanged application code.
Other browser suites were not repeated after those UI changes.
Desktop and narrow-screen history captures are linked in the
[UI evidence](../../ui/assistant/README.md).

### Navigation marker acceptance (#34)

The generated-file check, 28 frontend unit tests, all Go packages, four startup
checks, type checking and production build passed on 2026-11-08. Full browser
regression passed 108 of 111 cases. Three new cases used Escape while the composer
was running, which stops the reply before closing the window; they now use the
explicit close button. The final navigation suite passed all four cases with
unchanged application code. It covers all three study pages, empty sessions,
accepted turns, refresh persistence, invalid subjects and simultaneous image/chat
icons at 1280 and 320 pixels. The Go summary test verifies subject isolation,
interrupted records and complete counts beyond the history list's page size.

- [Navigation browser checks](../../../tests/browser/assistant-navigation.spec.ts)
- [Summary regression](../../../internal/llm/conversation_coverage_test.go)
