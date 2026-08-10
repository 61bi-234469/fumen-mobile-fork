/* tslint:disable */
/* eslint-disable */

export class CCMove {
    private constructor();
    free(): void;
    [Symbol.dispose](): void;
    b2b: boolean;
    combo: number;
    hold: boolean;
    piece: number;
    rotation: number;
    score: number;
    x: number;
    y: number;
}

export class ColdClearBot {
    free(): void;
    [Symbol.dispose](): void;
    add_next_piece(piece: number): void;
    constructor(field: Uint8Array, hold: number, b2b: boolean, combo: number, queue: Uint8Array, hold_allowed: boolean, speculate: boolean);
    /**
     * Switches the evaluation weight table. `preset` 0 selects
     * `Standard::default()`, 1 selects `Standard::fast_config()`.
     * Returns false (no-op) for any other value.
     */
    set_weights_preset(preset: number): boolean;
    suggest_move_sync(think_ms: number): CCMove | undefined;
    suggest_move_sync_with_incoming(think_ms: number, incoming: number): CCMove | undefined;
    suggest_top_moves_sync(think_ms: number, count: number): CCMove[];
    suggest_top_moves_sync_with_incoming(think_ms: number, count: number, incoming: number): CCMove[];
}

export function _web_worker_entry_point(scope: DedicatedWorkerGlobalScope): void;

export function init_panic_hook(): void;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_ccmove_free: (a: number, b: number) => void;
    readonly __wbg_coldclearbot_free: (a: number, b: number) => void;
    readonly __wbg_get_ccmove_b2b: (a: number) => number;
    readonly __wbg_get_ccmove_combo: (a: number) => number;
    readonly __wbg_get_ccmove_hold: (a: number) => number;
    readonly __wbg_get_ccmove_piece: (a: number) => number;
    readonly __wbg_get_ccmove_rotation: (a: number) => number;
    readonly __wbg_get_ccmove_score: (a: number) => number;
    readonly __wbg_get_ccmove_x: (a: number) => number;
    readonly __wbg_get_ccmove_y: (a: number) => number;
    readonly __wbg_set_ccmove_b2b: (a: number, b: number) => void;
    readonly __wbg_set_ccmove_combo: (a: number, b: number) => void;
    readonly __wbg_set_ccmove_hold: (a: number, b: number) => void;
    readonly __wbg_set_ccmove_piece: (a: number, b: number) => void;
    readonly __wbg_set_ccmove_rotation: (a: number, b: number) => void;
    readonly __wbg_set_ccmove_score: (a: number, b: number) => void;
    readonly __wbg_set_ccmove_x: (a: number, b: number) => void;
    readonly __wbg_set_ccmove_y: (a: number, b: number) => void;
    readonly coldclearbot_add_next_piece: (a: number, b: number) => void;
    readonly coldclearbot_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number, i: number) => number;
    readonly coldclearbot_set_weights_preset: (a: number, b: number) => number;
    readonly coldclearbot_suggest_move_sync: (a: number, b: number) => number;
    readonly coldclearbot_suggest_move_sync_with_incoming: (a: number, b: number, c: number) => number;
    readonly coldclearbot_suggest_top_moves_sync: (a: number, b: number, c: number) => [number, number];
    readonly coldclearbot_suggest_top_moves_sync_with_incoming: (a: number, b: number, c: number, d: number) => [number, number];
    readonly init_panic_hook: () => void;
    readonly _web_worker_entry_point: (a: any) => void;
    readonly wasm_bindgen__convert__closures_____invoke__h7cd80c00c37dd24a: (a: number, b: number, c: any) => void;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
    readonly __wbindgen_exn_store: (a: number) => void;
    readonly __externref_table_alloc: () => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __wbindgen_destroy_closure: (a: number, b: number) => void;
    readonly __externref_drop_slice: (a: number, b: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
