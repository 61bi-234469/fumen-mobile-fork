import { endAllDasHolds, endDasHold, isDasHoldActive, startDasHold } from '../piece_das';

describe('piece_das', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        endAllDasHolds();
        jest.useRealTimers();
    });

    test('押下直後に1回移動する', () => {
        const move = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('test', { move, moveToEnd, dasMs: 167, arrMs: 0 });

        expect(move).toHaveBeenCalledTimes(1);
        expect(moveToEnd).not.toHaveBeenCalled();
    });

    test('ARR=0のときDAS経過後に端まで移動する', () => {
        const move = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('test', { move, moveToEnd, dasMs: 167, arrMs: 0 });
        jest.advanceTimersByTime(166);
        expect(moveToEnd).not.toHaveBeenCalled();

        jest.advanceTimersByTime(1);
        expect(moveToEnd).toHaveBeenCalledTimes(1);
        expect(move).toHaveBeenCalledTimes(1);

        // 端まで移動後はリピートしない
        jest.advanceTimersByTime(1000);
        expect(moveToEnd).toHaveBeenCalledTimes(1);
        expect(move).toHaveBeenCalledTimes(1);
    });

    test('ARR>0のときDAS経過後にARR間隔でリピートする', () => {
        const move = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('test', { move, moveToEnd, dasMs: 167, arrMs: 33 });
        expect(move).toHaveBeenCalledTimes(1);

        // DAS経過時に1回、その後はARR間隔でリピート
        jest.advanceTimersByTime(167);
        expect(move).toHaveBeenCalledTimes(2);

        jest.advanceTimersByTime(33 * 3);
        expect(move).toHaveBeenCalledTimes(5);
        expect(moveToEnd).not.toHaveBeenCalled();
    });

    test('DAS前に離すと追加の移動は発生しない', () => {
        const move = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('test', { move, moveToEnd, dasMs: 167, arrMs: 33 });
        jest.advanceTimersByTime(100);
        endDasHold('test');

        jest.advanceTimersByTime(1000);
        expect(move).toHaveBeenCalledTimes(1);
        expect(moveToEnd).not.toHaveBeenCalled();
        expect(isDasHoldActive('test')).toBe(false);
    });

    test('ARRリピート中に離すとリピートが停止する', () => {
        const move = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('test', { move, moveToEnd, dasMs: 167, arrMs: 33 });
        jest.advanceTimersByTime(167 + 33 * 2);
        expect(move).toHaveBeenCalledTimes(4);

        endDasHold('test');
        jest.advanceTimersByTime(1000);
        expect(move).toHaveBeenCalledTimes(4);
    });

    test('複数のホールドが独立して動作する（同時押し）', () => {
        const moveLeft = jest.fn();
        const moveRight = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('left', { moveToEnd, move: moveLeft, dasMs: 167, arrMs: 33 });
        jest.advanceTimersByTime(50);
        startDasHold('right', { moveToEnd, move: moveRight, dasMs: 167, arrMs: 33 });

        expect(moveLeft).toHaveBeenCalledTimes(1);
        expect(moveRight).toHaveBeenCalledTimes(1);

        // leftのDASはrightの押下に影響されず経過する
        jest.advanceTimersByTime(117);
        expect(moveLeft).toHaveBeenCalledTimes(2);
        expect(moveRight).toHaveBeenCalledTimes(1);

        // 片方を離してももう片方は継続する
        endDasHold('left');
        jest.advanceTimersByTime(50 + 33);
        expect(moveRight).toHaveBeenCalledTimes(3);
        expect(moveLeft).toHaveBeenCalledTimes(2);
    });

    test('同じIDで再スタートすると前のホールドは破棄される', () => {
        const move1 = jest.fn();
        const move2 = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('test', { moveToEnd, move: move1, dasMs: 167, arrMs: 33 });
        startDasHold('test', { moveToEnd, move: move2, dasMs: 167, arrMs: 33 });

        jest.advanceTimersByTime(167);
        expect(move1).toHaveBeenCalledTimes(1);
        expect(move2).toHaveBeenCalledTimes(2);
    });

    test('endAllDasHoldsで全ホールドが解除される', () => {
        const move = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('left', { move, moveToEnd, dasMs: 167, arrMs: 33 });
        startDasHold('right', { move, moveToEnd, dasMs: 167, arrMs: 33 });
        endAllDasHolds();

        expect(isDasHoldActive('left')).toBe(false);
        expect(isDasHoldActive('right')).toBe(false);

        jest.advanceTimersByTime(1000);
        expect(move).toHaveBeenCalledTimes(2);
        expect(moveToEnd).not.toHaveBeenCalled();
    });
});
