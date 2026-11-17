# Cross-course roadmap

The course roadmap (课程路线图) relates installed courses to each other. A
course package states which courses to study before it or alongside it. The
learner database owns course completion marks and one saved route (学习路线)
generated from the relations, completion and a goal. Relations are advisory:
they order the route and label courses, and they never block opening a course.

The model reuses the concept graph from [learning paths](../learning-path/README.md):
prerequisites are alternative groups in disjunctive normal form, `PlanPath`
orders the route, and the saved route follows the saved-path pattern.

## Evidence review

Relations come only from the `学习起点` section of a course README. A sentence
becomes data when it does both:

1. It names an installed course by its title, by the subject its title begins
   with (电路基础, C 语言, 单片机, 参数化建模) or by the abbreviation 高数.
2. It tells the learner to study that course before this one (先学, 先完成,
   可先练) or alongside it (并行, 配合).

Unqualified 先学 is required (先修). 建议 or 可 makes the relation recommended
(建议先修). 并行 and 配合 are parallel (建议并行). Abilities (会, 能, 理解),
topics, project deliverables, tools, external resources and courses that do not
exist here remain prose.

Issue #46 added 16 packages: 15 technical and mathematics courses and Beginner
English. Courses without prerequisite requirements declare no relation.

| Course | `学习起点` sentence | Classification |
| --- | --- | --- |
| algebra-geometry | 会基本四则运算。 | Ability |
| | 小数和百分数可先练项目内的《基础数学》。 | **Recommended:** basic-math |
| applied-machine-learning | 会 Python，并理解比例和基本统计。 | Abilities; no course is named as study |
| | 先做出能运行的视觉检测基线。 | Project deliverable |
| automatic-control | 先了解传感器和执行器。 | No 传感器 course exists |
| | 深入分析前学习导数、积分和一阶微分方程。 | Topics; no course is named |
| c-programming | 会运行电脑程序。可先在桌面编译器练习。 | Ability; tool |
| cad-fdm-printing | 会用毫米表示尺寸即可。 | Ability |
| | 参数化建模可先在电脑完成，试印时使用可借用的 FDM 打印机。 | Tools |
| circuit-fundamentals | 会四则运算和单位换算。实验使用低压直流供电。 | Ability; lab condition |
| embedded-mcu | 先学电路基础与 C 语言的条件、循环和函数。 | **Required:** circuit-fundamentals and c-programming |
| | 可先用模拟器或一块开发板练习。 | Tools |
| engineering-calculus | 先掌握函数、代数运算与坐标图。 | Topics; no course is named |
| | 建议并行复习三角函数。 | Topic; no course is named |
| industrial-automation | 建议先完成单片机状态机。 | **Recommended:** embedded-mcu |
| | 入门可用控制逻辑仿真。 | Tool |
| linear-algebra | 会解简单方程，会读平面坐标和向量分量。 | Abilities |
| machine-vision | 会用 Python 读取文件和运行函数。 | Ability; no course is named as study |
| | 可从已有工件照片开始。 | Material |
| pcb-design | 选修。 | Elective status, not a relation |
| | 建议先完成电路基础与单片机样机，并确认器件和接线方案。 | **Recommended:** circuit-fundamentals and embedded-mcu; the wiring check is a project task |
| probability-statistics | 能计算均值、比例和百分数即可开始。 | Ability |
| | 系统学习概率分布与估计时再配合高数。 | **Parallel:** engineering-calculus |
| python-programming | 会操作电脑。即使没有编程经历，也可从变量开始。 | Ability; no prerequisite |
| tolerances-metrology | 会读毫米、小数和区间。 | Ability |
| | 建议与参数化建模并行。 | **Parallel:** cad-fdm-printing |
| beginner-english | 适合词汇量约 300 或更少……的成人。课程说明以中文呈现。 | Audience |
| | 从 USA Learns 的 *1st English Course* 第一单元开始。 | External resource |

Six packages gain a patch version with these relations; the other packages are
unchanged and keep their digests.

| Course | Version | Relation |
| --- | --- | --- |
| algebra-geometry | 1.0.1 | Recommended: basic-math |
| embedded-mcu | 1.0.1 | Required: circuit-fundamentals and c-programming |
| industrial-automation | 1.0.1 | Recommended: embedded-mcu |
| pcb-design | 1.0.1 | Recommended: circuit-fundamentals and embedded-mcu |
| probability-statistics | 1.0.1 | Parallel: engineering-calculus |
| tolerances-metrology | 1.0.1 | Parallel: cad-fdm-printing |

Several sentences describe abilities that an installed course teaches: Python
for machine learning and machine vision, calculus topics for automatic control,
and algebra topics for calculus. They become data only after a README names
the course as study.

## Package data

Protocol v1 gains an optional top-level `roadmap` object:

```json
"roadmap": {
  "note": "先学电路基础与 C 语言的条件、循环和函数。",
  "prerequisites": [
    { "all_of": ["circuit-fundamentals", "c-programming"], "strength": "required" }
  ],
  "parallel_with": []
}
```

- `note` quotes the README sentence that states the relations. It is required,
  so every relation carries its basis; the roadmap shows it to the learner.
- `prerequisites` lists up to eight alternative groups. Each `all_of` names up
  to sixteen course IDs. `strength` is `required` or `recommended`; a group is
  required only when the README requires every member.
- `parallel_with` lists up to sixteen courses to study alongside. Parallel is
  symmetric and orders nothing.
- A roadmap declares prerequisites, parallel courses or both.

`course.Load` and `npm run course:check` reject a group or parallel entry that
names the course itself, a group that contains another group, and a course that
is both a prerequisite and parallel. Packages are installed independently, so a
course ID that is not installed is valid.

`course:install` and startup seeding refuse a version whose prerequisites form a
cycle with the other active courses. The error lists the chain, for example
`roadmap prerequisite cycle a requires b requires a`, and the transaction rolls
back, so the previous version stays active. Courses that are not installed and
parallel relations do not take part.

## Course completion

| Course | Completed when |
| --- | --- |
| With concepts | Every concept is satisfied: mastered or known, as in learning paths |
| Without concepts | The learner marks it 已学完 |

Each course has one completion source. A course with concepts rejects the mark
with 该课程按知识点进度判断是否学完. A course without concepts, such as Basic
Math with four sample items, has no graph that practice results could satisfy,
so it completes through the mark. Marks are
keyed by course ID and survive upgrades; a stored mark is ignored while the
active version declares concepts.

## Course states

The first matching row applies:

| State | Label | Condition |
| --- | --- | --- |
| `completed` | 已学完 | The completion rule holds |
| `in_progress` | 学习中 | Has concepts, and at least one is satisfied or attempted |
| `ready` | 可开始 | No prerequisites, or every installed member of one group is completed |
| `waiting` | 先修未完成 | Otherwise |

Every state can open the course. A prerequisite or parallel course that is not
installed appears in the course's `missing` list and shows 未安装. It cannot be
completed here, so readiness and planning ignore it; a group whose members are
all missing counts as met.

## Planning

Active courses enter `PlanPath` in catalog order, by course ID. Packages declare
no study time, so every course has zero minutes and the route shows order and
progress, not days. Groups exclude missing courses, and completed courses are
satisfied. Required and recommended groups both order the route; the strength
is a label. Each course uses a met group first, then the group with the
smallest closure, then author order, and the pruning pass drops redundant
alternatives. Targets are up to 16 course IDs; none means every installed course.

## Saved route

`course_roadmaps` stores the relation digest, targets, steps and timestamps.
Each step records the course, title and chosen group with its strength. A
partial unique index allows one active route. Creating a route archives the
active one in the same transaction; archived routes are retained.

| Field | Meaning |
| --- | --- |
| Step `done` | The course is completed |
| Step `prerequisites_met` | The course is ready; otherwise the step shows 先修未完成 |
| Step `missing` | The course is no longer installed; excluded from progress |
| `completed_steps`, `remaining_steps` | Progress counts |
| `next_course` | First step that is not done and has its prerequisites met |
| `completed` | No remaining steps |
| `stale` | Active course IDs or prerequisite groups differ from the saved digest |
| `replan_suggested` | A fresh plan for the same goal has different remaining steps |

The digest hashes each active course ID with its groups and strengths. A release
that changes only content, the note or parallel courses does not mark a route
stale.

## Interfaces

| Method and path | Purpose |
| --- | --- |
| `GET /api/roadmap` | Courses with relations, completion, state and missing courses |
| `PUT /api/courses/{course}/completed` | `{"completed": true}` sets or clears the mark |
| `GET /api/roadmap/path` | `{"path": …}` or `{"path": null}` |
| `POST /api/roadmap/path` | Create from `{"targets": []}` |

Handlers return 404 with 课程不存在 and 400 for a concept course mark, more than
16 targets or a repeated target.

The catalog page has two tabs, 所有课程 and 学习路线 (`/courses?tab=roadmap`):

- The route panel has the goal form (all courses or chosen courses), progress
  as 已学完 n · 剩余 k, stale, replan and completed notices, and ordered steps.
  A step shows its state, chosen prerequisites with 先修 or 建议先修, 打开课程,
  and 标记已学完 or 取消已学完 for a course without concepts; a course with
  concepts shows its concept progress instead.
- The course graph renders courses with prerequisite relations through the
  dependency graph component shared with the knowledge graph. Solid edges are
  required, dotted edges recommended and dashed edges alternatives. Other
  courses are listed beside it. Selecting a course shows its basis, groups,
  parallel and missing courses, and actions.

## Ownership

| Location | Responsibility |
| --- | --- |
| `contracts/course/v1/` | `roadmap` schema and protocol text. |
| `internal/course/` | Model, package validation and the cross-course cycle check. |
| `internal/storage/` | Cycle refusal at install, `course_marks` and `course_roadmaps`. |
| `internal/study/` | Course states, completion marks, planning and the saved route. |
| `internal/httpapi/`, `contracts/http/` | Endpoints and OpenAPI contract. |
| `web/src/features/roadmap/`, `web/src/api/` | Roadmap tab, route and graph views, client. |
| `web/src/features/learning/` | Dependency graph component shared with the knowledge graph. |

No dependency is added.

## Non-goals

- Blocking a course until its prerequisites are complete.
- Concept-level relations between courses; the manufacturing courses declare no
  concepts.
- Study durations, calendars or scheduling.
- Inferring relations from abilities, topics or projects, or rewriting READMEs
  to create them.
- Upgrading bundled courses in an existing database at startup. Startup seeds
  only missing courses; `npm run course:install -- courses/<id>` installs a
  patch version.

## Acceptance

- The evidence table classifies every `学习起点` sentence of the 16 packages, and
  a test pins the bundled relations to the six rows above.
- Untouched packages keep their digests.
- Validation rejects self references, containing groups, a course that is both
  prerequisite and parallel, an unknown strength and a missing note.
- Installation refuses a version that closes a cycle among active courses and
  keeps the previous version active.
- State tests cover concept-derived completion, the mark, the mark rejected for
  a concept course, readiness with required and recommended groups, and missing
  courses.
- Routes persist across restart, replanning archives the previous route, and a
  relation change marks the route stale.
- HTTP tests cover 404 and 400 messages and the target limit.
- `tests/browser/course-roadmap.spec.ts` verifies the tab, graph selection,
  completion mark, route creation and reload on the bundled courses.
- `npm run check` passes.
