---
id: 0083
type: chore
status: closed
closed-by: 138cbc8
labels: [tooling, skills]
branch: chore/0083-add-desktop-gui-design-knowledge-repository-skill
created: 2026-11-23
---
# Add desktop-gui-design-knowledge repository skill

## 背景 / 目标

Install the `desktop-gui-design-knowledge` skill package under `.agents/skills/`
as a tracked repository prerequisite before introducing a Tauri desktop shell and
native desktop GUI refinements for Test-driven-Study.

## 关键功能清单（Key Feature List，KFL）

- Install the clean release copy of `desktop-gui-design-knowledge` under
  `.agents/skills/desktop-gui-design-knowledge/` (`SKILL.md`, `agents/openai.yaml`,
  `index/knowledge-index.yaml`, and all 10 `references/*.md` files, excluding
  `.DS_Store`).
- Add explicit allowlist entry `!.agents/skills/desktop-gui-design-knowledge/` to
  `.gitignore` alongside existing tracked repository skills.

## 改造面

- `.agents/skills/desktop-gui-design-knowledge/`
- `.gitignore`

## 非目标

- Introducing Tauri desktop packaging or modifying application runtime code in
  this issue.
- Modifying the upstream skill text inside the installed release copy.

## 验收标准（Acceptance Criteria，AC）

- `.agents/skills/desktop-gui-design-knowledge/SKILL.md`, `agents/openai.yaml`,
  `index/knowledge-index.yaml`, and all 10 reference documents exist without
  `.DS_Store` artifacts.
- `git status` shows the skill files tracked cleanly via `.gitignore`.
- `npm run issue:check` (or `node scripts/issue-check.mjs`) passes across all
  issue records.

## 讨论

Adding the explicit `.gitignore` unignore rule matches `design-course-package`,
`design-course-tts`, `design-course-vocabulary`, and `orchestrate-agent-swarm` so
repository skill tracking stays symmetric.

### Verification

- Installed `.agents/skills/desktop-gui-design-knowledge/` (13 files: `SKILL.md`,
  `agents/openai.yaml`, `index/knowledge-index.yaml`, and 10 `references/*.md`
  files; `.DS_Store` excluded).
- `node scripts/issue-check.mjs`: passed across all 83 issue files.
