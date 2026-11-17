# Memorization keyboard controls

Vim-style navigation follows [Vim motion commands](https://vimhelp.org/motion.txt.html)
and [Vim search commands](https://vimhelp.org/pattern.txt.html).
Learning actions are application mappings; they are not Vim or Emacs standards.

| Keys | Action | Convention |
| --- | --- | --- |
| `j`, Right arrow | Next question | Vim down / sequential navigation |
| `k`, Left arrow | Previous question | Vim up / sequential navigation |
| Up / Down arrows | Scroll the visible explanation | Local reading navigation |
| `gg` | First question in the filtered list | Vim first line |
| `G` (Shift+G) | Last question in the filtered list | Vim last line |
| `/` | Focus and select the search field | Vim search entry |
| `m` | Mark mastered and advance | Application |
| `r` | Toggle review status | Application |
| `u` | Clear the current learning mark | Application |
| `f` | Enlarge the original question image, when available | Application |
| `v` | Open the complete question | Application |
| `n` | Open the floating question navigator | Application |
| `?` | Open keyboard help | Application |

The `gg` sequence expires after 900ms and resets when focus changes. Repeated
key events may navigate, but do not repeat learning mutations or open dialogs.
The mappings and help text share `web/src/features/memorization/shortcuts.ts`.

## Focus and input behavior

Global shortcuts ignore text fields, selects, editable content, tab lists,
menus, composition events, and Ctrl/Command/Alt combinations. They also ignore
already-handled events and open dialogs for study actions. Up/Down may scroll
the analysis dialog body when it contains the visible explanation. Other
dialogs and tab lists retain native controls. Browser shortcuts remain available.
Search Escape returns focus to the reading area. Native Enter and Space still
activate focused buttons.

Dialogs use Escape to close and restore focus to the invoking control. A dialog
opened from the reading area returns there. Tab lists use Left/Right arrows and
Home/End with a single tab stop, following the
[WAI-ARIA tab pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
Modal focus behavior follows the
[WAI-ARIA dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

Inside the question navigator, arrow keys move focus between question numbers;
Up/Down move by a six-question row. Home/End focus the first/last result. Enter
selects a question and collapses the drawer. Escape closes it. The toolbar
control and close button also collapse it; clicking outside dismisses it.
The navigator uses one tab stop for the question-number grid and focuses the
current question when opened. Hundred-question index points only scroll the
local list. Selecting a tile performs the actual question change. The filled
index point marks the selected question's range, even while browsing another
part of the list. Original question identifiers appear below the ordinal on
each tile and in tooltips. Locate centers and focuses the current original ID.

## Preference

The keyboard-help checkbox disables global printable shortcuts. The setting is
saved in localStorage; arrow navigation and native control interactions remain
available. Visible hints and `aria-keyshortcuts` follow that preference. This
provides the off mechanism described in
[WCAG 2.1.4](https://www.w3.org/WAI/WCAG21/Understanding/character-key-shortcuts.html).
