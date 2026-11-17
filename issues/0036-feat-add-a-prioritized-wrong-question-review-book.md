---
id: 0036
type: feat
status: closed
closed-by: 41b27f8ed3359765c48588eed6fab5cc696f015a
labels: []
branch: feat/0036-add-a-prioritized-wrong-question-review-book
created: 2026-11-09
---
# Add a prioritized wrong-question review book

## 背景 / 目标

Learners need one review list for practice mistakes, completed exam mistakes, and questions they asked the assistant about. A single correct answer is insufficient evidence of mastery.

## 关键功能清单（Key Feature List，KFL）

- Add a minimal Wrong Question Book tab to each supported subject in Learning Analysis.
- Combine all three sources by question and rank the pending list by review priority.
- Replay answer and help events by actual occurrence time and apply spaced confirmation and memory decay.
- Provide a direct retry and an ordered practice queue.

## 改造面

Study service, SQL queries, HTTP schema, analysis tabs, practice filters and acceptance checks.

## 非目标

A fitted recall probability, changes to exam grading, or automatic edits to manual memorization marks.

## 验收标准（Acceptance Criteria，AC）

- Existing and future practice, finished exam, and assistant records contribute without duplication.
- Rapid successes cannot establish mastery, later errors reset confirmation, and time can make mastered items due again.
- Both subjects have independent lists with source labels, priority, and status filters.
- Review uses ordinary answer submission and retains a stable queue during practice.

## 讨论

2026-11-09. Use a deterministic spacing policy and current timestamp rather than a fitted model. Exact interval and score parameters are product defaults.

[Review-book design and acceptance](../docs/features/learning-analysis/review-book.md)
records evidence sources, scoring, spaced confirmation, and verification.
