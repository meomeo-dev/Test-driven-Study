---
id: 0029
type: feat
status: closed
closed-by: e6c54df
labels: []
branch: feat/0029-restart-an-active-mock-examination-from-preparation
created: 2026-11-03
---
# Restart an active mock examination from preparation

## 背景 / 目标

Allow a learner to start a fresh timed paper while an unfinished examination
exists. Place the restart control to the right of Continue on the preparation page.

## 关键功能清单（Key Feature List，KFL）

- Show Restart beside Continue for the current subject's active examination.
- Confirm that the old paper is finalized and retained before creating a new one.
- Reuse finalization, creation and retry-safe UUID recovery.
- Refresh examination history and learning-analysis caches after restarting.

## 改造面

- Examination preparation controls and creation request handling.
- Local request-ID helper, independent terminal CSS and browser regression checks.
- Mock-examination usage documentation and acceptance requirements.

## 非目标

- Deleting or rewriting the old paper, answers or original deadline.
- Resetting other subjects or changing scoring, sampling or question data.
- A new worktree, service dependency or alternative examination backend.

## 验收标准（Acceptance Criteria，AC）

- Restart appears to the right of Continue and fits desktop and narrow viewports.
- Cancelling leaves the original paper active with the same deadline.
- Confirming retains the old result and creates a different paper with a full timer.
- Lost responses and retries cannot create duplicate papers or learning attempts.
- If finalization succeeds but creation fails, retry can recover or create the
  pending new UUID without reusing the finalized old paper.
- Relevant browser checks and the production build pass without modifying live data.

## 讨论

Implement directly on main. The supplied preparation screenshot is retained under
the matching issue assets directory. Restart uses the existing final-submit and
create operations; unsubmitted old questions score zero, and submitted answers
remain available in history and learning analysis.

Completed in `e6c54df`. Existing examination browser regressions and interrupted
restart recovery passed. Manual checks with isolated data verified cancellation,
aligned controls, a fresh full timer, and preservation of the old answer and result.
The production build passed; live learner data was not used for verification.
