import { soldSlearBudgetOf } from '../budget';
import { createSoldSlearProfile, F14_COMPAT_RULESET_ID } from '../profile';
import { BOARD_CELL_COUNT, buildF14DecideRequest, PieceLetter, SoldSlearPosition } from '../request';

const emptyCells = (): string => '_'.repeat(BOARD_CELL_COUNT);

const withRow = (cells: string, y: number, row: string): string => (
    cells.slice(0, y * 10) + row + cells.slice((y + 1) * 10)
);

const position = (overrides: Partial<SoldSlearPosition> = {}): SoldSlearPosition => ({
    cells: withRow(emptyCells(), 0, 'GGGGGG____'),
    hold: null,
    queue: ['I', 'Z', 'O', 'L', 'J', 'S', 'T'],
    chain: { combo: 5, b2b: 0 },
    ...overrides,
});

const execution = createSoldSlearProfile(soldSlearBudgetOf('standard'));

describe('buildF14DecideRequest', () => {
    test('builds matching start (TBP rows, y = 0 at the bottom) and selector blocks', () => {
        const { request } = buildF14DecideRequest(position(), execution, 'req-1');
        expect(request).toBeDefined();
        const { start, selector } = request!;
        expect(start.board).toHaveLength(40);
        expect(start.board[0]).toEqual(['G', 'G', 'G', 'G', 'G', 'G', null, null, null, null]);
        expect(start.board[1].every(cell => cell === null)).toBe(true);
        expect(selector.board.cells.slice(0, 10)).toBe('GGGGGG____');
        expect(selector.rulesetId).toBe(F14_COMPAT_RULESET_ID);
        expect(start.queue).toEqual(['I', 'Z', 'O', 'L', 'J', 'S', 'T']);
        expect(selector.pieces).toEqual({
            current: 'I', hold: null, holdAvailable: true, known: ['Z', 'O', 'L', 'J', 'S', 'T'],
        });
        expect(start.combo).toBe(5);
        expect(selector.chain).toEqual({ combo: 5, b2b: 0 });
        expect(start.back_to_back).toBe(false);
        expect(request!.execution).toBe(execution);
    });

    test('passes the S2 B2B level and keeps incoming at zero as the profile requires', () => {
        const { request } = buildF14DecideRequest(
            position({ chain: { combo: 0, b2b: 3 }, hold: 'T' }), execution, 'req-2');
        expect(request!.start.b2b).toBe(3);
        expect(request!.start.back_to_back).toBe(true);
        expect(request!.selector.chain.b2b).toBe(3);
        expect(request!.selector.incoming).toEqual({ pendingRows: 0, dueThisLockRows: 0 });
        expect(request!.diagnostics).toEqual({ rootValues: true });
        expect(request!.start.hold).toBe('T');
        expect(request!.selector.pieces.hold).toBe('T');
    });

    test('truncates the queue to 14 pieces', () => {
        const queue = ('IZOLJSTIZOLJSTIZOL'.split('')) as PieceLetter[];
        const { request } = buildF14DecideRequest(position({ queue }), execution, 'req-3');
        expect(request!.start.queue).toHaveLength(14);
        expect(request!.selector.pieces.known).toHaveLength(13);
    });

    test('refuses a queue without a NEXT piece (the WASM would trap)', () => {
        expect(buildF14DecideRequest(position({ queue: ['T'] }), execution, 'req-4').error).toBe('shortQueue');
    });

    test('refuses malformed boards and pieces', () => {
        expect(buildF14DecideRequest(position({ cells: '_' }), execution, 'r').error).toBe('invalidBoard');
        expect(buildF14DecideRequest(
            position({ cells: withRow(emptyCells(), 0, 'X_________') }), execution, 'r').error).toBe('invalidBoard');
        expect(buildF14DecideRequest(
            position({ queue: ['T', 'X' as PieceLetter] }), execution, 'r').error).toBe('invalidPiece');
    });
});
