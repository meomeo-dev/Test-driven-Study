---
id: 0086
type: feat
status: closed
closed-by: 09fd0c8
labels: [security, llm, palace, tts, ui, api]
branch: feat/0086-add-explicit-allow-direct-https-opt-in-for-ai-and-tts-provid
created: 2026-11-23
---
# Add explicit allow direct HTTPS opt-in for AI and TTS providers

## 背景 / 目标

Remote AI (LLM and Image/Palace) and TTS provider requests currently require an
explicit proxy URL with no way to connect directly to remote `https://`
endpoints even when a local user intentionally operates without a proxy. At the
same time, silent fallback from a configured proxy or implicit environment
proxy discovery must remain strictly forbidden.

This feature adds a manually-checked, default-off `"Allow direct HTTPS"` opt-in
(`allow_direct_https: bool`) across LLM, Image/Palace, and TTS settings, HTTP
contracts, backend transport validation, settings UI, and repository guidance
while preserving strict proxy-required-by-default security invariants.

## 关键功能清单（Key Feature List，KFL）

- Add `allow_direct_https` (`boolean`, default `false`) to LLM, Image/Palace,
  and TTS settings GET/PUT/Test schemas in `contracts/http/openapi.yaml` and
  regenerate `web/src/api/generated/` via `npm run generate:api`.
- Add `AllowDirectHTTPS bool` (`json:"allow_direct_https"`) across config,
  persistence (`<dataDir>/{llm,image,tts}-provider.json`), settings payloads,
  and HTTP handlers in `internal/llm/`, `internal/palace/`, `internal/tts/`,
  and `internal/httpapi/`.
- Enforce five transport security invariants across all three providers:
  1. `AllowDirectHTTPS == false` + empty `ProxyURL` + remote `https://` ->
     reject (unchanged strict default).
  2. `AllowDirectHTTPS == true` + empty `ProxyURL` + remote `https://` ->
     allow with `transport.Proxy = nil` (never read environment proxy vars).
  3. `AllowDirectHTTPS == true` + remote plaintext `http://` (non-loopback) ->
     reject; loopback `http://127.0.0.1`, `localhost`, and `::1` remain allowed.
  4. `AllowDirectHTTPS == true` + non-empty `ProxyURL` -> use configured proxy
     with zero silent fallback to direct.
  5. Existing provider JSON files omitting `allow_direct_https` default to
     `false` on load.
- Add a default-unchecked checkbox (`允许直连 HTTPS（Allow direct HTTPS）`) with
  concise helper text in all three Settings dialog provider tabs (LLM, Image/
  Palace, TTS) and wire `allow_direct_https` in `web/src/api/{llm,palace,tts}.ts`
  for load, save, and connectivity test requests.
- Update the remote-proxy invariant bullet in `AGENTS.md` to document the
  explicit opt-in while reiterating zero silent direct fallback.
- Add unit tests covering all five security invariants in Go and serialization /
  default-off behavior in frontend unit tests.

## 改造面

- `contracts/http/openapi.yaml` and generated `web/src/api/generated/`
- `internal/llm/`, `internal/palace/`, `internal/tts/`, and `internal/httpapi/`
  (provider config, validation, transport, settings handlers, and tests)
- `web/src/api/{llm,palace,tts}.ts` (and settings clients/types)
- Settings dialog UI components and unit tests under `web/src/`
- `AGENTS.md`

## 非目标

- Reading `HTTP_PROXY`/`HTTPS_PROXY` environment variables automatically or
  introducing silent proxy-to-direct fallback.
- Allowing unencrypted plaintext `http://` connections to non-loopback hosts.
- Adding new AI/TTS providers, changing keyring credential storage, or altering
  database schemas.

## 验收标准（Acceptance Criteria，AC）

- All five transport security invariants are implemented and covered by Go unit
  tests across `internal/llm`, `internal/palace`, `internal/tts`, and
  `internal/httpapi`.
- Settings GET/PUT/Test API contracts and generated TypeScript types match
  (`npm run check:generated` reports no drift).
- All three Settings tabs display a default-unchecked checkbox with Chinese
  copy + `"Allow direct HTTPS"` and transmit `allow_direct_https` on save and
  test, covered by frontend unit tests.
- `AGENTS.md` accurately documents the default-proxy requirement and explicit
  direct-HTTPS opt-in.
- `npm run check:generated`, `go test -count=1 ./...`, `go vet ./...`,
  `npm run typecheck`, `npm run test:unit`, `npm run build`, `git diff --check`,
  and `node scripts/issue-check.mjs` all pass cleanly.

## 讨论

- Keeping `transport.Proxy = nil` when `AllowDirectHTTPS == true` and
  `ProxyURL == ""` prevents `http.ProxyFromEnvironment` from silently routing
  traffic through ambient shell proxy variables.

### Verification

- `go test -count=1 ./...`: passed (`9/9` packages ok).
- Focused security and contract tests (`TestAllowDirectHTTPS*`,
  `TestTTSAllowDirectHTTPS*`, `TestLLMSettingsAllowDirectHTTPSContract`,
  `TestPalaceSettingsAllowDirectHTTPSContract`, `TestTTSRoutes`) across
  `internal/{llm,palace,tts,httpapi}`: `8/8` suites passed (`0` skips).
- `go vet ./...`: passed.
- `npm run typecheck && npm run test:unit`: passed (`tsc --noEmit` clean;
  Vitest `16/16` files, `66/66` tests passed).
- `npm run build`: passed (`tsc --noEmit`, `vite build` 3365 modules, and
  `go build ./cmd/server`).
- `npm run generate:api` SHA-256 check: zero drift on
  `web/src/api/generated/*`. Material gap on `npm run check:generated`: its
  `generate:db` step requires cached `sqlc v1.31.1` (unavailable offline in
  this environment); `db/` and `internal/storage/` were untouched in `#86`.
- `git diff --check`, `gofmt -l`, and `node scripts/issue-check.mjs`: all clean.
