---
id: 0080
type: chore
status: closed
closed-by: 7cd142e
labels: [course, vocabulary, skills]
branch: chore/0080-add-design-course-vocabulary-repository-skill
created: 2026-11-20
---
# Add design-course-vocabulary repository skill

## 背景 / 目标

The repository now supports versioned `vocabulary_file` assets with category
taxonomy, optional `pos` (`word`), minimalist `grammar_note`, question/unit
cross-references, and `term_tts`/`example_tts` playback. Add a dedicated
repository skill `.agents/skills/design-course-vocabulary/` (alongside
`design-course-package` and `design-course-tts`) to guide vocabulary notebook
authoring and provide a standalone vocabulary audit CLI.

## 关键功能清单（Key Feature List，KFL）

- Create `.agents/skills/design-course-vocabulary/` with `SKILL.md`,
  `agents/openai.yaml`, `references/vocabulary-spec.md`, zero-dependency
  `scripts/audit-course-vocabulary.mjs` + `scripts/lib/audit.mjs`, and unit
  tests in `tests/audit-course-vocabulary.test.mjs`.
- Document entry selection, unit/question coverage, `category` vs `pos` rules,
  minimalist `grammar_note` discipline, bilingual examples, and handoff boundaries
  with `design-course-tts` (`term_tts`/`example_tts`) and `design-course-package`.
- Allowlist `.agents/skills/design-course-vocabulary/` in `.gitignore` and update
  `CHANGELOG.md` and `handoff.md`.

## 改造面

- `.agents/skills/design-course-vocabulary/`
- `.gitignore`, `CHANGELOG.md`, `handoff.md`

## 非目标

- Modifying application runtime code or rewriting existing course banks.

## 验收标准（Acceptance Criteria，AC）

- Skill passes `meta-create-skills/scripts/check-skill.sh`, `meta-skill-toolbox`
  `check-toolbox.mjs`, and `meta-skill-knowledge-base` `check-knowledge-base.mjs`.
- `node --test .agents/skills/design-course-vocabulary/tests/*.test.mjs` passes.
- `audit-course-vocabulary.mjs --strict` passes on both `golden-course-template`
  (`1.4.0`) and `beginner-english` (`2.4.0`), and `npm run issue:check` passes.

## 讨论

Keeping TTS speech segmentation/overrides in `design-course-tts` and package/unit
planning in `design-course-package` avoids overlapping responsibilities while
giving vocabulary authors clear rules against `pos` duplication and over-annotated
`grammar_note` entries.

### Verification

- `meta-create-skills/scripts/check-skill.sh design-course-vocabulary .agents/skills`: `PASS`.
- `meta-skill-toolbox/scripts/check-toolbox.mjs`: `valid: true` (`0` errors, `0` warnings).
- `meta-skill-knowledge-base/scripts/check-knowledge-base.mjs`: `valid: true` (`0` errors, `0` warnings).
- `node --test .agents/skills/design-course-vocabulary/tests/*.test.mjs`: `4/4` passed.
- `audit-course-vocabulary.mjs --strict`: passed with `0` errors and `0` warnings on `golden-course-template@1.4.0` (`12` entries) and `beginner-english@2.4.0` (`71` entries).
- `npm run issue:check`: passed across issues `0001–0080`.
