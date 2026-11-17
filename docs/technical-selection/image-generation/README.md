# Image generation selection

Review date: 2026-11-01. Scope: personal, local React/TypeScript application
with a Go backend and an existing GPT Image-compatible provider configuration.

## Selected implementation

Use Go `net/http`, `encoding/json`, and `mime/multipart` behind the
`palace.ImageProvider` interface. Reuse SQLite, Goose, sqlc, TanStack Query,
and Radix dialogs already installed in the application. Image generation itself
adds no AI SDK or npm dependency. The provider-settings feature adds a narrow
OS credential adapter; see [credential storage](credential-storage.md).
The browser talks only to the local Go API.

The provider implements the two required image operations; it does not need
chat orchestration, embeddings, an agent framework, or a Python service.
`net/http` supports proxy transports, request contexts, deadlines, and redirect
control. Source: [Go HTTP package](https://pkg.go.dev/net/http).

| Candidate | Fit and decision | License / replacement condition |
| --- | --- | --- |
| Go standard library | Selected for two bounded requests and explicit proxy behavior. No new transitive dependencies. | BSD-3-Clause; replace the adapter if supported operations expand substantially. |
| Official OpenAI Go SDK | Maintained upstream option with typed APIs; unnecessary additional API surface here. Its default retries must be disabled for uncertain paid calls. | Apache-2.0; adopt behind `ImageProvider` when additional official API operations justify it. |
| OpenAI JS / Vercel AI SDK | Useful for a Node backend or multi-provider TypeScript application. This application's backend is Go. | Apache-2.0; revisit only if backend ownership changes. |
| ComfyUI / InvokeAI / Diffusers | Local generation introduces model downloads, inference services, and hardware requirements outside the requested endpoint integration. | ComfyUI GPL-3.0; Diffusers Apache-2.0. Reassess model licenses separately before local inference. |

Primary references: [OpenAI Go](https://github.com/openai/openai-go),
[SDK retries](https://github.com/openai/openai-go#retries),
[OpenAI JS](https://github.com/openai/openai-node),
[AI SDK OpenAI provider](https://ai-sdk.dev/providers/ai-sdk-providers/openai),
[AI SDK license](https://github.com/vercel/ai/blob/main/LICENSE),
[ComfyUI](https://github.com/comfy-org/ComfyUI),
[Diffusers](https://github.com/huggingface/diffusers).

The small adapter avoids introducing another supply chain. It still requires
maintenance when provider contracts change. Live credentials, provider terms,
availability, usage, and image quality remain properties of the configured
service, rather than guarantees supplied by an SDK.

## Local collection findings

The supplied `futuristic_viz/data` export contains 2,849 repository records
and 2,395 scan records. Its curated catalogue has no image-generation category.
Relevant exact extracted dependencies include `openai`, `@google/genai`, `ai`,
`@ai-sdk/openai`, and `@ai-sdk/openai-compatible`. Examples include Vane,
Sim, Dyad, and the Vercel AI repository.

Fifteen scan records match the public AI dependency set recorded in
[local-evidence.json](local-evidence.json). These are dependency observations;
they do not establish that a repository calls an image API. No exact
`diffusers`, `replicate`, or `@fal-ai/*` dependency was extracted in that set.
Repository entries for image applications with empty extracted hits do not
prove that their dependencies are absent. The collection supplies candidates,
not a complete SDK census, version audit, or image-quality benchmark.

The evidence file records relevant names and input hashes, without copying the
entire collection or private provider configuration.

## Provider protocol

- Text-only generation: JSON `POST /images/generations` under the configured
  versioned base URL. Reference generation: multipart `POST /images/edits`
  with the original PNG/JPEG under `image[]`.
- Send the full prompt, configured model, `n=1`, size, quality, and
  `output_format=png`. Omit legacy `response_format` and `input_fidelity`.
- Prefer base64 output. Compatible services returning a URL are supported;
  downloads use the same explicit proxy, no provider authorization, and no
  redirects. Returned PNG/JPEG bytes are decoded and stored locally.
- Default to configured `gpt-image-2`; keep other configured model names
  selectable. Compatible-service aliases do not establish official model
  capabilities. Parameters must be accepted by the actual service.
- Offer explicit 1K/2K/4K-tier presets for 9:16 and 2:3, with actual dimensions
  and capped outputs disclosed. Keep earlier size-only requests compatible.
  See [resolution presets](resolution-presets.md) for the exact mappings.

Sources: [generation API](https://developers.openai.com/api/reference/resources/images/methods/generate),
[edit API](https://developers.openai.com/api/reference/resources/images/methods/edit),
[GPT Image 2 parameters](https://developers.openai.com/api/docs/guides/image-prompting#gpt-image-2-model-parameters).

## Persistence and failure behavior

Go reads `.env.gpt-image2` or explicit process overrides. Only readiness,
configured model names, and proxy-enabled status reach the browser. A remote
HTTPS provider requires a proxy; connection failure never falls back to direct
access. Browser tests override all provider settings with a loopback fixture.

Each submission stores an immutable question/settings/prompt snapshot and a
client UUID before inference. Repeating that UUID with the same input returns
the same job. A changed input conflicts. One worker handles at most one model
request at a time; at most ten jobs may be active. The deadline is ten minutes.

There are no automatic retries of model POST requests. Navigation and polling
do not resubmit inference. Cancellation changes local job state and cancels
the local request; it does not guarantee upstream cancellation or no charge.
Restart marks queued and running jobs interrupted for explicit user action.

Images are limited to 32 MiB and 4096 pixels per edge, decoded for integrity,
hashed, and atomically saved under `var/palaces/`. The database stores metadata,
usage returned by the provider, and the full rendered prompt. No fixed price
is inferred from token counts. Existing jobs retain their complete original
prompts. The embedded v1.1 template makes the authorized identifier/reference
edits described in the resolution reference; jobs retain their template version.

See [feature and module layout](../../features/palace/README.md) and
[UI specification](../../ui/palace/README.md) for the implemented boundaries.
