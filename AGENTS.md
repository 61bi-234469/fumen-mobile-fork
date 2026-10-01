# AGENTS.md

## Project

- This repository is `fumen-mobile-fork`, a mobile-oriented Tetris Fumen editor/viewer forked from knewjade's `fumen-for-mobile` at commit `4120acb`.
- The stack is TypeScript 4.x, Hyperapp 1.x, Webpack 5, Jest 27, and Cypress 15.
- Major fork features now include List/Tree modes, the responsive editor rail/tray/side panel, rectangle selection and parts stamps, piece/HOLD/NEXT queues and shortcuts, INPUT mode with statistics and 7bag gray, Classic/SRS/SRS+ rotation systems, Tetgram import/export, GIF/image export, Cold Clear AI integration, and a TETR.IO replay (.ttrm) viewer with garbage reproduction and Cold Clear move evaluation.
- The app is an offline-capable PWA served from GitHub Pages. Lint is TSLint 6 (`tslint.json`).
- Treat the repository contents as the source of truth. If this document conflicts with the current code or configuration, inspect the relevant files and report the discrepancy rather than following stale paths blindly.
- Keep changes consistent with the existing architecture. Prefer extending current actions, views, components, and domain helpers over introducing a new pattern.

## Repository Map

- `src/actions.ts` is the application entry point. It composes Hyperapp actions and owns startup, URL parameter handling, local-storage restoration, i18n initialization, and browser event wiring.
- `src/states.ts` defines the main state shape and defaults. `src/view.ts` selects the active screen (Reader, Editor, List, Tree, Replay) and mounts shared modals and overlays.
- `src/actions/` contains feature state transitions. New behavior normally belongs in the closest existing action module.
- `src/views/` contains screen composition. The current editor UI is split across `src/views/editor/`; list, reader, navigator, replay, and tree interaction views remain alongside it.
- `src/components/` contains reusable controls (`atomics/`, `tools/`, `event/`), modals, list/tree components, replay components (`replay/`), and editor overlays.
- `src/lib/` contains domain logic: fumen encoding/decoding, clipboard parsing, Tetgram, tree utilities, selection/parts, queues and shortcuts, rotation systems, INPUT statistics, GIF/image export, thumbnails, SEO, TETR.IO replay parsing and simulation (`ttrm/`), Cold Clear support, and shared helpers such as `toast.ts` and `clipboard_copy.ts`.
- `src/locales/` contains typed translation keys and English/Japanese translations.
- `resources/` contains static files copied to `dest/`. The tracked HTML user manual is under `resources/manual/`.
- `third_party/cold-clear/`, `third_party/licenses/`, and `src/lib/cold_clear_wasm/` contain bundled third-party, patch, license, JavaScript glue, and WASM assets.
- Unit tests live near source under `src/**/__tests__/`. `src/__tests__/` also holds repository contracts: `e2e_selector_contract.test.ts` (Cypress `datatest` selectors must exist in `src`) and `spec_timings_contract.test.ts` (`cypress/spec-timings.json` must match the spec files).
- Cypress specs and shared UI operations live under `cypress/integration/` and `cypress/support/`. `cypress/SPEC_MAP.md` maps each spec to the `src` areas it covers; `cypress/spec-timings.json` weights CI sharding (`scripts/plan_cypress_shards.js`).
- `dest/`, `coverage/`, Cypress screenshots/videos, and logs are generated output. Never hand-edit or commit them.

## Feature Locations

- List/Tree: `src/actions/list_view.ts`, `src/actions/tree_operations.ts`, `src/views/list_view.ts`, `src/views/tree_*`, `src/components/list_view/`, `src/components/tree/`, and `src/lib/fumen/tree_*`.
- Editor layout and interaction: `src/actions/editor_interaction.ts`, `src/actions/editor_panel.ts`, `src/actions/rect_select.ts`, `src/views/editor/`, `src/components/selection_overlay.tsx`, and `src/components/view_settings_popover.tsx`.
- Piece queue and rotation: `src/components/modals/piece_queue.tsx`, `src/lib/piece_queue.ts`, `src/lib/piece_shortcut.ts`, `src/lib/rotation_system.ts`, `src/lib/srs.ts`, and `src/lib/srs_plus.ts`.
- Editor editing aids: `src/actions/field_editor_right_click.ts` (unified right-click), `src/lib/spawn_mino_convert.ts` and `src/lib/spawn_mino_toggle_toast.ts` (SPAWN mino / paint toggle), `src/lib/seven_bag_gray.ts`, `src/lib/input_stats.ts`, and `src/views/editor/input_stats_panel.ts` (INPUT mode).
- Piece queue and rotation also include `src/views/editor/piece_queue_overlay.ts`, `src/lib/classic_rotation.ts`, and `src/lib/piece_das.ts`.
- Settings and shortcuts: `src/components/modals/user_settings.tsx`, `src/components/modals/user_settings_catalog.ts`, `src/actions/user_settings.ts`, `src/actions/view_settings.ts`, `src/actions/shortcuts.ts`, and `src/lib/shortcuts.ts`.
- Import/export: `src/actions/list_view.ts`, `src/components/modals/list_view_menu.tsx`, `open.tsx`, `append.tsx`, `src/lib/tetgram.ts`, `src/lib/gif_export.ts`, `src/lib/thumbnail.ts`, `src/lib/tree_export.ts`, `src/lib/comment_metadata.ts`, and `src/lib/clipboard_parser/`.
- Cold Clear: `src/actions/cold_clear.ts`, `src/lib/cold_clear/`, `src/lib/cold_clear_wasm/`, `src/components/modals/cold_clear_menu.tsx`, `src/components/input_ai_guide_overlay.tsx`, and the matching third-party notices and patches. `third_party/cold-clear/README.md` documents how to rebuild the WASM from the pinned source and patch.
- TETR.IO replay: `src/actions/replay.ts`, `src/actions/replay_analysis.ts`, `src/views/replay.tsx`, `src/views/replay_layout.ts`, `src/components/replay/`, `src/lib/ttrm/`, `src/lib/input_replay.ts`, and `src/lib/cold_clear/replay_analysis.ts`. It depends on `@haelp/teto`; `chalk` is aliased to `src/lib/ttrm/chalk_stub.js` in both `webpack.config.js` and `jest.config.js`.
- Sold Slear (second AI engine, a TETR.IO S2 Cold Clear 2 derivative from the owner's s2-bot-lab): `src/lib/ai_engine.ts` (engine choice and capabilities), `src/lib/sold_slear/`, `src/lib/sold_slear_wasm/`, and `third_party/sold-slear/README.md` (provenance, rebuild steps, checksum). It reuses the Cold Clear worker message protocol, so actions and UI stay in the Cold Clear modules.
- Web workers: Cold Clear, Sold Slear, and the ttrm replay worker are compiled with `tsconfig.worker.json` (see the worker rules in `webpack.config.js`).
- PWA, SEO, and build budget: Workbox `GenerateSW` in `webpack.config.js`, `src/lib/force_reload.ts`, `src/lib/seo.ts`, `resources/manifest.json`, `resources/robots.txt`, `resources/sitemap.xml`, and `scripts/check-build-performance.js` (precache URL/byte budget enforced in CI and deploy).

## Local Instructions And Skills

- `AGENTS.md` is the primary instruction file; `CLAUDE.md` points agents back to it. Both are tracked.
- `docs/` and `.claude/` are gitignored local working material. Use `docs/plans/` for implementation plans, `docs/notes/` for investigations, reviews, and technical notes, `docs/presentations/` for presentation materials, and `docs/samples/` for sample assets. Name new plans and notes `yyyy_mm_dd_<lowercase-kebab-case>.md`. Do not force-add `docs/` files, and do not reference `docs/` paths from tracked files except as clearly marked local-only notes.
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
- Put user-visible strings in `src/locales/` and update both English and Japanese translations. English terms may remain untranslated when the surrounding Japanese wording intentionally uses the English product/feature term. `src/locales/__tests__/parity.test.ts` fails when a Japanese key is missing; only the legacy `Menu` labels are allowlisted.
- Show toasts with `showToast` from `src/lib/toast.ts` (it escapes HTML) and copy text with `copyTextToClipboard` from `src/lib/clipboard_copy.ts` instead of calling `M.toast` or `document.execCommand` directly.
- Ask before deleting files from the repository or workspace.

## Data And State Invariants

- A page's `field.ref` and `comment.ref` must point to an earlier page index. Reorder, insert, extraction, and tree operations must resolve or rebuild refs with the existing helpers; never move raw pages and leave stale indices.
- The first page's fumen-wide `colorize` value must survive reorder, extraction, and replacement when a different page becomes first. Rotation system (`classic`, `srs`, `srsPlus`) is a separate user setting, not a page `srs` flag.
- The tree root is always virtual (`pageIndex === -1`). After every tree mutation, `normalizeTreeAndPages` must preserve `tree DFS pre-order === pages order` and keep the active page/node coherent.
- Tree metadata is embedded in the first page comment as `#TREE=<base64>`. URL/fumen export, import, local-storage save, and undo/redo depend on the existing `embedTreeInPages` / `extractTreeFromPages` format. Do not change the format casually.
- List reorder is disabled while tree mode is enabled. Tree-enabled reorder and structural changes must go through tree operations.
- Piece/HOLD/NEXT queue state is represented through standard fumen quiz comments (`#Q=...`) and is consumed by editor and Cold Clear flows. Trace all consumers before changing its syntax or synchronization.
- `localStorageWrapper.saveViewSettings` and `saveUserSettings` in `src/memento.ts` replace the whole stored object. Never call them with a partial object; use or extend `persistViewSettings` in `src/actions/view_settings.ts` for view settings. Access `localStorage` through `localStorageWrapper`, whose helpers tolerate blocked storage, quota errors, and corrupted JSON. Known exceptions are `src/lib/parts.ts` (its own guarded key) and the guarded early read in `src/states.ts`.
- The fumen encoder truncates each comment to 4095 characters after `escape()`, which can cut `#TREE=` data. Autosave and URL export warn through `warnIfTreeCommentOverLimit` (`src/lib/tree_overflow_toast.ts`); keep that check on any new path that encodes tree data.
- `normalizeTreeAndPages` lives in `src/actions/tree_operations.ts`. List and tree reorder both rebuild refs with `rebuildPageRefsForOrder` from the same module.
- Treat URL/hash parsing, local-storage restoration, history snapshots, and screen/view transitions as cross-cutting behavior. Trace `src/actions.ts`, `src/memento.ts`, and the related action modules before changing them.

## Change And Test Rules

- Inspect nearby tests before changing behavior. Add or update Jest coverage for state/domain behavior and Cypress coverage for UI-critical workflows.
- Cypress selectors and helpers depend heavily on `datatest` attributes. When controls or modes are added, moved, renamed, or removed, update `cypress/support/operations.js`, affected specs, `cypress/SPEC_MAP.md`, and the allowlist in `src/__tests__/e2e_selector_contract.test.ts` (when applicable) in the same change.
- Always rebuild `dest/` before Cypress runs. A stale bundle can produce false failures and false passes.
- Never replace an expected fumen string merely to make a test pass. First classify the difference as an intentional behavior change, a test bug, or a regression; decode the fumens and compare pages/fields/actions semantically.
- Remove temporary verification aids before delivery: `it.only`, debug state exposure such as `window.__state`, throwaway tests/specs, diagnostic screenshots, and logging.
- Cold Clear spans actions, worker code, WASM glue/assets, settings, and fumen/tree behavior. Avoid partial fixes that do not trace the complete flow.
- When changing WASM or `third_party/`, verify `THIRD_PARTY_LICENSES.md`, `third_party/licenses/`, bundled source/patch notices, and copied release artifacts as applicable.

## How-To Checklists

- Add a user-visible string: add the accessor in `src/locales/keys.ts`, the English text in `src/locales/en/translation.ts`, and the Japanese text in `src/locales/ja/translation.ts`; run `yarn test locales`.
- Add a persisted view setting: extend `ViewSettings` in `src/memento.ts`, write it through `persistViewSettings`, restore it in `src/actions/restore_view_settings.ts`, and cover it in `src/__tests__/memento_view_settings.test.ts`.
- Add or rename a `datatest` selector: follow the Cypress rule in "Change And Test Rules" and run `yarn test e2e_selector_contract`.
- Add a Cypress spec: add a row to `cypress/SPEC_MAP.md` and its measured seconds to `cypress/spec-timings.json`; `yarn test spec_timings_contract` checks the table.
- Add or upgrade a dependency that ships in the app (bundled code or copied assets): record its license in `THIRD_PARTY_LICENSES.md` and add its license file to `shippedPackageLicenses` in `webpack.config.js`, which copies it to `dest/third_party/npm/`.
- Rebuild the Cold Clear WASM: follow `third_party/cold-clear/README.md`, then update the checksums recorded there.

## Commands And CI

- Development server with watch build: `yarn dev`. Static server only: `yarn serve` (port 8080).
- Development build: `yarn webpack`. Production build: `yarn webpack-prod`. Both clean `dest/` first.
- Precache budget check (run after a production build): `yarn check-build-performance`.
- Sold Slear is included by default in production, preview, and development builds. `SOLD_SLEAR_ENABLED=false` explicitly opts out. `yarn check-sold-slear-exclusion --present` verifies its assets and credits in `dest/`; omit `--present` when verifying an opt-out build.
- Lint: `yarn lint`. Type check: `yarn typecheck`.
- Unit tests: `yarn test`; target a file/pattern with `yarn test <pattern>`. Coverage is opt-in with `yarn test --coverage`.
- Cypress: `yarn cy-run --spec <specs>` (see the e2e skill); `yarn cy-open` for the interactive runner.
- CI uses Node.js 20. Local Node may be newer; if a failure only reproduces on one version, say which.
- `.github/workflows/dev-workflow.yaml` runs on non-`main` pushes and manual dispatch. The unit job runs lint, type check, and Jest. Five e2e shards each run a production build, `check-build-performance`, and their share of Cypress specs.
- `.github/workflows/deploy.yml` runs on pushes to either `main` or `develop`. It checks out both branch heads on every run, runs Jest for `main`, builds both, and publishes `main` at the Pages site root and `develop` at `/preview/` (with `noindex`). A failed `develop` build therefore also blocks republishing production.
- Before running `gh` commands, apply any `gh` environment notes from `AGENTS.local.md` if present.

## Git And Delivery

- Use `develop` for routine development and commit directly to it. Do not create or switch to another branch unless the user explicitly approves it.
- Treat `main` as production. Never commit, merge, or push to `main` without explicit user approval; merge `develop` into it only through the requested production release procedure.
- A push to `develop` updates the preview deployment. A push to `main` updates production. The request "デプロイ" means the explicit `develop` → `main` release procedure in `.agents/skills/release/SKILL.md`, not merely a preview push.
- Never push `main` without confirmation immediately before the push. Pushes to branches other than `main` do not require confirmation.
- Before a production release, run at least `yarn lint`, `yarn typecheck`, `yarn test`, `yarn webpack-prod`, and `yarn check-build-performance`, plus relevant Cypress specs or verify a green `dev-workflow` run as allowed by the release skill.
- Commits must use the repository owner's GitHub noreply identity, `61bi-234469 <121346275+61bi-234469@users.noreply.github.com>`. It is already set in this repository's local git config; check it with `git config user.email` before committing. Never set or override `user.name`/`user.email` yourself (no `git config`, `-c user.*`, or `GIT_AUTHOR_*`/`GIT_COMMITTER_*`); if it is missing or different, stop and ask the user. Never use a real email address for commits.
- Write commit subjects and bodies in English. Include the actual model name in a trailer such as `Model: <model name>`. When the change follows an implementation plan in `docs/plans/` that records model names (設計作成者/レビュー者/実装者), use the model names recorded there for the trailer (joint names if multiple) in preference to the committing model's own name. When the agent harness also requires a `Co-Authored-By:` trailer, add it after `Model:`; the two do not conflict.
- Keep unrelated user changes intact and out of the commit.
