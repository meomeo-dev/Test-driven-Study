# Memory palace

Route: `/palace?subject=1&question=4`. The sidebar carries the current original
question ID from memorization and practice. Both subjects are supported.

Choose a question, review its original answer, optionally set a palace address,
and generate one image. Settings include configured model, quality, dimensions,
and use of the original reference image. Generation continues after navigating
away. Recent subject history and selected job URLs restore saved results and
question context. **生成详情** shows the exact saved prompt and provider-reported usage.

Model, aspect ratio, quality, and resolution retain the learner's last explicit
selection in local browser preferences. Switching question/subject, inspecting
history, or reloading does not replace those choices with an older job's settings.
Palace addresses and reference availability remain tied to the current question.
Preferences contain no API key, proxy authentication, or provider configuration.

Before generation, the prompt dialog shows the canonical template. After the
LLM stage, generation details show the exact final image request text. Original
question text, every option, resolved answer text, original explanation, and
optional palace address fill the template's three active variables. Reference
images contain the original diagram; the full question remains in the text.
GIF references are excluded rather than silently replacing an animation with
one frame. Original GIFs remain viewable in the source panel.

The page exposes answers and records an answer exposure, like memorization.
Image generation does not create a scored attempt or change manual review marks.
Generated facts and Chinese labels require review against the original question.
The image endpoint does not add a legal-research or fact-checking tool.

## Module layout

```text
internal/palace/
  config.go                 Server-only dotenv and proxy configuration
  credentials.go            OS credential adapter and atomic profile reference
  settings.go               Masked settings, secret updates, connection tests
  models.go                 Domain types and ImageProvider interface
  prompt.go                 Full prompt rendering and embedded template
  prompts/memory-palace.v1.json
  provider.go               Generation/edit requests and proxied download
  images.go                 Image validation, reference hashes, atomic files
  service.go                Preview, idempotent creation, history, cancellation
  worker.go                 Serial pipeline execution and terminal states
  control.go                Pause, checkpoint boundaries, resume, explicit retry
  tasks.go                  Global task summaries and transition events
  trace.go                  Observed task events and trace reads
  pipeline.go               Planning contract and durable stage transition
  sizes.go                  Presets and imagegen-aligned pixel validation
  output-sizes.json         Shared frontend/backend dimension mappings
  coverage.go               All successful questions and latest saved job IDs
internal/storage/migrations/00003_palaces.sql
db/queries.sql              Persistent queue and history queries
internal/httpapi/palace.go  Local HTTP handlers
contracts/http/openapi.yaml Generated frontend type source
web/src/api/palace.ts       Typed local HTTP calls
web/src/features/palace/
  PalacePage.tsx            Route, subject, question selection, data queries
  PalaceWorkspace.tsx       Generation controls and job interactions
  PalaceSource.tsx          Original question, answer, image, explanation
  PalaceSettings.tsx        Settings and recent history components
  PalaceCanvas.tsx          Status, saved image, zoom, download
  TaskManager.tsx           Cross-question task list and lifecycle events
  TaskActions.tsx           Shared pause, resume, stop and retry controls
  ProviderDialog.tsx        Provider configuration with transient secret input
  preferences.ts            Validated public generation preferences and sizes
  hooks.ts                  Preference persistence and generated-image coverage
web/src/features/trace/     Original timeline, event feed and resumable reads
internal/tasktrace/        Bounded append-only event recorder
web/src/styles/palace.css   Compact responsive layout and theme tokens
tests/fixtures/image-provider.mjs
tests/browser/palace.spec.ts
```

Courses can provide custom memory palace templates under `courses/<course>/profiles/`.
The application loads it when the course is available and keeps provider settings
and execution policy in the application. The original import manifests retain
their recorded source evidence. Changing a template requires a version change.
Existing job prompts remain saved.

## HTTP endpoints

| Method and path | Result |
| --- | --- |
| GET `/api/palaces/info` | Safe readiness and model list; no endpoint or key. |
| GET `/api/palaces/coverage` | All successful question IDs, image counts, and latest job IDs for a subject. |
| GET `/api/palaces/settings` | Base URL, sanitized proxy, models, key-present flag, write token; no secrets. |
| PUT `/api/palaces/settings` | Persist and immediately apply provider configuration. |
| POST `/api/palaces/settings/test` | Test model-list access without saving or generating. |
| POST `/api/palaces/preview` | Full rendered prompt and reference availability. |
| POST `/api/palaces/jobs` | Idempotent creation, HTTP 202 with saved job. |
| GET `/api/palaces/jobs?subject=1&question=4` | Latest 30 jobs; question filter optional. |
| GET `/api/palaces/jobs/{job}` | Persisted status and input/output metadata. |
| POST `/api/palaces/jobs/{job}/cancel` | Cancel queued/running local work. |
| GET `/api/palaces/jobs/{job}/image` | Local image; `?download=1` sets attachment. |

State transitions: `queued → running → succeeded | failed`; cancellation changes
queued/running work to `canceled`. Shutdown/restart changes active work to
`interrupted`. Terminal rows cannot be overwritten by a late provider result.
Regeneration is an explicit new UUID. Polling and HTTP-client retries never
automatically repeat a paid provider call.

The navigator in memorization, practice, and memory-palace modes marks questions
with successful saved images. Coverage is independent of the recent-30 history
window. Selecting such a question in memory-palace mode opens its latest saved
image, even when that image is older than the visible history list.

Resolution presets and exact pixel constraints are documented in
[resolution presets](../../technical-selection/image-generation/resolution-presets.md).

## Local configuration and backup

Use **生图设置** in the page toolbar. The modal accepts Base URL, API key,
comma-separated models, and an HTTP/HTTPS/SOCKS proxy. A blank key retains the
current one; explicit removal disables generation. Changing the API origin
requires key re-entry or explicit permission to reuse the saved key. Closing
the modal discards the entered secret. Connection tests only query `/models`.

The profile is protected by the OS credential store. A private atomic
`image-provider.json` in the study data directory contains a random account
reference plus sanitized URL/model metadata. It contains no API key or proxy
authentication. A missing or locked saved credential disables generation;
it never silently reactivates a previous dotenv key. Settings changes are
blocked while jobs are queued or running. Saves apply only after persistence
and verification succeed.

For bootstrap deployments, `.env.gpt-image2.example` documents all four variables.
Copy it to `.env.gpt-image2`, fill the values, and restart. Process environment
values override that file; saved UI settings override both. No variable uses
the public `VITE_` prefix. `STUDY_IMAGE_CONFIG_FILE` selects another dotenv file.
To return deliberately to environment-only configuration, stop the app, remove
the profile index `image-provider.json`, and restart. This does not revoke the
provider key or delete unrelated OS credentials.

Outputs live in `${STUDY_DATA_DIR:-var}/palaces/`, beside `study.sqlite`.
Stop the application and back up the database and palace directory together.
Deleting either independently loses the corresponding history or output bytes.
OS credentials are separate from that backup. On a different machine or OS
account, enter a key again. Linux needs a running Secret Service for UI saves;
headless environments can use the explicit dotenv/environment configuration.

Automated checks use isolated SQLite directories and fake local images. They
never read a real provider configuration or make paid image requests.

## Independent Responses planning

The service settings dialog has separate **生图服务** and **LLM · Responses**
tabs. LLM bootstrap uses `.env.gpt` / `GPT_1_*`, with an example at
[.env.gpt.example](../../../.env.gpt.example). Saved LLM settings take priority.
LLM keys belong to the `test-driven-study.llm-provider` OS credential service;
image keys belong to `test-driven-study.image-provider`. Their index files are
`llm-provider.json` and `image-provider.json` inside the data directory. Neither
index contains a key or proxy authentication.

An optional `GPT_1_DEFAULT_MODEL` selects a configured bootstrap model; otherwise
the first listed model is used. A connection test reports missing model-list
entries without silently changing the configured selection.

LLM defaults include model, reasoning effort, required web search and working
context. The UI exposes one context policy: 274 K total, 210 K compaction trigger
and 64 K reserve. The per-response allowance derives from reserve, capped at
128 K and constrained by the provider's model window. K means 1024 tokens,
including reasoning and visible output. The optional legacy API field
`max_output_tokens_k` remains compatible; it is not a second UI control.

Provider-default effort omits `reasoning`. Unsupported values fail without model
substitution. Connection tests only query `/models`; they do not prove Responses,
vision, structured output, search or compaction support.

One `POST /api/palaces/jobs` with `generation_mode: pipeline` and an `llm` object
creates a durable job. Its `snapshot.pipeline.stage` is `planning` or `generating`.
The LLM record uses the parent job ID. The server persists a validated scene and
exact final image prompt before the image request. Navigation and reload do not
require another action. Independent provider settings cannot change during jobs.

The LLM always receives the original diagram, independently of the image-provider
reference switch. PNG/JPEG and static GIF bytes are preserved. Animated GIFs
become up to eight labeled composited PNG frames, with disposal handled before
sampling. Original files remain unchanged. Records store hashes and frame
positions, without persisting base64 image payloads.

Template v1.2 tells the image model to ignore watermarks, branding, repeated
textures, compression noise and unrelated shadows. LLM instructions apply the
same constraint to research and scene design. Actual traffic signs, road markings,
signal colors and answer-relevant lighting remain evidence. Obscured details
must not be invented. Existing snapshots retain their earlier template versions.

Cancellation prevents later stages. Refusal and explicit source conflicts stop
before images; insufficient evidence returns to research automatically. Output exhaustion automatically compacts
and continues; partial plans never reach the image provider. Restart preserves paused jobs and interrupts
other active work without replaying paid calls. Each LLM HTTP request has a fifteen-minute
deadline; image requests allow ten minutes. Failed jobs require explicit regeneration.

`GET /api/llm/plans/{id}` exposes the saved plan, image-input metadata, research,
progress and usage. Standalone plan APIs and older direct image requests remain
compatible for existing clients/history. The current page starts a pipeline.
Planning does not create scored attempts or change manual study marks.

Actual `gpt-6.1-sol` records include successful hosted search, source validation
and saved images. Other requests were rejected at `tool_choice` or stopped for
insufficient evidence. A failed request does not establish global lack of search
support; interpret each record's completed-search count and research outcome.
See [pipeline acceptance](pipeline-acceptance.md) for the successful records.

## Research and compaction

Hosted search performs retrieval server-side. Returned links are evidence metadata,
not a complete page archive. See [retrieval responsibility and limits](../../technical-selection/image-generation/hosted-search-retrieval.md).

Course research restricts external search according to configured boundaries. The
supplied transcript, lesson, or passage establishes item-specific facts, and web search
supports general teaching claims. A missing external copy of the same exercise
does not require supplemental research. Required search requests actual sources with
`include: ["web_search_call.action.sources"]`. A completed search call and eligible
returned source URLs are mandatory. The server never accepts model-written URLs
as proof of retrieval. Structured claims must match actual source records.

The first call produces cited research notes; the same model synthesizes strict
JSON from those notes, retained original input and source metadata. A valid
structured result returned during research can be accepted when it satisfies all
local checks. Search-off mode is explicit and labeled unverified. Unsupported
search never silently becomes search-off or legacy preview search.

Insufficient or unverified-source assessments preserve the draft and reopen
hosted research. The identified gap is supplied as task data. Research notes then
return to structured assessment; only a supported result can start images.
Original questions, diagrams, source records and cumulative usage remain intact
through continuation and compaction. General courses stop after eight research
and planning rounds if a valid plan still cannot be accepted. Paused jobs retain
their completed round count.

Progress includes `research_rounds`, `page_opens`, `page_finds` and `evidence_gap`.
Three consecutive research requests without a new eligible source or a distinct
primary-page read/find target stop with `no_research_progress`. Fresh tool IDs or
repeated queries alone do not count as evidence. A final supported assessment can
still complete. Conflicts, refusal, cancellation and uncertain requests stop.
Previously failed jobs remain immutable; explicit regeneration uses the new loop.

The official guide recommends GA `web_search`. Its typed specific-tool enum does
not currently list GA `web_search`; supplying only that tool with `required`
avoids relying on an undocumented tool-choice object. Actual source traces remain
mandatory even if a compatible endpoint ignores `required`.

Input counting uses `/responses/input_tokens` with the full request structure.
The client compacts before the threshold and leaves output/tool headroom. Hosted
search has a smaller 128K window, so its effective threshold is lower than the
normal 210 K setting. Context policy is not a cumulative billing limit or proof
of a provider's actual window.

On output exhaustion or a full window, `/responses/compact` receives the complete
conversation. Its entire returned replacement window is replayed, including opaque
compaction state and retained messages. No encrypted reasoning is decoded.
If the standalone route is explicitly unsupported/unavailable, Codex V2 uses a
streamed `/responses` request with `compaction_trigger`. Retain the original
question/images and exactly one encrypted compaction item; omit the trigger and
other returned assistant output. This protocol was verified on the configured
model, including counting and subsequent replay. If V2 is also explicitly
unsupported, the same selected model creates a bounded factual summary. The original question/images
and independently collected sources are retained. Methods are recorded as
`native`, `codex_v2` or `summary`. Summary compression
does not preserve opaque reasoning. See [protocol compatibility](../../technical-selection/image-generation/codex-protocol-compatibility.md).

Structured requests include the character and array limits used by local
validation in both the instructions and JSON schema. If the provider explicitly
rejects a length keyword, the planner records it and uses the original shape
with the same written limits and local validation. If a draft violates a limit,
the trace and replacement request identify the field and the applicable limit.
The loop continues toward a complete replacement JSON object. Repeated identical
non-progress, refusal, incompatible APIs, cancellation and transport uncertainty
stop it. An uncertain paid POST is never replayed as continuation. Rounds,
searches, compactions and cumulative returned token usage are persisted.

Errors identify the failed operation and allowlisted parameter names, not raw diagnostics,
private URLs or credentials. Saved provider credentials remain server-side.
See [pipeline acceptance](pipeline-acceptance.md) for actual capability results.

## Task controls

The toolbar task panel controls jobs across questions and subjects.
[Lifecycle and recovery](task-lifecycle.md) describes pause boundaries, restart
behavior, durable checkpoints and explicit retry semantics.

## Observed execution

Running jobs show a timeline and incremental activity in the image panel.
Completed and failed jobs expose the saved trace through **执行轨迹**. The viewer
records request intervals, actual hosted tool events, returned public summaries,
answers and storage stages. It does not reveal private reasoning or invent old
activity. See [execution traces](execution-traces.md) for controls, limits and
local snapshot/SSE endpoints.
