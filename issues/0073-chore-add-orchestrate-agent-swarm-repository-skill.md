---
id: 0073
type: chore
status: closed
closed-by: 6b7fae2
labels: [tooling, skills]
branch: chore/0073-add-orchestrate-agent-swarm-repository-skill
created: 2026-11-20
---
# Add orchestrate-agent-swarm repository skill

## 背景 / 目标

The `.agents/skills/orchestrate-agent-swarm/` package was added in the
working tree under repository skills. Track its skill definition, references,
board CLI, templates, and test suite cleanly in `.gitignore` and git history.

## 关键功能清单（Key Feature List，KFL）

- Track `.agents/skills/orchestrate-agent-swarm/` (18 files: `SKILL.md`,
  `agents/openai.yaml`, `references/`, `scripts/`, `templates/`, `tests/`).
- Add explicit allowlist entry `!.agents/skills/orchestrate-agent-swarm/` to
  `.gitignore` alongside existing tracked repository skills.

## 改造面

- `.agents/skills/orchestrate-agent-swarm/`
- `.gitignore`

## 非目标

- Modifying application runtime code, course packages, or swarm protocol logic.

## 验收标准（Acceptance Criteria，AC）

- `node --test .agents/skills/orchestrate-agent-swarm/tests/*.test.mjs` passes
  all 77 tests across 26 suites.
- `npm run issue:check` passes and `git status` is clean on `main`.

## 讨论

Adding the explicit unignore rule matches `design-course-package` and
`design-course-tts` so repository skill tracking stays symmetric.

### Verification

- `node --test .agents/skills/orchestrate-agent-swarm/tests/*.test.mjs`: 77/77
  tests across 26 suites passed.
- `npm run issue:check`: passed across all 73 issue files.
