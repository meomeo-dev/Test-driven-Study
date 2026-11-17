# Responses planning acceptance

Historical verification of issue #18 on 2026-11-02. The automatic pipeline in
issue #19 supersedes the manual adoption interaction described here.

## Automated verification

`GOPROXY=off GOSUMDB=off npm run check` passed:

- Issue validation and generated HTTP/SQL binding consistency.
- 13 frontend unit tests and all Go package tests.
- 3 background-startup tests.
- TypeScript checking and frontend/API production builds.
- 58 browser tests, including provider-tab isolation, structured planning,
  explicit adoption, image-job provenance, incomplete-output rejection and
  recovery after an uncertain POST response.
- Desktop/mobile viewport bounds and keyboard tab navigation.

Automated inference uses loopback fixtures and isolated SQLite/credential stores.
It does not contact the configured real providers or modify real study results.

## Actual provider verification

The configured `.env.gpt` endpoint was contacted through its explicit proxy.
Model-list authentication succeeded. Five configured model IDs appeared in the
response; `gpt-5.5` did not. Listing is not proof of Responses compatibility.

One explicit Responses request used `gpt-6.1-sol`, `medium` reasoning and an
8 K ceiling (8192 tokens). It completed with all required structured fields:
`title`, `scene`, `anchors`, `pitfalls`, and `image_prompt`.

Returned usage was 1922 input, 1462 output and 3384 total tokens. No image request
was submitted during this live verification. Image generation remains a separate
user action. No additional model or 4K capability is inferred from this result.

The extracted image prompt retained the question's answer, red-light condition
and canonical teaching layout. Human review remains necessary for instructional
accuracy; the text-only LLM did not inspect the original question image.

## Existing data

A SQLite backup was created before migration. All original rows were retained:

| Table | Before | After |
| --- | ---: | ---: |
| Questions | 3147 | 3147 |
| Scored attempts | 287 | 287 |
| Image jobs | 14 | 14 |

Database integrity returned `ok`; foreign-key checks returned no violations.
Actual provider keys and private Base URLs were absent from tracked/unignored
source files, production assets and development logs.

## UI evidence

The settings and planning screenshots under `docs/ui/palace/llm-*.png` use local
fixtures and contain no actual provider credentials or private endpoint address.
