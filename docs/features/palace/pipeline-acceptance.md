# Automatic memory-palace pipeline acceptance

Date: 2026-11-02. Branch: `main`. No linked worktree was created.

## Delivered behavior

One durable palace job runs LLM research/planning, validates the structured scene,
persists the final image prompt, generates the image and saves it locally.
Navigation/reload requires no adoption action. Cancellation, interruption,
unsupported features and invalid research prevent later stages and paid replay.

Original images always enter the LLM; animated GIFs use labeled composited samples.
Image-provider reference selection is independent. The UI retains one context
policy: 274 K total, 210 K trigger and 64 K reserve. Output follows reserve without
a separate editable control. Native compaction and same-model summary mode have
distinct provenance. Source links, input-frame hashes and usage remain reviewable.

Template v1.2 adds only the reference-watermark/artifact instruction to the prompt;
its version field is updated. Other template fields and text remain unchanged.
Traffic signs, road markings, light colors and relevant lighting remain evidence.
Template SHA-256:
`be5007883e4e2e33528b8d337309c245ccc54422711725752c6f4bca1e4feb5d`.
Historical prompts and images have not been regenerated. Prompt instructions alone
do not prove that every future image will be artifact-free.

## Actual provider verification

All provider requests used the configured explicit proxy. No direct fallback or
automatic replay of uncertain requests was used. The selected test LLM was always
`gpt-6.1-sol`; no other LLM was substituted.

Before required-research enforcement, job
`0901a1b4-58e5-46ae-aa65-c090d5462536` completed LLM planning and `gpt-image-2`
generation automatically. It saved a 720×1280 PNG, 1,796,763 bytes, SHA-256
`2a36f4b85c8e69e36c955dc9e010cae3035c7db1d1f325953f7722ddaf128482`.
This proves stage ordering and image saving, not search-grounded generation.

Vision request `1e29fd59-fd6a-4305-8fec-6567339bff5a` interpreted the original
JPEG and identified the red signal and crossing. It returned no completed search
call and was rejected before images. Usage: 6,730 input, 1,638 output, 8,368 total.

Diagnostic request `72bae2ef-3df0-4934-9dc3-8e8310a7d052` tried GA `auto` and
documented preview search. Both completed without actual search metadata; the
record failed with `search_not_executed`. These protocols were diagnostic only.
Production uses the recommended GA tool with `tool_choice: required`.

Final v1.2 pipeline `0946694b-02d2-4c8b-a6c3-3c2ed706ad33` used
`gpt-6.1-sol`, medium reasoning and 274/210/64 K. The endpoint rejected
`tool_choice`. The job and linked plan failed; no image was submitted or saved.
This is a failed request, not evidence that required search is globally unavailable.

Successful hosted-search pipelines are also present in the actual database:

- `56299ef7-5070-42a0-9b88-bd171b8c42e0`: question 17, `gpt-6.1-sol`, medium,
  required search, one completed search and 17 eligible source records. Research
  was supported, citations matched returned metadata and the image was saved.
- `25c02cba-a690-463e-a6ce-b247047d916b`: question 92082, the same public LLM
  parameters, two completed searches and 28 eligible source records. Research
  was supported and the image was saved.
- `3422f7fc-f98f-4670-aae8-f7363f43858d`: one completed search and 16 eligible
  sources, but research was insufficient. The image stage correctly did not run.

These positive records establish actual hosted search and complete image
pipelines. The earlier blanket conclusion that the endpoint could not search was
incorrect. The cause of mixed accepted/rejected requests remains unverified.

The input-counting endpoint succeeded. Standalone compaction returned an
unavailable route. A follow-up verified Codex V2 encrypted compaction, counting
the returned state and successful opaque-state replay on `gpt-6.1-sol`. The
application now tries V2 before summary fallback. Full 210 K exhaustion remains
untested. See [protocol compatibility](../../technical-selection/image-generation/codex-protocol-compatibility.md).
Returned token usage does not establish charges or prices.

## Automated verification

The final full check passed: 11 frontend unit tests, all Go packages, four
startup checks, production builds, generated-binding/issue checks and 60 browser
acceptance tests. The fixture evidence does not establish real provider search
or native-compaction capability.

`GOPROXY=off GOSUMDB=off npm run check` covers generated-binding consistency,
frontend unit tests, Go packages, startup behavior, production builds and browser
acceptance. Inference fixtures use loopback URLs and isolated SQLite/credential
stores, without real API keys, paid requests or synthetic real study attempts.

Coverage includes automatic progression across navigation, idempotency after
uncertain submission, cancellation, failed/insufficient research, invented-source
rejection, input images independent of image references, every bundled GIF,
complete compaction-window replay, same-model summaries and duplicate-output-field
removal. Desktop and mobile settings stay inside the viewport. Port-reset probes
remain occupied until a later refusal and do not stop unrelated processes.

## Data and confidentiality

All original question, manual-mark, scored-attempt, image-job and LLM-plan rows
from the pre-research backup remain unchanged. Question count is 3,147; scored
attempt count is 287. New diagnostics append records rather than rewriting history.
SQLite integrity returned `ok`; foreign-key checks found no violations.

The original `c6f3079a-c1b6-4b24-ae40-7b8cf1d3df4e` PNG retains SHA-256
`92a29051412612d66edad0b56ecc47fbefd25ddb26bafebc33b551c659cf8082`.
Actual key/Base URL scans found no matches in tracked/unignored files, production
assets or development logs. UI evidence uses public local fixtures.
