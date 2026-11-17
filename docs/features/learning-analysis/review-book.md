# Wrong-question book

Open **学习分析 → 错题本** for Subject 1 or Subject 4. The book keeps one row per
question. Each row shows its score, source counts, latest answer, spaced
confirmations, and next review date when available. Pending items appear first.
Use **已掌握** to inspect items that meet the current confirmation rule or **全部**
to see the entire book. The overview date filter applies only to the overview.

**开始复习** opens regular practice at the top of the pending queue. The review
filter uses the same order as the book. Correcting a question can change its
future priority. The current practice queue keeps its order until a filter or
session changes. **返回错题本** refreshes the latest results.

## Evidence and chronology

The service reads existing SQLite records and rebuilds the subject on request.
Mastery is a computed view of the current history. All three sources can coexist
on one question. Only questions with a mistake or a saved help request enter
the book. Correct answers before and after membership still affect its score.

- Ordinary practice contributes one observation per saved submission.
- Finished mock exams contribute their existing immutable attempts. They use the
  original answer time even when the exam finishes after a later practice answer.
  Their presentation IDs reference the finished exam. Exam omission stays a
  scoring outcome without a submitted answer observation.
- Each saved user chat message is a help observation. Help signals contribute
  their own priority component.

Answers at the same millisecond follow attempt ID order. Help follows answers
on ties. A read transaction keeps answer, help and question metadata consistent.
The report exposes question titles, evidence counts and derived review state.
Existing manual memorization marks retain their separate meaning.

## Spaced mastery

Each answer or help request updates the time of the last observation. A correct
answer qualifies as independent after a gap of at least 24 hours from the
previous observation. The first independent correct establishes a baseline.
The second must occur at least one day later. The third must occur at least
three days after the second. Earlier repetitions retain their grades and leave
the confirmation count and next review date in place.

Three confirmations with a current schedule produce **已掌握**. The next review
intervals are 7, 14 and 30 days. After the last stage each qualifying success
renews the 30-day interval. Reaching the due date changes the status to
**复习到期**. A later wrong answer resets the confirmation count. A help request
opens review again, preserving existing confirmations. The next independent
correct clears that request and advances the schedule when eligible.

For example, a wrong answer and immediate correction on Monday still need an
independent check. An eligible correct on Tuesday establishes confirmation one.
Wednesday and Saturday successes at the required gaps can establish mastery.
The next check is due seven days after Saturday's confirmation.

## Review priority

The 0–100 score ranks questions within the pending list. It combines four terms.

| Component | Rule |
| --- | --- |
| Memory decay | `45 × (1 − 0.8^(elapsed / interval))`, or 45 before the first confirmation. |
| Recent error burden | `35 × weighted wrong / (1 + weighted evidence)`. Evidence weights decay with a 30-day half-life. All wrong answers and independent correct answers contribute. |
| Unresolved wrong answers | 10 points if the question has a wrong answer and the current confirmation count is zero. |
| Open help request | 10 points until an independent correct answer clears the request. |

The server rounds the total to an integer. It orders pending items by descending
score and ascending original question ID on ties. Mastered items follow pending
items in the full list. These parameters are fixed product defaults. The score
indicates review priority and the mastery label describes evidence on this item.

The spacing policy draws on work showing that the effective gap depends on the
retention horizon. Exponential decay follows the form used in half-life models.
The thresholds here remain product defaults for binary study outcomes.
[Cepeda et al., 2008](https://journals.sagepub.com/doi/10.1111/j.1467-9280.2008.02209.x)
[Settles and Meeder, 2016](https://aclanthology.org/P16-1174/)

## Interfaces

- `/analysis?subject=1&tab=review` opens the book.
- `GET /api/analysis/review-book?subject=1` rebuilds the subject report.
- `GET /api/practice/questions?subject=1&state=review` returns the pending queue.

## Acceptance on 2026-11-09

The full repository gate passed, including 113 browser cases. A final tab layout
adjustment passed the production build and seven analysis/theme browser cases.
Regression tests cover stored records, chronological replay, spaced confirmation,
expiry, later errors, help, subject isolation, and the ranked practice queue.
Browser runs use isolated records and local provider fixtures.

- [Policy checks](../../../internal/study/review_policy_test.go)
- [Stored evidence integration](../../../internal/study/review_book_test.go)
- [Browser review flow](../../../tests/browser/review-book.spec.ts)
