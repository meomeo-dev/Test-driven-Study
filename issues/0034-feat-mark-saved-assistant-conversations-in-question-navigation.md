---
id: 0034
type: feat
status: closed
closed-by: e967e7df1afac8348a1f2074f77de670aeeb0111
labels: []
branch: feat/0034-mark-saved-assistant-conversations-in-question-navigation
created: 2026-11-08
---
# Mark saved assistant conversations in question navigation

## 背景 / 目标

Question navigation marks saved memory-palace images, but learners cannot see
which questions have saved assistant conversations.

## 关键功能清单（Key Feature List，KFL）

- Add a conversation icon to marked question tiles in all three study navigators.
- Show image and conversation icons together with accessible labels and a legend.
- Mark only conversations with saved messages; opening an empty chat is insufficient.
- Refresh markers after accepted chat submissions and across reloads.

## 改造面

Question-scoped conversation summary query and HTTP contract, shared study-page
coverage hook, navigator presentation, local-fixture acceptance and documentation.

## 非目标

No new dependency, transcript download in navigator, grading changes or exam-terminal changes.

## 验收标准（Acceptance Criteria，AC）

- Memorization, practice and palace navigation mark questions with saved messages.
- Empty conversations remain unmarked; failed/interrupted saved turns remain marked.
- Results cover the full subject without the 50-conversation history-page limit.
- Image and chat markers coexist without obscuring question numbers on narrow screens.
- New accepted turns update markers without a page reload.
- Generated bindings, appropriate backend/frontend checks and browser cases pass.

## 讨论

2026-11-08: The user requested a conversation icon analogous to the existing
memory-palace image marker. Reuse SQLite records and existing UI/query dependencies.

Implementation and verification: [saved conversation markers](../docs/features/assistant/conversations.md#question-navigation-markers).
