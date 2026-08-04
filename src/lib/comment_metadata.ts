export type InputRotationDirection = 'cw' | 'ccw' | '180';

export interface InputRotationEvidence {
    direction: InputRotationDirection;
    kickIndex?: number;
}

const INPUT_ROTATION_TOKEN = /^inputRotation=(cw|ccw|180)(?::([0-4]))?$/;
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
