import { Piece } from '../../enums';
import { getBlockPositions } from '../../piece';
import { ccMoveToMove, findPlacedIndexByKey, toCellKey } from '../../cold_clear/move_match';
import { decisionToMoves, f14LocationCells, F14Decision, identityToMove, parseF14Identity } from '../convert';

const identity = (type: string, orientation: string, x: number, y: number, spin = 'none'): string => (
    JSON.stringify({ spin, location: { orientation, type, x, y } })
);

const decision = (identities: string[], selected = identities[0]): F14Decision => ({
    type: 'f14_decision',
    status: 'move',
    selectedIdentity: selected,
    ranking: { identities },
});

describe('Sold Slear move conversion', () => {
    // CC2 のミノ形状・回転中心がアプリの getPieces と一致することを 7 種 x 4 向きで固定する
    test('CC2 locations cover the same cells as the converted app moves', () => {
        for (const type of ['I', 'O', 'T', 'L', 'J', 'S', 'Z']) {
            for (const orientation of ['north', 'east', 'south', 'west']) {
                const location = { type, orientation, x: 4, y: 5 };
                const move = identityToMove(identity(type, orientation, 4, 5), 'T');
                expect(move).not.toBeNull();
                const appMove = ccMoveToMove(move!);
                expect(appMove).not.toBeNull();
                const appCells = getBlockPositions(
                    appMove!.type, appMove!.rotation, appMove!.coordinate.x, appMove!.coordinate.y);
                expect(toCellKey(appCells)).toBe(toCellKey(f14LocationCells(location)!));
            }
        }
    });

    test('marks a move as HOLD when it places a piece other than the current one', () => {
        expect(identityToMove(identity('T', 'north', 4, 0), 'T')!.hold).toBe(false);
        expect(identityToMove(identity('I', 'north', 4, 0), 'T')!.hold).toBe(true);
    });

    test('keeps the spin for chain updates and replay matching', () => {
        expect(identityToMove(identity('T', 'south', 4, 1, 'full'), 'T')!.s2!.spin).toBe('normal');
        expect(identityToMove(identity('S', 'east', 4, 1, 'mini'), 'S')!.s2!.spin).toBe('mini');
    });

    test('drops moves that do not fit in the 23-row app field', () => {
        expect(identityToMove(identity('I', 'east', 4, 22), 'I')).toBeNull();
        expect(identityToMove(identity('I', 'north', 0, 0), 'I')).toBeNull();
        expect(identityToMove(identity('X', 'north', 4, 0), 'I')).toBeNull();
        expect(parseF14Identity('not json')).toBeNull();
    });

    test('puts the selected (rescued) move first and keeps the rest in CC2 order', () => {
        const ids = [identity('T', 'north', 4, 0), identity('T', 'north', 1, 0), identity('T', 'north', 7, 0)];
        const outcome = decisionToMoves(decision(ids, ids[1]), 'T');
        expect(outcome.kind).toBe('moves');
        if (outcome.kind === 'moves') {
            expect(outcome.moves.map(move => move.x)).toEqual([1, 4, 7]);
            expect(outcome.returnedCount).toBe(3);
        }
    });

    test('classifies non-move decisions', () => {
        expect(decisionToMoves({ type: 'f14_decision', status: 'root-no-move' }, 'T').kind).toBe('noMove');
        const error = decisionToMoves({ type: 'f14_decision', status: 'unsupported', reason: 'ruleset' }, 'T');
        expect(error.kind).toBe('error');
    });

    test('replay matching prefers the same spin and falls back to the same cells', () => {
        const outcome = decisionToMoves(decision([
            identity('T', 'south', 4, 1, 'none'),
            identity('T', 'south', 4, 1, 'full'),
        ]), 'T');
        if (outcome.kind !== 'moves') {
            throw new Error('expected moves');
        }
        const key = toCellKey(getBlockPositions(Piece.T, 2, 4, 1));
        expect(findPlacedIndexByKey(outcome.moves, key, 'normal')).toBe(1);
        expect(findPlacedIndexByKey(outcome.moves, key, 'none')).toBe(0);
        expect(findPlacedIndexByKey(outcome.moves, key, 'mini')).toBe(0);
        expect(findPlacedIndexByKey(outcome.moves, key)).toBe(0);
    });
});
