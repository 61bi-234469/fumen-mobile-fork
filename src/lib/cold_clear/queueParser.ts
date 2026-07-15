import { Piece } from '../enums';

export interface ParsedQueue {
    hold: Piece | null;
    current: Piece | null;
    queue: Piece[];
}

export interface ParsedQueueState extends ParsedQueue {
    b2b: boolean;
    combo: number;
}

// #Q=[hold](current)next... 形式 (テト譜Quiz互換)。`;` 以降は次のクイズとして無視する
const QUIZ_QUEUE_REGEX = /^#Q=\[([IOTLJSZiotljsz]?)\]\(([IOTLJSZiotljsz]?)\)([IOTLJSZiotljsz]*)(;.*)?$/;
// 旧形式 (読み込みのみ互換): NEXT列 または ホールド:NEXT列
const LEGACY_QUEUE_REGEX = /^([IOTLJSZiotljsz]:)?[IOTLJSZiotljsz]*$/;
const SCORE_SEGMENT_REGEX = /^score=(-?(?:0|[1-9]\d*)\.\d{2})$/;
const OUTSIDE_TOP_SEGMENT_REGEX = /^outsideTop=(\d+)$/;
const B2B_SEGMENT_REGEX = /^b2b=(0|1|true|false)$/;
const COMBO_SEGMENT_REGEX = /^combo=(-?\d+)$/;
const METADATA_SEPARATOR = ' | ';

const CHAR_TO_PIECE: Record<string, Piece> = {
    I: Piece.I,
    O: Piece.O,
    T: Piece.T,
    L: Piece.L,
    J: Piece.J,
    S: Piece.S,
    Z: Piece.Z,
    i: Piece.I,
    o: Piece.O,
    t: Piece.T,
    l: Piece.L,
    j: Piece.J,
    s: Piece.S,
    z: Piece.Z,
};

const PIECE_TO_CHAR: Record<number, string> = {
    [Piece.I]: 'I',
    [Piece.O]: 'O',
    [Piece.T]: 'T',
    [Piece.L]: 'L',
    [Piece.J]: 'J',
    [Piece.S]: 'S',
    [Piece.Z]: 'Z',
};

export function parseQueueComment(text: string): ParsedQueue | null {
    const parsed = parseQueueStateComment(text);
    if (!parsed) {
        return null;
    }

    if (parsed.hold === null && parsed.current === null && parsed.queue.length === 0) {
        return null;
    }

    return {
        hold: parsed.hold,
        current: parsed.current,
        queue: parsed.queue,
    };
}

export function parseQueueStateComment(text: string): ParsedQueueState | null {
    if (!text) {
        return null;
    }

    const segments = text.split(METADATA_SEPARATOR);
    if (segments.length === 0) {
        return null;
    }

    const queueOnly = parseQueueOnlyComment(segments[segments.length - 1]);
    const metadataSegmentCount = queueOnly ? segments.length - 1 : segments.length;
    const queue = queueOnly || { hold: null, current: null, queue: [] };

    let b2b = false;
    let combo = 0;
    for (let i = 0; i < metadataSegmentCount; i += 1) {
        const tokens = segments[i].split(' ');
        if (tokens.length === 0 || tokens.some(token => token.length === 0)) {
            return null;
        }

        for (const token of tokens) {
            if (SCORE_SEGMENT_REGEX.test(token) || OUTSIDE_TOP_SEGMENT_REGEX.test(token)) {
                continue;
            }

            const b2bMatch = B2B_SEGMENT_REGEX.exec(token);
            if (b2bMatch) {
                b2b = b2bMatch[1] === '1' || b2bMatch[1] === 'true';
                continue;
            }

            const comboMatch = COMBO_SEGMENT_REGEX.exec(token);
            if (comboMatch) {
                combo = Math.max(0, Number.parseInt(comboMatch[1], 10));
                continue;
            }

            return null;
        }
    }

    return {
        b2b,
        combo,
        hold: queue.hold,
        current: queue.current,
        queue: queue.queue,
    };
}

function parseQueueOnlyComment(text: string): ParsedQueue | null {
    if (text === '') {
        return {
            hold: null,
            current: null,
            queue: [],
        };
    }

    const quizMatch = QUIZ_QUEUE_REGEX.exec(text);
    if (quizMatch) {
        const [, holdChar, currentChar, queueStr] = quizMatch;
        return {
            hold: holdChar ? CHAR_TO_PIECE[holdChar] : null,
            current: currentChar ? CHAR_TO_PIECE[currentChar] : null,
            queue: Array.prototype.map.call(queueStr, (c: string) => CHAR_TO_PIECE[c]) as Piece[],
        };
    }

    if (text.startsWith('#Q=')) {
        return null;
    }

    if (!LEGACY_QUEUE_REGEX.test(text)) {
        return null;
    }

    const colonIndex = text.indexOf(':');
    if (colonIndex === -1) {
        return {
            hold: null,
            current: null,
            queue: Array.prototype.map.call(text, (c: string) => CHAR_TO_PIECE[c]) as Piece[],
        };
    }

    const holdChar = text.substring(0, colonIndex);
    const queueStr = text.substring(colonIndex + 1);
    return {
        hold: CHAR_TO_PIECE[holdChar],
        current: null,
        queue: Array.prototype.map.call(queueStr, (c: string) => CHAR_TO_PIECE[c]) as Piece[],
    };
}

const toChar = (piece: Piece | null): string => {
    return piece !== null ? PIECE_TO_CHAR[piece] : '';
};

export function buildQueueComment(hold: Piece | null, current: Piece | null, queue: Piece[]): string {
    if (hold === null && current === null && queue.length === 0) {
        return '';
    }
    const queueStr = queue.map(p => PIECE_TO_CHAR[p]).join('');
    return `#Q=[${toChar(hold)}](${toChar(current)})${queueStr}`;
}

export function buildQueueStateComment(
    hold: Piece | null,
    current: Piece | null,
    queue: Piece[],
    b2b: boolean,
    combo: number,
): string {
    const queueComment = buildQueueComment(hold, current, queue);
    const metadataTokens: string[] = [];

    if (b2b) {
        metadataTokens.push('b2b=1');
    }

    const normalizedCombo = Math.max(0, Math.floor(combo));
    if (normalizedCombo > 0) {
        metadataTokens.push(`combo=${normalizedCombo}`);
    }

    const metadataComment = metadataTokens.join(' ');
    if (metadataComment && queueComment) {
        return `${metadataComment} | ${queueComment}`;
    }
    if (metadataComment) {
        return metadataComment;
    }
    return queueComment;
}
