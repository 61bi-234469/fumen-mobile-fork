export type InputRotationDirection = 'cw' | 'ccw' | '180';

export interface InputRotationEvidence {
    direction: InputRotationDirection;
    kickIndex?: number;
}

export interface SevenBagGrayProgress {
    bag: number;
    pieces: number;
    lines: number;
    perfectClears: number;
}

export interface SevenBagGrayDisplay {
    pieces: number[];
    rowMap: number[];
}

const INPUT_ROTATION_TOKEN = /^inputRotation=(cw|ccw|180)(?::([0-4]))?$/;
const SEVEN_BAG_GRAY_TOKEN = /^sbg=(\d+),(\d+),(\d+),(\d+)$/;
const SEVEN_BAG_GRAY_DISPLAY_TOKEN = /^sbgd=([0-8]{230}):([0-9a-z.]+)$/;
const METADATA_SEPARATOR = ' | ';

export const parseInputRotationEvidence = (text: string): InputRotationEvidence | undefined => {
    for (const segment of text.split(METADATA_SEPARATOR)) {
        for (const token of segment.split(' ')) {
            const match = INPUT_ROTATION_TOKEN.exec(token);
            if (match) {
                return {
                    direction: match[1] as InputRotationDirection,
                    ...(match[2] === undefined ? {} : { kickIndex: Number.parseInt(match[2], 10) }),
                };
            }
        }
    }
    return undefined;
};

export const parseSevenBagGrayProgress = (text: string): SevenBagGrayProgress | undefined => {
    for (const segment of text.split(METADATA_SEPARATOR)) {
        for (const token of segment.split(' ')) {
            const match = SEVEN_BAG_GRAY_TOKEN.exec(token);
            if (match) {
                return {
                    bag: Math.min(6, Number.parseInt(match[1], 10)),
                    pieces: Number.parseInt(match[2], 10),
                    lines: Number.parseInt(match[3], 10),
                    perfectClears: Number.parseInt(match[4], 10),
                };
            }
        }
    }
    return undefined;
};

export const parseSevenBagGrayDisplay = (text: string): SevenBagGrayDisplay | undefined => {
    for (const segment of text.split(METADATA_SEPARATOR)) {
        for (const token of segment.split(' ')) {
            const match = SEVEN_BAG_GRAY_DISPLAY_TOKEN.exec(token);
            if (!match) continue;
            const rowMap = match[2].split('.').map(value => Number.parseInt(value, 36));
            if (rowMap.length !== 23 || rowMap.some(value => !Number.isFinite(value))) return undefined;
            return {
                rowMap,
                pieces: Array.from(match[1]).map(value => Number.parseInt(value, 10)),
            };
        }
    }
    return undefined;
};

/** Add or replace only our token, leaving all comment bodies (including #Q and #TREE) intact. */
export const withInputRotationEvidence = (
    text: string,
    evidence: InputRotationEvidence | undefined,
): string => {
    const segments = text.split(METADATA_SEPARATOR)
        .map(segment => segment.split(' ').filter(token => !INPUT_ROTATION_TOKEN.test(token)).join(' '))
        .filter(segment => segment !== '');
    if (evidence === undefined) {
        return segments.join(METADATA_SEPARATOR);
    }
    const token = `inputRotation=${evidence.direction}${evidence.kickIndex === undefined ? '' : `:${evidence.kickIndex}`}`;
    return [token].concat(segments).join(METADATA_SEPARATOR);
};

export const withSevenBagGrayProgress = (text: string, progress: SevenBagGrayProgress | undefined): string => {
    const segments = text.split(METADATA_SEPARATOR)
        .map(segment => segment.split(' ').filter(token => !SEVEN_BAG_GRAY_TOKEN.test(token)).join(' '))
        .filter(segment => segment !== '');
    if (progress === undefined) return segments.join(METADATA_SEPARATOR);
    const token = `sbg=${progress.bag},${progress.pieces},${progress.lines},${progress.perfectClears}`;
    return [token].concat(segments).join(METADATA_SEPARATOR);
};

export const withSevenBagGrayDisplay = (text: string, display: SevenBagGrayDisplay | undefined): string => {
    const segments = text.split(METADATA_SEPARATOR)
        .map(segment => segment.split(' ')
            .filter(token => !SEVEN_BAG_GRAY_DISPLAY_TOKEN.test(token)).join(' '))
        .filter(segment => segment !== '');
    if (display === undefined) return segments.join(METADATA_SEPARATOR);
    const pieces = display.pieces.map(piece => String(piece)).join('');
    const rowMap = display.rowMap.map(value => value.toString(36)).join('.');
    return [`sbgd=${pieces}:${rowMap}`].concat(segments).join(METADATA_SEPARATOR);
};
