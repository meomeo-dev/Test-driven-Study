---
id: 0033
type: feat
status: closed
closed-by: 4851dd2554565cbf5f7055c268fc35d5d0a72223
labels: []
branch: feat/0033-persist-assistant-conversations-and-expose-history
created: 2026-11-08
---
# Persist assistant conversations and expose history

## 背景 / 目标

The question assistant keeps messages only in browser memory. Reloading loses
conversation history and there is no way to select an earlier conversation.

## 关键功能清单（Key Feature List，KFL）

- Persist conversations, messages, source links and terminal states in SQLite.
- Restore the selected conversation after reload or returning to a question.
- Add compact history and new-conversation controls with current/all-question lists.
- Retain partial interrupted replies without replaying paid requests.

## 改造面

SQLite migration and generated queries, LLM service, HTTP contract and handlers,
assistant runtime adapter, history UI, isolated acceptance checks and feature docs.

## 非目标

No provider migration, new dependency, automatic request replay, account system,
conversation deletion or changes to grading and learner records.

## 验收标准（Acceptance Criteria，AC）

- Reload and service restart retain saved messages, Markdown and citations.
- New conversations preserve previous conversations and history can select them.
- History can filter the current question and navigate to another question.
- Disconnects retain partial replies with an interrupted status.
- Duplicate turn IDs and concurrent writers cannot repeat an accepted model call.
- Existing compact full-height draggable/resizable layout remains usable.
- Appropriate unit, Go, startup, build and browser acceptance checks pass.

## 讨论

2026-11-08: The user reported missing history after reload. Use the existing
SQLite database and assistant-ui runtime; preserve shared LLM/search settings.
Develop in an ordinary branch in the primary checkout; worktrees are prohibited.

Implementation and acceptance: [saved conversations](../docs/features/assistant/conversations.md).
