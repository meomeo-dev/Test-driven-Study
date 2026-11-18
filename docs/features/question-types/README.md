# Curriculum Question Types Feature

This directory documents the question type system, JSON schema data contracts, and
grading extensions for the learning platform.

## Documentation Index

- [v2 Question Types Specification](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/docs/features/question-types/v2-question-types-specification.md):
  Covers the full specification for expanding curriculum questions from 4 basic types
  to 10 types: Cloze (`cloze`), True/False with Analysis (`true_false`), Listening
  Comprehension (`listening`), Reading Comprehension (`reading_comprehension`), Writing
  (`writing`: sentence making, short essay, full essay), and Translation (`translation`:
  EN->ZH, ZH->EN). Includes JSON schemas, grading engine specifications, non-breaking
  database storage strategy, and 10 golden sample items for `step-up-english`.

## Related Specifications and Code
- Schema: [contracts/course/v1/items.schema.json](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/contracts/course/v1/items.schema.json)
- Storage Projection: [internal/storage/workspace.go](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/internal/storage/workspace.go)
- TTS Integration: [deepseek-tts-architecture.md](file:///Volumes/1TB-ZYJ/git/Test-driven-Study/docs/features/tts/deepseek-tts-architecture.md)
