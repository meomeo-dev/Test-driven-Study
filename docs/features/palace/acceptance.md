# Memory-palace acceptance

Date: 2026-11-01. Branch: `main`. No linked worktree was created.

The follow-up provider dialog is specified in
[credential storage](../../technical-selection/image-generation/credential-storage.md).
Its automated checks use an injected credential store and public fixture URLs;
the actual machine's API key and Keychain items are not modified by tests.

Refinement coverage includes shared legal-size presets, invalid edge/area/grid
dimensions, omitted question-ID input, reference transmission, persistent
generation parameters, and badges in all navigators. A 35-job fixture verifies
that an older successful question remains discoverable outside recent history;
failed jobs never count as saved images.

## Real provider integration

One explicit image job used the configured `gpt-image-2` model with original
question #4, the complete v1 prompt, a palace address, the original JPEG
reference, medium quality, and 1152×2048 output dimensions. The provider POST
used the configured explicit proxy. No automatic retry was performed.

The job succeeded in 35.78 seconds and saved a valid local PNG:

| Property | Result |
| --- | --- |
| Dimensions | 1152×2048 |
| Bytes | 4,105,734 |
| SHA-256 | `92a29051412612d66edad0b56ecc47fbefd25ddb26bafebc33b551c659cf8082` |
| Provider-reported input / output / total tokens | 1,685 / 2,376 / 4,061 |
| Local status | `succeeded` |

The output presents answer “2. 错误”, the red traffic signal, the six requested
teaching regions, and a three-scene mnemonic. This verifies the integration,
not general model quality. The generated wording “路口中间的位置” adds an
interpretation of the diagram and should be checked against the original.
No legal-source verification or multi-question model benchmark was performed.
Token counts do not establish the configured provider's billed price.

The image in `docs/ui/palace/desktop-light.png` shows the memory palace workspace
in the implemented page. It is not a fixture image or design mockup. Page and image requests use local URLs.

## Data and template preservation

A consistent SQLite backup was created while the app was stopped before the
new migration. The original 3,147 question rows, three review-mark rows, and
223 scored attempts remained unchanged. All pre-existing exposure records
remained present; opening study pages can append new exposures.

The initial relocated v1.0 prompt matched the former source byte for byte:
`348f8e31e692bd23ed697fe81b07d096bc2a27e95688e34e330e3a3bd9ef7cac`.
It is embedded in the Go executable, and the real job retained its complete
rendered prompt, original question snapshot, settings, and reference hash.

The authorized v1.1 refinement removes the question-identifier input and makes
the reference-image role explicit. Its SHA-256 is
`2d03f72c6271f494abb0c5fcaea644d64c937de05bf81587bb91278d968c452a`.
The original real job above retains its v1.0 prompt and image unchanged.

## Automated coverage

`GOPROXY=off GOSUMDB=off npm run check` passed after the provider/preset
refinements: issue validation, regenerated binding consistency, ten frontend
unit tests, all Go packages, three startup checks, production frontend/API
builds, and 53 browser acceptance tests.

The supplied imagegen script's actual `_validate_gpt_image_2_size` function
accepted all six application presets and rejected four deliberately invalid
edge/grid/area examples. This validation only executed local arithmetic.
No additional paid 4K generation was submitted by automated acceptance.

Go coverage exercises JSON/multipart provider requests, base64/local URL
responses, uncredentialed downloads, redirect rejection, proxy-required failure,
image integrity/size rejection, prompt substitution, secret-safe configuration,
HTTP validation, idempotency/conflicts, queue capacity, cancellation, persistent
failures, and restart interruption without replaying provider calls.

Browser acceptance uses an isolated SQLite database and a loopback fake provider.
It covers generation, prompt preview, saved details, original-question entry,
history selection, download, reload, failure, explicit retry, uncertain-submit
idempotency, cancellation, disabled configuration, and responsive dialogs.

The tested viewport sizes are 1440×900, 1280×600, 1024×768, 700×600, and
390×844. The root document fits each viewport; content scrolls inside panels
and dialogs. No browser test reads real credentials or makes a paid AI request.

## Current pipeline acceptance

The automatic LLM/image pipeline, vision inputs, required research, context
compaction and template v1.2 follow-up are verified separately in
[pipeline acceptance](pipeline-acceptance.md). Historical outputs above retain
their original prompt versions and have not been regenerated.
