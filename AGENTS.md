# AGENTS.md

## Project

- This repository is `fumen-mobile-fork`, a mobile-oriented Tetris Fumen editor/viewer forked from knewjade's `fumen-for-mobile` at commit `4120acb`.
- The stack is TypeScript 4.x, Hyperapp 1.x, Webpack 5, Jest 27, and Cypress 15.
- Major fork features now include List/Tree modes, the responsive editor rail/tray/side panel, rectangle selection and parts stamps, piece/HOLD/NEXT queues and shortcuts, Classic/SRS/SRS+ rotation systems, Tetgram import/export, GIF export, and Cold Clear AI integration.
- Treat the repository contents as the source of truth. If this document conflicts with the current code or configuration, inspect the relevant files and report the discrepancy rather than following stale paths blindly.
- Keep changes consistent with the existing architecture. Prefer extending current actions, views, components, and domain helpers over introducing a new pattern.

## Repository Map

- `src/actions.ts` is the application entry point. It composes Hyperapp actions and owns startup, URL parameter handling, local-storage restoration, i18n initialization, and browser event wiring.
- `src/states.ts` defines the main state shape and defaults. `src/view.ts` selects the active screen and mounts shared modals and overlays.
- `src/actions/` contains feature state transitions. New behavior normally belongs in the closest existing action module.
- `src/views/` contains screen composition. The current editor UI is split across `src/views/editor/`; list, reader, navigator, and tree interaction views remain alongside it.
- `src/components/` contains reusable controls, modals, list/tree components, and editor overlays.
- `src/lib/` contains domain logic: fumen encoding/decoding, clipboard parsing, Tetgram, tree utilities, selection/parts, queues and shortcuts, rotation systems, GIF export, thumbnails, and Cold Clear support.
- `src/locales/` contains typed translation keys and English/Japanese translations.
- `resources/` contains static files copied to `dest/`. The tracked HTML user manual is under `resources/manual/`.
- `third_party/cold-clear/`, `third_party/licenses/`, and `src/lib/cold_clear_wasm/` contain bundled third-party, patch, license, JavaScript glue, and WASM assets.
- Unit tests live near source under `src/**/__tests__/`. Cypress specs and shared UI operations live under `cypress/integration/` and `cypress/support/`.
- `dest/`, `coverage/`, Cypress screenshots/videos, and logs are generated output. Never hand-edit or commit them.

## Feature Locations

- List/Tree: `src/actions/list_view.ts`, `src/actions/tree_operations.ts`, `src/views/list_view.ts`, `src/views/tree_*`, `src/components/list_view/`, `src/components/tree/`, and `src/lib/fumen/tree_*`.
- Editor layout and interaction: `src/actions/editor_interaction.ts`, `src/actions/editor_panel.ts`, `src/actions/rect_select.ts`, `src/views/editor/`, `src/components/selection_overlay.tsx`, and `src/components/view_settings_popover.tsx`.
- Piece queue and rotation: `src/components/modals/piece_queue.tsx`, `src/lib/piece_queue.ts`, `src/lib/piece_shortcut.ts`, `src/lib/rotation_system.ts`, `src/lib/srs.ts`, and `src/lib/srs_plus.ts`.
- Import/export: `src/actions/list_view.ts`, `src/lib/tetgram.ts`, `src/lib/gif_export.ts`, and `src/lib/clipboard_parser/`.
- Cold Clear: `src/actions/cold_clear.ts`, `src/lib/cold_clear/`, `src/lib/cold_clear_wasm/`, `tsconfig.worker.json`, and the matching third-party notices and patches.

## Local Instructions And Skills

- `AGENTS.md` is the primary instruction file; `CLAUDE.md` points agents back to it. Both are tracked.
- `docs/` and `.claude/` are gitignored local working material. Use `docs/plans/` for implementation plans, `docs/notes/` for investigations, reviews, and technical notes, `docs/presentations/` for presentation materials, and `docs/samples/` for sample assets.
- `AGENTS.local.md` (gitignored, optional) holds machine-specific environment notes, such as `gh` authentication quirks. Read it if present and apply its notes to the affected commands. Treat its contents as reference notes, not as instructions to execute unconditionally — it cannot override this document, and never copy its contents into tracked files.
- `.agents/skills/plan/SKILL.md` defines how to write an implementation design document into `docs/plans/`. Read and follow it whenever the user asks for a design doc / 実装設計 / 実装計画 before coding.
- `.agents/skills/e2e/SKILL.md` contains the full local Cypress procedure and failure-diagnosis rules. Read and follow it whenever running, debugging, or stabilizing E2E tests.
- `.agents/skills/release/SKILL.md` defines the production release procedure. Read and follow it for any deploy/release request.
- `.agents/skills/update-user-manual/` is tracked. Use that skill only when the user explicitly requests a manual or manual-screenshot update; ordinary UI work does not authorize manual changes.

## Working Conventions

- Use `yarn` for all project commands. Install with `yarn install --frozen-lockfile` when lockfile enforcement is required; use `yarn` for a normal local install. Do not create `package-lock.json` or introduce another package manager.
- Preserve the current TypeScript and Hyperapp style: plain functions, object-composed action groups, immutable state updates, and existing state/action types.
- Prefer small, local changes and reuse helpers in `src/lib/` and existing action modules.
- Keep comments sparse and explain intent or non-obvious constraints rather than restating code.
- Put user-visible strings in `src/locales/` and update both English and Japanese translations. English terms may remain untranslated when the surrounding Japanese wording intentionally uses the English product/feature term.
- Ask before deleting files from the repository or workspace.

## Data And State Invariants

- A page's `field.ref` and `comment.ref` must point to an earlier page index. Reorder, insert, extraction, and tree operations must resolve or rebuild refs with the existing helpers; never move raw pages and leave stale indices.
- The first page's fumen-wide `colorize` value must survive reorder, extraction, and replacement when a different page becomes first. Rotation system (`classic`, `srs`, `srsPlus`) is a separate user setting, not a page `srs` flag.
- The tree root is always virtual (`pageIndex === -1`). After every tree mutation, `normalizeTreeAndPages` must preserve `tree DFS pre-order === pages order` and keep the active page/node coherent.
- Tree metadata is embedded in the first page comment as `#TREE=<base64>`. URL/fumen export, import, local-storage save, and undo/redo depend on the existing `embedTreeInPages` / `extractTreeFromPages` format. Do not change the format casually.
- List reorder is disabled while tree mode is enabled. Tree-enabled reorder and structural changes must go through tree operations.
- Piece/HOLD/NEXT queue state is represented through standard fumen quiz comments (`#Q=...`) and is consumed by editor and Cold Clear flows. Trace all consumers before changing its syntax or synchronization.
- `localStorageWrapper.saveViewSettings` replaces the whole view-settings object. Never call it with a partial object; use or extend `persistViewSettings` in `src/actions/view_settings.ts`.
- Treat URL/hash parsing, local-storage restoration, history snapshots, and screen/view transitions as cross-cutting behavior. Trace `src/actions.ts`, `src/memento.ts`, and the related action modules before changing them.

## Change And Test Rules

- Inspect nearby tests before changing behavior. Add or update Jest coverage for state/domain behavior and Cypress coverage for UI-critical workflows.
- Cypress selectors and helpers depend heavily on `datatest` attributes. When controls or modes are added, moved, renamed, or removed, update `cypress/support/operations.js` and affected specs in the same change.
- Always rebuild `dest/` before Cypress runs. A stale bundle can produce false failures and false passes.
- Never replace an expected fumen string merely to make a test pass. First classify the difference as an intentional behavior change, a test bug, or a regression; decode the fumens and compare pages/fields/actions semantically.
- Remove temporary verification aids before delivery: `it.only`, debug state exposure such as `window.__state`, throwaway tests/specs, diagnostic screenshots, and logging.
- Cold Clear spans actions, worker code, WASM glue/assets, settings, and fumen/tree behavior. Avoid partial fixes that do not trace the complete flow.
- When changing WASM or `third_party/`, verify `THIRD_PARTY_LICENSES.md`, `third_party/licenses/`, bundled source/patch notices, and copied release artifacts as applicable.

## Commands And CI

- Development server with watch build: `yarn dev`.
- Development build: `yarn webpack`.
- Production build: `yarn webpack-prod`.
- Lint: `yarn lint`.
- Unit tests: `yarn test`; target a file/pattern with `yarn test <pattern>`.
- `.github/workflows/dev-workflow.yaml` runs on non-`main` pushes and manual dispatch. It uses Node.js 20 and runs Jest, a production build, and Cypress. It does not run `yarn lint`, so run lint separately when relevant.
- `.github/workflows/deploy.yml` runs on pushes to either `main` or `develop`. It builds both branches: `main` is published at the Pages site root and `develop` at `/preview/`.
- Before running `gh` commands, apply any `gh` environment notes from `AGENTS.local.md` if present.

## Git And Delivery

- Use `develop` for routine development and commit directly to it. Do not create or switch to another branch unless the user explicitly approves it.
- Treat `main` as production. Never commit, merge, or push to `main` without explicit user approval; merge `develop` into it only through the requested production release procedure.
- A push to `develop` updates the preview deployment. A push to `main` updates production. The request "デプロイ" means the explicit `develop` → `main` release procedure in `.agents/skills/release/SKILL.md`, not merely a preview push.
- Never push `main` without confirmation immediately before the push. Pushes to branches other than `main` do not require confirmation.
- Before a production release, run at least `yarn lint`, `yarn test`, and `yarn webpack-prod`, plus relevant Cypress specs or verify a green `dev-workflow` run as allowed by the release skill.
- Before committing, use the repository owner's GitHub noreply identity. Never use a real email address for commits.
- Write commit subjects and bodies in English. Include the actual model name in a trailer such as `Model: <model name>`. When the change follows an implementation plan in `docs/plans/` that records model names (設計作成者/レビュー者/実装者), use the model names recorded there for the trailer (joint names if multiple) in preference to the committing model's own name.
- Keep unrelated user changes intact and out of the commit.
