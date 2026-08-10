import { FieldConstants, Piece, isMinoPiece } from '../enums';
import { createInputReplayContext, inputGarbageView } from '../input_replay';
import { irFieldToField } from '../ttrm/board_converter';
import { boardAtFrame, pointAt } from '../ttrm/timeline';
import { IRField, PlayerRoundIR } from '../ttrm/types';
import { fieldToCC } from './fieldConverter';
import { toCellKey } from './move_match';
import { CCAnalyzePositionMessage, CC_HOLD_NONE, PIECE_TO_CC } from './types';
import {
    COLD_CLEAR_THINK_MS_PRESETS,
    REPLAY_ANALYSIS_THINK_MS_DEFAULT,
} from './think_time';

// リプレイ 1 ラウンドを Cold Clear で解析するための純粋モジュール。
// IR から Worker 入力を組み立て、返ってきたスコアを損失・順位・集計へ変換する。
// state にも DOM にも依存しない。

// 探索深さ（＝スコアの絶対値レンジ）を手ごとにそろえるため、NEXT は必ずこの件数へ切る。
export const ANALYSIS_NEXT_COUNT = 5;
// 実質「ルート直下の候補を全件」の意味。既存の 1 手スコア評価と同じ値。
export const ANALYSIS_CANDIDATE_COUNT = 5000;
export const ANALYSIS_THINK_MS_PRESETS = COLD_CLEAR_THINK_MS_PRESETS;
export const ANALYSIS_THINK_MS_DEFAULT = REPLAY_ANALYSIS_THINK_MS_DEFAULT;

export const normalizeAnalysisThinkMs = (thinkMs: number): number =>
    ANALYSIS_THINK_MS_PRESETS.includes(thinkMs) ? thinkMs : ANALYSIS_THINK_MS_DEFAULT;

export interface AnalysisSettings {
    thinkMs: number;
    holdAllowed: boolean;
    speculate: boolean;
    weightsPreset: number;
}

export type AnalysisSkipReason =
    | 'noCurrent'
    | 'shortQueue'
    | 'clipped'
    | 'noCells'
    | 'occupiedCells'
    | 'completeLine';

export interface AnalysisPosition {
    index: number;
    frame: number;
    request?: CCAnalyzePositionMessage;
    skipReason?: AnalysisSkipReason;
}

// 解析対象の手番は locks[0..L-1] = 手番 1..L。initial / terminal は含めない。
export const analysisMoveCount = (player: PlayerRoundIR): number => player.locks.length;

const hasCompleteLine = (field: IRField): boolean => {
    for (let y = 0; y < FieldConstants.Height; y += 1) {
        const start = y * FieldConstants.Width;
        let filled = true;
        for (let x = 0; x < FieldConstants.Width; x += 1) {
            if (field[start + x] === Piece.Empty) {
                filled = false;
                break;
            }
        }
        if (filled) {
            return true;
        }
    }
    return false;
};

// 次の非消去 lock でせり上がる行数。INPUT 取り込みと同じ導出式を共有する
// （直近 1 火力だけを見る。穴の位置や後続 parcel は Cold Clear へ渡せない）。
const incomingAt = (player: PlayerRoundIR, index: number, lockFrame: number): number => {
    try {
        const context = createInputReplayContext(player, index - 1, Math.max(0, lockFrame - 1));
        return inputGarbageView(context).nextTankRows.length;
    } catch (e) {
        // ガベージ設定を復元できないリプレイでも解析自体は続ける
        return 0;
    }
};

// 手番 index（1..L）の設置直前局面を Worker 入力へ変換する。
export const buildAnalysisPosition = (
    player: PlayerRoundIR, index: number, settings: AnalysisSettings,
): AnalysisPosition => {
    const lock = player.locks[index - 1];
    const frame = lock.frame;
    const skip = (skipReason: AnalysisSkipReason): AnalysisPosition => ({ index, frame, skipReason });

    if (lock.cells === undefined || lock.cells.length === 0) {
        return skip('noCells');
    }

    // LockPoint.fieldBefore は名前に反して設置後の盤面なので使えない。
    // 設置直前の盤面は visual timeline の「この lock frame より前の最後の変化点」から取る。
    // これは前の設置とその後にせり上がったガベージまで含んだ状態になる。
    const board = boardAtFrame(player, frame - 1);
    if (board.clippedRowCount > 0) {
        return skip('clipped');
    }
    // 同一 frame に複数の lock が並ぶと、直前の変化点にこの手の 1 つ前の設置が
    // 含まれないことがある。そのまま解析すると別の局面を評価してしまう。
    for (const [x, y] of lock.cells) {
        if (y >= FieldConstants.Height) {
            return skip('clipped');
        }
        if (board.field[y * FieldConstants.Width + x] !== Piece.Empty) {
            return skip('occupiedCells');
        }
    }

    // LockPoint の hold/current/next は lock 後の値なので、直前ポイントから取る。
    const previous = pointAt(player, index - 1);
    const current = previous.current;
    if (current === null || !isMinoPiece(current)) {
        return skip('noCurrent');
    }
    const next = previous.next.filter(isMinoPiece);
    if (next.length < ANALYSIS_NEXT_COUNT) {
        return skip('shortQueue');
    }
    if (hasCompleteLine(board.field)) {
        return skip('completeLine');
    }

    // clear.b2b / clear.ren は当該 lock 後のエンジン統計で、非成立時は -1 になり得る。
    const previousLock = player.locks[index - 2];
    const b2b = previousLock !== undefined && previousLock.clear.b2b >= 0;
    const combo = previousLock !== undefined ? Math.max(0, previousLock.clear.ren + 1) : 0;

    const hold = previous.hold !== null && isMinoPiece(previous.hold) ? previous.hold : null;
    const queue = [current, ...next.slice(0, ANALYSIS_NEXT_COUNT)].map(piece => PIECE_TO_CC[piece]);

    return {
        index,
        frame,
        request: {
            index,
            queue,
            b2b,
            combo,
            type: 'analyzePosition',
            field: fieldToCC(irFieldToField(board.field)),
            hold: hold !== null ? PIECE_TO_CC[hold] : CC_HOLD_NONE,
            holdAllowed: settings.holdAllowed,
            speculate: settings.speculate,
            weightsPreset: settings.weightsPreset,
            thinkMs: settings.thinkMs,
            incoming: incomingAt(player, index, frame),
            candidateCount: ANALYSIS_CANDIDATE_COUNT,
            placedCellKey: toCellKey(lock.cells.map(([x, y]) => [x, y])),
        },
    };
};

export const buildAnalysisPositions = (
    player: PlayerRoundIR, settings: AnalysisSettings,
): AnalysisPosition[] => {
    const positions: AnalysisPosition[] = [];
    for (let index = 1; index <= analysisMoveCount(player); index += 1) {
        positions.push(buildAnalysisPosition(player, index, settings));
    }
    return positions;
};

// ---- 指標 ----

// 探索の揺れで実手が最善を上回ることがある。損失は 0 未満にしない。
export const lossOf = (bestScore: number, playedScore: number): number =>
    Math.max(0, bestScore - playedScore);

export interface MoveEvalLike {
    status: string;
    loss?: number;
    rank?: number;
}

export interface AnalysisSummary {
    analyzed: number;
    unmatched: number;
    skipped: number;
    failed: number;
    best: number;
    matchRate: number;   // 0..1。解析成功手のうち rank 1 の割合
    meanLoss: number;
    maxLoss: number;
    totalLoss: number;
}

const okLosses = (moves: MoveEvalLike[]): number[] =>
    moves.filter(move => move.status === 'ok' && move.loss !== undefined)
        .map(move => move.loss as number);

export const summarizeAnalysis = (moves: MoveEvalLike[]): AnalysisSummary => {
    const losses = okLosses(moves);
    const best = moves.filter(move => move.status === 'ok' && move.rank === 1).length;
    const totalLoss = losses.reduce((sum, loss) => sum + loss, 0);
    return {
        best,
        totalLoss,
        analyzed: losses.length,
        unmatched: moves.filter(move => move.status === 'unmatched').length,
        skipped: moves.filter(move => move.status === 'skipped').length,
        failed: moves.filter(move => move.status === 'failed').length,
        matchRate: losses.length > 0 ? best / losses.length : 0,
        meanLoss: losses.length > 0 ? totalLoss / losses.length : 0,
        maxLoss: losses.length > 0 ? Math.max(...losses) : 0,
    };
};

// Cold Clear の score は累積評価値で、局面をまたいだ絶対比較に意味が無い。
// 単位を仮定せずに済むよう、棒の高さも色分けも「この解析の中での相対値」で決める。
export const LOSS_SCALE_EPSILON = 1e-6;
export const LOSS_RATIO_MINOR = 0.15;
export const LOSS_RATIO_MAJOR = 0.5;

export const percentile = (values: number[], ratio: number): number => {
    if (values.length === 0) {
        return 0;
    }
    const sorted = values.slice().sort((a, b) => a - b);
    const position = Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * ratio)));
    return sorted[position];
};

// 上位 10% の損失を満杯とする。全手ほぼ最善なら scale が 0 に潰れるため下限を置く。
export const lossScaleOf = (moves: MoveEvalLike[]): number =>
    Math.max(percentile(okLosses(moves), 0.9), LOSS_SCALE_EPSILON);

export type LossGrade = 'best' | 'minor' | 'mid' | 'major';

export const gradeOf = (loss: number, rank: number | undefined, scale: number): LossGrade => {
    if (rank === 1 || loss <= 0) {
        return 'best';
    }
    const ratio = loss / scale;
    if (ratio >= LOSS_RATIO_MAJOR) {
        return 'major';
    }
    if (ratio >= LOSS_RATIO_MINOR) {
        return 'mid';
    }
    return 'minor';
};

// タイムライン・ガベージマーカー帯と同じ写像。3 つの帯が縦に揃うことが表示の前提。
export const frameToX = (frame: number, endFrame: number, width: number): number => {
    const span = Math.max(1, endFrame);
    const x = frame / span * width;
    return Math.min(width, Math.max(0, x));
};
