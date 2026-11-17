---
id: 20
type: fix
status: closed
labels: [ai, compatibility]
branch: fix/0020-align-responses-compaction-with-codex
created: 2026-11-02
closed-by: b3bffeb4fab0205cd139b159c91ef698c28b4263
---
# Align Responses compaction with Codex

## 背景 / 目标

Standalone compaction failure was incorrectly described as general inability to
compact. The configured model accepts Codex V2 through streamed Responses. Error
messages also conflate generation, counting and compaction capabilities.

## 关键功能清单（Key Feature List，KFL）

- Try encrypted V2 compaction when standalone compaction is explicitly unavailable.
- Retain original question/images and exactly one opaque V2 item for continuation.
- Parse terminal SSE responses without accepting truncated compaction state.
- Report the failing operation and safe parameter, without capability overclaims.
- Document separately verified counting, hosted search and compaction results.

## 改造面

- LLM HTTP transport, compaction, failure types and regression tests.
- HTTP contracts, generated frontend types and compaction provenance display.
- Feature, compatibility and acceptance documentation.

## 非目标

- Changing credentials, provider paths, models or Codex configuration.
- Treating a tool-free answer as search or adding a separate search service.
- Worktrees; implementation remains on main.

## 验收标准（Acceptance Criteria，AC）

- A standalone unsupported response can progress through valid V2 compaction.
- V2 preserves the original input bytes, excludes trigger/assistant output and
  requires exactly one nonempty encrypted compaction item.
- Truncated, malformed or uncertain streams never trigger paid fallback/replay.
- Same-model summary remains available only after explicit unsupported protocols.
- Error output identifies its operation and never exposes raw provider diagnostics.
- Hosted search remains gated on actual search calls and source evidence.
- Existing browser behavior, original data and history remain intact.

## 讨论

Codex uses multiple compaction and search paths. Compatibility is verified per
operation; a failure on one route cannot establish every capability is absent.
