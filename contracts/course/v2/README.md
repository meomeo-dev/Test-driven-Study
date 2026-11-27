# Course package protocol v2

Set `protocol_version` to `2` in [course.json](manifest.schema.json) and
validate question arrays with the [item schema](items.schema.json). The
[v1 contract](../v1/README.md) remains supported. Updating a course requires a
new package version; keep existing item IDs to preserve learner history.

V2 adds cloze, listening, reading comprehension, writing and translation to
the four existing types. V2 true/false items require Boolean `grading.value`
and rich `analysis`. V1 true/false items retain `grading.boolean`.

Any v2 question type may declare an optional `study_translation` object with an
optional `display_in` array restricting which study surfaces show the
translation (`memorize`, `practice_review`, `exam_review`, `typing`, `palace`;
omitting `display_in` enables all five surfaces). `stem` translates the prompt;
`options` maps authored option IDs on choice/judgment items; `material` aligns
one plain-text translation per nonblank passage segment or structured transcript
line on `cloze`, `reading_comprehension`, and `listening`; `sample_response`
aligns per nonblank writing sample segment; and `sub_questions` maps existing
sub-question IDs to translated `stem` and/or `options`. See the guide below for
alignment and review visibility.

English course packages can declare an optional `vocabulary_file` containing a
[vocabulary array](vocabulary.schema.json). See the
[vocabulary authoring guide](../../../docs/features/vocabulary/README.md) for
entry categories, unit and question references, and a complete example.

See the [authoring and scoring guide](../../../docs/features/question-types/README.md)
for cross-reference checks, local scoring and sample items.
