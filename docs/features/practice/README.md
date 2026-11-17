# Practice mode

Route: /practice. The implementation starts from a filesystem copy of 14 source
files under web/src/features/memorization at commit 5b31d00, excluding unit-test
files. The copied feature has its own page, filters, navigator, image/dialog
components, shortcuts, and presentation behavior. Existing memorization code
retains its behavior; only an exposure-recording hook is added there.

## Interaction

- Number keys 1–4 choose options. Single-choice and judgment questions keep one
  selection; multiple-choice questions toggle options independently.
- Enter submits the selected set. The server compares the complete set with
  the original answer; partial multiple-choice answers receive no credit.
- After grading is saved, Enter advances to the next question. It does not
  submit another attempt, skip feedback while saving, or wrap the final question.
- Correct options and explanations appear only after a successful submission.
  Full-question preview before submission also withholds answer annotations.
- r starts a fresh presentation of the same question. Earlier attempts remain.
- j/k, arrows, gg/G, search, image zoom, navigation, and keyboard help follow
  the copied memorization controls. Printable shortcuts retain the off switch.
- Enter on an option or Submit follows the same two-stage confirmation command;
  other focused buttons preserve native activation.
  Editing, IME, modifiers, open dialogs, and repeated mutation keys are guarded.
- Feedback keeps the current filtered navigation snapshot until the learner
  moves away, so a newly correct answer does not disappear mid-explanation.
- Up/Down scroll visible overflowing explanations, including the compact analysis
  dialog. The input, IME, modifier, navigation-grid, and tab-list guards remain.
- Original ID and result state label the stem column; type and chapter share the
  context row. Navigator tiles expose both filtered position and original ID.

## Persistence and API

| Endpoint | Responsibility |
| --- | --- |
| GET /api/practice/overview | Subject counts from latest submitted results. |
| GET /api/practice/questions | Filtered original-order question summaries. |
| POST /api/practice/presentations | Idempotent server-timestamped presentation. |
| POST /api/practice/presentations/{id}/answer | Grade and append one immutable attempt. |
| PUT /api/practice/cursor | Practice resume position, separate from memorization. |
| POST /api/study/exposures | Record answer exposure through memorization or memory palace. |
| GET /api/analysis | Subject/time-window learning aggregates. |

A public presentation type has no answer, analysis, or skill properties. The
server validates signs, cardinality, duplicates, original question revision,
and chronology. The presentation ID prevents duplicate attempts when a request
is retried. A conflicting answer cannot overwrite an earlier result. SQLite
triggers reject attempt updates and deletions.

Server UTC epoch milliseconds define opening and answer times. A stable database
sequence resolves same-millisecond ties. Clients cannot submit their own result
or backdate an answer. Pending and skipped presentations are not scored.
Memorization exposure and manual marks are not attempts. Prior exposure is
checked again when submitting, including activity after the presentation opened.
Historical passive activity before this feature cannot be reconstructed.

The SQLite migration adds tables without replacing question or learning data.
Back up the active database before deploying the migration. Browser and API
tests use isolated databases, not personal practice history.
