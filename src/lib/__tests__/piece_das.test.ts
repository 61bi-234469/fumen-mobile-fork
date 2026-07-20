import {
    activateDasCut,
    endAllDasHolds,
    endDasHold,
    endSoftDropHold,
    FRAME_DURATION_MS,
    framesToMilliseconds,
    isDasHoldActive,
    millisecondsToFrames,
    cutDasHolds,
    startDasHold,
    startSoftDropHold,
} from '../piece_das';

const DAS_FRAMES = 10;
const ARR_FRAMES = 2;

describe('piece_das', () => {
    test('converts legacy millisecond settings to 60 fps frame values', () => {
        expect(millisecondsToFrames(167)).toBe(10);
        expect(millisecondsToFrames(33)).toBe(2);
        expect(millisecondsToFrames(0)).toBe(0);
    });

    test('converts fractional frames without rounding', () => {
        expect(framesToMilliseconds(5.5)).toBeCloseTo(FRAME_DURATION_MS * 5.5);
        expect(framesToMilliseconds(1.5)).toBeCloseTo(FRAME_DURATION_MS * 1.5);
    });

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

        startDasHold('test', { move, moveToEnd, dasFrames: DAS_FRAMES, arrFrames: 0 });

        expect(move).toHaveBeenCalledTimes(1);
        expect(moveToEnd).not.toHaveBeenCalled();
    });

    test('ARR=0のときDAS経過後に端まで移動する', () => {
        const move = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('test', { move, moveToEnd, dasFrames: DAS_FRAMES, arrFrames: 0 });
        jest.advanceTimersByTime(FRAME_DURATION_MS * DAS_FRAMES - 1);
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

        startDasHold('test', { move, moveToEnd, dasFrames: DAS_FRAMES, arrFrames: ARR_FRAMES });
        expect(move).toHaveBeenCalledTimes(1);

        // DAS経過時に1回、その後はARR間隔でリピート
        jest.advanceTimersByTime(FRAME_DURATION_MS * DAS_FRAMES);
        expect(move).toHaveBeenCalledTimes(2);

        jest.advanceTimersByTime(FRAME_DURATION_MS * ARR_FRAMES * 3);
        expect(move).toHaveBeenCalledTimes(5);
        expect(moveToEnd).not.toHaveBeenCalled();
    });

    test('DAS前に離すと追加の移動は発生しない', () => {
        const move = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('test', { move, moveToEnd, dasFrames: DAS_FRAMES, arrFrames: ARR_FRAMES });
        jest.advanceTimersByTime(FRAME_DURATION_MS * 6);
        endDasHold('test');

        jest.advanceTimersByTime(1000);
        expect(move).toHaveBeenCalledTimes(1);
        expect(moveToEnd).not.toHaveBeenCalled();
        expect(isDasHoldActive('test')).toBe(false);
    });

    test('ARRリピート中に離すとリピートが停止する', () => {
        const move = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('test', { move, moveToEnd, dasFrames: DAS_FRAMES, arrFrames: ARR_FRAMES });
        jest.advanceTimersByTime(FRAME_DURATION_MS * (DAS_FRAMES + ARR_FRAMES * 2));
        expect(move).toHaveBeenCalledTimes(4);

        endDasHold('test');
        jest.advanceTimersByTime(1000);
        expect(move).toHaveBeenCalledTimes(4);
    });

    test('複数のホールドが独立して動作する（同時押し）', () => {
        const moveLeft = jest.fn();
        const moveRight = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('left', { moveToEnd, move: moveLeft, dasFrames: DAS_FRAMES, arrFrames: ARR_FRAMES });
        jest.advanceTimersByTime(FRAME_DURATION_MS * 3);
        startDasHold('right', { moveToEnd, move: moveRight, dasFrames: DAS_FRAMES, arrFrames: ARR_FRAMES });

        expect(moveLeft).toHaveBeenCalledTimes(1);
        expect(moveRight).toHaveBeenCalledTimes(1);

        // leftのDASはrightの押下に影響されず経過する
        jest.advanceTimersByTime(FRAME_DURATION_MS * 7);
        expect(moveLeft).toHaveBeenCalledTimes(2);
        expect(moveRight).toHaveBeenCalledTimes(1);

        // 片方を離してももう片方は継続する
        endDasHold('left');
        jest.advanceTimersByTime(FRAME_DURATION_MS * 5);
        expect(moveRight).toHaveBeenCalledTimes(3);
        expect(moveLeft).toHaveBeenCalledTimes(2);
    });

    test('同じIDで再スタートすると前のホールドは破棄される', () => {
        const move1 = jest.fn();
        const move2 = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('test', { moveToEnd, move: move1, dasFrames: DAS_FRAMES, arrFrames: ARR_FRAMES });
        startDasHold('test', { moveToEnd, move: move2, dasFrames: DAS_FRAMES, arrFrames: ARR_FRAMES });

        jest.advanceTimersByTime(FRAME_DURATION_MS * DAS_FRAMES);
        expect(move1).toHaveBeenCalledTimes(1);
        expect(move2).toHaveBeenCalledTimes(2);
    });

    test('endAllDasHoldsで全ホールドが解除される', () => {
        const move = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('left', { move, moveToEnd, dasFrames: DAS_FRAMES, arrFrames: ARR_FRAMES });
        startDasHold('right', { move, moveToEnd, dasFrames: DAS_FRAMES, arrFrames: ARR_FRAMES });
        endAllDasHolds();

        expect(isDasHoldActive('left')).toBe(false);
        expect(isDasHoldActive('right')).toBe(false);

        jest.advanceTimersByTime(1000);
        expect(move).toHaveBeenCalledTimes(2);
        expect(moveToEnd).not.toHaveBeenCalled();
    });

    test('DAS Cut skips the initial DAS delay when a piece spawns', async () => {
        const move = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('test', { move, moveToEnd, dasFrames: DAS_FRAMES, arrFrames: ARR_FRAMES });
        jest.advanceTimersByTime(FRAME_DURATION_MS * DAS_FRAMES);

        activateDasCut(0);
        expect(move).toHaveBeenCalledTimes(2);
        await Promise.resolve();
        expect(move).toHaveBeenCalledTimes(3);

        jest.advanceTimersByTime(FRAME_DURATION_MS * 5);
        expect(move).toHaveBeenCalledTimes(5);

        jest.advanceTimersByTime(FRAME_DURATION_MS * ARR_FRAMES);
        expect(move).toHaveBeenCalledTimes(6);
    });

    test('DAS Cut keeps ARR=0 precharge active across spawns', async () => {
        const move = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('test', { move, moveToEnd, dasFrames: DAS_FRAMES, arrFrames: 0 });
        jest.advanceTimersByTime(FRAME_DURATION_MS * DAS_FRAMES);
        activateDasCut(0);
        await Promise.resolve();
        activateDasCut(0);
        await Promise.resolve();

        expect(moveToEnd).toHaveBeenCalledTimes(3);
    });

    test('only the latest zero-DCD DAS Cut starts ARR in the same turn', async () => {
        const move = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('test', { move, moveToEnd, dasFrames: DAS_FRAMES, arrFrames: 0 });
        activateDasCut(0);
        activateDasCut(0);
        await Promise.resolve();

        expect(moveToEnd).toHaveBeenCalledTimes(1);
    });

    test('releasing a hold cancels a pending zero-DCD DAS Cut', async () => {
        const move = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('test', { move, moveToEnd, dasFrames: DAS_FRAMES, arrFrames: 0 });
        activateDasCut(0);
        endDasHold('test');
        await Promise.resolve();

        expect(moveToEnd).not.toHaveBeenCalled();
    });

    test('DCD delays DAS Cut ARR activation after a piece spawns', () => {
        const move = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('test', { move, moveToEnd, dasFrames: DAS_FRAMES, arrFrames: ARR_FRAMES });
        jest.advanceTimersByTime(FRAME_DURATION_MS * DAS_FRAMES);
        activateDasCut(3);

        jest.advanceTimersByTime(FRAME_DURATION_MS * 3 - 1);
        expect(move).toHaveBeenCalledTimes(2);

        jest.advanceTimersByTime(1);
        expect(move).toHaveBeenCalledTimes(3);
        expect(moveToEnd).not.toHaveBeenCalled();
    });

    test('DAS Cut skips pending DAS when a direction is held before spawn', async () => {
        const move = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('test', { move, moveToEnd, dasFrames: DAS_FRAMES, arrFrames: ARR_FRAMES });
        activateDasCut(0);

        expect(move).toHaveBeenCalledTimes(1);
        await Promise.resolve();
        expect(move).toHaveBeenCalledTimes(2);
        jest.advanceTimersByTime(FRAME_DURATION_MS * DAS_FRAMES);
        expect(move).toHaveBeenCalledTimes(7);
    });

    test('DCD delays DAS Cut even when the initial DAS is still pending', () => {
        const move = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('test', { move, moveToEnd, dasFrames: DAS_FRAMES, arrFrames: ARR_FRAMES });
        activateDasCut(3);

        jest.advanceTimersByTime(FRAME_DURATION_MS * 3 - 1);
        expect(move).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(1);
        expect(move).toHaveBeenCalledTimes(2);
    });

    test('DCD pauses active ARR and resumes after the configured frames', () => {
        const move = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('test', { move, moveToEnd, dasFrames: DAS_FRAMES, arrFrames: ARR_FRAMES });
        jest.advanceTimersByTime(FRAME_DURATION_MS * DAS_FRAMES);
        expect(move).toHaveBeenCalledTimes(2);

        cutDasHolds(3);
        jest.advanceTimersByTime(FRAME_DURATION_MS * 3 - 1);
        expect(move).toHaveBeenCalledTimes(2);

        jest.advanceTimersByTime(1);
        expect(move).toHaveBeenCalledTimes(3);

        jest.advanceTimersByTime(FRAME_DURATION_MS * ARR_FRAMES);
        expect(move).toHaveBeenCalledTimes(4);
        expect(moveToEnd).not.toHaveBeenCalled();
    });

    test('SDFはTETR.IOの0.05G下限準拠でSDF×3マス/秒の落下間隔になる', () => {
        const move = jest.fn();

        // SDF=5 → 5 × 3 = 15マス/秒 → 4フレーム間隔
        startSoftDropHold('test', move, 5);
        expect(move).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(FRAME_DURATION_MS * 4 - 1);
        expect(move).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(1);
        expect(move).toHaveBeenCalledTimes(2);

        // 以降も同じ間隔でリピートする
        jest.advanceTimersByTime(FRAME_DURATION_MS * 4 * 3);
        expect(move).toHaveBeenCalledTimes(5);
    });

    test('SDF=∞は毎フレーム落下する', () => {
        const move = jest.fn();

        startSoftDropHold('test', move, Infinity);
        expect(move).toHaveBeenCalledTimes(1);

        jest.advanceTimersByTime(FRAME_DURATION_MS * 3);
        expect(move).toHaveBeenCalledTimes(4);
    });

    test('ソフトドロップホールドを離すと落下が停止する', () => {
        const move = jest.fn();

        startSoftDropHold('test', move, 5);
        endSoftDropHold('test');

        jest.advanceTimersByTime(1000);
        expect(move).toHaveBeenCalledTimes(1);
    });

    test('DCD does not delay a hold that has not entered ARR yet', () => {
        const move = jest.fn();
        const moveToEnd = jest.fn();

        startDasHold('test', { move, moveToEnd, dasFrames: DAS_FRAMES, arrFrames: ARR_FRAMES });
        cutDasHolds(20);
        jest.advanceTimersByTime(FRAME_DURATION_MS * DAS_FRAMES);

        expect(move).toHaveBeenCalledTimes(2);
    });
});
