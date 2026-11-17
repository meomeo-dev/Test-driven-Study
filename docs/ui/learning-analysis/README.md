# Learning analysis UI

The local analysis page uses the existing sidebar, colors, and viewport bounds.
Its toolbar shares the persistent light/dark control with both study modes;
charts, tables, advice, history, and calculation dialogs use semantic theme colors.
Subject and time-window controls select server aggregates. Metric cards show
submissions, per-question recent accuracy, coverage, and a provisional bank-score
estimate. Chapter denominators and errors remain visible alongside daily trends,
first/repeat results, comparable seven-day periods, and evidence-linked advice.

Sparse forecasts display insufficient evidence. Available estimates still show
sample size, coverage, and an uncalibrated label. History and calculation details
open in bounded dialogs. Desktop sections fit the viewport; compact screens use
local panel scrolling rather than document scrolling.

`desktop.png` and `mobile.png` are acceptance captures using isolated test
records. They are not the user's personal learning results. Statistical
assumptions and public references are in docs/features/learning-analysis/design.md.

The **错题本** tab uses one list with a score, question, source counts, and review
action per row. It defaults to pending items and retains mastered items in their
own filter. The subject selection applies to both analysis tabs. The time window
applies to the overview, while the book uses all saved evidence.
See [review-book rules](../../features/learning-analysis/review-book.md).

[Wrong-question book acceptance capture](review-book.png)
