import { Piece, Rotation } from '../enums';
import { Field } from '../fumen/field';
import {
    findAllLiftableMinos,
    findLiftableMinoAt,
    hasAnyLiftableMino,
    liftableCellIndices,
} from '../spawn_mino_convert';

const index = (x: number, y: number) => x + y * 10;

const fieldWith = (cells: { x: number, y: number, piece: Piece }[]): Field => {
    const field = new Field({});
    for (const cell of cells) {
        field.add(cell.x, cell.y, cell.piece);
    }
    return field;
};

const paint = (piece: Piece, positions: [number, number][]) => (
    positions.map(([x, y]) => ({ x, y, piece }))
);

describe('findLiftableMinoAt', () => {
    test('Tミノ(Spawn)を座標付きで返す', () => {
        // (1,0) (2,0) (3,0) / (2,1)
        const field = fieldWith(paint(Piece.T, [[1, 0], [2, 0], [3, 0], [2, 1]]));
        const mino = findLiftableMinoAt(field, index(2, 0));
        expect(mino).toBeDefined();
        expect(mino!.piece).toBe(Piece.T);
        expect(mino!.rotation).toBe(Rotation.Spawn);
        expect(mino!.coordinate).toEqual({ x: 2, y: 0 });
        expect(mino!.indices).toEqual([index(1, 0), index(2, 0), index(3, 0), index(2, 1)].sort((a, b) => a - b));
    });

    test('Oミノを返す', () => {
        const field = fieldWith(paint(Piece.O, [[4, 3], [5, 3], [4, 4], [5, 4]]));
        const mino = findLiftableMinoAt(field, index(5, 4));
        expect(mino).toBeDefined();
        expect(mino!.piece).toBe(Piece.O);
    });

    test('縦のIミノを返す', () => {
        const field = fieldWith(paint(Piece.I, [[0, 0], [0, 1], [0, 2], [0, 3]]));
        const mino = findLiftableMinoAt(field, index(0, 2));
        expect(mino).toBeDefined();
        expect(mino!.piece).toBe(Piece.I);
        expect(mino!.rotation).toBe(Rotation.Right);
    });

    test('グループのどのセルを指しても同じ結果になる', () => {
        const field = fieldWith(paint(Piece.S, [[1, 0], [2, 0], [2, 1], [3, 1]]));
        const results = [index(1, 0), index(2, 0), index(2, 1), index(3, 1)]
            .map(cell => findLiftableMinoAt(field, cell));
        expect(results.every(mino => mino !== undefined)).toBe(true);
        const keys = new Set(results.map(mino => mino!.indices.join(',')));
        expect(keys.size).toBe(1);
    });

    test('同色で5セル以上つながっているときは対象外', () => {
        const field = fieldWith(paint(Piece.T, [[1, 0], [2, 0], [3, 0], [2, 1], [4, 0]]));
        expect(findLiftableMinoAt(field, index(2, 0))).toBeUndefined();
    });

    test('灰色はミノ形でも対象外', () => {
        const field = fieldWith(paint(Piece.Gray, [[1, 0], [2, 0], [3, 0], [2, 1]]));
        expect(findLiftableMinoAt(field, index(2, 0))).toBeUndefined();
    });

    test('空セルは対象外', () => {
        const field = fieldWith(paint(Piece.T, [[1, 0], [2, 0], [3, 0], [2, 1]]));
        expect(findLiftableMinoAt(field, index(8, 8))).toBeUndefined();
    });

    test('形と色が食い違うときは対象外', () => {
        // S字に塗られたTミノ色。Tミノとして持ち上げてしまうと位置がずれるので弾く
        const field = fieldWith(paint(Piece.T, [[1, 0], [2, 0], [2, 1], [3, 1]]));
        expect(findLiftableMinoAt(field, index(2, 0))).toBeUndefined();
    });

    test('4セルでもミノ形でないときは対象外', () => {
        const field = fieldWith(paint(Piece.T, [[1, 0], [2, 0], [3, 0], [4, 0]]));
        expect(findLiftableMinoAt(field, index(2, 0))).toBeUndefined();
    });

    test('上下に分離した4セルは連結していないので対象外', () => {
        const field = fieldWith(paint(Piece.I, [[0, 0], [1, 0], [0, 5], [1, 5]]));
        expect(findLiftableMinoAt(field, index(0, 0))).toBeUndefined();
    });
});

describe('findAllLiftableMinos', () => {
    test('候補が1つだけの盤面', () => {
        const field = fieldWith(paint(Piece.T, [[1, 0], [2, 0], [3, 0], [2, 1]]));
        const found = findAllLiftableMinos(field);
        expect(found).toHaveLength(1);
        expect(found[0].piece).toBe(Piece.T);
    });

    test('離れた候補を全て返す', () => {
        const field = fieldWith(
            paint(Piece.T, [[1, 0], [2, 0], [3, 0], [2, 1]])
                .concat(paint(Piece.O, [[6, 0], [7, 0], [6, 1], [7, 1]])),
        );
        const found = findAllLiftableMinos(field);
        expect(found).toHaveLength(2);
        expect(found.map(mino => mino.piece).sort()).toEqual([Piece.T, Piece.O].sort());
    });

    test('同じグループを重複して返さない', () => {
        const field = fieldWith(paint(Piece.O, [[4, 3], [5, 3], [4, 4], [5, 4]]));
        expect(findAllLiftableMinos(field)).toHaveLength(1);
    });

    test('同色ミノ2つが隣接して8セル連結になっているときは候補にしない', () => {
        const field = fieldWith(paint(Piece.O, [[0, 0], [1, 0], [0, 1], [1, 1], [2, 0], [3, 0], [2, 1], [3, 1]]));
        expect(findAllLiftableMinos(field)).toEqual([]);
    });

    test('継承ブロック由来かどうかを問わず候補にする（ユーザーがタップして決めるため）', () => {
        const field = fieldWith(paint(Piece.L, [[0, 0], [1, 0], [2, 0], [2, 1]]));
        expect(findAllLiftableMinos(field)).toHaveLength(1);
    });
});

describe('liftableCellIndices', () => {
    test('全候補のセルを平坦に返す', () => {
        const field = fieldWith(
            paint(Piece.T, [[1, 0], [2, 0], [3, 0], [2, 1]])
                .concat(paint(Piece.O, [[6, 0], [7, 0], [6, 1], [7, 1]])),
        );
        const cells = liftableCellIndices(field).sort((a, b) => a - b);
        expect(cells).toEqual([
            index(1, 0), index(2, 0), index(3, 0), index(2, 1),
            index(6, 0), index(7, 0), index(6, 1), index(7, 1),
        ].sort((a, b) => a - b));
    });

    test('候補がなければ空', () => {
        const field = fieldWith(paint(Piece.Gray, [[1, 0], [2, 0], [3, 0], [2, 1]]));
        expect(liftableCellIndices(field)).toEqual([]);
    });
});

describe('hasAnyLiftableMino', () => {
    test('継承ブロック由来でも持ち上げ候補として数える', () => {
        const field = fieldWith(paint(Piece.L, [[0, 0], [1, 0], [2, 0], [2, 1]]));
        expect(hasAnyLiftableMino(field)).toBe(true);
    });

    test('灰色だけの盤面ではfalse', () => {
        const field = fieldWith(paint(Piece.Gray, [[1, 0], [2, 0], [3, 0], [2, 1]]));
        expect(hasAnyLiftableMino(field)).toBe(false);
    });

    test('空盤面ではfalse', () => {
        expect(hasAnyLiftableMino(new Field({}))).toBe(false);
    });
});
