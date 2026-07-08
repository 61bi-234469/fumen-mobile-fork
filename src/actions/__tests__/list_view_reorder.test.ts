import { Field } from '../../lib/fumen/field';
import { Page } from '../../lib/fumen/types';
import { Piece } from '../../lib/enums';
import { toPrimitivePage } from '../../history_task';

jest.mock('../../actions', () => ({
    actions: {},
    main: {},
}));

jest.mock('../../memento', () => ({
    localStorageWrapper: {},
}));

jest.mock('../../states', () => ({
    resources: {
        konva: {
            stage: {
                isReady: false,
            },
        },
        modals: {},
    },
}));

jest.mock('../../env', () => ({
    PageEnv: {
        Version: 'test',
        Debug: false,
    },
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { toReorderPageTask } = require('../list_view');

const defaultFlags = {
    lock: false,
    mirror: false,
    colorize: true,
    rise: false,
    quiz: false,
    srs: true,
};

const createPages = (): Page[] => {
    const field = new Field({});
    field.add(0, 0, Piece.T);

    return [
        {
            index: 0,
            field: { obj: field },
            comment: { text: 'a' },
            flags: { ...defaultFlags, colorize: true },
        },
        {
            index: 1,
            field: { ref: 0 },
            comment: { ref: 0 },
            flags: { ...defaultFlags },
        },
        {
            index: 2,
            field: { ref: 0 },
            comment: { ref: 0 },
            flags: { ...defaultFlags },
        },
    ];
};

describe('toReorderPageTask', () => {
    test('moving the first page to the end resolves refs and carries first-page flags', () => {
        const pages = createPages();
        const prevPrimitives = pages.map(toPrimitivePage);

        const task = toReorderPageTask(0, 3, prevPrimitives);
        const result = task.replay([...pages]);

        expect(result.index).toBe(2);

        const newFirstPage = result.pages[0];
        expect(newFirstPage.field.ref).toBeUndefined();
        expect(newFirstPage.field.obj).toBeDefined();
        expect(newFirstPage.field.obj?.equals(pages[0].field.obj as Field)).toBe(true);
        expect(newFirstPage.comment).toEqual({ text: 'a' });
        expect(newFirstPage.flags.colorize).toBe(true);
    });

    test('revert restores the original page order and index', () => {
        const pages = createPages();
        const prevPrimitives = pages.map(toPrimitivePage);

        const task = toReorderPageTask(0, 3, prevPrimitives);
        const revertResult = task.revert([...pages]);

        expect(revertResult.index).toBe(0);
        expect(revertResult.pages).toHaveLength(pages.length);
        revertResult.pages.forEach((page: Page, i: number) => {
            expect(page.index).toBe(pages[i].index);
            expect(page.comment).toEqual(pages[i].comment);
            expect(page.flags).toEqual(pages[i].flags);
        });
        expect(revertResult.pages[0].field.obj?.equals(pages[0].field.obj as Field)).toBe(true);
    });

    test('a no-op slot does not change the page order', () => {
        const pages = createPages();
        const prevPrimitives = pages.map(toPrimitivePage);

        const task = toReorderPageTask(1, 1, prevPrimitives);
        const result = task.replay([...pages]);

        expect(result.pages.map((p: Page) => p.index)).toEqual([0, 1, 2]);
    });
});
