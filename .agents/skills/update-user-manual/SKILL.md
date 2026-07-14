---
name: update-user-manual
description: Maintain and audit the Fumen Mobile Fork HTML user manual and real-app screenshots when the user explicitly requests a manual update. Do not use for ordinary implementation or UI changes unless the user separately asks to update the manual.
---

# Update the user manual

Use this skill only when the user explicitly requests creating, updating, auditing, or otherwise changing the user manual or its screenshots. Changes to application behavior, controls, localized labels, screen layout, List/Tree workflows, the PC side panel, Cold Clear, Import/Export, Help routing, or other user-facing behavior do not by themselves authorize a manual update.

Maintain `resources/manual/index.html` as a concise, task-oriented description of the current app.

## Establish the current behavior

1. Read `AGENTS.md`.
2. Inspect recent UI commits with `git log` and `git log -p` for affected files.
3. Inspect the implementation, Japanese locale strings, and relevant unit/Cypress tests.
4. Run the current build and operate the feature in the live local app.
5. Treat sources in this order: current implementation and tests, live app, then locale strings.
6. Audit the whole manual for related stale content instead of editing only the reported sentence.

## Write for current users

- Describe only features and constraints that exist now.
- Do not mention removed behavior, past UI, migration history, or phrases equivalent to "previously", "now", "deprecated", or "no longer exists".
- Keep a current limitation when it changes what the user can do, such as List reordering being disabled in tree mode or the last page being protected from deletion.
- Use the visible Japanese UI label from `src/locales/ja/translation.ts`. Do not retain an old English label as a parenthetical alias after the UI is localized.
- Put behavior under the screen or setting that currently owns it. For example, document kick-table selection under Settings, not FLAGS.
- Lead with what the user can accomplish. Prefer short steps, verbs, tables, and visible button labels.
- Preserve the warning that tree data is stored as `#TREE=...` in the first-page comment.
- Keep the manual in Japanese unless the task explicitly adds another language.
- Keep a short footer disclosure that the manual is created and maintained with generative AI using the implementation and live app as its basis.

## Keep the information architecture stable

Order the main sections by the user workflow:

1. Introduction
2. Screen overview
3. Edit
4. Pages and comments
5. List
6. Tree
7. PC side panel
8. Cold Clear
9. Import, export, and sharing
10. Settings
11. Useful operations
12. Troubleshooting

Keep the sticky navigation in the same order as the sections. Place the PC side panel after the full-screen Tree explanation because it embeds both List and Tree.

## Required UI audit

Before declaring the manual current, compare the live app and Cypress coverage for:

- the editor's split Import/Export and field-settings buttons;
- the unified Import/Export modal, output scope, GIF delay, and TinyURL setting;
- List/Tree card activation, second-click navigation, comments, and reordering constraints;
- the tree node's permanent delete icon, subtree scope, last-page protection, and Undo toast;
- tree-mode disable confirmation and the first-page `#TREE=` data;
- the PC List/Tree side panel, tabs, resizing, saved width, and responsive auto-hide;
- localized List/Tree setting labels, read directly from the Japanese locale file;
- Settings ownership of all kick-table choices, using their current localized labels;
- Cold Clear queue editing, search types, and every visible setting.

## Maintain screenshots

- Store screenshots under `resources/manual/images/`.
- Capture the running current app. Never generate or reconstruct the application UI.
- Use a stable sample fumen that clearly shows the documented feature.
- Capture PC-only features at a desktop viewport and mobile workflows at a representative mobile viewport.
- Avoid personal data, browser chrome, debug overlays, and transient toasts unless the toast itself is documented.
- Replace a screenshot when visible controls, labels, layout, or workflow change.
- Add concise Japanese `alt` text and a caption describing the current UI.
- If adding arrows or callouts, annotate a real screenshot and retain the unedited source during the task.

## Preserve navigation

- Preserve the remaining informational content in `resources/help.html` unless the user explicitly requests a removal.
- Keep the manual link near the bottom of Help rather than redirecting Help itself.
- Keep README and Help links pointing to the manual.
- Keep all manual assets local so the manual works offline.

## Validate delivery

1. Confirm every local link, section anchor, stylesheet, and image referenced by the manual exists.
2. Confirm navigation order matches section order.
3. Search the manual for obsolete and historical wording before finishing.
4. Run `yarn webpack`; do not edit generated files in `dest/`.
5. Open the built manual and verify all images load at desktop and mobile widths without page-level horizontal overflow.
6. Confirm Help still displays its original content and its bottom link opens `manual/index.html`.
7. Run relevant lint, unit, and Cypress tests when application code or UI flows change.
