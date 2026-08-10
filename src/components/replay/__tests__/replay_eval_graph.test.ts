/**
 * @jest-environment jsdom
 */

jest.mock('../../../states', () => ({}));

import { ReplayMoveEval } from '../../../states';
import { hasDrawableEval, moveAtGraphX, renderReplayEvalGraph } from '../replay_eval_graph';

const move = (
    index: number, frame: number, status: ReplayMoveEval['status'], loss?: number, rank?: number,
): ReplayMoveEval => ({ index, frame, status, loss, rank });

describe('replay_eval_graph', () => {
    beforeAll(() => {
        // jsdom の canvas は 2d コンテキストを持たないため、必要な API だけ差し替える
        (HTMLCanvasElement.prototype as any).getContext = () => ({
            scale: jest.fn(),
            fillRect: jest.fn(),
            beginPath: jest.fn(),
            moveTo: jest.fn(),
            lineTo: jest.fn(),
            stroke: jest.fn(),
            fillStyle: '',
            strokeStyle: '',
            globalAlpha: 1,
            lineWidth: 1,
        });
        (HTMLCanvasElement.prototype as any).toDataURL = () => 'data:image/png;base64,stub';
    });

    test('未解析だけのときは描画対象にならない', () => {
        expect(hasDrawableEval([])).toBe(false);
        expect(hasDrawableEval([move(1, 10, 'pending')])).toBe(false);
        expect(hasDrawableEval([move(1, 10, 'pending'), move(2, 20, 'ok', 5, 2)])).toBe(true);
    });

    test('同じ配列・同じ幅ならメモ化した画像を返す', () => {
        const moves = [move(1, 10, 'ok', 0, 1), move(2, 20, 'ok', 40, 5)];
        const spy = jest.spyOn(HTMLCanvasElement.prototype as any, 'toDataURL');
        spy.mockClear();

        renderReplayEvalGraph(moves, 300, 1200);
        renderReplayEvalGraph(moves, 300, 1200);
        expect(spy).toHaveBeenCalledTimes(1);

        // 幅が変われば描き直す
        renderReplayEvalGraph(moves, 400, 1200);
        expect(spy).toHaveBeenCalledTimes(2);

        // 解析が進んだら描き直す
        moves.push(move(3, 30, 'ok', 10, 2));
        renderReplayEvalGraph(moves, 400, 1200);
        expect(spy).toHaveBeenCalledTimes(3);
    });

    test('クリック位置から最寄りの手を選ぶ', () => {
        const moves = [move(1, 0, 'ok', 0, 1), move(2, 600, 'ok', 10, 2), move(3, 1200, 'ok', 5, 3)];
        expect(moveAtGraphX(moves, 0, 300, 1200)!.index).toEqual(1);
        expect(moveAtGraphX(moves, 160, 300, 1200)!.index).toEqual(2);
        expect(moveAtGraphX(moves, 300, 300, 1200)!.index).toEqual(3);
        // 範囲外でも端の手へ丸める
        expect(moveAtGraphX(moves, 9999, 300, 1200)!.index).toEqual(3);
        expect(moveAtGraphX([], 10, 300, 1200)).toBeUndefined();
    });
});
