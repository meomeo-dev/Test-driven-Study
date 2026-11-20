---
id: 0078
type: feat
status: closed
closed-by: ea6db16
labels: []
branch: feat/0078-add-vocabulary-notebook-to-english-memorization
created: 2026-11-20
---
# Add vocabulary notebook to English memorization

## 背景 / 目标

English learners need a vocabulary notebook while reviewing questions in memorization.

## 关键功能清单（Key Feature List，KFL）

- Provide a notebook with question, unit and course scope, text search, and entry categories.
- Include terms, Chinese meanings and bilingual examples for the golden template and every Beginner English unit.

## 改造面

Optional v2 vocabulary asset, course catalog projection, memorization toolbar and dialog, course samples and authoring guide.

## 非目标

Personal vocabulary editing, automatic extraction, paid services, and changes to assessment grading.

## 验收标准（Acceptance Criteria，AC）

- Display the notebook in courses with a declared word list and validate every unit and question reference.
- Allow learners to study words, word groups, phrases, collocations, idioms and function phrases in memorization.
- Verify a desktop and mobile workflow, query scope, filtering, and existing courses without word lists.

## 讨论

Course manifests declare a versioned asset. Its presence gates the notebook because the existing language field describes course presentation.

### Verification

- Both packages passed course validation and TTS audits. Beginner English
  passed its strict effort audit. Independent verification confirmed 83
  entries and 133 question references across the 11 units.
- Generated bindings, 57 frontend unit tests, Go tests, four startup tests,
  and the application build passed.
- Browser coverage passed for all 27 cases. Two notebook tests passed on a
  focused rerun after accounting for the cancelled development-mode request.
