import { Field } from '../field';
import { Page } from '../types';
import { decode, encode } from '../fumen';
import { createTreeFromPages, embedTreeInPages, extractTreeFromPages, isTreeCommentOverLimit } from '../tree_utils';

const flags = { lock: false, mirror: false, colorize: true, rise: false, quiz: false };

const createPages = (count: number, firstComment: string): Page[] => Array.from({ length: count }, (_, index) => ({
    index,
    field: index === 0 ? { obj: new Field({}) } : { ref: 0 },
    comment: index === 0 ? { text: firstComment } : { ref: 0 },
    flags: { ...flags },
}));

const withTree = (pages: Page[]) => embedTreeInPages(pages, createTreeFromPages(pages), true);

describe('isTreeCommentOverLimit', () => {
    test('is false without tree data even for a long comment', () => {
        expect(isTreeCommentOverLimit(createPages(1, 'x'.repeat(5000)))).toBe(false);
    });

    test('is false for a small tree that survives an encode round trip', async () => {
        const pages = withTree(createPages(5, 'hello'));
        expect(isTreeCommentOverLimit(pages)).toBe(false);

        const decoded = await decode(`v115@${await encode(pages)}`);
        expect(extractTreeFromPages(decoded).tree).not.toBeNull();
    });

    test('detects a tree that the encoder would truncate', async () => {
        // Non-ASCII text expands six-fold under escape(), so a modest comment exhausts the budget.
        const pages = withTree(createPages(20, 'テ'.repeat(700)));
        expect(isTreeCommentOverLimit(pages)).toBe(true);

        const decoded = await decode(`v115@${await encode(pages)}`);
        expect(extractTreeFromPages(decoded).tree).toBeNull();
    });
});
