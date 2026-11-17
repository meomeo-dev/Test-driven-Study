# Study question context and explanation navigation

Both study modes show the original question ID and study state in the stem
column's heading, aligned with the option and explanation labels. The chapter
appears beside the type badge. Long chapters truncate visually but retain
their complete text and native title tooltip.

Up/Down scroll an already visible, overflowing explanation by 48 px. Held keys
continue scrolling. The same behavior targets the analysis dialog on compact
screens. Input fields, composition, modifiers, navigation grids, tab lists, and
unrelated dialogs retain their existing controls. Printable-shortcut preferences
do not disable arrow scrolling. Practice never reveals answers through this path.

Navigator tiles show both filtered list position and original question ID.
These values are different: sparse original IDs are not sequential list indices.
The current summary displays both. Locate centers and focuses the current tile
without selecting another question or changing study records. Hundred-question
points continue to index filtered positions.

Browser acceptance covers resumed cursors without an explicit question URL,
current-tile location after scrolling away, selection/reopening, desktop and
mobile metadata, long main explanations, compact analysis dialogs, and keyboard
guards. Chapter-filtered lists retain the same original ID while changing the
displayed position. Captures use isolated test data:

- practice-context.png: chapter and aligned question context before answering.
- practice-current-navigation.png: current original ID and located tile.

Acceptance on 2026-11-01: npm run check passed all 41 browser workflows,
8 frontend unit tests, Go tests, generated bindings, startup lifecycle checks,
strict builds, and issue validation. No question data or source images changed.
