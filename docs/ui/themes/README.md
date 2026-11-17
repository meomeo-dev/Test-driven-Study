# Selected light and dark themes

The application implements preview A as its default blue-white light palette
and preview C as its dark-blue palette. The unselected navy-sidebar option is
retained only in the generated preview archive.

The toolbar's theme button switches modes with mouse, Enter, or Space. The
choice persists across navigation and reloads through localStorage. A small
head bootstrap applies the stored choice before the application renders.
When storage is blocked, switching remains available for the current session.

Shared semantic CSS tokens cover page surfaces, text, actions, focus, dialogs,
navigation, charts, and answer feedback. Dark mode uses a dark label on the
bright blue primary action. Text links use a separate contrast-safe blue;
secondary text and success labels use readable shades of the selected palette.
Original logo pixels and question media are unchanged.

Representative normal-size text is checked at a minimum contrast ratio of 4.5:1
against its rendered background. Blue text links and success labels use darker
light-mode shades than their generated references. These targeted checks do not
claim a complete WCAG accessibility audit.

Browser acceptance uses isolated learning data. Captures are practice-light.png,
practice-dark.png, practice-dark-mobile.png, and analysis-dark.png. Tests cover
selection preservation, record counts, route/reload persistence, blocked storage,
viewport bounds, overlays, and representative text contrast in both modes.

Acceptance on 2026-11-01: npm run check passed all 31 browser flows, 8 frontend
unit tests, Go tests, generated bindings, startup lifecycle, issue validation,
and production builds. The running personal application was checked by toggling
only its theme; acceptance attempts use a separate database.
