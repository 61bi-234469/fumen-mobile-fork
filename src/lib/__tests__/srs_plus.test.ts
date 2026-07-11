import { Piece, Rotation } from '../enums';
import { test180Rotation, testLeftRotationSrsPlus, testRightRotationSrsPlus } from '../srs_plus';
import { testLeftRotation, testRightRotation } from '../srs';

// 出典（数値の根拠）:
// - JLSTZ/T/O の90°: guidelineと同一のため src/lib/srs.ts の testLeftRotation/testRightRotation に委譲（変更なし）。
// - I の90°（全8遷移）: note.com記事 https://note.com/wehqi/n/n6797e5134f3f （I.NE/EN/ES/SE/SW/WS/WN/NW）。
//   Budget-Tetris-Engine https://github.com/TemariVirus/Budget-Tetris-Engine の srs_plus.zig と基準セルシフト補正のうえ一致確認済み。
// - 180°（JLSTZ/T・I・O）: 同記事のN/E/S/W表記（NS=Spawn>Reverse, EW=Right>Left, SN=Reverse>Spawn, WE=Left>Right）。
//   JLSTZ/Tの Reverse>Spawn 行のみ tetris.wiki 掲載の osk氏（TETR.IO開発者）公式180°キック図に基づき記事の誤植を修正。

describe('srsPlus 90 degree rotation (I piece, dedicated table)', () => {
    const transitionsRight: { current: Rotation; next: Rotation; first: number[] }[] = [
        { current: Rotation.Spawn, next: Rotation.Right, first: [1, 0] },
        { current: Rotation.Right, next: Rotation.Reverse, first: [0, -1] },
        { current: Rotation.Reverse, next: Rotation.Left, first: [-1, 0] },
        { current: Rotation.Left, next: Rotation.Spawn, first: [0, 1] },
    ];

    transitionsRight.forEach(({ current, next, first }) => {
        it(`CW: ${Rotation[current]} -> ${Rotation[next]}`, () => {
            const result = testRightRotationSrsPlus(Piece.I, current);
            expect(result.rotation).toBe(next);
            expect(result.test[0]).toEqual(first);
            expect(result.test).toHaveLength(5);
        });
    });

    const transitionsLeft: { current: Rotation; next: Rotation; first: number[] }[] = [
        { current: Rotation.Spawn, next: Rotation.Left, first: [0, -1] },
        { current: Rotation.Left, next: Rotation.Reverse, first: [1, 0] },
        { current: Rotation.Reverse, next: Rotation.Right, first: [0, 1] },
        { current: Rotation.Right, next: Rotation.Spawn, first: [-1, 0] },
    ];

    transitionsLeft.forEach(({ current, next, first }) => {
        it(`CCW: ${Rotation[current]} -> ${Rotation[next]}`, () => {
            const result = testLeftRotationSrsPlus(Piece.I, current);
            expect(result.rotation).toBe(next);
            expect(result.test[0]).toEqual(first);
            expect(result.test).toHaveLength(5);
        });
    });

    it('candidate set matches guideline SRS (same offsets, different order)', () => {
        const srsPlusResult = testRightRotationSrsPlus(Piece.I, Rotation.Spawn);
        const guidelineResult = testRightRotation(Piece.I, Rotation.Spawn);

        const sortKey = (offsets: number[][]) => offsets.map(([x, y]) => `${x},${y}`).sort();
        expect(sortKey(srsPlusResult.test)).toEqual(sortKey(guidelineResult.test));
        expect(srsPlusResult.test).not.toEqual(guidelineResult.test);
    });
});

describe('srsPlus 90 degree rotation (non-I pieces delegate to guideline srs.ts)', () => {
    ([Piece.T, Piece.L, Piece.J, Piece.S, Piece.Z, Piece.O] as const).forEach((piece) => {
        it(`CW ${piece} Spawn matches guideline srs.ts`, () => {
            expect(testRightRotationSrsPlus(piece, Rotation.Spawn)).toEqual(testRightRotation(piece, Rotation.Spawn));
        });

        it(`CCW ${piece} Right matches guideline srs.ts`, () => {
            expect(testLeftRotationSrsPlus(piece, Rotation.Right)).toEqual(testLeftRotation(piece, Rotation.Right));
        });
    });
});

describe('srsPlus 180 degree rotation', () => {
    describe('I piece', () => {
        it('Spawn -> Reverse', () => {
            const result = test180Rotation(Piece.I, Rotation.Spawn);
            expect(result.rotation).toBe(Rotation.Reverse);
            expect(result.test).toEqual([[1, -1], [1, 0]]);
        });

        it('Reverse -> Spawn', () => {
            const result = test180Rotation(Piece.I, Rotation.Reverse);
            expect(result.rotation).toBe(Rotation.Spawn);
            expect(result.test).toEqual([[-1, 1], [-1, 0]]);
        });

        it('Right -> Left', () => {
            const result = test180Rotation(Piece.I, Rotation.Right);
            expect(result.rotation).toBe(Rotation.Left);
            expect(result.test).toEqual([[-1, -1], [0, -1]]);
        });

        it('Left -> Right', () => {
            const result = test180Rotation(Piece.I, Rotation.Left);
            expect(result.rotation).toBe(Rotation.Right);
            expect(result.test).toEqual([[1, 1], [0, 1]]);
        });
    });

    describe('O piece', () => {
        it('Spawn -> Reverse', () => {
            const result = test180Rotation(Piece.O, Rotation.Spawn);
            expect(result.rotation).toBe(Rotation.Reverse);
            expect(result.test).toEqual([[1, 1]]);
        });

        it('Reverse -> Spawn', () => {
            const result = test180Rotation(Piece.O, Rotation.Reverse);
            expect(result.rotation).toBe(Rotation.Spawn);
            expect(result.test).toEqual([[-1, -1]]);
        });

        it('Right -> Left', () => {
            const result = test180Rotation(Piece.O, Rotation.Right);
            expect(result.rotation).toBe(Rotation.Left);
            expect(result.test).toEqual([[1, -1]]);
        });

        it('Left -> Right', () => {
            const result = test180Rotation(Piece.O, Rotation.Left);
            expect(result.rotation).toBe(Rotation.Right);
            expect(result.test).toEqual([[-1, 1]]);
        });
    });

    describe('JLSTZ/T pieces (shared table)', () => {
        ([Piece.J, Piece.L, Piece.S, Piece.Z, Piece.T] as const).forEach((piece) => {
            it(`${piece} Spawn -> Reverse`, () => {
                const result = test180Rotation(piece, Rotation.Spawn);
                expect(result.rotation).toBe(Rotation.Reverse);
                expect(result.test).toEqual([[0, 0], [0, 1], [1, 1], [-1, 1], [1, 0], [-1, 0]]);
            });

            it(`${piece} Reverse -> Spawn (fact-checked fix applied)`, () => {
                const result = test180Rotation(piece, Rotation.Reverse);
                expect(result.rotation).toBe(Rotation.Spawn);
                expect(result.test).toEqual([[0, 0], [0, -1], [-1, -1], [1, -1], [-1, 0], [1, 0]]);
            });

            it(`${piece} Right -> Left`, () => {
                const result = test180Rotation(piece, Rotation.Right);
                expect(result.rotation).toBe(Rotation.Left);
                expect(result.test).toEqual([[0, 0], [1, 0], [1, 2], [1, 1], [0, 2], [0, 1]]);
            });

            it(`${piece} Left -> Right`, () => {
                const result = test180Rotation(piece, Rotation.Left);
                expect(result.rotation).toBe(Rotation.Right);
                expect(result.test).toEqual([[0, 0], [-1, 0], [-1, 2], [-1, 1], [0, 2], [0, 1]]);
            });
        });
    });

    describe('round trip', () => {
        ([Piece.I, Piece.O, Piece.T, Piece.L, Piece.J, Piece.S, Piece.Z] as const).forEach((piece) => {
            it(`${piece}: Spawn -> Reverse -> Spawn returns to Spawn`, () => {
                const first = test180Rotation(piece, Rotation.Spawn);
                const second = test180Rotation(piece, first.rotation);
                expect(second.rotation).toBe(Rotation.Spawn);
            });

            it(`${piece}: Right -> Left -> Right returns to Right`, () => {
                const first = test180Rotation(piece, Rotation.Right);
                const second = test180Rotation(piece, first.rotation);
                expect(second.rotation).toBe(Rotation.Right);
            });
        });
    });
});
