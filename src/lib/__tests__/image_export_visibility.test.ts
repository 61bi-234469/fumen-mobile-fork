/** @jest-environment jsdom */

import { Field } from '../fumen/field';
import { Page } from '../fumen/types';
import { SerializedTree } from '../fumen/tree_types';
import { generateListViewExportImage } from '../thumbnail';
import { generateTreeViewExportImage } from '../tree_export';

const page = (): Page => ({
    index: 0,
    field: { obj: new Field({}) },
    comment: { text: 'export comment' },
    flags: {
        lock: true,
        mirror: false,
        colorize: true,
        rise: false,
        quiz: false,
    },
});

const tree: SerializedTree = {
    version: 1,
    rootId: 'root',
    nodes: [
        { id: 'root', parentId: null, pageIndex: -1, childrenIds: ['page-0'] },
        { id: 'page-0', parentId: 'root', pageIndex: 0, childrenIds: [] },
    ],
};

describe('image export metadata visibility', () => {
    const fillText = jest.fn();
    let lastCanvasHeight = 0;
    const context = {
        fillText,
        arcTo: jest.fn(),
        beginPath: jest.fn(),
        bezierCurveTo: jest.fn(),
        clearRect: jest.fn(),
        closePath: jest.fn(),
        fill: jest.fn(),
        fillRect: jest.fn(),
        lineTo: jest.fn(),
        measureText: jest.fn((text: string) => ({ width: text.length * 5 })),
        moveTo: jest.fn(),
        scale: jest.fn(),
        stroke: jest.fn(),
        strokeRect: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        lastCanvasHeight = 0;
        jest.spyOn(HTMLCanvasElement.prototype as any, 'getContext').mockReturnValue(context);
        jest.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(function (this: HTMLCanvasElement) {
            lastCanvasHeight = this.height;
            return 'data:image/png;base64,test';
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    const drawnText = (): string => fillText.mock.calls.map(call => call[0]).join('');

    type Generate = (
        pages: Page[],
        guideLineColor: boolean,
        trimTopBlank: boolean,
        options?: { showPageNumbers: boolean; showComments: boolean },
    ) => string;
    const generators: { name: string; generate: Generate }[] = [
        { name: 'list', generate: generateListViewExportImage },
        {
            name: 'tree',
            generate: (pages, guideLineColor, trimTopBlank, options) => generateTreeViewExportImage(
                pages,
                guideLineColor,
                tree,
                trimTopBlank,
                options,
            ),
        },
    ];

    generators.forEach(({ name, generate }) => {
        test(`${name} export shows page numbers and comments by default`, () => {
            generate([page()], true, false);

            expect(fillText).toHaveBeenCalledWith('#1', expect.any(Number), expect.any(Number));
            expect(drawnText()).toContain('export comment');
        });

        test(`${name} export hides page numbers and comments independently`, () => {
            generate([page()], true, false, { showPageNumbers: false, showComments: true });
            expect(fillText).not.toHaveBeenCalledWith('#1', expect.any(Number), expect.any(Number));
            expect(drawnText()).toContain('export comment');

            fillText.mockClear();
            generate([page()], true, false, { showPageNumbers: true, showComments: false });
            expect(fillText).toHaveBeenCalledWith('#1', expect.any(Number), expect.any(Number));
            expect(drawnText()).not.toContain('export comment');

            fillText.mockClear();
            generate([page()], true, false, { showPageNumbers: false, showComments: false });
            expect(fillText).not.toHaveBeenCalled();
        });

        test(`${name} export removes unused metadata space`, () => {
            generate([page()], true, false, { showPageNumbers: true, showComments: true });
            const fullHeight = lastCanvasHeight;
            generate([page()], true, false, { showPageNumbers: false, showComments: true });
            const commentsOnlyHeight = lastCanvasHeight;
            generate([page()], true, false, { showPageNumbers: true, showComments: false });
            const pageNumberOnlyHeight = lastCanvasHeight;
            generate([page()], true, false, { showPageNumbers: false, showComments: false });
            const fieldOnlyHeight = lastCanvasHeight;

            expect(fullHeight).toBeGreaterThan(commentsOnlyHeight);
            expect(commentsOnlyHeight).toBeGreaterThan(pageNumberOnlyHeight);
            expect(pageNumberOnlyHeight).toBeGreaterThan(fieldOnlyHeight);
        });
    });
});
