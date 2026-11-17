---
id: 0002
type: chore
status: closed
closed-by: a7ed4bc839a5e0a73d4021571b905bfac60487b7
labels: []
branch: chore/0002-uncommon-local-ports
created: 2026-11-01
---
# Uncommon local ports

## 背景 / 目标

Move local startup defaults away from commonly used development ports, then
integrate the verified configuration into main.

## 关键功能清单（Key Feature List，KFL）

- Use frontend port 43187 and Go API/built-app port 43188 by default.
- Keep environment overrides and the Vite API proxy consistent.
- Use separate uncommon ports for browser acceptance.
- Update startup documentation and origin-validation fixtures.

## 改造面

- .env.example, vite.config.ts, scripts/web.mjs, cmd/server/main.go.
- playwright.config.ts and internal/httpapi/server_test.go.
- README.md and the local issue record.

## 非目标

Automatic port selection, public network access, dependency upgrades, and
changes to memorization behavior or stored learning data.

## 验收标准（Acceptance Criteria，AC）

- AC1: npm run dev serves the frontend on 43187 and proxies to API 43188.
- AC2: npm start serves the built application on 43188.
- AC3: browser acceptance uses 43287/43288 and passes.
- AC4: origin checks, type checking, and production build pass.
- AC5: defaults, environment examples, and startup URLs agree.
- AC6: the completed branch is merged into main with a clean working tree.

## 讨论

The selected ports had no listening processes during initial inspection.
Explicit environment overrides remain supported, and Vite strictPort remains
enabled so startup fails clearly if a selected port is already occupied.

Validation passed: HTTP API tests, strict TypeScript checking, production build,
seven browser workflows, and actual development/production startup on the new
default ports. Proxy requests, permitted-origin writes, and shutdown also passed.
