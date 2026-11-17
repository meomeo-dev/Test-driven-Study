# Execution trace acceptance

Verified on 2026-11-02, issues #23 and #24.

`npm run check` passed: 69 browser tests, 15 frontend unit tests, all Go package
tests, four startup checks, generated-contract checks and the production build.
AI acceptance uses isolated loopback providers, without paid model requests.

## Trace behavior

| Scenario | Verified result |
| --- | --- |
| Incremental Responses output | Text is persisted before the terminal response and appears in the live feed. |
| Public summary and encrypted reasoning | Public summaries are visible; opaque state and private reasoning events are absent. |
| Tool arguments | Argument completion is labeled as preparation, not application tool execution. |
| Official citations and page reading | Safe government citations are deduplicated; page-find patterns remain readable. |
| Whole JSON response | Result markers explicitly lack independent measured durations. |
| Completion-only tool event | No invented tool start or zero-duration execution claim is shown. |
| Missing trailing deltas | Only a verified suffix from the completed visible item is appended. |
| Interrupted stream | Delivered text remains diagnostic output; no image request or paid replay occurs. |
| Event reconnect and page reload | Reads resume by durable event ID without restarting generation. |
| Pause and continue | Existing checkpoint controls and ordered pipeline stages remain intact. |
| Stored text containing HTML | Markup remains escaped text and cannot execute. |
| Historical job | Empty trace state is explicit; old events are not fabricated. |
| Storage bounds | Span text and total events remain bounded, with terminal-event headroom. |
| Desktop and mobile | Timeline, activity feed, task controls and dialogs remain within the document viewport. |

## Runtime and data

The local service was restarted on web port 43187 and API port 43188 after
confirming there were no active user tasks. Health and the historical trace
snapshot endpoint were verified. The existing job's empty-state viewer and the
new subject guide were inspected in the live browser.

A consistent private backup preceded migration. Comparison preserved every
original row in 3,147 questions, 316 answer attempts, 37 palace jobs, 33 LLM plans
and 41 lifecycle events. All 20 saved images remained byte-identical. Integrity
and foreign-key checks passed. No trace rows were backfilled for old jobs.
Private provider values were absent from changed files and the production bundle.

[Subject-guide acceptance](../subject-guide/acceptance.md) covers official
requirements, course selection, sources and responsive layouts.
