---
id: 0042
type: fix
status: closed
closed-by: c1a7df0c8d0a90148cd9e3b13acc18c855a0b565
labels: []
branch: fix/0042-stop-repeated-ielts-palace-research
created: 2026-11-11
---
# Stop repeated IELTS palace research

## 背景 / 目标

The IELTS workshop task produced valid scene plans but repeatedly requested
external copies of the supplied recording and answer key. The image stage
received no request even though the plans found that the transcript supported
the answer.

## 关键功能清单（Key Feature List，KFL）

- Ground item-specific claims in supplied transcripts or passages. Use required
  search to support general teaching guidance with retrieved sources.
- Bound the number of general-course planning and search rounds, including
  after pause and resume.

## 改造面

LLM research prompts, the memory palace planning loop, and fixture coverage.

## 非目标

Changes to image provider limits, driving-source requirements, and the IELTS
question bank.

## 验收标准（Acceptance Criteria，AC）

- A transcript-backed IELTS fixture reaches the image stage with search enabled.
- Repeated insufficient assessments terminate even when searches find new URLs.
- A real answer conflict and an invented citation remain validation failures.

## 讨论

The task trace showed six completed LLM calls, two supplemental searches
triggered by `research.status=insufficient`, and zero image requests.

Go tests, typecheck and 20 browser cases passed. The IELTS regression observed
one hosted search request, one completed scene plan and one image request
using local provider fixtures.
