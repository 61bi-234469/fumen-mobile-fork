# Sold Slear (Cold Clear 2 S2 derivative)

`src/lib/sold_slear_wasm/cold_clear_2_s2.wasm` is Sold Slear 1.4, the GUI / INPUT champion bot of the
repository owner's s2-bot-lab project ("SPSA v11 guarded clear and B2B weights", bot id `cc2-s2-champion`).
It replaces Sold Slear 1.0 ("Legacy backup consistency"); the app ships only the current champion.
It is included in production and develop preview builds by default. Builds can explicitly opt out
with `SOLD_SLEAR_ENABLED=false`; `scripts/check-sold-slear-exclusion.js --present` verifies its assets
and credits in normal builds.

## Source

- Repository: s2-bot-lab (MIT, Copyright (c) 2026 61bi-234469). The commit below is on the owner's
  development repository `61bi-234469/s2-bot-lab-staging` (private), from which
  https://github.com/61bi-234469/s2-bot-lab is published; it is not yet on the public repository.
- Commit: `8dccbcdf66d1a4a359c44e9170b6a19ce51e0ebd`
- Crate: `bot/cold-clear-2-s2` (MIT OR Apache-2.0; MIT selected for this copy)
  - Base: https://github.com/MinusKelvin/cold-clear-2 at `ed8b19327b6bd1410ddd873d8611485bd45d8fae`
  - Non-T mini spin retention and the all-spin weight preset are based on
    https://github.com/chouhy/cold-clear-2 at `b20a92b0ed3230dd910d0674f7a09c552a34dd46`.
    That fork keeps both upstream license files at this commit
    (`LICENSE-MIT` blob `18ec7679b2be93a659661338aab1421f67d59051`,
    `LICENSE-APACHE` blob `f8974b64e1f652f4b517a12c54339612c2542c77`).
  - s2-bot-lab adds the F14 selector (candidate re-ranking, solvency rescue, root allocation),
    direct 180-degree rotation, spawn-buffer entry, legacy backup consistency, tree reuse, the
    top-out rescue fallback and related opt-in switches. `bot/cold-clear-2-s2/UPSTREAM.md` in that repository lists the changes.
- Patched dependency: `instant` 0.1.13 (`bot/instant-wasm-safe`, BSD-3-Clause). On bare WASM its
  unused timed-parking clock returns a constant, so the module has no host imports.
- Local no-op `puffin` crate (`bot/puffin-noop`, part of s2-bot-lab, MIT).

## Artifact

- `cold_clear_2_s2.wasm`: 1,498,998 bytes,
  SHA-256 `8b4591144a4e141d25c0a76f94c9059a073b712fc8f1a9dd91c65d97640cb061`
- Exports `memory`, `cc2_alloc`, `cc2_invoke`, `cc2_dealloc`; no imports.
  `src/lib/sold_slear/engine.ts` checks both at load time. This is the single-threaded build;
  the bot's MULTITHREAD setting needs the threaded WASI build and is not used here.
- Requests carry `"diagnostics": {"rootValues": true, "rootChildValues": true}`. Both are
  display-only and leave the search and the decision unchanged. `rootValues` lists the bot's
  search value for each of the 16 returned candidates (in `ranking.returnedIdentities` order);
  `rootChildValues` lists every root move with its value, highest first, so moves outside the
  16 candidates also get a score. The app shows these values as move scores.
- The owner's record for the flag (s2-bot-lab commits `121ed92`, `dd563bd`): identical status,
  selection and full ranking with it on 8,160 saved native requests and 200 WASM requests under
  the GUI champion profile, with values equal to `rootValues` for every returned candidate.
- Checked on 2026-10-30 for this copy: the profile in `profile.ts` serializes identically to
  s2-bot-lab `createChampionProfile` (SELECTION 2,048, THINK TIME off), and s2-bot-lab's own
  `src-js/cc2-wasm-engine.mjs` returns the same moves as `engine.test.ts` expects.

## Profile

The bot's identity is the WASM plus the execution profile in `src/lib/sold_slear/profile.ts`,
transcribed from `src-js/champion-identity.mjs` (`CHAMPION_PROFILE_ARGS`) and
`src-js/champion-parameters.mjs` (`createChampionProfile`) at the commit above.
`src/lib/sold_slear/__tests__/budget_profile.test.ts` pins it.

- The standard budget is the champion's 2,048 selections with tree reuse
  (`tree_reuse_floor` 256): when a request continues the previous one in the same worker, the
  search keeps that tree, so a move needs fewer new selections. Results therefore depend on the
  request sequence within a worker, as in the s2-bot-lab GUI.
- Time budgets drop `tree_reuse_floor`, as the champion's THINK TIME does.

## Rebuild

Rust 1.92.0 (from the repository's `rust-toolchain.toml`) with the `wasm32-unknown-unknown` target,
built on Windows:

```powershell
git clone https://github.com/61bi-234469/s2-bot-lab-staging.git C:\build\s2-bot-lab
cd C:\build\s2-bot-lab
git checkout 8dccbcdf66d1a4a359c44e9170b6a19ce51e0ebd
$env:RUSTFLAGS = "--remap-path-prefix=C:\build\s2-bot-lab=/s2-bot-lab --remap-path-prefix=$env:USERPROFILE\.cargo\registry\src=/cargo/registry/src"
cargo build --release --target wasm32-unknown-unknown --manifest-path bot/cold-clear-2-s2/Cargo.toml --lib
```

Copy `bot/cold-clear-2-s2/target/wasm32-unknown-unknown/release/cold_clear_2_s2.wasm` to `src/lib/sold_slear_wasm/`.
The path remapping keeps local paths out of the binary. The checkout path still affects cargo's
package identity and therefore the code layout, so a byte-identical result needs the same
checkout path (`C:\build\s2-bot-lab`). A build this way on 2026-10-30 gave the checksum above, and a clean
rebuild (`cargo clean` of the target) in the same checkout gave it again.

When updating the bot:

- update the checksum here and in `src/lib/sold_slear/__tests__/engine.test.ts`, and put it first
  in `scripts/check-sold-slear-exclusion.js` (keep the hash main still ships until the release);
- re-transcribe the profile and update `budget_profile.test.ts`;
- update the expected move in `engine.test.ts`;
- regenerate `rust-crates.txt` from `cargo metadata --filter-platform wasm32-unknown-unknown`
  (runtime dependencies only, proc-macro and build-only crates excluded).

## Licenses in this directory

- `LICENSE-MIT-cold-clear-2`: Cold Clear 2 MIT license (Copyright (c) 2021 Mark Carlson)
- `LICENSE-s2-bot-lab`: s2-bot-lab MIT license (Copyright (c) 2026 61bi-234469)
- `LICENSE-instant`: `instant` BSD-3-Clause license
- `rust-crates.txt`: licenses of the Rust crates linked into the WASM
- The Apache-2.0 text is `third_party/licenses/Apache-2.0.txt`.
