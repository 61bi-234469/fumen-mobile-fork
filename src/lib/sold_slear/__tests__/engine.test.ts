import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { soldSlearBudgetOf } from '../budget';
import { decisionToMoves, selectableMoves } from '../convert';
import { createSoldSlearEngine, SoldSlearEngine } from '../engine';
import { createSoldSlearProfile } from '../profile';
import { BOARD_CELL_COUNT, buildF14DecideRequest } from '../request';

// 同梱 WASM を実際に動かす smoke test。選択予算は決定的なので、期待手は
// 同じ要求を s2-bot-lab（commit 8dccbcd）の src-js/cc2-wasm-engine.mjs に与えた結果で固定する。
const WASM_PATH = path.join(__dirname, '..', '..', 'sold_slear_wasm', 'cold_clear_2_s2.wasm');
const WASM_SHA256 = '8b4591144a4e141d25c0a76f94c9059a073b712fc8f1a9dd91c65d97640cb061';

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
            expect(outcome.moves[0].s2!.identity).toBe(REFERENCE_SELECTED_IDENTITY);
            // 要求の diagnostics.rootValues により、返却候補すべてに探索値が付く
            const returned = decision.ranking!.returnedIdentities!.length;
            expect(returned).toBe(16);
            expect(decision.diagnostics!.rootValues).toHaveLength(returned);
            // rootChildValues により、返却 16 候補の外の root 手（HOLD する手を含む）も探索値付きで並ぶ
            expect(outcome.moves.length).toBe(REFERENCE_ROOT_CHILD_COUNT);
            expect(outcome.returnedCount).toBe(REFERENCE_ROOT_CHILD_COUNT);
            expect(outcome.moves.some(move => move.hold)).toBe(true);
            expect(outcome.moves.every(move => Number.isFinite(move.score))).toBe(true);
            const extra = outcome.moves.slice(returned).map(move => move.score!);
            expect(extra).toEqual(extra.slice().sort((a, b) => b - a));
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

    // 右端 1 列だけ空いた 8 段の上で HOLD に I がある。標準予算では推奨手が HOLD する手になる
    test('the best non-HOLD candidate is still found when the recommendation uses HOLD', () => {
        const { request } = buildF14DecideRequest({
            cells: cellsWithBottomRow('GGGGGGGGG_'.repeat(8)),
            hold: 'I',
            queue: ['S', 'Z', 'O', 'L', 'J', 'T'],
            chain: { combo: 0, b2b: 0 },
        }, createSoldSlearProfile(soldSlearBudgetOf('standard')), 'engine-test-3');
        const outcome = decisionToMoves(engine.decide(request!), 'S');
        expect(outcome.kind).toBe('moves');
        if (outcome.kind === 'moves') {
            expect(outcome.moves[0].hold).toBe(true);
            const withoutHold = selectableMoves(outcome.moves, false);
            expect(withoutHold.length).toBeGreaterThan(0);
            expect(withoutHold[0].hold).toBe(false);
            expect(withoutHold[0].piece).toBe(outcome.moves.find(move => !move.hold)!.piece);
        }
    });
});

// s2-bot-lab の createF14DecideRequest + createCc2WasmSession(...).decideF14 で同じ局面を解いた結果
const REFERENCE_SELECTED_IDENTITY = '{"location":{"orientation":"north","type":"I","x":7,"y":0},"spin":"none"}';
// 同じ結果の diagnostics.rootChildValues の root 手数。すべてアプリの 23 行に収まる
const REFERENCE_ROOT_CHILD_COUNT = 34;
