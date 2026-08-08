import { FieldConstants, Platforms } from '../lib/enums';
import { State } from '../states';
import {
    REPLAY_QUEUE_COLUMN_UNITS, REPLAY_QUEUE_GAP, replayQueueColumnWidth,
} from '../components/replay/replay_side';
import {
    GAUGE_COLUMN_WIDTH_COMPACT, GAUGE_COLUMN_WIDTH_FULL,
} from '../components/replay/replay_gauge';

// Replay 再生画面のレイアウト（P2 §3-6）。
// narrow: 相手を 0.55 倍で並置し、相手のキューは盤面上に横並び（モバイル）。
// wide:   自陣と相手を同一ブロックサイズ・同一の縦列キューで並置（PC）。
// state を書き換えず、毎描画ここで導出する。

// PC かつこの幅以上なら wide。これ未満では 2 面を等倍で置くと窮屈になるため、
// 相手を縮小する narrow のほうが読みやすい。
export const REPLAY_WIDE_MIN_DISPLAY_WIDTH = 720;

export const REPLAY_WIDE_MAX_WIDTH = 960;
export const REPLAY_NARROW_MAX_WIDTH = 480;

const MIN_BLOCK_SIZE = 6;
const NARROW_MAX_BLOCK_SIZE = 16;
const WIDE_MAX_BLOCK_SIZE = 22;

// narrow での相手の縮小率と、これを下回ったら相手を隠す下限
const OPPONENT_SCALE = 0.55;
const MIN_OPPONENT_BLOCK_SIZE = 4;

// HOLD 列 + gap + 盤面 + gap + NEXT 列。列幅は盤面 3.4 マス基準なので、
// 「盤面 10 マス + キュー 6.8 マス + gap 2 つ」を解いてブロックサイズを決める。
const SIDE_QUEUE_GAPS = REPLAY_QUEUE_GAP * 2;
const SIDE_QUEUE_UNITS = REPLAY_QUEUE_COLUMN_UNITS * 2;
// P3 §7-2 の懸念 3: ゲージバーぶんの幅を予約しないと 375px で盤面が右へ溢れる。
// 表示トグルの状態にかかわらず常に予約する ―― トグルで盤面の大きさが変わると
// 「ゲージ 0 でも枠は残す」（レイアウトを動かさない）と矛盾するため。
const GAUGE_COLUMN_FULL = GAUGE_COLUMN_WIDTH_FULL + 2;
const GAUGE_COLUMN_COMPACT = GAUGE_COLUMN_WIDTH_COMPACT + 2;
// playingPhase の左右 padding
const CONTAINER_PADDING = 32;
// wide で 2 面の間に置く間隔
export const WIDE_BOARD_GAP = 24;
// トランスポート・統計・ボタン群が使う縦幅の実測ぶん
const VERTICAL_RESERVE = 330;

export type ReplayLayoutMode = 'wide' | 'narrow';

export interface ReplayLayout {
    mode: ReplayLayoutMode;
    containerMaxWidth: number;
    blockSize: number;
    // wide では blockSize と同値
    opponentBlockSize: number;
    // HOLD / NEXT 列の幅。blockSize と一緒に決まる（replay_side が受け取る）
    queueWidth: number;
    // 幅不足のフォールバックを適用したあとの最終判断
    showOpponent: boolean;
}

const blockSizeByHeight = (displayHeight: number): number =>
    Math.floor((displayHeight - VERTICAL_RESERVE) / FieldConstants.Height);

const clampBlockSize = (maxBlockSize: number, displayHeight: number, byWidth: number): number =>
    Math.max(MIN_BLOCK_SIZE, Math.min(
        maxBlockSize, blockSizeByHeight(displayHeight), Math.floor(byWidth)));

const narrowLayout = (state: Readonly<State>, wantsOpponent: boolean): ReplayLayout => {
    const available = Math.min(state.display.width, REPLAY_NARROW_MAX_WIDTH)
        - SIDE_QUEUE_GAPS - CONTAINER_PADDING
        - GAUGE_COLUMN_FULL - (wantsOpponent ? GAUGE_COLUMN_COMPACT : 0);
    // 相手は自陣ブロックの OPPONENT_SCALE 倍。自陣 1 ブロックあたりの所要幅から逆算する。
    const widthPerBlock = wantsOpponent ? 1 + OPPONENT_SCALE : 1;
    const boardUnits = FieldConstants.Width * widthPerBlock;
    // 列幅は下限・上限で丸まるので、まず概算のブロックサイズから列幅を確定し、
    // その実寸を引いた残りで盤面を決め直す。
    const queueWidth = replayQueueColumnWidth(clampBlockSize(
        NARROW_MAX_BLOCK_SIZE, state.display.height, available / (boardUnits + SIDE_QUEUE_UNITS)));
    const blockSize = clampBlockSize(
        NARROW_MAX_BLOCK_SIZE, state.display.height, (available - queueWidth * 2) / boardUnits);
    const opponentBlockSize = Math.floor(blockSize * OPPONENT_SCALE);

    if (wantsOpponent && opponentBlockSize < MIN_OPPONENT_BLOCK_SIZE) {
        // 相手を出すと潰れる幅。相手なしで計算し直す（showOpponent の state は変えない）
        return narrowLayout(state, false);
    }

    return {
        blockSize,
        opponentBlockSize,
        queueWidth,
        mode: 'narrow',
        containerMaxWidth: REPLAY_NARROW_MAX_WIDTH,
        showOpponent: wantsOpponent,
    };
};

const wideLayout = (state: Readonly<State>, wantsOpponent: boolean): ReplayLayout => {
    const available = Math.min(state.display.width, REPLAY_WIDE_MAX_WIDTH) - CONTAINER_PADDING
        - (wantsOpponent ? WIDE_BOARD_GAP : 0);
    const perSide = (wantsOpponent ? Math.floor(available / 2) : available)
        - SIDE_QUEUE_GAPS - GAUGE_COLUMN_FULL;
    const queueWidth = replayQueueColumnWidth(clampBlockSize(
        WIDE_MAX_BLOCK_SIZE, state.display.height,
        perSide / (FieldConstants.Width + SIDE_QUEUE_UNITS)));
    const blockSize = clampBlockSize(
        WIDE_MAX_BLOCK_SIZE, state.display.height,
        (perSide - queueWidth * 2) / FieldConstants.Width);

    return {
        blockSize,
        queueWidth,
        mode: 'wide',
        containerMaxWidth: REPLAY_WIDE_MAX_WIDTH,
        // 2 盤面を対等に見せるのが wide の目的なので、相手も同じサイズ
        opponentBlockSize: blockSize,
        showOpponent: wantsOpponent,
    };
};

// wantsOpponent は「相手が居て、かつユーザが表示を選んでいる」かどうか。
export const getReplayLayout = (state: Readonly<State>, wantsOpponent: boolean): ReplayLayout =>
    state.platform === Platforms.PC && REPLAY_WIDE_MIN_DISPLAY_WIDTH <= state.display.width
        ? wideLayout(state, wantsOpponent)
        : narrowLayout(state, wantsOpponent);
