---
id: 0026
type: feat
status: closed
closed-by: 1a77e17
labels: []
branch: feat/0026-add-timed-theory-mock-examinations
created: 2026-11-03
---
# Add timed theory mock examinations

## 背景 / 目标

Implement persistent, timed theory mock examinations for the local Yunnan passenger-car question bank, using verified national rules and clearly identified simulation behavior.

## 关键功能清单（Key Feature List，KFL）

- Research official examination rules and public interface behavior with isolated subagents.
- Add Subject 1 and Subject 4 preparation, random papers, countdown, question navigation and keyboard controls.
- Save answers and resume the same paper after reload or service restart.
- Grade on the server, record results, support review and integrate submitted answers into learning statistics.

## 改造面

- SQLite migration and sqlc queries; study examination domain and HTTP contract.
- React examination feature, sidebar, API types and bounded responsive styles.
- Unit, HTTP and browser acceptance coverage; user documentation and evidence.

## 非目标

- Official exam registration, identity verification, credited training hours or physical driving exams.
- Claiming an exact copy of a Yunnan examination vendor interface or official paper sampling.
- New dependencies, worktrees or external model requests.

## 验收标准（Acceptance Criteria，AC）

- Official facts have linked sources and uncertain simulation choices are identified.
- Papers have unique locally available questions, stable order and server-owned deadlines.
- Unsubmitted papers expose no correct answers or explanations.
- Duplicate submissions cannot duplicate scores or learning attempts.
- Expiry, early submission, result history and wrong-answer review persist across reloads.
- Primary controls remain within the viewport on desktop and mobile.
- Existing data remains unchanged by migration and verification.

## 讨论

Develop and commit on main without creating a worktree. Reuse existing question assets, scoring normalization, dialogs and typed API generation.
