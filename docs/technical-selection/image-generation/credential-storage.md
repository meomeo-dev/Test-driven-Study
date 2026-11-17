# Provider credential storage

Review date: 2026-11-01. Selected dependency:
`github.com/zalando/go-keyring v0.2.8`.

The browser settings dialog requires persistent credentials without storing
them in browser storage, source control, or the study database. A small
`CredentialStore` interface isolates OS persistence from provider and job logic.
The application stores one bounded connection profile in the OS credential
store, including the API key and any proxy authentication.

## Selection and dependency assessment

| Concern | Assessment |
| --- | --- |
| Fit | Generic credential Set/Get/Delete; macOS Keychain, Windows Credential Manager, Linux Secret Service. |
| Maintenance | Latest stable tag verified as v0.2.8 on the review date; pin the tag rather than master. |
| Adoption | Existing portable Go credential library, rather than a custom encryption scheme. Popularity is not a security audit. |
| License | Root MIT; Darwin source Apache-2.0; included shellescape MIT. |
| Added modules | go-keyring v0.2.8; wincred v1.2.3 (MIT); godbus/dbus/v5 v5.2.2 (BSD-2-Clause). |
| Existing shared module | x/sys remains at the application's v0.49.0; the library minimum is v0.27.0. |
| Go/platform requirements | Root Go 1.18; its D-Bus dependency declares Go 1.20. No new CGO requirement on macOS. |
| Supply chain | Go module checksums and pinned versions; inspect platform source on upgrades. No external binary download or shell interpolation. |
| Runtime cost | Local OS credential operations; no hosted secret service or paid SDK. |
| Lock-in | Restricted to `CredentialStore`; switch adapters without changing jobs or HTTP types. |
| Exit conditions | Unsafe secret transport, unmaintained platform support, incompatible OS behavior, or a signed packaged app needing native Keychain policy. |

The exact Darwin tag executes `/usr/bin/security -i` and writes an escaped,
base64-encoded command to stdin. Secrets are absent from subprocess arguments.
Base64 is transport encoding; Keychain supplies at-rest protection. The library
has no request-context API, and OS access prompts may require user interaction.
The application bounds the serialized profile to 2300 bytes, below the
Darwin implementation's 4096-byte encoded command limit.

Sources: [release](https://github.com/zalando/go-keyring/releases/tag/v0.2.8),
[pinned Darwin source](https://github.com/zalando/go-keyring/blob/v0.2.8/keyring_darwin.go),
[module requirements](https://github.com/zalando/go-keyring/blob/v0.2.8/go.mod),
[root license](https://github.com/zalando/go-keyring/blob/v0.2.8/LICENSE),
[Unix implementation](https://github.com/zalando/go-keyring/blob/v0.2.8/keyring_unix.go),
[Apple Keychain](https://developer.apple.com/documentation/security/using-the-keychain-to-manage-user-secrets).

Alternatives considered: a mode-0600 JSON file is simpler but retains plaintext
secrets; native Keychain bindings add CGO; broader keyring libraries add backend
choices and dependencies unnecessary for this application. No plaintext fallback
is used when system credential storage is unavailable or denied.

## Persistence and update boundaries

Each save writes a new random account under the app-specific credential service
and verifies its content. It then atomically replaces a mode-0600 index file in
the study data directory. The index contains the account reference and sanitized
URL/model metadata, without API keys or proxy authentication. Only a successful
save changes the live provider. The previous active item is then removed.

A crash before index replacement can leave an unused OS item. A cleanup failure
is logged without secret values; it does not invalidate the newly saved profile.
The application never removes unrelated Keychain items.

Read APIs return `key_configured`, never the key, a ciphertext, or a reusable
mask. Empty key input retains the key; explicit removal disables it. A changed
provider origin requires a new key or explicit reuse. Existing proxy credentials
survive a round-trip through the sanitized, unchanged proxy URL.

Settings writes require both the existing loopback Host/origin restrictions
and an unpredictable process-local write token. Responses use `Cache-Control:
no-store`. Connection tests only call the model-list endpoint through the
explicit proxy and do not save settings or generate images.

Saved UI settings override the bootstrap dotenv configuration. A locked or
missing saved OS credential disables generation instead of silently restoring
the old dotenv key. On a different computer, re-enter credentials in the dialog.
Automated tests inject a fake credential store and never modify real OS items.
