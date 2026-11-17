# Shared learning workspace

The shared learning workspace is the unified baseline for every installed course.
The catalog opens the same sidebar, memorization, practice, analysis, review
book, exam terminal, guide, assistant, memory palace, and task controls. The
selected course supplies the question bank, unit names, media, and domain
content. Application-level settings and defaults apply to all courses.

## Repository ownership

| Directory | Responsibility |
| --- | --- |
| `cmd/server/` | Assemble shared services and start the application. |
| `cmd/course/` | Scaffold, validate, and install course packages. |
| `web/src/app/` | Course selection, workspace context, and routing. |
| `web/src/features/` | Shared catalog, study screens, exam terminal, guide, assistant, and palace. |
| `internal/course/` | Package manifests, imports, revisions, and resource lookup. |
| `internal/study/` | Question grading, learning history, analysis, and exam sessions. |
| `internal/llm/`, `internal/palace/`, `internal/tasktrace/` | Shared providers, jobs, recovery, and execution traces. |
| `internal/storage/`, `internal/httpapi/` | Persistent identity, learner records, and the application API. |
| `contracts/course/`, `contracts/http/` | Package format and application API contracts. |
| `courses/<course-id>/` | Manifest, question files, and optional assets, guide text, and declarative rules. |

A minimal course contains a manifest and questions. It gets the application
guide structure, default exam rules, tutor, and palace template. Installed courses
supply their own domain rules, references, and teaching material.
The app selects the answer control by question type and preserves the shared
submission, keyboard, feedback, and review workflow.

## Migration

1. Use the installed course catalog to resolve the active course and unit for
   the workspace. Keep existing navigation URLs usable.
2. Resolve course-local item IDs and revisions to persistent application
   identities. Preserve existing learner references, original scores and
   timestamps, exam snapshots and deadlines, and accepted AI jobs. Use one
   practice history for study, analysis, and review.
3. Give the exam, guide, assistant, and palace access to the same course
   context. Use shared defaults and validated domain data.
4. Verify the shared workspace across all installed engineering courses.

## Acceptance

Drive both bundled courses through the same feature routes and controls. Verify
typed grading, review, exam recovery, and AI isolation with local fixtures.
Install a third question-only package and exercise the shared workspace. Check
an isolated upgraded database for unchanged grades and snapshot recovery.
