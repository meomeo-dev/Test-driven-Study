---
id: 0023
type: feat
status: closed
closed-by: 7691032ca608760c4c407ed7006b7f830a8d9e0c
labels: []
branch: feat/0023-add-driving-subject-requirements-guide
created: 2026-11-03
---
# Add driving subject requirements guide

## 背景 / 目标

Provide an accessible Chinese guide to Subjects 1–4 for initial C1/C2 learners,
including exam prerequisites, curriculum, training hours and examination format.
Distinguish formal legal naming and national rules from local booking verification.

## 关键功能清单（Key Feature List，KFL）

- Add a dedicated sidebar route and C1/C2 selection.
- Show four subject sections with prerequisites, study content, hours and exam format.
- Cite current official national and Yunnan sources with effective/review dates.
- Keep the page bounded, with secondary details in tabs or expandable panels.

## 改造面

- Sidebar/routes and a dedicated guide feature with typed content.
- Responsive guide styles and browser acceptance checks.
- Public-source research reference and reader documentation.

## 非目标

- Driving-school enrollment, booking APIs or personal eligibility determinations.
- Treating syllabus hours as a universal local booking-system threshold.

## 验收标准（Acceptance Criteria，AC）

- All four subjects are available through the new menu and direct URLs.
- C1/C2 hour differences and the formal Subject 4 naming are accurate and cited.
- Prerequisites, theory/practical hours, daily limits and exam details are readable.
- Sources are official, dated and linked; unverified local details are labeled.
- Desktop/mobile views remain bounded and keyboard accessible.

## 讨论

Implement directly on main. No worktree is created. Public research is isolated from private implementation and credentials.

The guide targets initial C1/C2 applications. National teaching-hour baselines
remain distinct from unverified local automatic approval thresholds. Official
sources and interface scope are documented in
[the subject guide](../docs/features/subject-guide/README.md).
