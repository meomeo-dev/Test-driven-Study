---
id: 0037
type: feat
status: closed
closed-by: 5fc713369e040f982ea9161774ea97924023e36b
labels: []
branch: feat/0037-generalize-study-with-versioned-course-packages
created: 2026-11-11
---
# Generalize study with versioned course packages

## 背景 / 目标

The application currently assumes one driving-theory bank. Make the existing Go and React application host independently maintained, versioned course packages while preserving current learner records.

## 关键功能清单（Key Feature List，KFL）

- Course manifest, data validation and authoring commands.
- Legacy bank conversion, course installation and scoped media.
- Course navigation, lessons and typed practice, including a numeric item.
- Course-specific exam and AI settings with legacy behavior and recovery.

## 改造面

Course resources and contracts, Go study and storage, HTTP and React, and acceptance fixtures. The [execution plan](../plans/20261111_course-platform_execution-plan.yaml) records the four dependency-ordered boundaries.

## 非目标

Full QTI interoperability, a course marketplace, and course-supplied executable plugins are outside this issue.

## 验收标准（Acceptance Criteria，AC）

- A course authored with the scaffold can be validated and used without application source changes.
- The existing 3,147-question bank preserves original identities, ordering, grading and media.
- Two courses using overlapping IDs and filenames keep independent progress and assets.
- Existing learner records, active exam deadlines, and recoverable AI tasks retain their behavior.
- Integrated checks use isolated databases and local providers.

## 讨论

The platform contract and HTTP contract are versioned independently. Resource packages contain data and local media. The application owns assessment and provider execution.
