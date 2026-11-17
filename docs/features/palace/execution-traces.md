# Execution traces

New palace jobs display **执行轨迹** in the waiting area. The upper timeline
aligns observed request intervals. The lower feed shows scheduler events,
public reasoning summaries when returned, hosted search activity, text output,
context checks, compaction, image generation and local saving. Actual official
URL citations appear as separate source records; page-find activity preserves
the returned search pattern.

Select a timeline row to open its activity details. Filter the feed by summary,
tool or answer. Scrolling upward stops automatic following; **回到最新** resumes
it. Completed or failed jobs retain an **执行轨迹** button beside generation
details. The viewer supports both themes and bounded desktop/mobile layouts.

## What the measurements mean

- Request intervals include network and service processing time.
- Public summaries are displayed only when the endpoint provides them; they do
  not expose private chain-of-thought or measure its duration.
- Hosted tool events report the provider's observed lifecycle. Function-argument
  completion is labeled as preparation, not application tool execution.
- Whole-response results and completion-only tool results have no measured
  independent execution interval. Their bars are result markers.
- Missing end events remain explicitly unknown after interruption.
- Original image bytes, credentials, request headers and opaque reasoning are
  excluded. Each span stores at most 48,000 text characters, in bounded chunks.
  A job stores at most 12,000 events, reserving room for terminal records. The
  viewer reports the event limit and per-span text truncation.

The trace does not start, stop or repeat a provider request. Pause, continue and
stop remain available through the existing task controls. Reconnecting the
viewer or switching questions only reads saved events. Incomplete transport
output cannot start image generation and is not silently replayed.

## Local API

`GET /api/palaces/jobs/{id}/trace?after=<event-id>` returns up to 256 ordered
events, the next cursor, task state and the storage-limit flag.

`GET /api/palaces/jobs/{id}/trace/stream?after=<event-id>` emits `trace` SSE events
with durable event IDs, heartbeats and a `settled` event after the observed task
becomes quiet. Native reconnect also accepts `Last-Event-ID`. Event IDs prevent
duplicate display; generation uses its existing durable job ID independently.

Older jobs without captured events show an empty state. The viewer does not
reconstruct or invent their past activities. See the
[public interface and protocol references](../../technical-selection/agent-traces/README.md).

See [acceptance results](execution-trace-acceptance.md) for verification and views.
