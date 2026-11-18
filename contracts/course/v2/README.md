# Course package protocol v2

Set `protocol_version` to `2` in [course.json](manifest.schema.json) and
validate question arrays with the [item schema](items.schema.json). The
[v1 contract](../v1/README.md) remains supported. Updating a course requires a
new package version; keep existing item IDs to preserve learner history.

V2 adds cloze, listening, reading comprehension, writing and translation to
the four existing types. V2 true/false items require Boolean `grading.value`
and rich `analysis`. V1 true/false items retain `grading.boolean`.

See the [authoring and scoring guide](../../../docs/features/question-types/README.md)
for cross-reference checks, local scoring and sample items.
