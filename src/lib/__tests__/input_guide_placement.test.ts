import { Piece, Rotation } from '../enums';
import { Field } from '../fumen/field';
import { inferGuideRotationEvidence } from '../input_guide_placement';
import { evaluatePlacement } from '../input_stats';

const fillRow = (field: Field, y: number, holes: number[]) => {
    for (let x = 0; x < 10; x += 1) {
        if (!holes.includes(x)) field.setToPlayField(x + y * 10, Piece.Gray);
    }
};

describe('inferGuideRotationEvidence', () => {
    // T-spin double slot: the T points down into (4, 0) under an overhang at (3, 2).
    const tsdField = () => {
        const field = new Field({});
        fillRow(field, 0, [4]);
        fillRow(field, 1, [3, 4, 5]);
        field.setToPlayField(3 + 2 * 10, Piece.Gray);
        return field;
    };
    const tsd = { type: Piece.T, rotation: Rotation.Reverse, coordinate: { x: 4, y: 1 } };

    it.each(['srs', 'srsPlus'] as const)('recovers a rotation that makes an AI T-spin double count (%s)', (system) => {
        const field = tsdField();
        const preset = system === 'srs' ? 'ppt' : 'tetrioS2';
        const evidence = inferGuideRotationEvidence(field, tsd, system, preset);
        expect(evidence).toBeDefined();
        expect(evaluatePlacement(field, tsd, preset, evidence)).toMatchObject({ clearedLines: 2, spin: 'full' });
    });

    it('leaves a flat placement on an open floor without a spin', () => {
        const field = new Field({});
        const move = { type: Piece.T, rotation: Rotation.Spawn, coordinate: { x: 4, y: 0 } };
        const evidence = inferGuideRotationEvidence(field, move, 'srsPlus', 'tetrioS2');
        expect(evaluatePlacement(field, move, 'tetrioS2', evidence).spin).toBe('none');
    });

    it('returns no evidence when no rotated state could have kicked into the placement', () => {
        // A pocket shaped exactly like a flat T: every other orientation collides nearby.
        const field = new Field({});
        fillRow(field, 0, [3, 4, 5]);
        fillRow(field, 1, [4]);
        fillRow(field, 2, []);
        const move = { type: Piece.T, rotation: Rotation.Spawn, coordinate: { x: 4, y: 0 } };
        expect(inferGuideRotationEvidence(field, move, 'srsPlus', 'tetrioS2')).toBeUndefined();
    });
});
