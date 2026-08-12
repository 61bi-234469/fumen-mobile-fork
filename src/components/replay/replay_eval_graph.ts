import { ReplayMoveEval } from '../../states';
import { frameToX, gradeOf, lossScaleOf } from '../../lib/cold_clear/replay_analysis';

// 手評価グラフ。タイムライン・ガベージマーカー帯と同じフレーム軸で敷くので、
// 3 つの帯が縦に揃う。再生中は 16ms ごとに再描画が走るため、
// canvas → data URL をメモ化する（replay_timeline_markers.ts と同じ流儀）。
//
// カーソル線はここには描かない。位置が毎 tick 変わるため、画像を作り直さずに済むよう
// 呼び出し側が絶対配置の DOM を重ねる。

export const EVAL_GRAPH_HEIGHT = 56;

const BASE_COLOR = '#cfd8dc';
const GRADE_COLORS: { [grade: string]: string } = {
    best: '#90a4ae',
    minor: '#90a4ae',
    mid: '#ef6c00',
    major: '#e53935',
};
const UNMATCHED_COLOR = '#7e57c2';
const FAILED_COLOR = '#ef9a9a';
const CUMULATIVE_COLOR = '#1565c0';
const BAR_WIDTH = 3;
const MIN_BAR_HEIGHT = 1;
const RENDER_SCALE = 2;

interface GraphMemo {
    width: number;
    endFrame: number;
    signature: string;
    url: string;
}

const memo = new WeakMap<ReplayMoveEval[], GraphMemo>();

// 解析が進むたびに内容が変わる。件数と最後の確定手だけで十分に識別できる。
const signatureOf = (moves: ReplayMoveEval[]): string => {
    let settled = 0;
    let lastIndex = 0;
    for (const move of moves) {
        if (move.status !== 'pending') {
            settled += 1;
            lastIndex = move.index;
        }
    }
    return `${moves.length}:${settled}:${lastIndex}`;
};

export const hasDrawableEval = (moves: ReplayMoveEval[]): boolean =>
    moves.some(move => move.status !== 'pending');

export const renderReplayEvalGraph = (
    moves: ReplayMoveEval[], width: number, endFrame: number,
): string => {
    const signature = signatureOf(moves);
    const cached = memo.get(moves);
    if (cached !== undefined && cached.width === width
        && cached.endFrame === endFrame && cached.signature === signature) {
        return cached.url;
    }

    const url = drawGraph(moves, width, endFrame);
    if (url !== '') {
        memo.set(moves, { width, endFrame, signature, url });
    }
    return url;
};

const drawGraph = (moves: ReplayMoveEval[], width: number, endFrame: number): string => {
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(width * RENDER_SCALE));
    canvas.height = EVAL_GRAPH_HEIGHT * RENDER_SCALE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return '';
    }
    ctx.scale(RENDER_SCALE, RENDER_SCALE);

    const height = EVAL_GRAPH_HEIGHT;
    const scale = lossScaleOf(moves);
    const totalLoss = moves.reduce((sum, move) => sum + (move.loss ?? 0), 0);

    // 損失（マイナス評価）は天井を基準に下へ伸ばす。
    ctx.fillStyle = BASE_COLOR;
    ctx.fillRect(0, 0, width, 1);

    // 累積損失（傾向線）。総損失が 0 なら描かない
    if (totalLoss > 0) {
        ctx.strokeStyle = CUMULATIVE_COLOR;
        ctx.globalAlpha = 0.45;
        ctx.lineWidth = 1;
        ctx.beginPath();
        let cumulative = 0;
        ctx.moveTo(0, 1);
        for (const move of moves) {
            if (move.status === 'pending') {
                continue;
            }
            cumulative += move.loss ?? 0;
            const x = frameToX(move.frame, endFrame, width);
            ctx.lineTo(x, 1 + cumulative / totalLoss * (height - 2));
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    for (const move of moves) {
        if (move.status === 'pending') {
            continue;
        }
        const x = Math.min(width - BAR_WIDTH, Math.max(0, frameToX(move.frame, endFrame, width)));

        if (move.status === 'unmatched') {
            // 圏外は損失が測れない。損失棒と区別して下端に固定の欠測マーカーを出す
            ctx.fillStyle = UNMATCHED_COLOR;
            ctx.fillRect(x, height - 6, BAR_WIDTH, 6);
            continue;
        }
        if (move.status === 'failed') {
            ctx.fillStyle = FAILED_COLOR;
            ctx.fillRect(x, height - 6, BAR_WIDTH, 6);
            continue;
        }
        if (move.status === 'skipped') {
            ctx.fillStyle = BASE_COLOR;
            ctx.fillRect(x, 1, BAR_WIDTH, 2);
            continue;
        }

        const loss = move.loss ?? 0;
        const ratio = Math.min(1, loss / scale);
        const barHeight = Math.max(MIN_BAR_HEIGHT, Math.round(ratio * (height - 2)));
        ctx.fillStyle = GRADE_COLORS[gradeOf(loss, move.rank, scale)] ?? BASE_COLOR;
        ctx.fillRect(x, 1, BAR_WIDTH, barHeight);
    }

    return canvas.toDataURL('image/png');
};

// クリック位置 → 最寄りの解析済み手。無ければ undefined。
export const moveAtGraphX = (
    moves: ReplayMoveEval[], x: number, width: number, endFrame: number,
): ReplayMoveEval | undefined => {
    if (moves.length === 0 || width <= 0) {
        return undefined;
    }
    const frame = Math.max(0, Math.min(endFrame, x / width * Math.max(1, endFrame)));
    let nearest: ReplayMoveEval | undefined;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const move of moves) {
        const distance = Math.abs(move.frame - frame);
        if (distance < nearestDistance) {
            nearest = move;
            nearestDistance = distance;
        }
    }
    return nearest;
};
