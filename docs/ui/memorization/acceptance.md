# Memorization acceptance

Date: 2026-11-01. Status: passed. Scope: three-column workspace
and continuous floating question navigation, implemented directly on main.

| Gate | Result |
| --- | --- |
| Issue validation | All five issues passed. |
| Frontend domain and shortcut tests | 8 passed across 2 files. |
| TypeScript and production frontend/Go build | Passed. |
| Browser acceptance | All 19 workflows passed using installed Google Chrome. |
| Source dataset and image assets | No modifications. |

## Layout coverage

Viewport coverage includes 1920×1080, 1536×864, 1440×900, 1366×768, 1280×720,
1280×600, 1280×480, 1024×768, and 390×844. Dimension checks cover the document,
body, root, application shell, workspace, reading area, and question card, plus
primary button bounds.

The three-column stability check uses five original content cases at 1280px
width and 900/600/480px heights: an image question, the longest original stem
(190 characters), a question without an image, the longest original option set,
and an image recovered from a source-package gap. Question, answer, and explanation columns share a top
and height. Save notices preserve footer bounds. Full explanation text remains
in the third column without line clamping.

There is no permanent right sidebar. The floating navigator overlays the page
without changing reading-panel dimensions. Its bounds are checked at 1440×900,
1280×600, 1280×480, and 390×844. The main document does not scroll; oversized
content and the continuous question list scroll within their own bounds.

## Navigation coverage

The question browser contains all 1734 subject-one or 1413 subject-four results
in one continuous grid, with no pagination. Index points include the first,
every 100th, and last position. Jumps scroll the list without changing the
selected question. A current-range dot distinguishes the selected question's
location from the list's browsing position.

Coverage includes native wheel scrolling, hundred-position and end jumps,
selection by original question ID, reopening at the current tile, learned-state
labels, filtered two-question results, and empty results. Keyboard coverage
includes n, arrows, Home/End, Enter, Escape, focus restoration, trigger toggling,
outside click, and protection during text entry or an existing dialog.

At widths of 900px or less, explanation is available through the toolbar and
the complete-content dialog. At widths of 650px or less, primary columns stack.
Dialog tabs retain standard keyboard interactions.

## Regression and data isolation

Existing workflows cover original answers and images, subject totals, learning
marks, reload/cursor resume, search, empty results, chapter filters, multiple
answers, recovered original images, image-load retries, dialogs, and keyboard preferences. Tests use
isolated SQLite directories under var/browser-acceptance, preserving personal
study records. Backend behavior, generated bindings, dependencies, and original
data/assets are unchanged. No AI provider requests were added.

The original chapter-zero labels and initial migration records remain intact.
The 135 source-package image gaps were subsequently filled from the original
image server. All 135 recovered originals pass full decoding and SHA-256 checks;
all 1434 bundled images remain byte-identical. Current local image references
have zero gaps. Recovery evidence is in docs/data/image-recovery/.

## Artifacts

The question-context update moves original ID/state into the stem-column
heading and places the chapter beside the type badge. Additional coverage
checks Up/Down in long explanations and compact analysis dialogs, keyboard
guards, resumed current-question location, and original IDs under chapter
filters. Navigation's accessible names include both position and original ID.

- `implemented-desktop.png`: three-column page at 1440×900.
- `implemented-desktop-long.png`: longest original stem at 1280×600.
- `implemented-navigation-open.png`: continuous navigator and vertical index.
- `implemented-mobile.png`: primary content at 390×844.
- `design.yaml`, `keyboard.md`: requirements and interaction reference.
- `mockup-desktop.png`, `prompt.md`: original generated design and brief.

Commands: npm run issue:check, npm run test:unit, npm run build, and
npm run test:e2e.
