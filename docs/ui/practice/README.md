# Practice UI

Practice centers the stem, options, and actions in a bounded reading lane.
Text questions stack the stem above the options. Image questions place the stem
and illustration beside the options on wider screens and stack on narrow screens.
The reading lane scrolls when the full task exceeds the viewport. Titles and
options expand with their text. The compact toolbar entry opens the question
assistant. Progress, theme, navigation, and help are available above the question.

The original explanation appears below the actions after the server saves and
grades the answer. Compact screens show the explanation in the analysis dialog.
Numeric badges communicate 1–4 selection; Enter
submits, then advances to the next question after grading. The next-question
button exposes its Enter hint after answering. r starts another attempt.
Earlier records remain unchanged; the final question does not wrap.

After grading, the right-side Submit button becomes Next at the same target.
Retry sits immediately to its left. The existing left Previous/Next pair stays
in place. The two Next actions share the same navigation and final-question guard.
Compact windows shorten the right-side hint area. Both layouts preserve the
primary click target when feedback appears.

The question type and chapter share the context row. Original ID and result
state label the stem column. Up/Down scroll visible explanations after grading;
the same keys work in the compact analysis dialog. Navigation shows both original
IDs and filtered positions. See ../study-context/README.md for keyboard guards
and current-question location behavior.
Each navigation tile retains its list-position label and adds a visible original
ID, so sparse source IDs cannot be mistaken for the hundred-question index.

Captures use isolated acceptance data:

- `focus-text.png` shows the complete text question and its actions at 780 pixels.
- `before-answer.png`: public question and unannotated options.
- `after-answer.png`: saved result, correct choices, and original explanation.
- `mobile-after-answer.png`: compact layout after submission.
- `action-footer-desktop.png`, `action-footer-mobile.png`: post-answer actions.

`design.yaml` records the current interaction and layout contract. Domain and
persistence behavior is described in docs/features/practice/README.md.
