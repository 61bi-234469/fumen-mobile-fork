import { InputRotationDirection, InputRotationEvidence } from './comment_metadata';
import { Piece, Rotation } from './enums';
import { Field } from './fumen/field';
import { Move } from './fumen/types';
import { InputRulesPreset, Spin, evaluatePlacement } from './input_stats';
import { getBlockPositions } from './piece';
import { testLeftRotation, testRightRotation } from './srs';
import { test180Rotation, testLeftRotationSrsPlus, testRightRotationSrsPlus } from './srs_plus';

type RotationSystemName = 'classic' | 'srs' | 'srsPlus';

const ROTATIONS = [Rotation.Spawn, Rotation.Right, Rotation.Reverse, Rotation.Left];

const SPIN_RANK: { [spin in Spin]: number } = { none: 0, mini: 1, full: 2 };

const fits = (field: Field, piece: Piece, rotation: Rotation, x: number, y: number): boolean => (
    getBlockPositions(piece, rotation, x, y)
        .every(([px, py]) => 0 <= px && px < 10 && 0 <= py && py < 23 && field.get(px, py) === Piece.Empty)
);

const rotationTests = (rotationSystem: RotationSystemName) => {
    const tests: { direction: InputRotationDirection, test: typeof testRightRotation }[] = rotationSystem === 'srsPlus'
        ? [
            { direction: 'cw', test: testRightRotationSrsPlus },
            { direction: 'ccw', test: testLeftRotationSrsPlus },
            { direction: '180', test: test180Rotation },
        ]
        : [
            { direction: 'cw', test: testRightRotation },
            { direction: 'ccw', test: testLeftRotation },
        ];
    return tests;
};

/**
 * The AI only reports the final placement, so recover the rotation that could have
 * locked it: a legal state one rotation earlier whose first successful kick lands
 * exactly on the move. Among those, the one with the strongest spin wins, because
 * the engine plans spins by reaching them with a final rotation.
 * Classic rotation has no kick table of its own for spin rules, so it reuses SRS.
 */
export const inferGuideRotationEvidence = (
    field: Field,
    move: Move,
    rotationSystem: RotationSystemName,
    preset: InputRulesPreset,
): InputRotationEvidence | undefined => {
    const { type, rotation: finalRotation } = move;
    const { x, y } = move.coordinate;
    let best: { evidence: InputRotationEvidence, rank: number } | undefined;
    for (const { direction, test } of rotationTests(rotationSystem)) {
        for (const fromRotation of ROTATIONS) {
            const { test: offsets, rotation } = test(type, fromRotation);
            if (rotation !== finalRotation) continue;
            offsets.forEach(([dx, dy], kickIndex) => {
                const fromX = x - dx;
                const fromY = y - dy;
                if (!fits(field, type, fromRotation, fromX, fromY)) return;
                const earlierKickWins = offsets.slice(0, kickIndex)
                    .some(([ex, ey]) => fits(field, type, finalRotation, fromX + ex, fromY + ey));
                if (earlierKickWins) return;
                const evidence: InputRotationEvidence = { direction, kickIndex };
                const rank = SPIN_RANK[evaluatePlacement(field, move, preset, evidence).spin];
                if (best === undefined || best.rank < rank) best = { evidence, rank };
            });
        }
    }
    return best?.evidence;
};
