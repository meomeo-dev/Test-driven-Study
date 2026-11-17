# Course knowledge graphs and learning paths

A concept graph (知识图谱) describes every valid learning relation inside one
course. A learning path (学习路径) is one learner's saved plan generated from
that graph, the learner's evidence and a goal. They use separate data: the
versioned course package owns the graph; the learner database owns marks and
paths, and practice history supplies the evidence.

## Terms

| Term | Definition |
| --- | --- |
| Concept (知识点) | The smallest planned node in a course. It belongs to one unit. |
| Prerequisite group (先修条件组) | Concepts that must all be satisfied (AND). |
| Prerequisites (先修条件) | Alternative groups (OR). A concept unlocks when one group is satisfied. |
| Satisfied | The concept is mastered, or marked known without contrary evidence. |
| Learning path (学习路径) | A saved goal, daily minutes and ordered steps for this learner. |

Alternative groups express any monotone AND/OR rule in disjunctive normal form.
`(python ∧ statistics) ∨ preparatory` is written as two groups.

## Package data

Protocol v1 gains two optional fields, added to `manifest.schema.json`,
`items.schema.json`, the Go model and the protocol README. Packages without
them load unchanged. The digest hashes file bytes, so untouched packages keep
their digests. A package that uses the fields needs an application release
that understands them.

```json
{
  "units": [{
    "id": "intro",
    "title": "自我介绍与问候",
    "question_file": "questions/intro.json",
    "lessons": [{ "id": "intro", "title": "自我介绍与问候", "file": "lessons/intro.md" }],
    "concepts": [{
      "id": "self-introduction",
      "title": "自我介绍句型",
      "summary": "My name is …, I live in …, I am learning English.",
      "estimated_minutes": 25,
      "lesson": "intro",
      "prerequisites": [{ "all_of": ["greetings", "be-verb"] }]
    }]
  }]
}
```

An item lists the concepts it assesses: `"concepts": ["be-verb"]`. Tags belong
to `Item`, not to the learner-facing `Prompt`, so they never reach the browser
or AI prompts. Untagged items remain ordinary practice items.

Concept IDs, like item IDs, stay stable across releases. A concept whose meaning
changes, or an item whose answer key changes, gets a new ID so that saved marks
and earlier attempts do not describe different content.

### Validation

`course.Load` and `npm run course:check` reject a package when:

1. A concept ID is not a slug or repeats anywhere in the course.
2. `estimated_minutes` is outside 1–600, or `lesson` names no lesson in the unit.
3. A group is empty, repeats a member, names an unknown concept or the concept
   itself, or contains another group of the same concept; a containing group
   can never be the cheaper choice. A concept has at most eight groups of at
   most sixteen members, so a rule must fit in eight alternatives after
   expansion.
4. The union of all prerequisite references contains a cycle. The error lists
   the cycle. Alternatives do not excuse a cycle.
5. An item tags an unknown concept, repeats a tag, or tags a concept from
   another unit.

`course:check` prints concept, group and tagged-item counts and warns about a
graded concept with fewer than three items.

## Learner state

Concept evidence is the latest recorded attempt of each tagged item in the
active version: practice submissions and finalized mock exam answers, the same
state practice overview reports. Item identity is `(course_id, item_id)`: an
item that keeps its ID keeps its evidence; a removed or renamed item leaves the
count. The review book continues to own retention.

| Value | Rule |
| --- | --- |
| `item_count` | Tagged items in the active version |
| `attempted`, `correct` | Tagged items with a latest attempt; those whose latest attempt is correct |
| `required_correct` | `min(3, item_count)` |
| Mastered | `item_count > 0`, `correct >= required_correct`, and `4 × correct >= 3 × attempted` |

With four items: 3 of 3, 3 of 4 and 4 of 4 correct master the concept; 2 of 2
and 2 of 3 do not. With one or two items every item must be correct. Another
correct answer never removes mastery; enough wrong latest answers do.

A concept is unlocked when it has no prerequisites or every member of one
group is satisfied. Unlocking is advisory: practice stays available, and the
API returns `unlocked` beside the state. The state uses the first matching row:

| State | Label | Condition |
| --- | --- | --- |
| `mastered` | 已掌握 | Mastery rule holds |
| `known` | 已会（自评） | Marked known, and no tagged item's latest attempt is wrong |
| `learning` | 学习中 | At least one tagged item attempted |
| `ready` | 可学习 | Unlocked, no attempts |
| `locked` | 未解锁 | Not unlocked, no attempts |

A wrong latest answer overrides a known mark; the concept shows 学习中 with a
自评与练习不一致 notice until the learner practices or clears the mark. A
concept without items is satisfied only by the mark; the Beginner English oral
self-check uses this form. Thresholds are application constants.

## Planning

`PlanPath(concepts, satisfied, targets)` is a pure function in `internal/study`.
Targets default to every concept.

1. Visit concepts in topological order. A satisfied concept has an empty
   closure. An unsatisfied concept chooses one group: a fully satisfied group
   first; otherwise the group whose combined closure has the fewest concepts,
   then the fewest estimated minutes, then author order. Its closure is itself
   plus the closures of its chosen group's members.
2. Take the union U of the target closures.
3. Remove redundant alternatives. In topological order, a concept in U may
   switch to another group, tried in author order, whose unsatisfied members
   are already in U when recomputing U from the targets makes it strictly
   smaller. Repeat until nothing changes. U only shrinks, so this ends within
   V rounds.
4. Order U with Kahn's algorithm over the chosen groups' edges. The ready queue
   uses author order: unit order, then concept order.

Every step follows all members of its chosen group, the result is
deterministic, and satisfied concepts are skipped. Step 3 removes a branch such
as an alternative C when another target already requires the concept A that
also unlocks the same step. The choice remains a heuristic, not a global
minimum. Courses are small; the passes cost O(V²·(V+E)) at most. The plan
reports total minutes for one learner studying one step at a time.

## Saved paths

A path stores the course, the course version and graph digest at creation,
targets (up to 16 concept IDs; none means the whole course), daily minutes
(10–480), steps and timestamps. The graph digest hashes the canonical concept
list: IDs, units, minutes, groups and sorted tagged item IDs. Each step records the concept, title, unit, estimated minutes and
chosen group. One path per course is active; a partial unique index enforces
this. Creating a path archives the active one in the same transaction.
Archived paths and known marks are keyed by course and concept ID and survive
upgrades.

Reading a path joins the saved steps with live concept states:

| Field | Meaning |
| --- | --- |
| Step `done` | The concept is satisfied |
| Step `unlocked` | Practice is allowed either way; locked steps show a 先修未完成 hint |
| Step `missing` | The concept is absent from the active version; excluded from progress |
| `mastered_steps`, `known_steps`, `remaining_minutes` | Progress counts and 估算 remaining time |
| `estimated_days` | `ceil(remaining_minutes / daily_minutes)` |
| `next_concept` | First step in order that is not done and is unlocked |
| `completed` | No remaining steps, including a plan created with none |
| `stale` | The active graph digest differs from the saved one; lesson-only releases do not count |
| `replan_suggested` | A fresh plan for the same goal has a different set of remaining steps |

Steps show live titles when their concept still exists. If a prerequisite
satisfied at creation regresses, no remaining step may be unlocked; the fresh
plan then includes that prerequisite, so `replan_suggested` is set. The path
never changes silently. Notices state what changed, and 重新规划 replaces the
path.

## Interfaces

| Method and path | Purpose |
| --- | --- |
| `GET /api/courses/{course}/concepts` | Concepts with prerequisites, evidence and live state |
| `PUT /api/courses/{course}/concepts/{concept}/known` | `{"known": true}` sets or clears the mark |
| `GET /api/courses/{course}/learning-path` | `{"path": …}` or `{"path": null}` |
| `POST /api/courses/{course}/learning-path` | Create from `{"targets": [], "daily_minutes": 30}` |
| `GET /api/practice/questions?subject=&concept=` | Practice list limited to tagged items |

`CourseSummary` adds `concept_count`. The handlers validate IDs and limits and
return 404 with 课程不存在 or 知识点不存在. The concept filter applies to every
practice state and rejects a concept from another unit with 400. Services in
`internal/study` compute states and paths; tags come from the active version's
item payloads, so no new item index is needed.

The workspace sidebar adds 学习路径 for courses with concepts. A direct link
to a course without concepts shows an empty state. The page has two tabs:

- 学习路径: the goal form (whole course, or chosen concepts) and daily
  minutes with limits shown; progress as 已掌握 n · 自评 m · 剩余 k; stale,
  replan and completed states; ordered steps with 练习本知识点, 指南 and
  标记已会（自评） or 取消自评. Practice opens with the concept's unit and a
  removable concept chip. A note states that the latest practice and mock exam
  answers set progress.
- 知识图谱: a layered SVG graph. Layers follow the longest prerequisite chain;
  nodes in a layer follow author order. Solid edges mark single-group
  prerequisites; dashed edges mark alternatives. Nodes are focusable with
  their state in text. The view scrolls horizontally on small screens.
  Selecting a node opens its groups, evidence and actions.

Graph layout is a tested pure function and needs no new dependency. Styles use
the existing tokens and control-size token in `web/src/features/learning/`.

## Ownership

| Location | Responsibility |
| --- | --- |
| `contracts/course/v1/` | Schemas and protocol text for concepts and tags. |
| `internal/course/` | Model fields, graph and tag validation, `course:check` summary. |
| `internal/study/` | Planner, concept states, known marks and saved paths. |
| `internal/storage/migrations/`, `db/queries.sql` | `concept_marks` and `learning_paths`. |
| `internal/httpapi/`, `contracts/http/` | Endpoints, practice filter and OpenAPI contract. |
| `web/src/features/learning/`, `web/src/api/` | Learning page, graph and path views, client. |
| `tests/fixtures/courses/concept-graph/` | Isolated browser fixture with AND and OR groups. |

No dependency is added.

## Beginner English pilot

Beginner English 1.1.0 becomes the reference graph. It keeps the `intro` unit
and lesson IDs and the four existing item IDs, which are tagged within `intro`
or moved with their concept; earlier attempts stay counted. Each new unit has
a guide lesson. Items are original, use the four existing types and include an
explanation.

| Unit | Concepts |
| --- | --- |
| `intro` 自我介绍与问候 | greetings, be-verb, spelling, self-introduction, oral-self-introduction |
| `numbers-places` 数字、位置与时间 | numbers, there-is-are, positions, clock-time |
| `requests` 简短请求与指令 | imperatives, yes-no-questions, polite-requests |
| `workbench` 工位动作与单位 | tools-parts, measurement-units, workbench-actions, workbench-instructions |

`polite-requests` shows the alternative form: a polite request is built either
on an imperative (`Please press the button.`) or on a question
(`Can you press the button?`), so it requires imperatives or
yes-no-questions. Every graded concept has at least four items;
oral-self-introduction is the self-check concept.

Beginner English 1.2.0 extends the graph to eight units, 33 concepts and
159 items; its [README](../../../courses/beginner-english/README.md) lists the
units and concepts.

## Non-goals

- A cross-course roadmap. Course README prerequisites are advisory prose and
  need their own evidence review before they become graph data; the
  [course roadmap](../course-roadmap/README.md) records that review.
- Accounts or multiple learners; probabilistic knowledge tracing; retention
  decay.
- Calendars, critical-path scheduling or constraint-based timetables.
- An in-app graph editor, AI-generated paths or a graph database.
- New graded item types or speech assessment.

## Acceptance

- Untouched course packages keep their digests, routes and behavior; the intro-geometry fixture digest matches its recorded value.
- `PublicQuestion` JSON carries no concept tags.
- Validation rejects each rule above with a message naming the concept.
- Planner tests cover AND groups, satisfied and cheaper alternatives, removal
  of a redundant alternative, skipped concepts, targets, deterministic order
  and step validity on generated DAGs.
- State tests cover the four-item outcome table, one-item concepts, known
  marks, and a wrong answer overriding a mark.
- Paths survive restart; replanning archives the previous path in one
  transaction; a concept graph change sets `stale` and marks missing steps,
  while a lesson-only release does not.
- HTTP tests cover 404 messages, the 17-target and minutes limits, and the
  concept filter for every practice state.
- `tests/browser/learning-path.spec.ts` verifies the goal form, progress, graph
  selection, practice chip, known mark and empty state on the fixture.
- Beginner English 1.1.0 has four units, sixteen concepts, the alternative
  group and at least sixty items, passes validation and keeps its four IDs.
- `npm run check` passes.
