# Memory palace UI

The page uses the application's blue/white light theme and deep-blue dark
theme. The root remains within `100dvh`; individual content panels scroll.

| Region | Content and interaction |
| --- | --- |
| Sidebar | Active memory-palace item and subject submenu. |
| Top toolbar | Page name, theme toggle, existing continuous question navigator. |
| Provider settings | Separate image and Responses LLM tabs, independent credentials and connection tests. |
| Action row | Original question ID, compact-screen controls, Generate. |
| Left panel | Original question, local diagram, all options and correct answer; expandable explanation. |
| Center panel | Empty state, asynchronous status, or contained generated image. Zoom and local download. |
| Right panels | Automatic LLM planning, image parameters, reference controls and recent image jobs. |
| Resolution | 1K/2K/4K tiers, exact requested dimensions, explicit cap for 2:3. |
| Saved-image badge | Image icon and border on successful questions in all three navigators. |

At 1100 pixels or below, settings and history open in dialogs. At 650 pixels or
below, the original question also opens in a dialog, leaving the image canvas
visible. The generation action remains in the action row at every width.
Long prompts occupy a scrollable read-only text field in a dialog.
The provider modal keeps saved keys blank, shows their configured status, and
requires explicit reuse when an API origin changes. The connection test only
reads the model list. It performs no image generation or save.
The resolution control has a short accessible name and a separate pixel-size
description. Its selected option always includes the concrete dimensions.

Generation uses an indeterminate status, with no fabricated percentage. The
page explains that accepted work continues across navigation. Failed and
interrupted jobs offer explicit regeneration. The cancellation control states
that stopping local waiting does not guarantee upstream cancellation or billing.

Saved-image previews use local API URLs. The source question and answer remain
available independently of provider configuration. Image-based legal claims
are not presented as verified current rules.

Acceptance covers 1440×900, 1280×600, 1024×768, 700×600, and 390×844 viewports.
Preview captures show one real provider result, documented in the
[acceptance report](../../features/palace/acceptance.md).

![Light desktop](desktop-light.png)

![Dark desktop](desktop-dark.png)

![Dark mobile](mobile-dark.png)

![Saved-image badges in the navigator](navigation-saved-images.png)

The configuration previews use public fixture addresses and an empty password
field. They contain no real provider URL, API key, or proxy authentication.

![Provider settings on desktop](provider-settings-desktop.png)

![Provider settings on mobile](provider-settings-mobile.png)

## Task-manager typography

Task management uses the shared typography tokens in `web/src/styles/tokens.css`:
12px controls and helper text, 14px body/status text, 13px task labels, 11px
captions and 17px dialog titles. Shared modal bodies set their size explicitly
across portal boundaries; task filters match shared application buttons.
These sizes remain the same in both themes and on compact screens.

Verified 2026-11-04: production build and 16 existing browser regressions passed.
Sixteen additional browser inspections covered empty, loading, error and populated
states at 1440×900, 1280×600, 390×844 and 320×568, across light/dark themes and
16px/20px root defaults. Computed font sizes matched tokens; dialogs remained
bounded without horizontal overflow and returned focus to their trigger.
All checks used isolated data or local provider fixtures, without paid requests.

![Empty task manager on desktop](task-manager-empty-desktop.png)

![Empty task manager on mobile](task-manager-empty-mobile.png)

![Empty task manager in the dark theme](task-manager-empty-dark.png)

## Automatic pipeline controls

Provider settings retain separate **生图服务** and **LLM · Responses** tabs.
The generation panel shows the automatic stage sequence and compact, expandable
LLM parameters. Model, reasoning effort and session budget remain configurable
before generation. No adoption or confirmation button appears between stages.

The canvas shows **LLM 记忆构思** and **生图与保存**, including waiting, active,
completed and failed states. The view remains inside the viewport during either
stage. **生成详情** contains an expandable read-only structured plan, final prompt
and returned usage. Errors remain attached to their failed stage.

The screenshots below use isolated fixture models, addresses and records.

![LLM provider settings](llm-settings-desktop.png)

![LLM provider settings on mobile](llm-settings-mobile.png)

![Automatically generated plan in job details](llm-planning-desktop.png)

## Research evidence and context budget

Compact LLM controls expose required/off search mode and expandable working-context
fields. Defaults show 274 K total, 210 K compaction trigger and 64 K reserve;
the backend derives per-response output from reserve. There is no second
output-limit input. The stage strip distinguishes research,
compaction and continued reasoning without adding a confirmation step.

Job details show original-image/frame count, reasoning rounds, searches,
compactions, cumulative usage and source-supported explanation. Government links
are clickable; unsupported or contradictory research remains a failed job and
cannot proceed to an image.

The provider settings tab tests authentication/model-list access only. Runtime
capability failures remain attached to the planning stage, with a safe API
parameter name. They do not show a successful research badge or trigger images.
The prompt preview includes the v1.2 reference-watermark instruction; existing
saved results keep their historical template and appearance.
