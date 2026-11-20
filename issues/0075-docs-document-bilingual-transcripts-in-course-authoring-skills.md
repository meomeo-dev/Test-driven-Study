---
id: 0075
type: docs
status: closed
closed-by: 5b31cc8
labels: []
branch: docs/0075-document-bilingual-transcripts-in-course-authoring-skills
created: 2026-11-20
---
# Document bilingual transcripts in course authoring skills

## 背景 / 目标

Issue #74 added bilingual study materials to the v2 course protocol. Update the repository instructions and course-authoring skills to describe the supported data and visibility.

## 关键功能清单（Key Feature List，KFL）

- Document aligned study translations for reading and all three listening modes.
- Describe how to verify alignment, preserve the original speech, and expose translations in study and review.

## 改造面

AGENTS.md and the repository-owned design-course-package and design-course-tts skills, including their references and interface prompts.

## 非目标

Runtime changes, course content changes, or a new course protocol.

## 验收标准（Acceptance Criteria，AC）

- Cross-check the authoring guidance against the course schema, Go validation, HTTP review models and listening UI.
- Verify the golden template and Beginner English with course validation and the TTS audit.
- Keep repository links and skill entry points valid.

## 讨论

The course contract is the canonical source for field names. The package skill owns coverage and versioning guidance, and the TTS skill explains how to align source segments without changing audio.

### Verification

- Both skill structure and reference checks passed. The TTS toolbox check,
  local links, and golden dialogue example passed.
- Both course packages passed `course:check` and the TTS audit. The golden
  template effort audit reported zero errors and five warnings.
- `go test -count=1 ./internal/course ./internal/study -run StudyTranslation`
  passed for alignment, original audio, and review visibility.
