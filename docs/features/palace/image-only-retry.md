# Image-only retry

Select **仅重跑生图** after an image fails or when another image would help.
The same action is available in the result panel, task history and execution
trace dialog. Choose an image model, aspect ratio, resolution and quality, then
select **仅生成新图**.

The new task reuses the exact saved final prompt, original question snapshot
and reference image. It does not call the LLM, repeat web research or change the
scene plan. The source task, analysis, image and trace remain available.
Image parameters selected for the new task become the last-used preferences.
The dialog displays the new pixel dimensions; legacy images may have a different
original size.

**重新构思** starts the complete pipeline with the current page settings.
**重跑完整流程** in task management starts it with the previous task settings.
Use these actions when the analysis or scene needs to change.

Only terminal tasks with a saved image-stage prompt can retry image generation.
Unfinished or failed analysis must be completed or rerun first. A missing saved
plan or changed reference asset prevents the new image request.

If a submission loses its network response, **确认上次提交** reuses its UUID and
parameters. The browser retains this public request in session storage across
reloads. Confirm unchanged parameters before choosing another attempt. The
server returns an already accepted job without generating another image.

## API and provenance

`POST /api/palaces/jobs/{source-id}/retry-image` accepts a new UUID in `id` and
optional `model`, `aspect_ratio`, `resolution`, and `quality` fields. Omitted
fields preserve the source settings. The endpoint returns HTTP 202 and the new
job; conflicting reuse of an ID returns HTTP 409.

`snapshot.retry_of` identifies the immediate source task. Pipeline retries retain
the original `snapshot.pipeline.plan_id`, with zero new `llm_usage`. Generation
details show the original plan's usage separately. Each attempt has its own image,
state events and trace; no LLM or search events are fabricated for the new task.
