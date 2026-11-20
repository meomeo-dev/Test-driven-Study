# Project instructions

## Scope and starting points

These instructions apply throughout this repository. Read [README.md](README.md)
for setup, [handoff.md](handoff.md) for the dated development state, and the
relevant issue and feature documentation before changing behavior.
[CHANGELOG.md](CHANGELOG.md) records user-facing changes and package releases.

- Keep source, comments, commits and technical documentation in clear English.
  Product labels and question-bank content are Chinese; preserve that language.
- Prefer small changes that preserve domain behavior. Keep study logic outside
  React components and HTTP handlers; use the existing Go services.
- Target 88-character lines when readable. Treat large files and functions as a
  refactoring signal, without splitting cohesive logic into shallow wrappers.
- Preserve useful existing comments and explain complex behavior beside the code.
- Reuse color and typography tokens from `web/src/styles/tokens.css`. Shared
  modal bodies set the body size explicitly because portals do not inherit page
  typography. Keep task controls on the shared control-size token.
- Use a context-isolated agent for technology research, with public names and
  non-confidential requirements only. Never send source, secrets, internal paths
  or private implementation details to external search services.
- Record dependency purpose, alternatives, boundary and exit conditions in
  [docs/dependencies.yaml](docs/dependencies.yaml) when adding a dependency.

## Project layout and ownership

| Location | Responsibility |
| --- | --- |
| `cmd/server/` | Server startup, service wiring and pipeline adapter. |
| `internal/course/`, `courses/` | Course validation and versioned course packages. |
| `internal/study/` | Questions, memorization, grading, analysis and mock exams. |
| `internal/storage/` | SQLite opening, import, embedded migrations and generated bindings. |
| `internal/httpapi/` | HTTP validation, endpoints and static frontend serving. |
| `internal/llm/` | Responses planning, research, budgets, compaction and checkpoints. |
| `internal/palace/` | Image provider, durable task queue, controls and saved images. |
| `internal/tts/` | Speech synthesis, provider settings and voice-specific cache. |
| `internal/tasktrace/` | Observed execution-event recording. |
| `web/src/features/` | React pages, mode hooks, and the 9-type `question-types/` L0–L5 package (`registry.test.ts` enforces zero `types/` cross-imports and `<= 300` lines/file). |
| `web/src/components/`, `web/src/styles/` | Shared controls and application styles. |
| `web/src/api/` | Handwritten HTTP clients and generated API types. |
| `tests/browser/`, `tests/startup/`, `tests/fixtures/` | Browser checks, process checks and local providers. |
| `contracts/course/`, `contracts/http/`, `db/` | Course schemas, OpenAPI and SQL queries. |
| `data/`, `assets/img/` | Original question exports and local question media. |
| `assets/audio/pinyin/` | Bundled Pinyin recordings and source attribution. |
| `issues/`, `docs/` | Requirements, frozen inputs, feature evidence and UI references. |

Change the source of generated code:

- HTTP: edit [contracts/http/openapi.yaml](contracts/http/openapi.yaml), then run
  `npm run generate:api`. Output is `web/src/api/generated/`; Hey API generates
  types only. The application HTTP clients remain handwritten.
- Database: add migrations under `internal/storage/migrations/` and edit
  [db/queries.sql](db/queries.sql), then run `npm run generate:db`. Output is
  `internal/storage/storedb/`. Do not rewrite applied migrations or generated code.
- `npm run generate` runs both generators. SQL generation requires cached sqlc
  v1.31.1 and runs offline. See the README for proxy-based cache preparation.
- `npm run check:generated` regenerates files and checks for drift; it can modify
  stale output. Review any generated diff rather than discarding it blindly.

## Running the application

Requirements: Node.js 26+, npm 11+ and Go 1.26+. Run commands from the repository
root; server asset resolution depends on the working directory.

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies using the committed npm lockfile. |
| `npm run dev` | Start Vite on 43387 and the Go API on 43388. |
| `npm run dev:up` | Start development services in the background. |
| `npm run dev:status` | Inspect background development services. |
| `npm run dev:down` | Stop the background development services. |
| `npm run build` | Typecheck, build `dist/` and compile the Go binary in `var/bin/`. |
| `npm start` | Serve the built application on API port 43388. |
| `npm run course:check -- <directory>` | Validate one course package (`pnpm run course:check <directory>` without `--`). |
| `npm run course:install -- <directory>` | Install or activate a validated version (`pnpm run course:install <directory>` without `--`). |

Configuration examples are `.env.example`, `.env.gpt.example` and
`.env.gpt-image2.example`. `STUDY_WEB_PORT`, `STUDY_API_PORT` and `STUDY_DATA_DIR`
override defaults. Existing services and data may belong to an active learner;
inspect their state before restarting services or changing configuration.

## Data and behavior invariants

- Ordinary study works without an account, AI credential or external database.
  Question media are served locally.
- Preserve question IDs, option signs, answers, and modular course exports.
  New package content requires a new version. Update an installed course with
  `course:install` so existing learner records keep their stable question IDs.
- In memorization, derive the card ordinal and active navigation tile from the
  displayed question. Publish the subject progress and filtered navigator rows
  together after marking. The footer position uses the filtered list, and
  the toolbar progress counts the whole subject. Retain learning-state colors
  on the selected tile.
- Default learner data are in `var/study.sqlite`, generated images in
  `var/palaces/`, and resumable LLM state in `var/llm-checkpoints/`. Respect a
  configured data directory. Back up these together while the service is stopped.
  Keep test data separate from learner data.
- Every submitted practice attempt remains a separate record. Estimates describe
  question-bank performance, not a calibrated official score or pass probability.
- Mock exams retain server-owned deadlines, saved paper/rule snapshots, stable
  option signs and atomic answer/navigation updates. Recovery must not reset time
  or duplicate papers or learning attempts. Restart finalizes and retains the old
  paper before creating a new one.
- Active unanswered exam questions expose no correctness or explanations. Grade
  multiple-choice answers by exact set; unanswered questions receive zero credit.
- Keep the exam terminal independent of the learning sidebar, themes and unrelated
  shortcuts. Mock exams provide standard local simulations based on course question
  banks and unit configurations.
- LLM, image, and TTS services have independent settings and OS credential entries.
  Never expose saved keys or proxy credentials in responses, logs or committed
  files. Remote AI calls and downloads require an explicit proxy, with no direct
  fallback; local test fixtures are the isolated development alternative.
- Declare audio in course data. Use local recordings for Pinyin and TTS for Han
  text in Elementary Chinese. Explicit TTS voices take precedence over the
  saved default, and the selected voice determines the cache entry. Keep
  playback controls consistent across options before grading. Use
  `design-course-tts` to audit course audio segmentation and all-caps overrides.
- Use v2 `study_translation` for aligned study text in reading and listening.
  Match `material` to nonblank `passage` text segments or structured
  `transcript` lines in order, and key sub-question and option translations by
  their existing IDs. Keep translated strings separate from the source audio
  inputs. Follow `golden-course-template` and validate with `course:check`.
  Expose translations through `question_review` in memorization and graded
  practice, and in mock exam review only after the entire paper ends.
  The [authoring guide](docs/features/question-types/README.md#study-translations)
  defines the alignment rules.
- Keep explanation audio, `cloze.passage_tts`, `writing.sample_response` /
  `sample_response_tts`, and `translation.reference_translation_tts` restricted to
  graded review and memorization payloads; never expose them in active unanswered
  exam or pre-submit practice payloads. Regeneration applies to synthesized speech.
  Record the source and license of bundled recordings in the audio asset README.
- Accepted palace jobs belong to the backend and survive page navigation.
  Preserve pause checkpoints, explicit continuation and image-only retry behavior.
  Uncertain paid requests must never be silently replayed. After restart, only
  safely paused tasks can resume; other unfinished tasks become interrupted.

## Issues, branches and evidence

Follow [issues/README.md](issues/README.md) and the shared contract in
[scripts/issue-lib.mjs](scripts/issue-lib.mjs).

- Git worktrees are prohibited for development in this repository. Do not create
  or use linked worktrees. Perform all development in the primary checkout.

1. Create issues with `npm run issue:new -- --type <type> "Title"` only in the
   primary checkout on `main`. Complete the template and validate it.
2. Commit the issue and any input assets on `main` before implementation.
3. Create its ordinary issue branch in the primary checkout with
   `git switch -c type/NNNN-slug main`. Implement and verify in that same checkout.
4. Keep the correspondence between `issues/NNNN-type-slug.md` and branch
   `type/NNNN-slug`. The legacy `issue:worktree` command reports a policy violation.
5. Keep issue files in place. Closed issues require `closed-by`; use Conventional
   Commits such as `fix: description (closes #N)`. Normally open PRs from the
   primary repository. Inspect the actual remote configuration first.

For authorized cleanup, inspect linked worktrees for local changes and
confirm each branch tip is reachable from the integration target. Before
removing a remote branch, verify the current remote tip and preserve it on the
remote integration branch, either already published or in the same atomic push.

Explicit user instructions can authorize a different workflow for a specific
task; preserve that scope. The direct-on-main decisions recorded in issues #27
and #29 do not establish a general exception for future issues.

Inputs under `issues/_assets/NNNN-slug/` are frozen after commit. Put implementation
outputs in their canonical feature/data/UI directory. Synchronize
`issues/_template.md` with `REQUIRED_SECTIONS` if the issue structure changes.

## Verification and handoff

- Track distinct file-modification operations as `edit_actions`. Invoke the test
  harness only after `edit_actions > 13`, or at task completion when edits exist
  and no harness has run. Reset the counter after each harness execution. An
  explicit user request can override this timing rule.
- Choose checks for the affected behavior: `npm run typecheck`, `npm run test:unit`,
  `npm run test:go`, `npm run test:startup` and `npm run test:e2e`. The complete
  acceptance gate is `npm run check`; do not repeat passed gates without a reason.
- For documentation-only changes, check local links, whitespace and relevant
  issue records. Application tests are needed when application behavior changes.
- Browser checks use isolated databases and local AI fixtures on frontend/API/
  provider ports 43287/43288/43289. Keep these isolated from learner data and paid
  services. Chromium or installed Chrome is required.
- Report checks actually run, their outcomes and material gaps. Historical
  acceptance reports are evidence of earlier runs, not a current verification.
- Keep [handoff.md](handoff.md) dated and concise: baseline commit, completed work,
  remaining acceptance criteria, verification and concrete next steps. Link
  canonical evidence rather than duplicating full feature documents. Keep
  temporary status in the handoff and durable instructions in this file.
