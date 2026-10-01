import {
    EDITOR_ACTIVE_BACKGROUND,
    EDITOR_ACTIVE_COLOR,
    EDITOR_ACTIVE_TEXT_COLOR,
    EDITOR_DANGER_COLOR,
    EDITOR_PALETTE_BACKGROUND,
    EDITOR_RAIL_DIVIDER_COLOR,
    EDITOR_RAIL_FRAME_COLOR,
    EDITOR_RAIL_FRAME_RADIUS,
    editorControlStateStyle,
} from '../editor_control_style';

describe('editor control styles', () => {
    test('uses a blue indicator instead of a red fill for active controls', () => {
        expect(editorControlStateStyle('active')).toEqual({
            background: EDITOR_ACTIVE_BACKGROUND,
            boxShadow: `inset 0 -3px 0 ${EDITOR_ACTIVE_COLOR}`,
            color: EDITOR_ACTIVE_TEXT_COLOR,
        });
    });

    test('keeps palette colors visible inside a blue selection outline', () => {
        expect(editorControlStateStyle('palette')).toEqual({
            background: EDITOR_PALETTE_BACKGROUND,
            boxShadow: `inset 0 0 0 2px ${EDITOR_ACTIVE_COLOR}`,
            color: '#333',
        });
    });

    test('reserves red for dangerous actions', () => {
        expect(editorControlStateStyle('danger').color).toBe(EDITOR_DANGER_COLOR);
        expect(editorControlStateStyle('active').color).not.toBe(EDITOR_DANGER_COLOR);
    });

    test('draws the rail frame dark with light dividers and rounded corners', () => {
        expect(EDITOR_RAIL_FRAME_COLOR).toBe('#333');
        expect(EDITOR_RAIL_DIVIDER_COLOR).toBe('#e0e0e0');
        expect(EDITOR_RAIL_FRAME_RADIUS).toBe(4);
    });
});
