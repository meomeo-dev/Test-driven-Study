# Development handoff

Updated 2026-11-17 (America/New_York).

Test-driven Study is a standalone, general-purpose test-driven learning platform
for engineering and science courses. The system includes 18 standard curriculum
course packages (such as [Elementary Chinese](courses/elementary-chinese/course.json)
at version 1.0.1 with 12 color illustrations, Basic Math, CAD/FDM Printing,
C Programming, Embedded MCU, Machine Vision, etc.) plus starter scaffolding.

The checkout has its own Git repository, SQLite data directory, AI credential
namespace, and local server ports. Run `npm run dev:up` to open the catalog at
<http://127.0.0.1:43387/courses>. The API listens on port 43388. Learner data and
local provider settings start fresh in this checkout.

Active browser regression covers the shared course workspace, guide,
practice, exams, local media, learning plans, and roadmap.

## Verification

Generated bindings, 39 frontend unit tests, Go tests for the standalone checkout,
startup tests, the production build, and Chrome browser tests passed.
The running app lists installed modular engineering courses. The database contains
clean learner data and modular course question banks.
