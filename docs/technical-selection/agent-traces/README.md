# Agent execution trace interface

The run panel combines an observed timeline with a chronological activity feed.
It uses original React components, CSS, native disclosures and EventSource with
SQLite-backed Go event recording. No UI dependency or copied vendor component
implementation is included.

## Public design references

- [Affect UI Trace Waterfall](https://www.affectui.com/components/trace-waterfall):
  aligned intervals, hierarchy, status and expandable operation details.
- [Tool Call Card](https://www.affectui.com/components/tool-call-card): compact
  operation summaries with retained results and errors.
- [Thinking State](https://www.affectui.com/components/thinking-state) and
  [AI Answer](https://www.affectui.com/components/ai-answer): activity disclosure
  and genuine incremental output.
- [Streaming interface guidance](https://www.affectui.com/guides/streaming-ai-responses-react):
  follow new output while the reader stays near the bottom, with manual return.

The independent implementation uses the application's existing blue themes,
its own append-only event contract and its own layout. Public behavior is the
reference; vendor registry files, component source, installation artifacts,
branding and motion sequences are outside this implementation.

## Protocol and truthfulness

[OpenAI Responses events](https://developers.openai.com/api/reference/resources/responses/streaming-events)
provide output deltas, hosted tool lifecycle and optional public reasoning
summaries. The application records timestamps when it observes those events.
A model request interval includes network and service time; it does not measure
private reasoning. Summary timestamps describe receipt, not hidden computation.

[Reasoning summaries](https://developers.openai.com/api/docs/guides/reasoning#reasoning-summaries)
require model/endpoint capability and explicit opt-in on supported models.
The application consumes returned public summaries without forcing an optional
summary parameter onto a compatible endpoint. Encrypted reasoning and private
reasoning events are never logged or displayed.

[Function argument completion](https://developers.openai.com/api/docs/guides/function-calling#streaming)
only means arguments are ready. Application-side execution requires an actual
runner result. This pipeline does not execute model-generated custom functions;
argument preparation is labeled separately from hosted tool execution.

A JSON-only response can still be validated. Its child results are marked as
whole-response observations, without invented start times or durations. Missing
terminal Responses events fail closed; partial text remains diagnostic output
and cannot start image generation. An uncertain paid request is never replayed
for tracing or compatibility.

## Storage and delivery

`task_trace_events` stores bounded, append-only span and text events. Local read
endpoints page by event ID. The SSE endpoint supports `Last-Event-ID`, heartbeats
and reconnect without starting generation. Live text is coalesced before writes.
Generated traces omit request headers, credentials, original image payloads,
opaque reasoning and raw response envelopes.

The recorder limits events and per-span text; reaching the limit is reported in
the viewer. Source links use validated HTTPS government URLs. Model text is
rendered as escaped text; complete structured scene output receives a readable
presentation. Trace observation adds no third-party runtime dependency.

Historical jobs without collected events show an empty state. An unfinished
span after interruption has an unknown end time rather than an invented finish.
Pause/stop behavior remains governed by the durable task lifecycle.
