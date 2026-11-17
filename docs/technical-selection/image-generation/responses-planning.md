# Responses planning and research

Verified: 2026-11-02.

## Implementation boundary

Go's standard HTTP client provides Responses, token counting and compaction.
The existing durable palace queue owns LLM research, structured scene synthesis,
validation and image generation. No orchestration dependency is needed.
Image and LLM providers use independent configuration, explicit proxies and OS
credential namespaces. Neither browser storage nor generated client types contain
provider credentials.

## Request and validation

- `POST /responses` uses the exact selected model, `store: false`, `stream: false`,
  a derived `max_output_tokens` and optional `reasoning.effort`.
- Original diagrams are local base64 `input_image` parts. Animated GIFs are
  composited before sampling up to eight labeled PNG frames.
- Research uses GA `web_search`, government-domain filters and `tool_choice:
  required`, with no other tool supplied. Request source metadata through
  `include: ["web_search_call.action.sources"]`.
- Read completed `web_search_call` items, consulted URLs and citation annotations.
  A model-written link or a prose claim that it searched is not retrieval proof.
- Research notes feed strict JSON scene synthesis automatically. Government-source
  claims must match actual returned source metadata. Insufficiency reopens
  research; explicit conflicts prevent image generation.
- Validate fields, bounds and enums locally. Structured output does not establish
  factual correctness or prove that a cited page entails every claim.
- Ignore reference watermarks, brands and compression artifacts while preserving
  real signs, signals, road markings and relevant scene lighting. The image
  template applies the same rule. No source asset is modified.

The current guide recommends `web_search` for new applications. Preview lacks GA
filters and returned-token controls. The API reference and official SDK enumerate
preview in the specific-tool-choice object but omit GA; the guide's prose permits
specific search choice. Use the unambiguous typed `required` form with one tool.
Do not invent a supported GA-specific object from that documentation mismatch.

There is no documented blanket prohibition on search plus structured output.
Separate research notes and JSON synthesis simplify tracing and compatibility;
actual provider capability still requires runtime verification.

## Context policy

Default UI policy is 274 K = 210 K trigger + 64 K reserve; K means 1024 tokens.
Single-response output follows reserve (default 64 K, local cap 128 K), rather
than another editable field. Working context and cumulative token usage differ.
Compaction cannot increase the model's per-response output ceiling.

`/responses/input_tokens` measures the full model/input/instructions/tools/schema
request. Compact before the effective threshold. Hosted search has a 128K window;
reserve output and tool overhead against this smaller limit during research.
No approximate text tokenizer substitutes for multimodal input counting.

Native `/responses/compact` returns a complete replacement window. Replay it
whole, preserving opaque reasoning and retained messages. If that protocol is
explicitly unavailable, try Codex V2 through streamed `/responses` with a
`compaction_trigger`. V2 retains the original question/images plus exactly one
returned encrypted item, rather than installing the whole response output.
If both protocols are explicitly unsupported, use a same-model factual summary.
Source evidence remains independent. Summary mode does not preserve encrypted
reasoning. Methods are labeled `native`, `codex_v2` or `summary`. Uncertain
transport failure never activates paid fallback.

Continue with complete replacement JSON, never concatenated partial fragments.
The job has no fixed round limit, but stops on non-progress, refusal, incompatible
APIs, transport uncertainty, cancellation or shutdown. Usage from generation and
compaction accumulates in the record; it does not establish the billed price.

## Persistence

The parent UUID is idempotent across submission uncertainty, navigation and
reload. Persist structured plan and exact augmented prompt before the image call.
Terminal jobs cannot be overwritten by late responses. Cancellation prevents
later stages, without promising upstream cancellation or free inference.

Store prompts, public parameters, frame hashes, source records, progress and
usage in SQLite. Do not persist base64 input or raw provider errors. Error
parameters are allowlisted; private endpoint information remains server-side.

## Iterative evidence assessment

Insufficient or unverified-source assessments are nonterminal. The next research
request receives the evidence gap and re-enabled hosted tools. Returned notes
then feed another strict assessment. The original input, retained sources,
selected model, cumulative usage and compaction policy stay in the same session.

Three consecutive research requests without a new eligible source or distinct
government-page open/find target stop. Response IDs, changed titles and repeated
queries alone do not reset that guard. A valid supported assessment can complete
even on the last such request. There is no fixed total research-round ceiling.
The last draft and unresolved gap remain reviewable after failure or cancellation.

## Verified endpoint limitations

The configured `gpt-6.1-sol` successfully interpreted original question images.
Hosted-search records also show completed search, matched government sources and
successful image generation. Specific diagnostic requests were rejected at
`tool_choice` or completed without a search item. Those failures establish only
the outcomes of those requests, not global endpoint incapability. The cause of
mixed success/failure is not established by the saved records.

Input counting succeeded. The standalone compact route is unavailable, while
Codex V2 compaction, counting its returned state and subsequent opaque replay
all succeeded on the same configured model. The earlier standalone rejection
did not establish general compaction failure. Full 210 K exhaustion is untested;
see [protocol compatibility](codex-protocol-compatibility.md) for exact probes.

## Official references

- [Web search](https://developers.openai.com/api/docs/guides/tools-web-search)
- [Responses tool choices](https://developers.openai.com/api/reference/resources/responses/methods/retrieve)
- [Official Responses SDK types](https://github.com/openai/openai-node/blob/master/src/resources/responses/responses.ts)
- [Image input](https://developers.openai.com/api/docs/guides/images-vision)
- [Compaction](https://developers.openai.com/api/docs/guides/compaction)
- [Token counting](https://developers.openai.com/api/docs/guides/token-counting)
- [Reasoning](https://developers.openai.com/api/docs/guides/reasoning)
- [Structured output](https://developers.openai.com/api/docs/guides/structured-outputs)

Model aliases and `/models` membership do not prove these capabilities.
