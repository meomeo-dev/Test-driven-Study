---
id: 19
type: feat
status: closed
labels: [ai, memory-palace]
branch: feat/0019-run-palace-planning-and-image-generation-as-one-pipeline
created: 2026-11-02
closed-by: 691f55484149d14cb0e865ae941cab01f132a18e
---
# Automatic memory-palace generation pipeline

## 背景 / 目标

One generation action must run LLM scene planning and image generation in order,
without an adoption or approval action between stages.

## 关键功能清单（Key Feature List，KFL）

- A durable server-owned job runs planning, validation and image generation.
- Independent providers and explicit model/reasoning/token parameters.
- Persist stage, structured plan reference, exact final prompt and separate usage.
- Show stage progress and expose plan details after execution.
- Send original diagrams to the LLM, including labeled animation samples.
- Require actual built-in search with traceable authoritative sources when enabled.
- Default context policy: 274 K target, 210 K trigger and 64 K reserve.
- Continue incomplete reasoning with native/explicit compaction and opaque replay;
  retain original inputs during same-model summary fallback.
- One UI context policy derives output allowance from reserve, without duplicate
  editable output controls. Use `gpt-6.1-sol` for actual verification.
- Ignore reference watermarks/artifacts while preserving answer-relevant details.
- Review Hey API maintenance and current official Web Search request contracts.
- Cancellation, failure and restart prevent later stages and automatic replay.

## 改造面

- Palace queue, LLM execution and provider adapter.
- OpenAPI contracts, SQL bindings and compact palace controls.
- Pipeline and regression tests, configuration examples and reader documentation.

## 非目标

- Browser-owned chaining, manual plan adoption or uncertain paid-call retries.
- Worktrees; implementation remains directly on main as requested.

## 验收标准（Acceptance Criteria，AC）

- One click reaches a saved image without another user action.
- Navigation or reload does not stop an accepted job or create duplicate calls.
- Invalid or incomplete planning results never reach the image provider.
- Canceling planning prevents image submission; restart never replays inference.
- The template, answer, reference image and provider separation remain intact.
- Existing direct-generation records remain readable.
- Search and compaction incompatibility never silently removes required features.
- Source-linked research, input-image metadata and context budgets are reviewable.
- Use GA `web_search` with `required`; no tool-free answer or invented citation
  may start images. Report actual endpoint limitations without claiming support.
- Template changes are minimal and versioned; existing snapshots remain unchanged.
- Desktop/mobile controls stay within the existing viewport layout.

## 讨论

The existing durable palace queue owns the pipeline. No workflow framework,
new external dependency or separate scheduling service is required.

Actual `gpt-6.1-sol` vision, hosted search and source-supported image pipelines
succeeded. Some requests were rejected at tool choice; those failures do not
establish global lack of hosted search. Insufficient research remains a separate
failure after successful retrieval. Standalone compaction is unavailable on the
tested route, while Codex V2 encrypted compaction and replay succeeded.
Acceptance includes safe handling of connection resets during local shutdown.
