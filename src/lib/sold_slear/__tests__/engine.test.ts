import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { soldSlearBudgetOf } from '../budget';
import { decisionToMoves } from '../convert';
import { createSoldSlearEngine, SoldSlearEngine } from '../engine';
import { createSoldSlearProfile } from '../profile';
import { BOARD_CELL_COUNT, buildF14DecideRequest } from '../request';

// 同梱 WASM を実際に動かす smoke test。512 selections は決定的なので、期待手は
// 同じ要求を s2-bot-lab（commit 61c0efd）の src-js/cc2-wasm-engine.mjs に与えた結果で固定する。
const WASM_PATH = path.join(__dirname, '..', '..', 'sold_slear_wasm', 'cold_clear_2_s2.wasm');
const WASM_SHA256 = '28a2487f84a6ffec764d8151058ede23dcbbc6f0beb49c41e6f4432bce53a6aa';

const cellsWithBottomRow = (row: string): string => row + '_'.repeat(BOARD_CELL_COUNT - row.length);

describe('Sold Slear WASM engine', () => {
    let engine: SoldSlearEngine;

    beforeAll(async () => {
        engine = await createSoldSlearEngine(fs.readFileSync(WASM_PATH));
    });

    afterAll(() => {
        engine.close();
    });

    test('ships the pinned artifact', () => {
        const hash = crypto.createHash('sha256').update(fs.readFileSync(WASM_PATH)).digest('hex');
        expect(hash).toBe(WASM_SHA256);
    });

    test('returns the reference decision for a fixed position', () => {
        const { request } = buildF14DecideRequest({
            cells: cellsWithBottomRow('GGGGGG____'),
            hold: null,
            queue: ['I', 'Z', 'O', 'L', 'J', 'S', 'T', 'Z', 'I', 'J', 'O', 'T', 'S', 'L'],
            chain: { combo: 5, b2b: 0 },
        }, createSoldSlearProfile(soldSlearBudgetOf('standard')), 'engine-test-1');
        const decision = engine.decide(request!);
        expect(decision.status).toBe('move');
        expect(decision.selectedIdentity).toBe(REFERENCE_SELECTED_IDENTITY);

        const outcome = decisionToMoves(decision, 'I');
        expect(outcome.kind).toBe('moves');
        if (outcome.kind === 'moves') {
            expect(outcome.moves.length).toBeGreaterThan(1);
            expect(outcome.moves.length).toBeLessThanOrEqual(16);
            expect(outcome.moves[0].s2!.identity).toBe(REFERENCE_SELECTED_IDENTITY);
            // 要求の diagnostics.rootValues により、すべての候補に探索値が付く
            expect(decision.diagnostics!.rootValues).toHaveLength(decision.ranking!.returnedIdentities!.length);
            expect(outcome.moves.every(move => Number.isFinite(move.score))).toBe(true);
        }
    });

    test('a time budget also returns a move', () => {
        const { request } = buildF14DecideRequest({
            cells: cellsWithBottomRow(''),
            hold: 'T',
            queue: ['S', 'Z'],
            chain: { combo: 0, b2b: 0 },
        }, createSoldSlearProfile(soldSlearBudgetOf('t100')), 'engine-test-2');
        expect(engine.decide(request!).status).toBe('move');
    });
});

// s2-bot-lab の createF14DecideRequest + createCc2WasmSession(...).decideF14 で同じ局面を解いた結果
const REFERENCE_SELECTED_IDENTITY = '{"location":{"orientation":"north","type":"I","x":7,"y":0},"spin":"none"}';
