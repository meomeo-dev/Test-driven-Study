# Memorization UI

The current implementation uses a fixed 100dvh workspace. The left navigation
contains the subject submenu. A small progress toolbar replaces the breadcrumb,
large title, and slogan from the original mockup.

On desktop, the primary surface has three equal columns: question text and
original image, options and correct answers, and full explanation. All three
columns fill the same bounded height. The action footer and save notice reserve
space so they remain stable across short/long questions. Oversized content can
scroll within its column. Complete original content and metadata are also
available in the detail dialog.

There is no permanent right sidebar. The toolbar question-navigation control is
collapsed initially and opens a floating right drawer without resizing the study
surface. All filtered question numbers form one continuous grid. A vertical line
with dot markers jumps to the first, every 100th, and the last position. Index
labels refer to filtered positions; tiles show original question IDs below
their position numbers. The current summary shows both values, and Locate
centers and focuses the current tile without switching questions.
Jumping scrolls only the drawer. Selecting a tile changes the question, closes
the drawer, and returns focus to the toolbar control. Reopening locates the
current question. The drawer also closes with Escape, its close button, the
toolbar toggle, or an outside click.

At widths of 900px or less, explanation opens through a toolbar button and the
primary surface has two columns. At widths of 650px or less, those columns stack.
The navigator stays within the viewport at all supported sizes. Its list scrolls
locally; the document does not scroll.

The selected blue-white and dark-blue palettes share the application theme
control documented in ../themes/README.md. The original ivory/forest mockup is
retained as design history. Its road scene remains illustrative; the application
uses only original question assets.
Progress comes from SQLite. Unimplemented navigation remains unavailable.

- `design.yaml`: current layout and behavior requirements.
- `keyboard.md`: shortcut mappings, safeguards, and standards references.
- `acceptance.md`: acceptance evidence and limitations.
- `implemented-desktop.png`, `implemented-mobile.png`: current browser captures.
- `implemented-desktop-long.png`: longest original stem in a short desktop viewport.
- `implemented-navigation-open.png`: continuous navigation with the vertical index.
- `mockup-desktop.png`, `prompt.md`: original design and generation brief.
