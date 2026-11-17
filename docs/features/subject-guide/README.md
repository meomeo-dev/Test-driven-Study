# Course subject guide

Route: `/guide?subject=<id>`. The sidebar opens **科目指南**. Learners can select
units of the installed course and read unit lessons, prerequisites, and examination format.

## Interface and layout

The course guide provides navigation for each unit in the active course package.
The summary row shows the exam format, study advice and, for units with questions,
the exam scope. The unit lessons fill the article body with an integrated lesson reader
whose text column is bounded for optimal reading comfort.

Lesson Markdown preserves clean formatting:
- Headings are nested cleanly below the unit title
- Lists, code blocks, and typographic tokens adhere to the shared CSS design tokens
- Selecting another unit opens its lessons from the beginning
- Responsive layout supports both desktop and narrow mobile viewports
- Light and dark themes are fully supported

## API contract

The backend provides `/api/guide?subject=<id>` returning `CourseGuide`:
- `stages`: List of unit guide stages (`id`, `title`, `official`, `format`, `learning`, `exam`, `prerequisites`)
- `reviewed`: Version and review date
- `total_hours`: Optional hours per unit
