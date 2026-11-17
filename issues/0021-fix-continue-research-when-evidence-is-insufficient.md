---
id: 21
type: fix
status: closed
labels: [ai, research]
branch: fix/0021-continue-research-when-evidence-is-insufficient
created: 2026-11-02
closed-by: f0a458dfa94642e45a394361107338be22c5e0d2
---
# Continue research when evidence is insufficient

## 背景 / 目标

A completed search followed by an insufficient assessment currently terminates
planning. Reopen hosted research automatically and resolve the identified gap
before permitting the image stage.

## 关键功能清单（Key Feature List，KFL）

- Preserve history, diagrams and actual sources across research/assessment cycles.
- Re-enable hosted tools after insufficient evidence or unverified citations.
- Supply the specific evidence gap and inspect relevant primary documents.
- Track research rounds, page opens/finds and current evidence gap.
- Stop repeated assessments without new sources/page-reading progress.
- Retain cancellation, compaction, conflict and uncertain-request protections.

## 改造面

- LLM session review, retrieval activity, request construction and instructions.
- HTTP contract, generated types and compact progress/details UI.
- Isolated model/browser fixtures, regression checks and reader documentation.

## 非目标

- Silently disabling research or accepting unsupported image prompts.
- Replaying old failed jobs, switching models or adding a web crawler.
- Worktrees; implementation remains on main.

## 验收标准（Acceptance Criteria，AC）

- Insufficient assessment automatically returns to hosted research on the same job.
- Search/open/find results can lead to a later supported assessment and one image.
- Original inputs, prior evidence, usage and context policy survive continuation.
- Repeated evidence stagnation stops without an arbitrary total-round ceiling.
- Fresh response IDs alone do not count as evidence progress.
- Three consecutive research requests without new source/read targets stop;
  source-title enrichment is retained without resetting that guard.
- The final unresolved gap is saved before a stagnation failure is published.
- Conflict, refusal, cancellation and uncertain transport prevent image submission.
- The UI shows pending evidence and research activity without root scrolling.
- Supplemental research remains cancelable from the compact details workflow.

## 讨论

Insufficient evidence is a continuation state. A supported assessment remains
required for images. Existing failed records remain immutable; new work uses a
new explicit job ID.
