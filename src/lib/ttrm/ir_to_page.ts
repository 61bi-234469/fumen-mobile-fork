import { isMinoPiece, parsePieceName, Piece } from '../enums';
import { Quiz } from '../fumen/quiz';
import { Page } from '../fumen/types';
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

// FR-50: IR の 1 地点 → 単独のキーページ。ref は使わず、生成ページは常に
// 先頭ページになるため colorize を明示する。
export const irPointToPage = (cells: IRField, queue?: IRQueue): Page => {
    const comment = buildQuizComment(queue);
    return {
        index: 0,
        field: { obj: irFieldToField(cells) },
        comment: { text: comment },
        flags: {
            lock: true,
            colorize: true,
            mirror: false,
            rise: false,
            quiz: comment !== '',
        },
    };
};
