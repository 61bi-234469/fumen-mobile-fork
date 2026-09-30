# Sold Slear (Cold Clear 2 S2 derivative)

`src/lib/sold_slear_wasm/cold_clear_2_s2.wasm` is Sold Slear, the development champion bot of the
repository owner's s2-bot-lab project ("Legacy backup consistency", bot id `cc2-s2-champion`).
It is published only in the develop preview; production builds leave it out
(`SOLD_SLEAR_ENABLED`, `scripts/check-sold-slear-exclusion.js`).

## Source

- Repository: https://github.com/61bi-234469/s2-bot-lab (MIT, Copyright (c) 2026 61bi-234469)
- Commit: `ff7210f28977ce0851301a351f751c0a3ad1bd98`
- Crate: `bot/cold-clear-2-s2` (MIT OR Apache-2.0; MIT selected for this copy)
  - Base: https://github.com/MinusKelvin/cold-clear-2 at `ed8b19327b6bd1410ddd873d8611485bd45d8fae`
  - Non-T mini spin retention and the all-spin weight preset are based on
    https://github.com/chouhy/cold-clear-2 at `b20a92b0ed3230dd910d0674f7a09c552a34dd46`.
    That fork keeps both upstream license files at this commit
    (`LICENSE-MIT` blob `18ec7679b2be93a659661338aab1421f67d59051`,
    `LICENSE-APACHE` blob `f8974b64e1f652f4b517a12c54339612c2542c77`).
  - s2-bot-lab adds the F14 selector (candidate re-ranking, solvency rescue, root allocation),
    direct 180-degree rotation, spawn-buffer entry, legacy backup consistency and related
    opt-in switches. `bot/cold-clear-2-s2/UPSTREAM.md` in that repository lists the changes.
- Patched dependency: `instant` 0.1.13 (`bot/instant-wasm-safe`, BSD-3-Clause). On bare WASM its
  unused timed-parking clock returns a constant, so the module has no host imports.
- Local no-op `puffin` crate (`bot/puffin-noop`, part of s2-bot-lab, MIT).

## Artifact

- `cold_clear_2_s2.wasm`: 1,169,575 bytes,
  SHA-256 `1449583088ec4481c7999ce3fe859bbb14c89a6b9c36d31e3a34186f59c9c274`
- Exports `memory`, `cc2_alloc`, `cc2_invoke`, `cc2_dealloc`; no imports.
  `src/lib/sold_slear/engine.ts` checks both at load time.
- The owner's development build of the same champion produced identical responses (excluding
  timing diagnostics) on 960 self-play positions (7-bag, HOLD, line clears, garbage rows), checked
  on 2026-10-01 with s2-bot-lab's own request builder and `src-js/cc2-wasm-engine.mjs`.

## Profile

The bot's identity is the WASM plus the execution profile in `src/lib/sold_slear/profile.ts`,
transcribed from `src-js/champion-identity.mjs` (`CHAMPION_PROFILE_ARGS`) and
`src-js/s2-f14-compat-browser.mjs` (`createF14LeafConversionGatedProfile`) at the commit above.
`src/lib/sold_slear/__tests__/budget_profile.test.ts` pins it.

## Rebuild

Rust 1.92.0 (from the repository's `rust-toolchain.toml`) with the `wasm32-unknown-unknown` target,
built on Windows:

```powershell
git clone https://github.com/61bi-234469/s2-bot-lab.git C:\build\s2-bot-lab
cd C:\build\s2-bot-lab
git checkout ff7210f28977ce0851301a351f751c0a3ad1bd98
$env:RUSTFLAGS = "--remap-path-prefix=C:\build\s2-bot-lab=/s2-bot-lab --remap-path-prefix=$env:USERPROFILE\.cargo\registry\src=/cargo/registry/src"
cargo build --release --target wasm32-unknown-unknown --manifest-path bot/cold-clear-2-s2/Cargo.toml --lib
```

Copy `target/wasm32-unknown-unknown/release/cold_clear_2_s2.wasm` to `src/lib/sold_slear_wasm/`.
The path remapping keeps local paths out of the binary. The checkout path still affects cargo's
package identity and therefore the code layout, so a byte-identical result needs the same
checkout path (`C:\build\s2-bot-lab`). Two fresh clones built this way on 2026-10-01 both gave the
checksum above.

When updating the bot:

- update the checksum here and in `scripts/check-sold-slear-exclusion.js` and
  `src/lib/sold_slear/__tests__/engine.test.ts`;
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
