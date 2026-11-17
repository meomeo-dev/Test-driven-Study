---
id: 0013
type: docs
status: closed
closed-by: f018ec5
labels: []
branch: docs/0013-rewrite-readme-for-github-readers
created: 2026-11-01
---
# Rewrite README for GitHub readers

## 背景 / 目标

Replace the accumulated root README with a reader-oriented GitHub introduction
and usage guide. Keep product facts, supported commands, data scope, and links;
remove conversation history, reasoning, decisions, personal paths, and temporary
verification instructions. Work directly on main without a worktree.

## 关键功能清单（Key Feature List，KFL）

- Present implemented features and planned modes accurately.
- Provide prerequisites, startup/build commands, configuration, and keyboard use.
- Include current screenshots, data counts, storage locations, and source layout.
- Move detailed data fields into a dedicated question-bank reference.

## 改造面

README.md and docs/data/question-bank/README.md.

## 非目标

Application behavior, dependencies, data/assets, deployment, external publishing,
additional runtime checks, and worktrees.

## 验收标准（Acceptance Criteria，AC）

- AC1: The root README is self-contained for a new GitHub reader.
- AC2: Commands, versions, paths, links, and feature descriptions match the repo.
- AC3: No personal absolute paths, temporary scripts, conversation references,
  reasoning logs, or technology-decision narrative remain in the root README.
- AC4: The detailed question-field reference remains available through a link.
- AC5: Only documentation changes are committed for this issue.

## 讨论

The current interface is Chinese. The README uses English with Chinese UI
labels where useful. Image generation and mock exams are described as planned;
existing statistics and rule-based advice are described as implemented features.

Acceptance: the root README is 190 lines; all four relative links resolve, all
documented npm script names exist, and the prerequisites match package.json and
go.mod. Root content has no personal paths, temporary commands, conversation
references, or decision narrative. The commit changes documentation only.
