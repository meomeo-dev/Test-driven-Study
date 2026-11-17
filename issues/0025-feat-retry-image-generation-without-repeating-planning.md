---
id: 0025
type: feat
status: closed
closed-by: c81f100
labels: []
branch: feat/0025-retry-image-generation-without-repeating-planning
created: 2026-11-03
---
# Retry image generation without repeating planning

## 背景 / 目标

Allow another image attempt from a completed planning snapshot after image failure or an unsatisfactory result, without repeating LLM research or scene planning.

## 关键功能清单（Key Feature List，KFL）

- Add image-only retry actions to failed/successful results, task history and trace details.
- Copy the exact saved final prompt and original question/reference snapshot.
- Permit image model, aspect, resolution and quality changes.
- Retain source-plan lineage and create a new idempotent job.
- Preserve original records/images and distinguish full-pipeline regeneration.

## 改造面

- Palace retry creation, shared queue admission and snapshot metadata.
- Local HTTP contract and typed frontend calls.
- Shared image controls, retry dialog, provenance and task/trace actions.
- Regression fixtures/tests and reader documentation.

## 非目标

- Editing or rerunning the saved analysis, automatic retry, or overwriting old output.
- Changing original reference semantics or introducing new dependencies/worktrees.

## 验收标准（Acceptance Criteria，AC）

- Image-only retries make zero new LLM requests and preserve exact final prompt bytes.
- Failed images and successful images both support explicit new attempts.
- The new image settings are validated without requiring a live LLM provider.
- Missing/unfinished plans and changed reference assets fail before paid requests.
- Repeated/uncertain submissions reuse one UUID and cannot duplicate generation.
- New tasks retain lineage, have separate images/traces and do not recount LLM usage.
- Desktop/mobile controls fit the existing bounded UI.

## 讨论

Implement directly on main. Reuse the established queue, reference checks and image controls. No database migration is required for additive snapshot metadata.
