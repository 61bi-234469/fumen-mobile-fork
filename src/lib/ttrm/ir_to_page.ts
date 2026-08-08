import { isMinoPiece, parsePieceName, Piece } from '../enums';
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

// FR-50: IR の 1 地点 → 単独のキーページ。ref は使わない。
// colorize は fumen 全体の設定なので、挿入先に合わせて呼び出し側から渡す。
// srs は回転法則のユーザ設定（spawn 位置が変わる）。
export const irPointToPage = (
    cells: IRField, queue?: IRQueue, colorize: boolean = true, srs: boolean = true,
): Page => {
    const comment = buildQuizComment(queue);
    return {
        index: 0,
        field: { obj: irFieldToField(cells) },
        piece: buildSpawnMove(queue, srs),
        comment: { text: comment },
        flags: {
            colorize,
            lock: true,
            mirror: false,
            rise: false,
            quiz: comment !== '',
        },
    };
};
