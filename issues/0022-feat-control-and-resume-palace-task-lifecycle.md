---
id: 22
type: feat
status: closed
closed-by: 2e6f6d5bf193a741ccf6c4f6bbf2fd3590f1cb83
labels: [tasks, ai]
branch: feat/0022-control-and-resume-palace-task-lifecycle
created: 2026-11-02
---
# Control and resume palace task lifecycle

## 背景 / 目标

Generation has a durable queue and cancellation, but lacks resumable pause and a
cross-question control surface. Add cooperative pause, checkpoint continuation,
explicit stop and retry, with global task visibility.

## 关键功能清单（Key Feature List，KFL）

- Global active/history task panel with state and lifecycle events.
- Queue pause, running pause request, durable paused state and explicit resume.
- Save LLM history, research state and opaque context at safe boundaries.
- Stop cancels local execution and prevents later stages; retry uses a new UUID.
- Resume paused tasks after frontend reload or backend restart without paid replay.
- Keep completed LLM/image results and reject changed provider/reference state.

## 改造面

- SQLite control state/events, queue queries and generated bindings.
- Palace controls/worker, LLM checkpoints and adapter boundary.
- Local HTTP contract, global task panel and per-task action controls.
- Concurrency/restart regression tests, reader docs and acceptance evidence.

## 非目标

- Promising remote cancellation/refunds or replaying uncertain requests.
- Resuming failed/canceled/in-flight interrupted tasks as if they were paused.
- General distributed scheduling, new infrastructure or worktrees.

## 验收标准（Acceptance Criteria，AC）

- Frontend can pause, continue and stop tasks independent of current question.
- Pause completes the current logical round and saves a safe checkpoint.
- A paused task releases the serial worker and retains ID, inputs and usage.
- Resume starts at the checkpoint and skips completed planning stages.
- Paused restart recovery works; uncertain active work is interrupted, not replayed.
- Original images are restored from validated local assets, not checkpoint base64.
- Controls are idempotent; terminal state cannot be overwritten by late output.
- Private keys/URLs stay out of checkpoints, public APIs and logs.
- Desktop/mobile task controls fit the existing bounded UI.

## 讨论

Pause and stop are distinct commands. The current provider request may finish
while a pause is pending. Final-stage success is retained rather than discarded.
