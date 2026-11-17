---
id: 0016
type: feat
status: closed
closed-by: 359e984
labels: []
branch: feat/0016-configure-image-provider-from-settings-dialog
created: 2026-11-01
---
# Configure image provider from settings dialog

## 背景 / 目标

Provide browser settings for new installations and existing image-provider
configuration. Work directly on main, without a linked worktree.

## 关键功能清单（Key Feature List，KFL）

- A compact modal for base URL, API key, model names, and explicit proxy.
- OS credential storage through a reviewed, pinned Go keyring adapter.
- Masked read APIs; explicit keep/replace/remove secret behavior.
- Immediate application after successful persistence, without interrupting jobs.
- Origin-bound key reuse, local CSRF protection, and safe connection checks.
- Existing dotenv example, documented precedence, and isolated acceptance tests.

## 改造面

internal/palace provider configuration and credential adapter; HTTP contracts
and handlers; React settings modal and entry points; Go and browser tests;
Go modules; configuration examples and reader documentation.

## 非目标

Browser/localStorage key persistence, returning saved secrets, automatic
plaintext fallback, remote configuration synchronization, paid image retries,
and worktrees.

## 验收标准（Acceptance Criteria，AC）

- AC1: Settings are available even without any configured provider.
- AC2: The key is stored in the OS credential store and never returned by GET.
- AC3: Empty key input preserves it; explicit removal disables generation.
- AC4: Changed provider origins require a new key or explicit reuse consent.
- AC5: Failed storage writes preserve the last applied configuration.
- AC6: Remote requests retain explicit proxy transport with no direct fallback.
- AC7: Active jobs block configuration changes; successful saves apply immediately.
- AC8: Tests use injected credential stores and never alter real saved credentials.
- AC9: Examples, README, dependency review, and feature documentation are current.

## 讨论

Use a narrow credential-store adapter with no silent fallback to plaintext.
The existing ignored dotenv file remains an explicit bootstrap option. Saved
UI settings take precedence after restart; credentials must be reconfigured
on a different machine rather than copied with the study database.

Implemented directly on main in commit 359e984. All acceptance criteria passed.
The complete check passed with 53 browser tests, ten frontend unit tests, all Go
packages, three startup checks, generated bindings, and production builds.
No linked worktree was created.
