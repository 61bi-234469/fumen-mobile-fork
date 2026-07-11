import { Field } from '../fumen/field';
import { Page } from '../fumen/types';
import {
    guideLineColorFromRotationSystem,
    synchronizeFirstPageColorize,
} from '../rotation_system';

const createPages = (colorize: boolean): Page[] => [{
    index: 0,
    field: { obj: new Field({}) },
    comment: { text: '' },
    flags: {
        colorize,
        lock: true,
        mirror: false,
        rise: false,
        quiz: false,
    },
}];

describe('rotation system color synchronization', () => {
    test('maps classic to the classic palette and SRS variants to the normal palette', () => {
        expect(guideLineColorFromRotationSystem('classic')).toBe(false);
        expect(guideLineColorFromRotationSystem('srs')).toBe(true);
        expect(guideLineColorFromRotationSystem('srsPlus')).toBe(true);
    });

    test('updates only the first page without mutating the original pages', () => {
        const pages = createPages(true);
        const result = synchronizeFirstPageColorize(pages, false);

        expect(result.changed).toBe(true);
        expect(result.pages).not.toBe(pages);
        expect(result.pages[0].flags.colorize).toBe(false);
        expect(pages[0].flags.colorize).toBe(true);
    });

    test('reuses the pages array when the palette already matches', () => {
        const pages = createPages(false);
        const result = synchronizeFirstPageColorize(pages, false);

        expect(result.changed).toBe(false);
        expect(result.pages).toBe(pages);
    });
});
