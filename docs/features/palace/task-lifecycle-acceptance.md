# Task lifecycle acceptance

Verified on 2026-11-02, issue #22.

## Automated checks

`npm run check` passed with 64 browser tests, 11 frontend unit tests, all Go
package tests, four startup checks, contract regeneration checks and a production
build. AI test providers were isolated loopback fixtures; no paid AI requests were
submitted by these checks.

| Scenario | Verified outcome |
| --- | --- |
| Pause a queued job | It is skipped by the worker and survives restart as paused. |
| Pause during Responses research | The current round finishes, opaque state and usage are saved, and no image starts. |
| Restart a paused research pipeline | Explicit resume uses the same ID and retained original image; exactly two total Responses rounds and one image request occur. |
| Pause after a valid plan | The exact final prompt is retained; resume skips the completed LLM stage. |
| Resume an image-free question | Persisted nil and empty reference lists are treated identically. |
| Changed provider, missing/in-flight checkpoint or changed original input | Resume fails without replaying old paid work. |
| Stop races with paused-child persistence | The late child checkpoint is discarded; terminal parent state remains canceled. |
| Stop a paused task | Continue is rejected; explicit retry creates a different task ID. |
| Pause during final image generation | The completed image is retained as success. |
| Global task controls | Switching question and reloading preserves pause/continue controls. |
| History pagination | Stable creation-time/ID cursors return 55 equal-time rows without duplicates. |
| Migration from schema 4 | Legacy prompts, errors and timestamps remain exact; history starts with an honest snapshot. |
| Local API | Summary/event endpoints, invalid controls, terminal guards and malformed cursors are checked. |
| Desktop/mobile layout | 1280 × 600 and 390 × 844 browser viewports retain bounded page dimensions. |

## Runtime and data verification

The local development service was restarted on web port 43187 and API port 43188.
Health, global task listing and the task manager UI were verified. No active user
task was interrupted during deployment.

A consistent SQLite backup and matching local images were saved privately before
migration. Comparison against that backup confirmed preservation of all original
3,147 questions, 316 answer attempts, 35 palace jobs and 31 LLM plans. All 19 saved
image files remained byte-identical. SQLite integrity and foreign-key checks
passed. Existing jobs received 35 historical snapshot events.

Private provider keys, configured URLs and proxy credentials were checked against
changed repository files and the production bundle; none were found. Checkpoint
tests verify hashed image references, exact opaque state and `0600` file mode.

## Limits

Pause is cooperative and waits for the current logical step. A final image can
finish while pause is pending. Stop cancels local execution and blocks later
stages; it cannot guarantee upstream cancellation or refunds. Unsafe interrupted
work requires an explicit new task. Live AI capability testing is independent of
this fixture-based lifecycle acceptance.
