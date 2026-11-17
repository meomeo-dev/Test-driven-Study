# Hey API maintenance assessment

Verified: 2026-11-02.

## Current evidence

The canonical repository is [hey-api/hey-api](https://github.com/hey-api/hey-api).
The former `hey-api/openapi-ts` address redirects there. The project is not
archived. Stable `@hey-api/openapi-ts` 0.99.0 was released on
[2026-06-22](https://github.com/hey-api/hey-api/releases/tag/2026-06-22).
The latest main-branch commit is a dependency fix on
[2026-09-30](https://github.com/hey-api/hey-api/commit/d6ba11fd9ae4f2b707454940121056fdb505235c).
The next-tag build also dates to September 30. A stable-release slowdown is real;
these dates do not establish abandonment.

The [official versioning policy](https://heyapi.dev/docs/openapi/typescript/get-started#versioning)
still describes pre-1.0 development and recommends exact pins. The
[migration guide](https://heyapi.dev/docs/openapi/typescript/migrating) documents
configuration and generated-code changes. Version 0.99.0 requires Node >=22.18.0;
this project's Node 26 requirement satisfies it.

## Project decision

Retain the exact 0.99.0 development dependency and existing lockfile. Only the
TypeScript type-generation plugin is enabled. Requests use the application's
small Fetch adapter; generated client runtimes, provider SDKs and query hooks
are not used. Hey API has no runtime role in image generation or Responses.
The OpenAPI document remains the source of truth, with checked-in generated
output and a reproducibility check.

This boundary makes replacement limited to generator configuration and generated
type imports. Do not upgrade to an unpublished next build solely for recency.
Review security, reproducibility and contract compatibility before upgrades.

## Alternatives and exit conditions

| Option | Fit and migration scope |
| --- | --- |
| [openapi-typescript](https://openapi-ts.dev/introduction) | Closest types-only alternative; adapt generated names/imports and retain Fetch calls. |
| [Orval](https://orval.dev/) | Suitable for generated operations/query hooks; more scope than current needs. [v8.46.0](https://github.com/orval-labs/orval/releases/tag/v8.46.0) was released October 30. |
| [OpenAPI Generator typescript-fetch](https://openapi-generator.tech/docs/generators/typescript-fetch/) | Stable general generator; introduces different runtime and serialization conventions. |

Replace Hey API if a relevant security issue lacks a fix, required OpenAPI syntax
cannot be generated correctly, supported Node versions cease to work, or the
project explicitly discontinues maintenance. Re-run type checking, generated-file
consistency and HTTP behavior checks for a replacement. No dependency is added
or upgraded by this assessment.
