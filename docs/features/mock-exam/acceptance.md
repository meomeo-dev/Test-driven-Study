# Mock examination acceptance

Checks use isolated SQLite databases and local browser fixtures. They do not
create examination or answer records in the user's database.

| Area | Required result |
| --- | --- |
| Reference layout | Independent preparation, candidate/timer column, upper question/selection area, persistent desktop 10-column answer table, operation strip and lower image region. |
| Theme isolation | No site sidebar/theme switch; terminal and its dialogs retain their own light palette while the site preference remains unchanged. |
| Paper | Exact 40/60 and 20/20/10 quotas, unique eligible questions, stable saved order, random choice options with stable answer signs. |
| Source revision | Shuffled option presentation does not create a new source revision in learning records. |
| Privacy | Active unanswered items omit correctness and review; committed items return feedback; total score remains withheld until finished. |
| Navigation | Draft selection and destination are saved atomically; empty choice skips; identical replay is idempotent; invalid destination rolls back. |
| Feedback | Incorrect commitment opens the recorded-style dialog; selected/correct answers are shown; ten-second auto-close and continuing timer work. |
| Submission | Current selection is assessed before confirmation; counts include it; repeated/concurrent finalization cannot duplicate attempts. |
| Scoring | Exact-set multiple choice, zero unanswered credit, 90-point pass boundary and documented early-end limits. |
| Recovery | Original paper, rules, deadline and committed choices survive reload; uncertain creation/navigation recover without a second paper. |
| Restart | Control is right of Continue; cancel preserves the active paper; confirmation retains its result and creates a new full-time paper; partial failure/reload cannot duplicate papers or attempts. |
| Timing | Late answers are rejected; finished countdown freezes at the finish time. |
| Controls | Number selection, multiple toggles, next/Enter, previous/table navigation, modifier/composition/held-key protection and shortcut preference. |
| Layout bounds | Document and primary controls fit 1440×1080, 1440×900, 1280×600, 1024×768, 700×600, 390×844 and 320×568; long text scrolls inside its region. |
| Multiple-answer table | Four selected letters fit inside the fixed answer-table region without pushing the operation strip down. |
| Coverage labels | Exam rules and question type quotas remain verified against unit configurations. |

Domain checks: `internal/study/exam_test.go`, `exam_blueprint_test.go` and
`exam_navigation_test.go`. HTTP checks: `internal/httpapi/exams_test.go`.
Presentation checks: `tests/browser/exam.spec.ts` and the terminal-label unit tests.
Restart checks: `tests/browser/exam-restart.spec.ts`.
Run `npm run check` for the complete repository gate.

Validated 2026-11-03: 74 browser checks, 17 frontend unit tests, all Go tests,
four startup tests and the production build passed. Live-service inspection at
1440×1080 confirmed viewport bounds and the absence of the learning sidebar.
Restart additionally combines manual cancel/confirm, aligned-control and retained
answer/result checks in isolated data with automated interrupted-creation recovery.

The mock exam terminal provides standardized local simulation testing for course units.
