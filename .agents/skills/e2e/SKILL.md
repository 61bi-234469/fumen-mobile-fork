---
name: e2e
description: Run, debug, or stabilize Cypress E2E tests in this repo. Use when running specs locally, investigating dev-workflow CI failures, or diagnosing a flaky or failing E2E test. Encodes hard-won pitfalls from docs/notes/e2e-ci-failure-investigation.md.
---

# Cypress E2E — run and debug

## Standard local run

```bash
# 1. ALWAYS rebuild first — running against a stale dest/ bundle produces
#    false failures (and false passes). CI always builds fresh.
yarn webpack-prod

# 2. Static server on :8080 (serves /fumen-mobile-fork and /fumen-for-mobile).
#    If one is already running it keeps serving the new dest/ — EADDRINUSE is ignorable.
mkdir -p logs
yarn serve > logs/serve.log 2>&1 &

# 3. Run specs via the wrapper (required on Windows). Prefer single specs over full runs.
yarn cy-run --spec cypress/integration/<name>_spec.js
yarn cy-run --spec "cypress/integration/a_spec.js,cypress/integration/b_spec.js"
```

- **Scope to the affected spec(s), not the full suite.** For a minor UI-only change
  (styling, copy, layout, non-selector markup) that touches no `datatest` attribute and
  adds/moves/removes no control, run only the spec(s) that already cover the touched
  component/view. Do not run the full suite "just in case." Run the full suite only when
  the release skill calls for it, or when the change plausibly has cross-spec impact
  (shared component/action, `cypress/support/operations.js` edit, selector rename).
- Failure screenshots: `cypress/screenshots/<spec>/`.
- `history_spec.js` alone takes 5+ minutes; full suite ~15 min. If a local run exceeds
  the environment's command timeout or Cypress Electron dies with a GPU error
  (`GPU process isn't usable` — environment issue, not a test failure; `--browser chrome`
  and `--disable-gpu` do NOT help), verify on GitHub Actions instead: check the latest
  existing `dev-workflow` run, or — per AGENTS.md, only after explicit user confirmation
  immediately beforehand — push to trigger a fresh run.
- Checking CI: `gh run list --workflow dev-workflow.yaml --branch develop`
  (apply any `gh` environment notes from `AGENTS.local.md` if present).

## Existing stabilization infrastructure (do not duplicate, do not remove)

`cypress/support/common.js`:
- `visit()` stubs `document.execCommand('copy'|'cut')` to return true
  (`stubClipboardCopy`, applied on `window:before:load` so it survives reloads).
  Opt out with `visit({ stubClipboard: false })`. Headless copy otherwise fails and
  leaves a "Failed to copy" toast that covers click targets → flakes.
- `disableModalAnimations` sets `M.Modal.defaults.inDuration/outDuration = 0` after
  every load/reload. This is the sanctioned way to speed up modal-heavy specs.
- `history_spec.js` `play()` verifies forward steps fully but round-trips undo/redo by
  default; pass `{ fullUndoRedo: true }` only where per-step undo grouping is the point.

## Hard rules

- **Never enable `waitForAnimations: false`** in cypress config. It was tried: fast, but
  Cypress clicks mid-animation elements and 5 new failures appear. Rejected permanently.
- **Never blanket-replace `cy.wait(...)`.** Replace a fixed wait only with a specific
  `should(...)` on what it was actually waiting for. Tiny waits (<200ms) are noise —
  removing them doesn't move full-run time (±2min run-to-run variance swamps it).
- **Never rewrite fumen expected values to make a test pass.** Classify first:
  intentional app change (`git log -L`/`-S` the behavior), test bug, or real regression.
  Decode fumen strings with a throwaway Jest (`decode()`, `getBlockPositions()`);
  base64 substring comparison lies.
- **`it.skip` is only for tests of unimplemented features** (e.g. the skipped live-URL-sync
  tests in `url_behavior_spec.js` — reactivate only when URL sync is implemented).
  Never skip a flaky test of a real feature; fix the app or the test.
- Revert every temporary aid before committing: `it.only`, `window.__state` exposure,
  throwaway diagnostic specs, added `cy.screenshot`.

## Flake diagnosis playbook (proven techniques)

- Single failure isolation: mark `it.only`, run the one spec. If it passes alone but
  fails in a full run → cross-test contamination (toast residue, state leak).
- State tracing: temporarily expose `currentState` as `window.__state` in `src/actions.ts`,
  rebuild, and dump state at each step from a throwaway spec. Bisect the helper
  (e.g. this is how `rightTap()` at (300,300) was caught clicking the "L" palette button).
- Controlled-input flake: Hyperapp controlled `value={x}` inputs revert typed text if a
  re-render lands between `.type()` and the `change` commit. Fix in the app by adding
  `oninput` state commits (see `cold_clear_menu.tsx` top-branch-count fix), not by
  loosening the assertion.
- Coordinate-based clicks (`cy.get('body').click(x,y)`) are fragile against UI reworks —
  prefer `datatest` selectors; check what actually sits at those coordinates in the
  current UI before trusting an old helper.
- Webpack-generated workers do NOT go through a `window.Worker` stub — mocking Worker in
  a spec does not control Cold Clear; assert on observable UI instead.
- Mobile bottom-sheet elements below the fold need `scrollIntoView()` before visibility
  assertions.

## Background

Full investigation history, per-spec timings, and the reasoning behind every rule above:
`docs/notes/e2e-ci-failure-investigation.md` (local-only, gitignored). Update it when you learn
something new about the E2E suite.
