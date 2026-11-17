---
id: 0007
type: feat
status: closed
closed-by: 8b04de5
labels: []
branch: feat/0007-practice-mode-and-time-aware-learning-analysis
created: 2026-11-01
---
# Practice mode and time-aware learning analysis

## 背景 / 目标

Copy the existing memorization implementation into a separate practice feature,
then adapt its interactions instead of rewriting the page. Learners select
answers with number keys, submit for server grading, and see explanations only
after answering. Immutable attempts feed a usable learning-analysis page.
Implementation remains directly on main without worktrees.

## 关键功能清单（Key Feature List，KFL）

- Copy existing feature files; preserve compact layout, images, navigation,
  subject switching, filters, and existing memorization behavior.
- Select with 1–4, submit with Enter, support exact-set multiple-choice grading.
- Withhold answer/explanation data from practice presentations before submission.
- Persist server-timestamped attempts, original selections, correctness, question
  revision, first/repeat status, and prior exposure context.
- Prevent duplicate submissions and preserve history when repeating a question.
- Separate memorization exposures/manual marks from scored attempts.
- Provide subject/time-window analytics, chapter error counts/rates, coverage,
  latest-per-question recent accuracy, daily trends, and comparable periods.
- Provide a transparent provisional bank-score estimate with sample/coverage
  guards and evidence-linked study advice, informed by public research.

## 改造面

- web/src/features/practice/ copied from memorization; new analytics feature.
- Shared navigation, API adapters, routes, styles, and memorization exposure hook.
- Go study services/HTTP handlers, SQLite migration/query bindings, HTTP contract.
- Domain/API/browser tests; docs/features/practice/ and learning-analysis/.

## 非目标

AI provider integration, official exam sampling/scoring guarantees, learned
psychometric models, changing source question data/assets, deleting learning
history, adding dependencies, external downloads, and linked worktrees.

## 验收标准（Acceptance Criteria，AC）

- AC1: Copied feature provenance is documented; original memorization workflows pass.
- AC2: Practice responses and visible UI contain no correct-answer or explanation
  content until submission; full-view and keyboard routes preserve that boundary.
- AC3: Numeric selection, Enter, multi-select, grading feedback, retry, navigation,
  input/IME safeguards, and shortcut preference behave consistently.
- AC4: Server grading rejects invalid/duplicate/unknown choices. Retried requests
  create one attempt; conflicting re-submissions cannot overwrite answers.
- AC5: Attempts survive restart with monotonic presentation/answer chronology.
  Practice cursor and manual memorization marks remain separate.
- AC6: Time windows and equal-period comparisons use server UTC timestamps.
  Latest-per-question estimates reflect later improvements without erasing history.
- AC7: Analysis exposes sample counts, chapter denominators, first/repeat results,
  coverage and data sparsity. Forecasts are provisional, not pass probabilities.
- AC8: Tests use isolated databases, production migration is backed up, and
  generated bindings, strict builds, domain/API/browser checks pass.

## 讨论

A context-isolated research agent receives only public requirements. The design
uses immutable events, explicit exposure context, 14-day recency weighting as a
product heuristic, and no claim of measured forgetting. Forecasts are withheld
until enough distinct questions and all bank chapters have evidence; even then
bank-weighted estimates are uncalibrated for real exams. External downloads
remain prohibited without an explicit proxy; this feature adds no dependencies.

The implementation copies 14 feature files from commit 5b31d00. Before-answer
full view uses a public-only preview; feedback retains the current filtered
queue until navigation. Equal-window comparisons, same-millisecond ordering,
and partial UTC boundary days have explicit domain tests. SQL generation uses
the cached pinned module without online lookups or direct-download fallback.

Acceptance: npm run check passes all gates, including 25 browser workflows,
8 frontend unit tests, Go domain/API/storage tests, startup lifecycle, strict
builds, issue validation, and generated bindings. The primary local service
is running after a backed-up migration. Original data/assets and existing
manual study marks are preserved. Live practice and sparse analysis are
verified without adding synthetic scored attempts to the personal database.
