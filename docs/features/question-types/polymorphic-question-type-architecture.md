# Polymorphic Named Question-Type Architecture

Status: Proposed design (tracked in [issue #61](../../issues/0061-feat-refactor-question-types-to-named-polymorphic-dispatch.md)).

## 1. Problem & Root Cause

The course authoring schemas (`contracts/course/v1/items.schema.json`, `contracts/course/v2/items.schema.json`) already separate question kinds by semantic `type` (`single_choice`..`translation`), but the runtime stack collapses them back into a flat union keyed by magic integers `1..9`:

1. **Flat pre-projection + negative blacklist (`internal/course/extended.go`, `internal/storage/workspace.go`)**:
   - `workspace.go:129-133` (`projectQuestion`) copies `AudioURL`, `TranscriptURL`, and `TranscriptLines: item.ListeningLines()` before switching on `item.Type`.
   - `Item.ListeningLines()` (`extended.go:125-135`) synthesizes a transcript from `item.Passage` whenever `len(lines) == 0 && item.Passage != nil && item.Type != Reading`.
   - Because `cloze` also carries `Passage` and has no `Transcript`, `cloze` projects its `{{1}}`/`{{2}}` passage into `transcript_lines`, causing `QuestionAudio` to render a listening player and transcript drawer on `cloze` questions.
2. **Untyped flat wire contracts (`contracts/http/openapi.yaml`)**:
   - `Question`, `PublicQuestion`, `QuestionSummary`, `PracticeSummary`, `ExamTypeQuota`, `QuestionContent`, and `CourseItemReview` use integer `question_type` (`1..9`) and mix all type-specific fields as flat optionals (`Attempt` omits `question_type` altogether).
3. **Scattered UI magic numbers and field-presence guessing (`web/src/`)**:
   - `QuestionAudio.tsx:70` only blacklists `question_type === readingQuestionType` (`7`).
   - Components check `< 3`, `=== 3`, `=== 4`, `=== 7`, `=== 8`, or guess question kind from `content?.blanks` / `content?.passage` / `attempt.numeric`.

## 2. Canonical Semantic `QuestionType`

Eliminate numeric identifiers `1..9` across Go domain types, SQLite `questions.question_type`, HTTP OpenAPI contracts, and TypeScript:

```text
single_choice | multiple_choice | true_false | numeric | cloze | listening | reading_comprehension | writing | translation
```

Split the 9 types cleanly by **media capability** (verified against `contracts/course/v1` and `courses/beginner-english/` where all 4 v1 types support optional listening `audio`/`transcript`):

- **Media-capable (5 types)**: `single_choice`, `multiple_choice`, `true_false`, `numeric`, `listening`. Only these 5 types may carry `audio_url`, `transcript_url`, `transcript_lines`, or render `QuestionAudio`.
- **Non-media extended (4 types)**: `cloze`, `reading_comprehension`, `writing`, `translation`. Media and transcript fields are omitted from their Go structs, OpenAPI variants, and TypeScript types.

| `QuestionType` | Media-capable | Stem supplement | Primary answer/input model |
| --- | --- | --- | --- |
| `single_choice` | Optional (v1) | None | `items: QuestionOption[]` |
| `multiple_choice` | Optional (v1) | None | `items: QuestionOption[]` |
| `true_false` | Optional (v1) | None | `items: TrueFalseOption[]` (carries `boolean_value`) |
| `numeric` | Optional (v1) | None | Numeric input (`number_tolerance` in review/grading only) |
| `cloze` | **Forbidden** | `ClozePassage` | `content: { passage, blanks }` |
| `listening` | **Native (3 modes)** | `QuestionAudio` | `content: { sub_questions, passage? }` |
| `reading_comprehension` | **Forbidden** | `ReadingPassage` | `content: { passage, sub_questions }` |
| `writing` | **Forbidden** | `WritingRequirements` | `content: { subtype, requirements?, min_words?, max_words? }` |
| `translation` | **Forbidden** | `TranslationSource` | `content: { direction, source_text, requirements? }` |

## 3. Course & HTTP Contract Design

### 3.1 Tighten `contracts/course/v2/items.schema.json`

- In the `listening` branch (`L39-51`), constrain `audio.mode` vs fields so `dialogue` and `recording` modes do not accept an unrelated `passage` field, and align `validateComposite()` in `internal/course/extended.go`.

### 3.2 Discriminated Unions in `contracts/http/openapi.yaml`

`@hey-api/openapi-ts@0.99.0` generates TypeScript discriminated unions (`({ question_type: 'cloze' } & ClozePublicQuestion) | ...`) when `oneOf` + `discriminator: { propertyName, mapping }` maps every variant by `$ref`.

- Define `QuestionType` (`enum` of the 9 strings) and `ExamQuotaQuestionType` (`enum: [single_choice, multiple_choice, true_false]`).
- Add `question_type: QuestionType` to `QuestionSummary`, `PracticeSummary`, and `Attempt`.
- Split `PublicQuestion` and `Question` into 9 `$ref` variants (`SingleChoicePublicQuestion`..`TranslationPublicQuestion`, `SingleChoiceQuestion`..`TranslationQuestion`) with `discriminator.propertyName: question_type`:
  - Only the 5 media-capable variants include optional `audio_url`, `transcript_url`, `transcript_lines`.
  - Only `true_false` uses `TrueFalseOption` (`boolean_value`); `numeric` omits `items` and `content`.
  - Each extended `Question` variant narrows `question_review` to its specific `*Review` schema.
  - Note: declare each variant's properties explicitly (or omit `additionalProperties: false` on `allOf`-composed subschemas) so OpenAPI schema validation and Hey API intersection generation stay clean.
- Split `CourseItemReview` into a 9-variant `oneOf` + `discriminator: { propertyName: type }` and replace recursive `sub_questions: CourseItemReview[]` with a 4-variant `SubQuestionReview` (`single_choice | multiple_choice | true_false | numeric`).
- Run `npm run generate:api` to regenerate `web/src/api/generated/types.gen.ts`.

## 4. Go Domain & Projection Design

### 4.1 Semantic `course.QuestionType` (`internal/course/question_type.go`)

```go
type QuestionType string

const (
	SingleChoice   QuestionType = "single_choice"
	MultipleChoice QuestionType = "multiple_choice"
	TrueFalse      QuestionType = "true_false"
	Numeric        QuestionType = "numeric"
	Cloze          QuestionType = "cloze"
	Listening      QuestionType = "listening"
	Reading        QuestionType = "reading_comprehension"
	Writing        QuestionType = "writing"
	Translation    QuestionType = "translation"
)
```

- `UnmarshalJSON` accepts both canonical strings and legacy integers `1..9`; `MarshalJSON` always emits the canonical string.
- Replace `study.NumericQuestion`, `study.ClozeQuestion..TranslationQuestion`, and `ExamTypeQuota.QuestionType int64` with `course.QuestionType`.

### 4.2 Exhaustive Per-Type Registries (`internal/course` & `internal/study`)

- **`internal/course`**: Register all 9 types in `map[QuestionType]ItemKind` (tested against `AllQuestionTypes()`). Remove `Item.ListeningLines()` as a shared catch-all method with `!= Reading`; move `ListeningLines` to `Listening` resolution (only invoked for `Listening` and explicit v1 `Transcript` items).
- **`internal/study`**: Define `study.TypeHandler` implemented by 9 explicit handlers (`map[course.QuestionType]TypeHandler`):
  - `Project(base QuestionBase, item course.Item) (Question, error)` — each type projects only its own fields; `workspace.go` removes global pre-projection of `AudioURL`/`TranscriptURL`/`TranscriptLines`.
  - `ToPublic(q Question, vis Visibility) PublicQuestion` — explicitly builds `VisibilityPractice`, `VisibilityActiveExam`, and `VisibilityFinishedExam` payloads, replacing JSON-roundtrip redaction (`practice.go`, `exam_session.go`).
  - `NormalizeAndScore`, `EncodeAttempt`, `IsEligibleForExam`, `ExamSectionOrder`, `PrepareExamItem` (preserving option order for `true_false`, shuffling `single_choice`/`multiple_choice`), `ExamAudioSpeeds`, `ExamSpeechLine`, and `TranscriptText` (non-media handlers return `nil`/`ErrInvalid`/`""` directly).
- **`internal/palace/prompt.go`**: Replace `NumericQuestion` and `map[int64]string` with `map[course.QuestionType]promptRenderer`; `TranscriptText` comes from the study handler so `cloze` never receives `<listening_transcript>`.

## 5. SQLite Migration & Snapshot Compatibility

Local `var/study.sqlite` holds 2,256 `questions` rows (`question_type` `1..9`), 3 `mock_exams` (including `in_progress`), 126 `practice_question_snapshots`, and 10 child FK tables (including immutable `answer_attempts`).

1. **Migration `internal/storage/migrations/00016_semantic_question_type.sql`**:
   - Use `-- +goose NO TRANSACTION` with `PRAGMA foreign_keys = OFF; PRAGMA legacy_alter_table = ON; BEGIN IMMEDIATE;` (matching `00012_shared_exams.sql`, verified against `sqlc@v1.31.1`'s SQLite DDL parser).
   - Rebuild `questions` with `question_type TEXT NOT NULL CHECK (question_type IN ('single_choice','multiple_choice','true_false','numeric','cloze','listening','reading_comprehension','writing','translation'))`, mapping `1..9` via `CASE`.
   - Recreate `questions_subject_order`, verify `PRAGMA foreign_key_check`, `COMMIT`, and `PRAGMA foreign_keys = ON`.
   - Delete `import_metadata` keys `LIKE 'workspace:%'` (matching `00015`) so active courses re-project clean `payload_json` on startup, purging stale `cloze` `transcript_lines`.
2. **`sqlc.yaml` + `npm run generate:db`**:
   - Map `questions.question_type` to `test-driven-study/internal/course.QuestionType` (or `string`) and regenerate `internal/storage/storedb/`.
3. **Frozen JSON Snapshot Compatibility**:
   - Do not mutate `mock_exams.paper_json`, `mock_exams.rule_json`, `practice_question_snapshots.question_json`, or `palace_jobs.snapshot_json` in place.
   - `QuestionType.UnmarshalJSON` decodes both `1..9` and semantic strings; `Question.UnmarshalJSON` decodes legacy flat `payload_json` into the typed representation and strips any stale `AudioURL`/`TranscriptURL`/`TranscriptLines` on the 4 non-media extended types.

## 6. Frontend TypeScript & React Architecture (`web/src/`)

1. **`QUESTION_TYPE_REGISTRY: Record<QuestionType, QuestionTypeSpec>` + `assertNever`** in `web/src/features/question-types/registry.ts`:
   - Holds `label`, `examPrompt`, `answerHeading`, `isChoice`, `isMultiple`, `isWritten`.
   - TypeScript forces every consumer to handle all 9 `QuestionType` cases.
2. **Type-narrowed components (zero numeric IDs, zero blacklists, zero field-guessing)**:
   - `QuestionAudio.tsx`: accepts only `MediaQuestion = Extract<AnyQuestion, { question_type: 'single_choice' | 'multiple_choice' | 'true_false' | 'numeric' | 'listening' }>`; removing `question_type === readingQuestionType` entirely so passing `cloze` or `reading_comprehension` is a compile error.
   - `ExtendedQuestion`, `ExtendedReview`, `ExtendedReference`, `ExtendedExplanations`: dispatch via exhaustive `switch` on `kind` / `item.type` / `question.question_type` + `assertNever`.
   - `practice/{QuestionCard,StudyDetails,PracticeSession,ChoiceOptions,QuestionPreview}`, `memorization/{QuestionCard,StudyDetails}`, `exam/{ExamQuestion,TerminalFeedback,TerminalDialogs,ExamWorkspace,ExamNavigation,useExamTerminal,terminalLabels}`, `palace/PalaceSource`, and `analysis/{AnalysisPage,model}` (`attemptSummary(attempt)` using `attempt.question_type`) all dispatch exhaustively via `switch (question.question_type)`.

## 7. Verification Matrix

1. **Go matrix tests (`internal/course/`, `internal/study/`, `internal/storage/`, `internal/palace/`)**:
   - Exhaustiveness test confirming all 9 `AllQuestionTypes()` have registered `ItemKind`, `TypeHandler`, and `promptRenderer`.
   - Projector/visibility matrix asserting non-media 4 types never emit `AudioURL`/`TranscriptURL`/`TranscriptLines`, active exam/practice public payloads withhold answers & transcripts, and cross-type `AnswerInput` returns `ErrInvalid`.
   - Legacy snapshot fixture test (integer `question_type: 1..9`, active `mock_exams`, pre-fix `cloze` snapshot containing `transcript_lines`) verifying clean decode and zero listening leak.
2. **TypeScript & Vitest matrix (`web/src/`)**:
   - `tsc --noEmit` exhaustiveness + `@ts-expect-error` assertions proving `cloze` / `reading_comprehension` / `writing` / `translation` cannot be passed to `QuestionAudio` and cannot access foreign fields.
   - Unit tests for `QUESTION_TYPE_REGISTRY`, `attemptSummary`, and component dispatch across all 9 types.
3. **Playwright E2E matrix (`tests/browser/question-types.spec.ts`)**:
   - Verify positive rendering/grading and **negative cross-type isolation** across all 9 types (e.g., `cloze`, `reading_comprehension`, `writing`, and `translation` render zero `听力音频播放` regions and zero `查看逐字稿` controls).
