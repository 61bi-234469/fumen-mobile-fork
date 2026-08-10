# Cold Clear Corresponding Source (MPL-2.0)

This repository distributes generated artifacts in `src/lib/cold_clear_wasm/`.
Those artifacts are derived from Cold Clear source code under MPL-2.0.

Upstream source:
- Repository: `https://github.com/MinusKelvin/cold-clear`
- Commit: `279edd7c3177ff8077f6a930193397814b281f27`

Local modifications used for the distributed wasm artifacts:
- Patch: `third_party/cold-clear/patches/0003-add-incoming-aware-search-and-weights-preset.patch`
  - This patch is a full diff against the pinned commit above (not incremental).
    Applying it alone creates the whole `wasm-api/` crate (`wasm-api/Cargo.toml`
    and `wasm-api/src/lib.rs` are new files in the diff), so no earlier patch is
    needed. It supersedes `0002-add-hold-speculate-and-b2b-combo-feedback.patch`
    and `0001-export-move-score-to-wasm.patch`, which are kept only for history.
  - Adds `suggest_move_sync_with_incoming`, `suggest_top_moves_sync_with_incoming`
    (incoming-garbage-aware candidate ranking), and `set_weights_preset`
    (0 = `Standard::default()`, 1 = `Standard::fast_config()`) to the
    `wasm-api` crate, on top of the move score / hold speculate / b2b+combo
    feedback from the earlier patches. Unused bindings that were present in
    previously distributed builds but never called from `src/lib/cold_clear/`
    (`load_book`, `reset`, `set_weights_json`, `new_with_options`) were dropped.

Distributed artifact checksums (SHA-256):
- `src/lib/cold_clear_wasm/cold_clear_wasm_api_bg.wasm`
  - `12A2FCA1B9C240255D95AF2EA2DA5D49648447DC749736B4BA9F99AF13D1CF49`
- `src/lib/cold_clear_wasm/cold_clear_wasm_api.js`
  - `738AE1EDA5FB8058A1F1BC2EE3802DB4C1F890BE95A9EF0A7D466211EE824FA3`
- `src/lib/cold_clear_wasm/cold_clear_wasm_api.d.ts`
  - `A31C07107ED0B3860E0DEF73956A7C983F7771F108E1EFFCA159401E27E8DAFA`

## Rebuild Steps

1. Clone upstream and checkout the pinned commit.
2. Apply `third_party/cold-clear/patches/0003-add-incoming-aware-search-and-weights-preset.patch`
   (`git apply` expects UTF-8; patch files in this directory are stored as UTF-8/LF).
3. Build from `wasm-api/`:
   - `wasm-pack build --release --target web --out-name cold_clear_wasm_api`
4. Copy generated files to `src/lib/cold_clear_wasm/`.

These steps were verified by rebuilding from a fresh clone of the pinned commit
with only patch 0003 applied: the resulting `.wasm`, `.js`, and `.d.ts` were
byte-identical to the distributed artifacts (toolchain: rustc 1.92.0,
wasm-pack 0.14.0). Note that rustc embeds absolute source paths in the `.wasm`,
so reproducing the checksum exactly also requires building at the same absolute
path; the `.js` and `.d.ts` are path-independent.

MPL-2.0 text is provided at `third_party/licenses/MPL-2.0.txt`.
