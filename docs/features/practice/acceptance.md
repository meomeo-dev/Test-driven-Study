# Practice and analysis acceptance

Date: 2026-11-01. Status: passed.

## Verification scope

- Existing memorization/browser navigation/image workflows remain covered.
- Public presentation serialization and full preview omit answers/explanations.
- Server grading handles exact sets, invalid signs, duplicate signs, and cardinality.
- Same-request and concurrent retries retain one immutable attempt.
- Conflicting answers cannot replace history; restart retains attempts and cursors.
- Passive exposure and manual marks do not become scored attempts.
- Recent question estimates reflect later improvement without removing old errors.
- Window boundaries, future records, equal-period comparisons, same-time ordering,
  sparse forecasts, chapter coverage, and partial daily bins have domain coverage.
- Numeric choice, explicit submission, repeat practice, input protection, image
  dialogs, filtered feedback, and mobile explanation gating have browser coverage.
- Analysis history, time controls, sparse/available forecasts, explanatory copy,
  and desktop/mobile bounds have browser coverage.

## Data isolation

API and storage tests create temporary SQLite databases. Browser tests use the
configured disposable browser-acceptance directory. Captured examples contain
test records, not the user's personal results. The production migration is
backed up before application restart. No original question data or image assets
are modified by this feature.

## Generated bindings and dependencies

HTTP types come from the OpenAPI contract; SQLite bindings come from the pinned
cached sqlc module. Generation performs no dependency download. The feature adds
no runtime or development dependency. Existing Go, Node, and browser tools are
reused.

## Results

The full npm run check command passed: all seven issue records, deterministic
HTTP/SQL regeneration, 8 frontend unit tests, Go domain/API/storage tests,
startup lifecycle tests, strict types, production builds, and 25 browser
workflows. Original 19 memorization/navigation/image flows remain included.

The live application was restarted after a consistent SQLite backup at
var/backups/before-practice-deploy-20261101T082159Z.sqlite. All 3147 questions
and existing manual memorization marks were preserved. The memorization cursor
continued updating during normal browsing; it was not reset from the backup.
The practice page and sparse live-analysis response were checked on the primary
checkout. No synthetic scored attempts were inserted into the personal database.
Page titles were manually verified after switching modes.

## Enter confirmation workflow

The follow-up keyboard change submits the selected answer on Enter, then uses
the next Enter to advance after grading. Browser coverage includes focused
Submit/Next buttons, a deliberately paused save request, held-key events,
input/dialog focus, empty selections, native Retry activation, and the final
question without wrapping. Test attempts remain in the isolated database.

All 27 browser flows pass after this change; the remaining generation, unit,
backend, startup, and production-build gates also pass.

## Question context and explanation scrolling

Follow-up coverage checks aligned stem metadata, the chapter beside the type,
Up/Down before and after grading, long explanation scrolling, compact analysis
dialogs, guarded inputs and modifiers, original-ID location after cursor resume,
and association after chapter filtering. New interaction paths do not expose
answers before a saved grade or modify question data.

The complete npm run check gate passes all 41 browser flows after this update,
including all ten new study-context cases and the existing unit/backend/build checks.

## Primary action after grading

Submit becomes a right-side Next button after grading; Retry sits immediately
to its left. The existing left navigation pair remains in place. Acceptance
checks the original submit click target, unchanged left-button positions,
wrong/correct feedback, retry history, both navigation controls, final-question
guards, and viewport bounds at widths 1440, 1280, 700, 651, and 390 px.

The complete check passes 42 browser flows and the other project gates. The
final compact styling also passes the production build and 7 focused practice
flows. The footer captures are in docs/ui/practice/.

Acceptance captures under docs/ui/practice/ and docs/ui/learning-analysis/ use
isolated test records. Public research and forecast limitations are documented
in docs/features/learning-analysis/design.md.
