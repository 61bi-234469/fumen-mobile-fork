import { F14Decision } from './convert';
import { F14DecideRequest } from './request';

// Sold Slear WASM（import なし、JSON in / 長さ前置 JSON out）の呼び出し層。
// s2-bot-lab src-js/cc2-wasm-engine.mjs の F14 経路を移植したもの。
// WASM に時計が無いので、時間予算はここで work を小刻みに回して打ち切る。

interface SoldSlearExports {
    memory: WebAssembly.Memory;
    cc2_alloc: (length: number) => number;
    cc2_invoke: (pointer: number, length: number) => number;
    cc2_dealloc: (pointer: number, length: number) => void;
}

const REQUIRED_EXPORTS = ['memory', 'cc2_alloc', 'cc2_invoke', 'cc2_dealloc'];
// 時間予算では 1 単位が締め切りを越えうる量を小さく抑え、選択予算では往復回数を減らす
const TIME_BUDGET_WORK_UNIT = 8;
const SELECTION_BUDGET_WORK_UNIT = 64;

export interface SoldSlearEngine {
    decide: (request: F14DecideRequest) => F14Decision;
    close: () => void;
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export const createSoldSlearEngine = async (
    source: ArrayBuffer | Uint8Array | WebAssembly.Module,
): Promise<SoldSlearEngine> => {
    const module = source instanceof WebAssembly.Module ? source : await WebAssembly.compile(source);
    const imports = WebAssembly.Module.imports(module);
    if (imports.length !== 0) {
        throw new Error(`Sold Slear WASM must be import-free; found ${imports.length}`);
    }
    const instance = await WebAssembly.instantiate(module, {});
    const exported = instance.exports as unknown as SoldSlearExports;
    for (const name of REQUIRED_EXPORTS) {
        if (!(name in instance.exports)) {
            throw new Error(`Sold Slear WASM export missing: ${name}`);
        }
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    let closed = false;

    const invoke = (request: unknown): any => {
        if (closed) {
            throw new Error('Sold Slear engine is closed');
        }
        const input = encoder.encode(JSON.stringify(request));
        const inputPointer = exported.cc2_alloc(input.length);
        new Uint8Array(exported.memory.buffer, inputPointer, input.length).set(input);
        let outputPointer: number;
        try {
            outputPointer = exported.cc2_invoke(inputPointer, input.length);
        } finally {
            exported.cc2_dealloc(inputPointer, input.length);
        }
        // memory.grow で buffer が差し替わるため、呼び出しのたびに取り直す
        const length = new DataView(exported.memory.buffer, outputPointer, 4).getUint32(0, true);
        try {
            const text = decoder.decode(new Uint8Array(exported.memory.buffer, outputPointer + 4, length));
            const response = JSON.parse(text);
            if (!response?.ok) {
                throw new Error(`Sold Slear request failed: ${response?.error ?? 'unknown'}`);
            }
            return response.value;
        } finally {
            exported.cc2_dealloc(outputPointer, length + 4);
        }
    };

    const expectDecision = (response: any): F14Decision => {
        if (response?.type !== 'f14_decision') {
            throw new Error('Sold Slear returned a malformed decision');
        }
        return response as F14Decision;
    };

    const decide = (request: F14DecideRequest): F14Decision => {
        const startedAt = now();
        const started = invoke({ request, op: 'f14_start', profile: request.execution });
        // 受理できない要求は f14_start が決定応答の形で返す
        if (started?.type === 'f14_decision') {
            return started as F14Decision;
        }
        const budget = request.execution.budget;
        if (budget.mode === 'time') {
            const deadline = startedAt + budget.maxMillis;
            let progress = invoke({ op: 'work', selections: TIME_BUDGET_WORK_UNIT });
            while (!progress.complete && now() < deadline) {
                progress = invoke({ op: 'work', selections: TIME_BUDGET_WORK_UNIT });
            }
            return expectDecision(invoke({ op: progress.complete ? 'f14_finish' : 'f14_finish_early' }));
        }
        let progress = invoke({ op: 'work', selections: SELECTION_BUDGET_WORK_UNIT });
        while (!progress.complete) {
            progress = invoke({ op: 'work', selections: SELECTION_BUDGET_WORK_UNIT });
        }
        return expectDecision(invoke({ op: 'f14_finish' }));
    };

    return {
        decide,
        close: () => {
            if (!closed) {
                invoke({ op: 'stop' });
            }
            closed = true;
        },
    };
};
