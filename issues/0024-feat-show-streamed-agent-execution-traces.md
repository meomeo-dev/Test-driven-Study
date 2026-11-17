---
id: 0024
type: feat
status: closed
closed-by: 7691032ca608760c4c407ed7006b7f830a8d9e0c
labels: []
branch: feat/0024-show-streamed-agent-execution-traces
created: 2026-11-03
---
# Show streamed agent execution traces

## 背景 / 目标

Replace the empty waiting surface with a trustworthy execution timeline and
live activity feed. Use public Affect UI behavior as reference and write an
independent implementation with existing project dependencies.

## 关键功能清单（Key Feature List，KFL）

- Persist observed task spans and safe text/tool events.
- Render a compact Gantt/waterfall with expandable streamed activity below.
- Relay real Responses events through a resumable local event stream.
- Keep task controls, history inspection and pause/restart semantics intact.
- Display public reasoning summaries only when returned; never expose encrypted state.

## 改造面

- SQLite trace migration/queries and a small recorder module.
- LLM transport/stream observation and palace stage instrumentation.
- Local HTTP trace snapshots/events and generated contracts.
- Original frontend trace components, styles, fixtures and regression tests.

## 非目标

- Copying Affect UI source, registry code, branding or installing its package.
- Inventing hidden reasoning, tool timing or historical traces.
- Replaying uncertain paid requests or introducing agent orchestration infrastructure.

## 验收标准（Acceptance Criteria，AC）

- Running palace jobs show observed timing bars and incremental activity.
- Tool input completion is not reported as tool execution completion.
- JSON-only endpoints are labeled as whole-response observations.
- Reasoning summaries, output and tool events are safely bounded and escaped.
- Reconnect/reload resumes from event IDs without duplicate provider calls.
- Prior jobs without collected traces show an honest empty state.
- Existing controls, generated images and one-screen desktop/mobile layout work.

## 讨论

Implement directly on main. No worktree is created. Public research is isolated from private implementation and credentials.

Public summaries are consumed only when returned. Model intervals include
network/service processing; completion-only results have no inferred duration.
The event contract and observation limits are documented in
[execution traces](../docs/features/palace/execution-traces.md).
