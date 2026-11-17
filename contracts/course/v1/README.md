# Course package protocol v1

A package is a local directory containing `course.json`, ordered question
files, Markdown lessons, and referenced assets. The manifest and items schemas
define the JSON structure. The application validates both with its embedded
schemas and checks references and grading rules before making a package
available.

A question-only package needs only `course.json` and its question files.
Installed packages use the application workspace, with the same learning
pages, grading, review, guide, exam terminal, tutor, and memory palace.
An omitted lesson uses the shared guide text. Default exams draw up to
20 eligible questions with one point per item, 90% to pass rounded up, and
one minute per question with a five-minute minimum.

## Identity and reading

- `course_id` identifies the course across releases. A unit ID is unique
  within a course. An item ID is unique within a course and stays stable if
  the item moves to another unit. A lesson ID is unique within its unit.
- The manifest lists units and lessons in display order. A question file is
  a nonempty array in the default practice order. Units may contain lessons,
  questions, or both.
- All resource paths use slash separators and stay inside the package root.
  Lessons are UTF-8 Markdown under `lessons/`. Item files belong under
  `questions/`. JPEG, PNG, GIF and WebP images belong under `assets/`.
  An item can also declare an `audio` path to an MP3 under `assets/`.
  The shared question screens play it from the item's installed version.
  A listening item can declare a `transcript` path to a UTF-8 `.txt` file
  under `assets/transcripts/` with up to 24 KiB of text. The study player,
  tutor, and memory palace use that same versioned transcript.
  Only explicitly referenced assets can be served by the learning application.
- The package digest covers the manifest and all referenced files, ordered
  by relative path. Unreferenced source exports can accompany the package for
  provenance. Publish a new package version when referenced contents change.

## Concept graph

A unit can declare `concepts`, the nodes of the course's knowledge graph. A
concept has a course-unique slug `id`, a `title`, `estimated_minutes` from 1
to 600, and optionally a `summary` and a `lesson` ID from the same unit.
`prerequisites` lists up to eight alternative groups; each group's `all_of`
names up to sixteen concepts. A concept unlocks when every member of any one
group is satisfied, so `(a ∧ b) ∨ c` is written as two groups.

```json
"concepts": [{
  "id": "word-problems", "title": "文字题", "estimated_minutes": 25,
  "lesson": "applied",
  "prerequisites": [{ "all_of": ["addition"] }, { "all_of": ["subtraction"] }]
}]
```

An item lists the concepts it assesses in `concepts`; each must belong to the
item's unit. Validation rejects unknown, self and repeated references, a group
that contains another group of the same concept, and any cycle across all
groups. `course:check` prints concept counts and warns about graded concepts
with fewer than three items. A concept without items is a self-check concept.
Concept IDs stay stable across releases; give a concept a new ID when its
meaning changes. The application owns mastery rules and learning paths; see
[learning paths](../../../docs/features/learning-path/README.md). Packages
that use these fields require an application release that supports them.

## Course roadmap

An optional top-level `roadmap` relates the course to other courses. `note`
quotes the course README sentence that states the relations. `prerequisites`
lists up to eight alternative groups; each `all_of` names up to sixteen course
IDs and `strength` is `required` or `recommended`. `parallel_with` lists up to
sixteen courses to study alongside. A roadmap needs prerequisites, parallel
courses or both.

```json
"roadmap": {
  "note": "先学电路基础与 C 语言的条件、循环和函数。",
  "prerequisites": [
    { "all_of": ["circuit-fundamentals", "c-programming"], "strength": "required" }
  ]
}
```

Validation rejects a group or parallel entry that names the course itself, a
group that contains another group, and a course that is both a prerequisite and
parallel. A course that is not installed is valid and is reported as missing.
Installation refuses a version whose prerequisites form a cycle with the active
courses. Relations are advisory and never block a course; see the
[course roadmap](../../../docs/features/course-roadmap/README.md).

## Assessment

| Item type | Response | Evaluation |
| --- | --- | --- |
| `single_choice` | `{"choice_ids":["a"]}` | One known ID matches the key. |
| `multiple_choice` | `{"choice_ids":["a","b"]}` | Exact set of distinct, known IDs. |
| `true_false` | `{"boolean":false}` | Exact Boolean match. |
| `numeric` | `{"value":"0.250"}` | Absolute difference is at most the declared tolerance. |

Numeric values use base-ten strings of at most 64 characters with optional
minus sign and fractional part. Zero tolerance is an exact rational match.
For example, `0.25` and `0.250` compare equally. A malformed or mismatched
response produces a validation error. The browser receives the prompt and
display options during practice. The application controls answer disclosure
through the submission and review modes.

Use `npm run course:new -- --id <id> --title "<title>"` to create an example
package. Use `npm run course:check -- courses/<id>` to validate the result
after editing.

`npm run course:install -- courses/<id>` installs a validated package in the
application's local SQLite database and activates its version in one transaction.
An existing version can be activated again when its digest matches. The
application reads saved presentations against their original installed version.

## AI teaching resources

An optional `ai_profile` can reference four independent files under `profiles/`.

| Field | Resource |
| --- | --- |
| `assistant_instructions` | UTF-8 guidance for the question assistant |
| `palace_research_instructions` | UTF-8 teaching guidance for the retrieval stage |
| `palace_planning_instructions` | UTF-8 teaching guidance for the scene planner |
| `palace_template` | JSON template for the image prompt |

Each file is limited to 24 KiB. The JSON template supplies
`template_id`, `version` and `prompt_template`. The prompt must include
`{{QUESTION_TEXT}}` and `{{REFERENCE_ANSWER}}` and may include
`{{PALACE_ADDRESS}}`. Installation includes these private files in the
version digest. The scaffold copies the three editable palace resources from
the [course starter](../../../courses/starter/profiles/) with an
[author guide](../../../courses/starter/profiles/PROMPT-AUTHORING.md). The guide
is copied for authors and is outside the runtime prompt references. Earlier
packages use the corresponding defaults for omitted resources. Models,
credentials, tool policy, response schema and budgets remain application settings.
