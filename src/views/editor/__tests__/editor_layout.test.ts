import { shouldUseCompactEditorRail } from '../responsive_layout';

describe('editor layout', () => {
    test('keeps text labels on a normal-height single-column rail', () => {
        expect(shouldUseCompactEditorRail(725, 1)).toBe(false);
        expect(shouldUseCompactEditorRail(559, 1)).toBe(true);
        expect(shouldUseCompactEditorRail(725, 2)).toBe(true);
    });
});
