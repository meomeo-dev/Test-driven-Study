# Subject guide acceptance

The dedicated sidebar menu, direct route, and URL state were verified in the browser.

- Units expose curriculum, lessons, and examination content.
- Unit lesson reading pane formats markdown with appropriate heading levels, lists, and code blocks.
- Switching units updates the active lesson and resets scroll to the top.
- Desktop and mobile views remain within the document viewport.
- Dark and light themes are fully supported across all viewports.
- Reading the guide makes no unexpected network requests.

## Course lessons

The course-lesson browser case verifies:
- At 1440×900, lesson text is bounded cleanly in a readable article column.
- Heading levels, lists, and formatted code blocks render with correct CSS token styling.
- Selecting another unit opens the lesson at scroll position 0.
- Units without questions display appropriate study advice without an exam scope line.
