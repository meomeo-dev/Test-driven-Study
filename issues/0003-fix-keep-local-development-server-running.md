---
id: 0003
type: fix
status: closed
closed-by: 29776db72227c607409e81fad1623b8081344d7b
labels: []
branch: fix/0003-keep-local-development-server-running
created: 2026-11-01
---
# Keep local development server running

## 背景 / 目标

The local page refuses connections when its foreground development process
stops after verification or terminal closure. Provide an explicit persistent
local startup path with readiness checks and process ownership.

## 关键功能清单（Key Feature List，KFL）

- Background startup, status, and stop npm commands.
- Wait for the real frontend and API before reporting readiness.
- Reuse an already managed process and reject occupied ports.
- Preserve logs and refuse to stop an unrelated process from stale PID data.

## 改造面

- scripts/dev-process.mjs and package.json.
- tests/startup/dev-process.test.mjs.
- README.md and this issue record.

## 非目标

Operating-system login services, public hosting, new dependencies, changes to
quiz behavior, and automatically stopping unrelated applications.

## 验收标准（Acceptance Criteria，AC）

- AC1: the background server survives the launcher command exiting.
- AC2: a second startup reuses the same managed PID.
- AC3: stop releases both owned ports; stale metadata cannot stop unrelated processes.
- AC4: occupied ports fail without leaving a managed process record.
- AC5: the default page serves real data and remains running after verification.
- AC6: the fix is committed directly on main as explicitly requested.

## 讨论

Implementation is performed directly on main at the user's explicit request;
no linked worktree is created. Background management targets this local macOS
setup and other POSIX systems. Foreground npm run dev remains available.

Verification: three startup regression cases passed. The default frontend and
API were then started in background mode; both health/readiness checks passed,
and the browser displayed the real memorization page with existing progress.
The managed server remains running for continued use.
