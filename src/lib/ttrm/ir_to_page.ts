import { FieldConstants, isMinoPiece, parsePieceName, Piece } from '../enums';
import { Quiz } from '../fumen/quiz';
import { Move, Page } from '../fumen/types';
import { createSpawnMove } from '../piece';
import { irFieldToField } from './board_converter';
import { IRField } from './types';

export interface IRQueue {
    hold: Piece | null;
    current: Piece | null;
    next: Piece[];
}

const pieceLetter = (piece: Piece | null): string =>
    piece !== null && isMinoPiece(piece) ? (parsePieceName(piece) ?? '') : '';

// HOLD / カレント / NEXT を標準の quiz コメント（#Q=[hold](current)next...）で表す。
// 形式そのものは src/lib/fumen/quiz.ts の生成器に任せる。
const buildQuizComment = (queue: IRQueue | undefined): string => {
    if (queue === undefined) {
        return '';
    }
    const hold = pieceLetter(queue.hold);
    const nexts = pieceLetter(queue.current) + queue.next.map(pieceLetter).join('');
    if (hold === '' && nexts === '') {
        return '';
    }
    return Quiz.create(hold, nexts).format().toString();
};

// カレントは spawn 位置に置いた操作対象ミノとして渡す。INPUT 画面を開いた時点で
// そのまま動かせる状態にするため、quiz の (current) と同じミノをページに載せる。
const buildSpawnMove = (queue: IRQueue | undefined, srs: boolean): Move | undefined => {
    const current = queue !== undefined ? queue.current : null;
    if (current === null || !isMinoPiece(current)) {
        return undefined;
    }
    return createSpawnMove(current, srs);
};

// FR-54: 次にせり上がる 1 行。穴の列（column から size 個）だけを空にし、残りを Gray で埋める。
// fumen のせり上がり行は 1 行しかない（FieldConstants.SentLine = 1）ので、2 行目以降は載せない。
const buildRiseRow = (rise: { column: number, size: number }): IRField => {
    const start = Math.min(FieldConstants.Width - 1, Math.max(0, Math.floor(rise.column)));
    const width = Math.min(FieldConstants.Width, Math.max(1, Math.floor(rise.size)));
    const row: IRField = [];
    for (let x = 0; x < FieldConstants.Width; x += 1) {
        row.push(start <= x && x < start + width ? Piece.Empty : Piece.Gray);
    }
    return row;
};

// FR-50: IR の 1 地点 → 単独のキーページ。ref は使わない。
// colorize は fumen 全体の設定なので、挿入先に合わせて呼び出し側から渡す。
// srs は回転法則のユーザ設定（spawn 位置が変わる）。
// rise を渡した地点だけ、ゲージ 1 行ぶんをせり上がり行として載せる（FR-54）。
// 渡さない場合の出力は P1 / P2 と 1 ビットも変わらない。
export const irPointToPage = (
    cells: IRField, queue?: IRQueue, colorize: boolean = true, srs: boolean = true,
    rise?: { column: number, size: number },
): Page => {
    const comment = buildQuizComment(queue);
    const sentLine = rise !== undefined ? buildRiseRow(rise) : undefined;
    return {
        index: 0,
        field: { obj: irFieldToField(cells, sentLine) },
        piece: buildSpawnMove(queue, srs),
        comment: { text: comment },
        flags: {
            colorize,
            lock: true,
            mirror: false,
            // fumen の意味論では「このページの lock 後にせり上がる」。
            // Editor で操作対象ミノを置いた直後にガベージが上がる = リプレイの挙動と一致する。
            rise: rise !== undefined,
            quiz: comment !== '',
        },
    };
};
