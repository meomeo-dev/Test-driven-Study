# Course-owned AI teaching content

Both AI modules resolve optional teaching content from the current
question's installed course version. The application owns prompt
assembly, provider configuration, and execution rules.

| Responsibility | Question assistant | Memory palace |
| --- | --- | --- |
| Course teaching content | Explanation approach, examples, terminology, preferred language and evidence guidance. | Research focus, scene planning, and the image composition template. |
| Shared application contract | Current question and supplied evidence, conversation history, retrieval and citation validation, output delivery and settings. | Canonical question and answer, template variables, structured plan, image request, job lifecycle, and persisted prompt. |

Courses such as Basic Math supply independent memory palace resources.
The course scaffold copies the generic [starter resources](../../../courses/starter/profiles/) and an
[author guide](../../../courses/starter/profiles/PROMPT-AUTHORING.md) with
stage-specific fill-ins, a worked example, and a review rubric.

## Package contract

The optional `ai_profile` configures assistant and palace resources.

```json
{
  "ai_profile": {
    "assistant_instructions": "profiles/assistant.txt",
    "palace_template": "profiles/memory-palace.json",
    "palace_research_instructions": "profiles/palace-research.txt",
    "palace_planning_instructions": "profiles/palace-planning.txt"
  }
}
```

The assistant file contains UTF-8 teaching guidance. The palace file
declares a template ID, a version, and a prompt using the shared
`QUESTION_TEXT`, `REFERENCE_ANSWER` and `PALACE_ADDRESS` placeholders.
The package loader checks paths, size limits, and content digests.
A missing field uses the corresponding shared default.
An invalid declared file fails installation. Models, credentials, proxy,
permitted tools and budgets are application settings.

The server resolves teaching content using the stored course ID and package
version. A job snapshot stores the rendered image prompt and profile identity.
The planning record pins the research and planning files to the same installed
version. Pause, resume, and image-only retry reuse the saved resources or
rendered prompt for their stage. Assistant replies
record the profile identity so older feedback can be traced after a course
upgrade. Application code enforces provider and tool permissions and validates
the plan before sending an image request.

The planner receives the course planning instructions and the rendered image
template with the item evidence. The image model receives that rendered
template and the validated scene. The platform supplies the
[output limits](../../../internal/llm/plan_validation.go) and JSON schema.

## IELTS examples

- **Question assistant.** Quote the evidence or a short relevant phrase,
  explain why each plausible distractor fails, and give one transfer exercise.
  Preserve English examples and use Chinese for explanations when helpful.
  For Listening, distinguish the supplied explanation from actual audio
  evidence. For Writing and Speaking, use criteria-based practice feedback
  when a learner has supplied a response and the task supports it.
- **Memory palace.** Use a visual association for a transferable skill,
  such as contrast markers, route directions, or matching a heading to a
  paragraph. Use one continuous scene and up to two short, verified English
  labels beside the action or object they describe.

IELTS guide tasks support self-review. Essay and recording submissions need
their own input workflow.
