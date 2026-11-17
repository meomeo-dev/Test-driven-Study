# Responses and Codex protocol compatibility

Verified: 2026-11-02. LLM: `gpt-6.1-sol`.

## Independently verified operations

All probes use the application's configured endpoint/key through its explicit
proxy, with public test text. They do not change Codex configuration, study rows,
saved images or provider credentials.

| Operation | Result |
| --- | --- |
| `/responses/input_tokens`, GA search, required and auto | HTTP 200 for both; 53 reported input tokens. |
| Streamed `/responses`, GA search, required | HTTP 400; upstream reports required tool choice has no available tool. |
| Streamed `/responses`, GA search, auto | HTTP 200, completed text, no completed search item. |
| Streamed Codex cached/live search definitions | Both complete without a search item. Text is not accepted as retrieval proof. |
| Standalone `/responses/compact` | Unavailable provider route in the earlier probe. |
| `/responses` with `compaction_trigger` | HTTP 200; exactly one encrypted compaction item. |
| Token count with returned opaque V2 state | HTTP 200, 113 reported input tokens in the last probe. |
| Original user input + returned opaque item + new user turn | HTTP 200, completed continuation. |

V2 was verified with small public inputs, not a full 210 K working session. It
establishes encrypted compaction and replay on the tested model/route, without
claiming standalone compaction or hosted-search support.

The counting probe succeeds while required generation fails. Earlier records did
not persist the preflight count before a rejected generation call; a zero saved
context count alone does not identify which request failed. Failures now include
an explicit safe operation name.

Reported preflight count and generation usage can differ because the compatible
service supplies additional context. Counts are provider-reported measurements,
not proof of the complete backend working window.

## Successful application search records

Persisted application records verify hosted search on `gpt-6.1-sol`, medium
reasoning, required search and 274/210/64 K policy:

| Record | Local time (America/New_York) | Outcome |
| --- | --- | --- |
| `56299ef7-5070-42a0-9b88-bd171b8c42e0` | November 2, 01:41 EST | Question 17; one completed search, 17 eligible source records, supported research and saved image. |
| `25c02cba-a690-463e-a6ce-b247047d916b` | November 2, 03:18 EST | Question 92082; two completed searches, 28 eligible source records, supported research and saved image. |
| `3422f7fc-f98f-4670-aae8-f7363f43858d` | November 2, 03:20 EST | Question 92082; one completed search and 16 eligible sources, but insufficient research; no image. |

The search counter is derived from completed `web_search_call` items with search
actions, not request declarations or model prose. Structured cited URLs in these
records match returned source metadata. Source count describes returned records;
it does not mean every source independently verifies the answer.

The earlier diagnostic failures remain valid observations but do not establish
that hosted search is unavailable. Saved records do not establish why requests
with the same model name and public parameters have different outcomes. Upstream
routing and effective provider configuration would require independent evidence;
no specific routing cause is asserted here.

## Codex behavior

Codex 0.166 normally sends `stream: true`, `store: false` and `tool_choice: auto`.
V2 compaction appends `{"type":"compaction_trigger"}` to ordinary Responses input.
It does not require the public standalone compaction route.

V2 continuation retains selected original user input and appends exactly one
encrypted compaction item. Other returned assistant output and the trigger are
not installed as history. This differs from standalone `/compact`, whose entire
returned window replaces the old window. The application preserves its original
question/images and separately collected source records in both paths.

Search may instead execute through Codex's registered standalone `web.run`
extension/search service. Codex suppresses hosted search when that extension is
available. Successful Codex search therefore does not establish that a custom
completion route accepts hosted web-search declarations.

Codex also distinguishes provider routing and authentication. A shared hostname
does not establish identical API path, credentials or tool execution service.
No private Codex paths or login credentials are copied into the application.

## Application behavior

Try standalone compaction, then V2 only after an explicit unsupported/unavailable
response. If both protocols are explicitly unsupported, use same-model factual
summary compression. Store the method as `native`, `codex_v2` or `summary`.
Truncated, malformed, uncertain or ambiguous V2 output stops without paid replay.

Required hosted search still requires actual completed search and source metadata.
A tool-free auto response does not satisfy that requirement. Successful required
search is already recorded. There is no silent switch to unverified image
generation or reuse of Codex login tokens.

Errors identify response generation, input counting, standalone compaction or V2
compaction, plus an allowlisted parameter. An HTTP 400 on one operation no longer
claims that images, search and all compaction protocols are unavailable.

## Public references

- [Codex request construction](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/core/src/client.rs#L1154)
- [V2 trigger](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/core/src/compact_remote_v2_attempt.rs#L173)
- [V2 output and history construction](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/core/src/compact_remote_v2.rs#L375)
- [Standalone search selection](https://github.com/openai/codex/blob/rust-v0.166.0/codex-rs/core/src/tools/spec_plan.rs#L702)
- [Input counting API](https://developers.openai.com/api/reference/resources/responses/subresources/input_tokens/methods/count)
- [Public compaction guide](https://developers.openai.com/api/docs/guides/compaction)

## Regression verification

The full check passed after the compatibility change: 11 frontend unit tests,
all Go packages, four startup checks, generated binding checks, production builds
and 60 browser acceptance tests. Go coverage includes exact V2 history retention,
complete SSE terminal events, truncated-stream rejection without fallback,
protocol-specific error reporting and durable preflight progress.

Application smoke record `831ed0ed-9ed6-493c-b71f-38a539f50715` retained a
successful preflight count of 1,932 and then failed generation with
`operation: response`, `parameter: tool_choice`. This confirms the distinction
through the running service. No image request was submitted. Original backup
rows remain present, SQLite integrity is `ok`, and foreign keys are valid.
