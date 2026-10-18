import { State } from '../states';
import { PlayerRoundIR, ReplayVisualState, RoundIR } from '../lib/ttrm/types';
import { indexAtFrame, preLockPointAt, ReplayPreLockPoint, visualAtFrame } from '../lib/ttrm/timeline';

// state から再生中の局面を引くだけの読み取り専用セレクタ。
// '../actions' を読み込まないので、Cold Clear のアクションからもアプリ本体を巻き込まずに使える。

export const getSelectedRound = (state: State): RoundIR | undefined => {
    return state.replay.ir?.rounds[state.replay.selection.roundIndex];
};

export const getSelfPlayerRound = (state: State): PlayerRoundIR | undefined => {
    const round = getSelectedRound(state);
    const selfId = state.replay.selection.selfPlayerId;
    if (round === undefined || selfId === null) {
        return undefined;
    }
    // rounds[i] 内の並び順はラウンドごとに入れ替わり得るため、必ず id で対応付ける（FR-15）
    return round.players.find(player => player.id === selfId);
};

// FR-16 は対象外だが、players[] から探す実装にして 3 人以上でも構造上は破綻させない。
export const getOpponentPlayerRound = (state: State): PlayerRoundIR | undefined => {
    const round = getSelectedRound(state);
    const selfId = state.replay.selection.selfPlayerId;
    if (round === undefined || selfId === null) {
        return undefined;
    }
    return round.players.find(player => player.id !== selfId);
};

// 手番送りで止まっている側だけ、接地直前の地点を返す。基準でない側と自動再生中は undefined。
export const preLockPointOf = (
    state: State, variant: 'self' | 'opponent',
): ReplayPreLockPoint | undefined => {
    if (state.replay.phase !== 'playing' || !state.replay.cursor.turnStop) {
        return undefined;
    }
    if (variant !== 'self') {
        return undefined;
    }
    const player = variant === 'self' ? getSelfPlayerRound(state) : getOpponentPlayerRound(state);
    if (player === undefined) {
        return undefined;
    }
    const index = variant === 'self'
        ? state.replay.cursor.selfIndex
        : state.replay.cursor.opponentIndex;
    return preLockPointAt(player, index);
};

// 手番停止中は未確定の設置を数えない。切り出す盤面と INPUT の統計をそろえるために使う。
export const getReplayConfirmedIndex = (state: State): number => {
    const preLock = preLockPointOf(state, 'self');
    return preLock !== undefined ? preLock.confirmedIndex : state.replay.cursor.selfIndex;
};

// 自陣の表示盤面（getReplaySelfVisual）に入っている設置数。同一フレームに設置が続く手番で
// 接地直前を復元できず確定地点を出すときは、選んだ手番ではなくそのフレームの最後の設置まで入る。
export const getReplaySelfVisualConfirmedIndex = (state: State): number => {
    const preLock = preLockPointOf(state, 'self');
    if (preLock !== undefined) {
        return preLock.confirmedIndex;
    }
    const player = getSelfPlayerRound(state);
    return player === undefined ? 0 : indexAtFrame(player, Math.floor(state.replay.cursor.frame));
};

// 確定ReplayPointは手番・統計用に残し、盤面・操作中ミノ・HOLD/NEXTだけを
// 共通フレーム軸のvisual timelineから引く。fractional cursorは次frameを先取りしない。
// 手番送りで止めた側だけは、設置済み・未確定の接地直前地点を出す。
export const getReplaySelfVisual = (state: State): ReplayVisualState | undefined => {
    const player = getSelfPlayerRound(state);
    if (player === undefined || state.replay.phase !== 'playing') {
        return undefined;
    }
    const preLock = preLockPointOf(state, 'self');
    if (preLock !== undefined) {
        return preLock.visual;
    }
    return visualAtFrame(player, Math.floor(state.replay.cursor.frame));
};
