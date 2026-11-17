---
id: 0027
type: feat
status: in-progress
labels: []
branch: feat/0027-replicate-the-current-yunnan-theory-examination-terminal
created: 2026-11-03
---
# Replicate the current Yunnan theory examination terminal

## 背景 / 目标

Replace the learning-site presentation of mock examinations with a faithful reproduction of the current actual Yunnan candidate terminal. Kunming or Yuxi is an acceptable reference location. Visual and interaction fidelity take precedence over the website design system.

## 关键功能清单（Key Feature List，KFL）

- Establish a dated current candidate-screen reference and its applicable system/version.
- Reproduce the complete candidate flow, visible labels, geometry and input behavior.
- Isolate the examination terminal from site navigation, themes and study shortcuts.
- Retain durable papers, server-owned deadlines, grading and learning records.
- Validate the implementation against the reference screen and operation sequence.

## 改造面

- Examination page, question controls, navigation, dialogs, CSS and keyboard bindings.
- Examination HTTP/domain behavior only where verified terminal interactions require it.
- Current reference evidence, acceptance screenshots and browser regression tests.

## 非目标

- Reusing historic mock-software screenshots as current-version evidence.
- Inferring candidate UI from procurement of room-management or cloud-desktop products.
- Altering the appearance or shortcuts of other learning pages.
- Collecting real identity or camera data merely to imitate a login screen.

## 验收标准（Acceptance Criteria，AC）

- A current actual candidate screen is supported by a traceable reference, date and location/version evidence.
- Screenshot publication/upload date is distinguished from the system version in use.
- Option selection, commitment, feedback, answer revision, navigation and paper submission match observed behavior.
- Website themes, sidebar and unrelated shortcuts do not affect the terminal.
- Persistence, idempotency, scoring and learning-history regression checks pass.
- The interface is not described as a current high-fidelity replica before the reference is verified.

## 讨论

Continue directly on main without a worktree. The user explicitly selected the
supplied recording as the implementation reference on 2026-11-03. Reproduce its
preparation, fixed examination workspace, answer table, next-question assessment,
wrong-answer feedback and submission/result dialogs independently of site themes.
Retain the documented source date and do not claim verified current Yunnan
deployment or complete local-content coverage.

The user supplied BV1PS4y1J7qb on 2026-11-03. Its 1080p video was downloaded
through an explicit proxy and inspected using overview and detailed transition
frames. The upload date is 2022-07-13, and visible labels identify a third-party
driving-school simulator. Ten selected frames and source metadata are preserved
under the matching issue assets directory. The canonical interface analysis is
docs/features/mock-exam/references/bilibili-bv1ps4y1j7qb.md. This provides concrete
historical geometry and interaction evidence but does not verify current Yunnan
deployment, so the original current-terminal acceptance criteria remain open.

The recorded-terminal implementation is complete: independent preparation and
examination views, fixed candidate/question/answer-table regions, lower image
region, atomic next-question assessment, ten-second wrong-answer feedback,
submission confirmation and result/review dialogs. Validation passed 74 browser
checks, 17 frontend unit tests, all Go tests, four startup tests and the production
build. The live 43187 service displays the new terminal. The original active paper
and deadline are retained. Current official Yunnan deployment and local-content
quota verification remain outstanding; this issue is not closed as full official
equivalence.
