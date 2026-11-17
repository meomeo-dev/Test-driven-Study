---
id: 0045
type: feat
status: closed
closed-by: 457bd6b2a2adc60b45d1961a1a966f8015a001eb
labels: []
branch: feat/0045-guide-and-improve-memory-palace-prompt-authoring
created: 2026-11-12
---
# Guide and improve memory palace prompt authoring

## 背景 / 目标

New courses receive usable defaults but no guidance on adapting each palace
prompt. IELTS and Basic Math need explicit evidence, planning and visual
checks for their own teaching methods.

## 关键功能清单（Key Feature List，KFL）

- Scaffold an author guide with fill-in examples for research, planning and
  image prompts.
- Improve all three prompt resources for IELTS and Basic Math.

## 改造面

Course starter assets, the two course profiles, and prompt acceptance checks.

## 非目标

Changes to the driving course, structured plan schema, or generation provider.

## 验收标准（Acceptance Criteria，AC）

- A freshly scaffolded package contains usable prompts and a local author guide.
- IELTS emphasizes language cues and their evidence. Basic Math emphasizes
  exact values, a fixed whole and accurate visual representations.
- The new prompt revisions install without changing prior versions.

## 讨论

The author guide provides stage-specific examples and a 100-point rubric.
Guide text stays in Markdown, outside the AI profile references.

Both updated packages and a newly scaffolded package passed validation.
Generated bindings, Go tests, the build, and 16 targeted browser cases
passed. Local fixtures verified each course's evidence-to-image requests.
An upgrade rehearsal retained earlier course versions and learner records.
The rubric requires reviewing a new rendered image before assigning a score.
