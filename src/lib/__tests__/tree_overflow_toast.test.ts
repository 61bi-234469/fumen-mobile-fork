import { Field } from '../fumen/field';
import { Page } from '../fumen/types';
import { createTreeFromPages, embedTreeInPages } from '../fumen/tree_utils';
import { resetTreeOverflowWarningForTesting, warnIfTreeCommentOverLimit } from '../tree_overflow_toast';

const flags = { lock: false, mirror: false, colorize: true, rise: false, quiz: false };

const pagesWithTree = (firstComment: string): Page[] => {
    const pages: Page[] = Array.from({ length: 3 }, (_, index) => ({
        index,
        field: index === 0 ? { obj: new Field({}) } : { ref: 0 },
        comment: index === 0 ? { text: firstComment } : { ref: 0 },
        flags: { ...flags },
    }));
    return embedTreeInPages(pages, createTreeFromPages(pages), true);
};

describe('warnIfTreeCommentOverLimit', () => {
    const toast = jest.fn();
    const small = pagesWithTree('hello');
    // 4090 ASCII chars fit alone, but the appended #TREE= line pushes the comment over 4095.
    const large = pagesWithTree('x'.repeat(4090));

    beforeEach(() => {
        toast.mockReset();
        (global as any).M = { toast };
        resetTreeOverflowWarningForTesting();
    });

    afterAll(() => {
        delete (global as any).M;
    });

    test('stays silent while the tree fits', () => {
        expect(warnIfTreeCommentOverLimit(small)).toBe(false);
        expect(toast).not.toHaveBeenCalled();
    });

    test('warns once for repeated autosaves and re-arms after the tree fits again', () => {
        expect(warnIfTreeCommentOverLimit(large)).toBe(true);
        warnIfTreeCommentOverLimit(large);
        expect(toast).toHaveBeenCalledTimes(1);

        warnIfTreeCommentOverLimit(small);
        warnIfTreeCommentOverLimit(large);
        expect(toast).toHaveBeenCalledTimes(2);
    });

    test('warns on every explicit export', () => {
        warnIfTreeCommentOverLimit(large);
        warnIfTreeCommentOverLimit(large, { everyTime: true });
        expect(toast).toHaveBeenCalledTimes(2);
    });
});
