# Resolution presets and reference images

Review date: 2026-11-01. The application follows the supplied imagegen skill's
`scripts/image_gen.py` function `_validate_gpt_image_2_size` and the documented
GPT Image 2 constraints. The skill script is referenced, not modified or run as
the application's backend.

Both edges must be multiples of 16, neither edge may exceed 3840, the long/short
edge ratio must be at most 3, and area must be 655,360–8,294,400 pixels inclusive.
The same arithmetic is enforced by Go validation and frontend preset validation.
Both languages read the same `internal/palace/output-sizes.json` preset table;
the Go executable embeds it and the frontend imports it during the build.
The API receives `size=WIDTHxHEIGHT`; resolution and aspect ratio are local
selection fields, not invented upstream API parameters.

| Aspect | 1K tier: smallest legal size | Approximately 2K | 4K tier / maximum |
| --- | --- | --- | --- |
| 9:16 | 720×1280 | 1152×2048 | 2160×3840 |
| 2:3 | 672×1008 | 1376×2064 | 2336×3504, capped at approximately 3.5K |

These are calculated presets; K is a tier label and actual dimensions are always
visible. Exact 9:16 at 576×1024 is below the minimum area. Exact 2:3 at
2560×3840 exceeds the maximum area. The top 2:3 option explicitly displays its
cap. The earlier size-only 1024×1536 request remains accepted for compatibility.

The API reference labels resolutions above 2560×1440 experimental. A compatible
service can reject custom dimensions even when the arithmetic is valid. There
is no automatic fallback, paid retry, or local upscale. The canvas shows actual
returned dimensions. Automated tests use a local fixture; no paid 4K quality
comparison was performed.

Sources: [Image API generation](https://developers.openai.com/api/reference/resources/images/methods/generate),
[Image API edit](https://developers.openai.com/api/reference/resources/images/methods/edit),
[GPT Image 2 parameters](https://developers.openai.com/api/docs/guides/image-prompting#gpt-image-2-model-parameters).

## Reference contract and prompt version

Available original JPEG/PNG images are selected as references by default and
sent using multipart `image[]` to `/images/edits`. Their hashes are saved and
checked before inference. Text-only jobs use `/images/generations`. GIF images
remain viewable but are not silently flattened for model input. No unsupported
`input_fidelity` parameter is sent for GPT Image 2.

The v1.1 template makes three prompt edits: remove the question-identifier input
line without replacement; identify the complete question text as the source of
the stem/options; label reference image 1 and preserve signal colors, sign
text/shapes, vehicle positions, and directions. Other teaching structure and
style instructions remain unchanged. Its three active variables are
QUESTION_TEXT, REFERENCE_ANSWER, and PALACE_ADDRESS. Existing job snapshots
retain their original prompt/version, including v1.0 images.

Input-image roles and explicit invariants follow the supplied imagegen skill's
prompting guidance. They guide generation rather than guarantee exact diagram
preservation; compare the output with the original before relying on it.
