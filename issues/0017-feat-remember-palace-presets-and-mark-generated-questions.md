---
id: 0017
type: feat
status: closed
closed-by: 359e984
labels: []
branch: feat/0017-remember-palace-presets-and-mark-generated-questions
created: 2026-11-01
---
# Remember palace presets and mark generated questions

## 背景 / 目标

Improve reference-image prompting, remove the prompt's question-ID input,
add resolution presets, retain generation choices, and mark questions with
saved memory images. Continue directly on main, without worktrees.

## 关键功能清单（Key Feature List，KFL）

- Delete the question-identifier input line without replacement content.
- Make only necessary reference-role and image-preservation prompt edits.
- Map 1K/2K/4K tiers and aspect ratios to valid explicit API dimensions.
- Persist model, aspect ratio, quality, and resolution across navigation/reload.
- Show saved-image badges in continuous question navigation for both subjects.
- Resolve the latest successful image outside the recent-30 history window.

## 改造面

Embedded prompt and renderer; palace settings/types/size validation; SQLite
coverage query and bindings; HTTP/OpenAPI; frontend preference hook, generation
controls, shared navigation badges; domain/browser tests and documentation.

## 非目标

Large prompt rewrites, extra question-ID instructions, automatic paid retries,
upscaling old images, fabricating supported provider parameters, and worktrees.

## 验收标准（Acceptance Criteria，AC）

- AC1: Rendered new prompts omit the question identifier input entirely.
- AC2: PNG/JPEG references are still transmitted through image edits; prompts
  identify the reference and preserve answer-determining diagram information.
- AC3: Presets respect the documented edge, area, ratio, and multiple-of-16 rules.
- AC4: UI discloses actual pixels and any capped approximate resolution tier.
- AC5: Last explicit generation choices persist; history cannot overwrite them.
- AC6: Saved-image badges survive reload and cover records older than 30 jobs.
- AC7: Existing saved prompts/images remain unchanged; isolated checks pass.

## 讨论

The image API accepts size as WIDTHxHEIGHT rather than separate resolution or
aspect-ratio parameters. Exact 9:16 at a 1024-pixel long edge is below the
minimum area. Exact 2:3 at a 3840-pixel long edge exceeds the maximum area;
the UI must disclose these limits rather than promise impossible sizes.

Implemented directly on main in commit 359e984. All acceptance criteria passed.
The complete check passed with 53 browser tests, ten frontend unit tests, all Go
packages, three startup checks, generated bindings, and production builds.
No linked worktree was created.
