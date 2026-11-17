---
id: 0028
type: fix
status: closed
closed-by: 665399d
labels: []
branch: fix/0028-align-theory-paper-composition-and-expose-yunnan-coverage-ga
created: 2026-11-03
---
# Align theory paper composition and expose Yunnan coverage gaps

## 背景 / 目标

Align initial C1/C2 theory mock papers with the current national baseline used
for Yunnan preparation. Distinguish verified type/scoring rules from unverified
local-content coverage and actual terminal behavior.

## 关键功能清单（Key Feature List，KFL）

- Enforce 40 judgment / 60 single-choice questions for Subject 1.
- Enforce 20 judgment / 20 single-choice / 10 multiple-choice for safety knowledge.
- Present syllabus groups, target content quotas, sources and coverage limits.
- Preserve saved papers and their rule snapshots when current rules change.
- Audit whether the imported bank identifies Yunnan local questions and topics.

## 改造面

- Study-domain examination rules, paper assembly and regression tests.
- HTTP schema, generated client types, preparation dialog and subject guide.
- Bank audit script and examination evidence/user documentation.

## 非目标

- Fabricating province/topic labels from question counts or chapter names.
- Claiming a commercial bank is the official current Yunnan examination bank.
- Closing the separate current-terminal reference requirement in issue #27.
- Changing original imported data or existing learning records.

## 验收标准（Acceptance Criteria，AC）

- Every new paper has exact type quotas, unique eligible questions and no answers
  exposed before submission; insufficient type pools fail rather than substitute.
- The UI distinguishes reference topic quotas from the sampler's actual coverage.
- Both theory components retain 45 minutes, 100 total points and a 90-point pass.
- Historical rule/paper snapshots remain readable and determine historical grading.
- The bank audit reports missing region/topic provenance reproducibly.
- Relevant domain, HTTP, browser, contract and build checks pass.

## 讨论

Work directly on main without creating a worktree. Current standards registration
and a police-published released-text copy support the numeric baseline; the copy
reserves the final typeset publication. The available official preview is a draft.
The bank's province_id/city_id fields are all zero and its commercial chapters do
not establish the standard's topic groups. Full Yunnan content alignment remains
dependent on reviewed topic classification and verifiable local questions.

Implemented in 665399d. The complete repository gate passed: 74 browser tests,
15 frontend unit tests, all Go tests, four startup tests and the production build.
The read-only bank audit reports all 3,147 province/city IDs as zero. Runtime
restart preserved all original rows and 23 generated-image files; SQLite
integrity passed. The missing content provenance and current-terminal reference
remain explicit limitations rather than completed Yunnan equivalence claims.
