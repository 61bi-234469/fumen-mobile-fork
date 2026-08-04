import { parseInputRotationEvidence, withInputRotationEvidence } from '../comment_metadata';

describe('input rotation metadata', () => {
    test('parses valid evidence and rejects malformed values', () => {
        expect(parseInputRotationEvidence('inputRotation=cw:4 | #Q=[](T)IOS'))
            .toEqual({ direction: 'cw', kickIndex: 4 });
        expect(parseInputRotationEvidence('hello inputRotation=180')).toEqual({ direction: '180' });
        expect(parseInputRotationEvidence('inputRotation=right:4 | #Q=[](T)')).toBeUndefined();
        expect(parseInputRotationEvidence('inputRotation=cw:5')).toBeUndefined();
    });

    test('replaces only the rotation token and preserves comment bodies', () => {
        const text = 'b2b=1 | #Q=[](T)IOS;#TREE=abc';
        const withEvidence = withInputRotationEvidence(text, { direction: 'ccw', kickIndex: 2 });
        expect(withEvidence).toBe('inputRotation=ccw:2 | b2b=1 | #Q=[](T)IOS;#TREE=abc');
        expect(withInputRotationEvidence(withEvidence, undefined)).toBe(text);
    });
});
