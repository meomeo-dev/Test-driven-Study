---
id: 18
type: feat
status: closed
closed-by: 697e0fd
labels: [ai, settings, memory-palace]
branch: feat/0018-add-independent-responses-provider-and-structured-palace-pla
created: 2026-11-01
---
# Independent Responses provider and structured palace planning

## 背景 / 目标

Configure a separate text reasoning provider and use structured Responses output
as an optional, reviewed input to memory-palace image generation.

## 关键功能清单（Key Feature List，KFL）

- Separate LLM environment configuration, system credentials, settings API and tab.
- Configurable model, reasoning effort and output token ceiling in K (1024 tokens).
- Strict JSON Schema output with bounded server-side validation.
- Explicit planning, preview and adoption before a separate image submission.
- Persistent, idempotent plan records and image-job prompt provenance.
- Restart recovery marks active work interrupted without replaying requests.

## 改造面

- Go LLM provider, settings, plan service and HTTP routes.
- SQLite migration, OpenAPI types and palace integration.
- Provider dialog tabs, planning dialog, isolated provider fixtures and tests.
- Public configuration examples and reader-facing documentation.

## 非目标

- Autonomous image retries, web research, chain-of-thought display or shared keys.
- Worktree creation; this change is implemented directly on main as requested.

## 验收标准（Acceptance Criteria，AC）

- LLM and image settings cannot overwrite or reuse each other's credentials.
- Remote calls use the configured proxy without direct fallback.
- Responses requests use store=false and strict text.format JSON Schema.
- Incomplete, refused and invalid outputs cannot become image prompts.
- Model, effort and K-unit limits survive saving and reload.
- Adopted plans retain the canonical template and are tied to their question/address.
- Automated checks use isolated stores, databases and local fixtures.
- Both tabs and planning controls fit desktop and mobile dialog bounds.

## 讨论

No new runtime dependency is required. Native HTTP and the existing OS credential
adapter dependency cover the integration. Planning and image generation remain
separate user actions, providers and records.
