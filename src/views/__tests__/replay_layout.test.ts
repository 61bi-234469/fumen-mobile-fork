import { FieldConstants, Platforms } from '../../lib/enums';
import {
    getReplayLayout,
    REPLAY_NARROW_MAX_WIDTH,
    REPLAY_WIDE_MAX_WIDTH,
    REPLAY_WIDE_MIN_DISPLAY_WIDTH,
} from '../replay_layout';
import { MINO_SLOT_WIDTH } from '../../components/replay/replay_side';
import {
    GAUGE_COLUMN_WIDTH_COMPACT, GAUGE_COLUMN_WIDTH_FULL,
} from '../../components/replay/replay_gauge';

// playingPhase の左右 padding。replay_layout.ts の同名定数と対応する。
const CONTAINER_PADDING = 32;

const createState = (override: {
    platform?: Platforms;
    width?: number;
    height?: number;
} = {}) => ({
    platform: override.platform ?? Platforms.PC,
    display: {
        width: override.width ?? 1280,
        height: override.height ?? 800,
    },
}) as any;

describe('getReplayLayout', () => {
    describe('narrow (mobile)', () => {
        test('mobile stays narrow whatever the window width is', () => {
            const phone = getReplayLayout(createState({ platform: Platforms.Mobile, width: 375 }), true);
            const wideWindow = getReplayLayout(
                createState({ platform: Platforms.Mobile, width: 1280 }), true);

            expect(phone.mode).toEqual('narrow');
            expect(wideWindow.mode).toEqual('narrow');
            expect(wideWindow.containerMaxWidth).toEqual(REPLAY_NARROW_MAX_WIDTH);
        });

        test('keeps the values the mobile layout shipped with', () => {
            // 375x667 は Cypress の既定ビューポート。ここが動いたらモバイル表示の退行
            const layout = getReplayLayout(
                createState({ platform: Platforms.Mobile, width: 375, height: 667 }), true);

            expect(layout.blockSize).toEqual(14);
            expect(layout.opponentBlockSize).toEqual(7);
        });

        test('the self board grows when the opponent is hidden', () => {
            // 幅が効く条件（縦は余っている）でないと差が出ない
            const state = createState({ platform: Platforms.Mobile, width: 300, height: 900 });
            expect(getReplayLayout(state, false).blockSize)
                .toBeGreaterThan(getReplayLayout(state, true).blockSize);
        });

        // P3 §7-2 の懸念 3: ゲージ幅を予約しないと 375px で盤面が右へ溢れる。
        // 予約が効いていれば、盤面 2 面 ＋ キュー列 ＋ ゲージ 2 本が表示幅に収まる。
        test.each([300, 375])('the boards and their gauges fit within %ipx', (width) => {
            const layout = getReplayLayout(
                createState({ width, platform: Platforms.Mobile, height: 900 }), true);

            const used = (layout.blockSize + layout.opponentBlockSize) * FieldConstants.Width
                + (MINO_SLOT_WIDTH + 10) * 2
                + CONTAINER_PADDING
                + (GAUGE_COLUMN_WIDTH_FULL + 2) + (GAUGE_COLUMN_WIDTH_COMPACT + 2);

            expect(layout.showOpponent).toBe(true);
            expect(used).toBeLessThanOrEqual(width);
        });

        test('hides the opponent instead of drawing a board that would collapse', () => {
            // 相手ブロックが 4px を割る幅。相手なしで計算し直される
            const layout = getReplayLayout(
                createState({ platform: Platforms.Mobile, width: 160, height: 667 }), true);

            expect(layout.showOpponent).toBe(false);
            expect(layout.opponentBlockSize).toBeGreaterThanOrEqual(3);
        });
    });

    describe('wide (PC)', () => {
        test('both sides get the same block size', () => {
            const layout = getReplayLayout(createState({ width: 1280, height: 800 }), true);

            expect(layout.mode).toEqual('wide');
            expect(layout.opponentBlockSize).toEqual(layout.blockSize);
            expect(layout.containerMaxWidth).toEqual(REPLAY_WIDE_MAX_WIDTH);
        });

        test('the threshold width is still wide', () => {
            expect(getReplayLayout(
                createState({ width: REPLAY_WIDE_MIN_DISPLAY_WIDTH }), true).mode).toEqual('wide');
            expect(getReplayLayout(
                createState({ width: REPLAY_WIDE_MIN_DISPLAY_WIDTH - 1 }), true).mode).toEqual('narrow');
        });

        test('shrinking the window past the threshold gives the narrow layout back', () => {
            const shrunk = getReplayLayout(createState({ width: 600, height: 800 }), true);

            expect(shrunk.mode).toEqual('narrow');
            expect(shrunk.opponentBlockSize).toBeLessThan(shrunk.blockSize);
            // narrow へ落ちても 2 盤面は残る
            expect(shrunk.showOpponent).toBe(true);
        });

        test('the narrowest wide window still fits two boards side by side', () => {
            const layout = getReplayLayout(
                createState({ width: REPLAY_WIDE_MIN_DISPLAY_WIDTH, height: 800 }), true);

            expect(layout.blockSize).toBeGreaterThanOrEqual(10);
            expect(layout.opponentBlockSize).toEqual(layout.blockSize);
        });

        test('a short window is limited by height, not width', () => {
            const short = getReplayLayout(createState({ width: 1920, height: 560 }), true);
            const tall = getReplayLayout(createState({ width: 1920, height: 1080 }), true);

            expect(short.blockSize).toEqual(10);
            // 高さが十分なら上限 22px まで伸びる
            expect(tall.blockSize).toEqual(22);
        });
    });
});
