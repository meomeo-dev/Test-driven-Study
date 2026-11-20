---
id: 0078
type: feat
status: open
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
