import { Field } from '../fumen/field';
import { Page } from '../fumen/types';
import { Piece } from '../enums';
import { calculateGifFrameLayout, normalizeGifFrameDelayMs } from '../gif_export';
import { THUMBNAIL_WIDTH, getThumbnailHeight } from '../thumbnail';

const createPage = (index: number, field: Field, comment: string = ''): Page => ({
    index,
    field: { obj: field },
    comment: { text: comment },
    flags: {
        lock: true,
        mirror: false,
        colorize: true,
        rise: false,
        quiz: false,
    },
});

const createField = (filledY?: number): Field => {
    const field = new Field({});
    if (filledY !== undefined) {
        field.setToPlayField(filledY * 10, Piece.I);
    }
    return field;
};

describe('GIF export layout', () => {
    test('omits comment area when every page has no comment', () => {
        const pages = [
            createPage(0, createField()),
            createPage(1, createField(4)),
        ];

        const layout = calculateGifFrameLayout(pages, true);

        expect(layout.hasAnyComment).toBe(false);
        expect(layout.width).toBe(THUMBNAIL_WIDTH);
        expect(layout.fieldX).toBe(0);
        expect(layout.commentY).toBeNull();
        expect(layout.commentHeight).toBe(0);
        expect(layout.height).toBe(layout.maxFieldHeight);
    });

    test('keeps a shared comment area when any page has a comment', () => {
        const pages = [
            createPage(0, createField(), ''),
            createPage(1, createField(4), 'comment'),
        ];

        const layout = calculateGifFrameLayout(pages, true);

        expect(layout.hasAnyComment).toBe(true);
        expect(layout.commentY).toBe(layout.fieldBottomY);
        expect(layout.commentHeight).toBeGreaterThan(0);
        expect(layout.height).toBe(layout.maxFieldHeight + layout.commentHeight);
    });

    test('aligns all trimmed fields by the bottom edge', () => {
        const pages = [
            createPage(0, createField(0)),
            createPage(1, createField(10)),
        ];
        const layout = calculateGifFrameLayout(pages, true);

        for (let i = 0; i < pages.length; i += 1) {
            const height = getThumbnailHeight(pages, i, true);
            const y = layout.fieldBottomY - height;
            expect(y + height).toBe(layout.fieldBottomY);
        }
    });
});

describe('normalizeGifFrameDelayMs', () => {
    test('uses 500ms as default and clamps supported range', () => {
        expect(normalizeGifFrameDelayMs(NaN)).toBe(500);
        expect(normalizeGifFrameDelayMs(1)).toBe(100);
        expect(normalizeGifFrameDelayMs(1234.4)).toBe(1234);
        expect(normalizeGifFrameDelayMs(20000)).toBe(10000);
    });
});
