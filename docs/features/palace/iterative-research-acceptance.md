# Iterative research acceptance

Date: 2026-11-02. Branch: `main`. No linked worktree was created.

## Behavior

An insufficient assessment or citation absent from actual retrieval metadata
returns planning to hosted research. The specific gap accompanies the next
request. New research notes are assessed again before image generation.
Original question/images, source records, model and usage remain in one session.

Three consecutive research requests without a new eligible source or distinct
government-page open/find target stop with `no_research_progress`. New tool IDs,
changed source titles and repeated queries alone do not reset this guard. Useful
retrieval can continue beyond four rounds. Supported evidence is still required
for images; explicit conflicts, refusal, cancellation and uncertain requests stop.

The UI exposes research rounds, page opens, page finds and an expandable evidence
gap. The final draft/gap remain visible when research stops. Existing failed jobs
retain their historical result; explicit regeneration starts the new behavior.

## Automated scenarios

- Initial research, insufficient JSON, supplemental hosted research with primary
  page opening/finding, supported JSON and exactly one image stage.
- Page navigation during supplemental work without a second job or manual action.
- A fresh response ID every round with unchanged evidence still stops.
- Six research rounds with genuinely new sources can reach a supported result.
- The evidence gap survives preflight compaction and reaches the next request.
- Direct primary-page reading qualifies as actual retrieval.
- Unverified citations reopen research rather than reaching image generation.
- Source title enrichment remains available without counting as new evidence.
- Cancellation during supplementation prevents another round and image request.
- A 1280×600 details view shows the pending gap without root scrolling.

Model/browser fixtures use loopback HTTP and isolated study databases. They never
submit paid AI requests or create synthetic scored attempts in the live database.
The fixture's document URLs and source claims are explicitly test data.

## Data preservation

A consistent SQLite backup was saved before deployment. Verification compares
original question, mark, scored-attempt, image-job and LLM-plan rows against that
snapshot. Interactive study may append new rows while development continues.
Provider credentials and private endpoint addresses remain outside tracked files.

## Verification results

The final `GOPROXY=off GOSUMDB=off npm run check` passed: all Go packages,
11 frontend unit tests, four startup checks, generated-binding/issue validation,
production builds and 62 browser acceptance tests.

A live LLM-only request used question 92082, `gpt-6.1-sol`, medium reasoning and
274/210/64 K. Record `3be9343c-b9b7-40ca-8477-d552ba6baf4c` failed at response
creation with `tool_choice` rejected before a model round. It did not exercise
supplementation and did not submit an image. Automatic multi-round recovery is
verified by isolated model/browser fixtures, not that failed live request.

Original immutable question, scored-attempt and terminal job/plan rows from the
backup remain unchanged. SQLite integrity and foreign-key checks passed. Private
key/Base URL scans found no matches in tracked/unignored files, production assets
or development logs. The running service uses the updated implementation.
