---
id: 0070
type: fix
status: closed
closed-by: beb646c
labels: [frontend, navigation]
branch: fix/0070-enable-independent-study-sidebar-scrolling
created: 2026-11-19
---
# Enable independent study sidebar scrolling

## 背景 / 目标

The study workspace clips the navigation when the sidebar's course units and
mode links exceed the viewport height. In Beginner English, this can hide
links below the memory palace unit list.

## 关键功能清单（Key Feature List，KFL）

- Make the shared study sidebar scroll vertically when its content overflows.
- Keep the study workspace in place while moving through the sidebar.

## 改造面

Shared study layout styles and a browser regression in the memory palace.

## 非目标

Changes to sidebar routes, course order, or question navigation behavior.

## 验收标准（Acceptance Criteria，AC）

- At desktop and narrow viewport widths, wheel scrolling inside the sidebar
  reaches the final link and returns to the first mode.
- The main content area retains its position as the sidebar scrolls.

## 讨论

Use the existing viewport-height sidebar as the native scroll container.

### Verification

Type checking and all seven course browser tests passed. The memory palace
regression scrolled to the final link and back at 1280×480 and 768×480 while
the main content area retained its position.
