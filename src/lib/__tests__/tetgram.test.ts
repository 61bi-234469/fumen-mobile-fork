import { Field } from '../fumen/field';
import { Piece, Rotation } from '../enums';
import { Page } from '../fumen/types';
import { flattenTreeToPageIndices } from '../fumen/tree_utils';
import { SerializedTree } from '../fumen/tree_types';
import {
    generateTetgramRawData,
    looksLikeTetgramRawData,
    parseTetgramRawData,
} from '../tetgram';

const flags = {
    lock: true,
    mirror: false,
    colorize: true,
    rise: false,
    quiz: false,
};

const createPage = (index: number, field: Field, comment: Page['comment'] = { text: '' }): Page => ({
    index,
    comment,
    field: { obj: field },
    flags: { ...flags },
});

const createTreePages = (): { pages: Page[]; tree: SerializedTree } => {
    const pages = [0, 1, 2, 3].map(index => createPage(index, new Field({}), { text: `page-${index}` }));
    const tree = {
        nodes: [
            { id: 'root', parentId: 'virtual', pageIndex: 0, childrenIds: ['main', 'branch'] },
            { id: 'main', parentId: 'root', pageIndex: 1, childrenIds: ['main-next'] },
            { id: 'main-next', parentId: 'main', pageIndex: 2, childrenIds: [] },
            { id: 'branch', parentId: 'root', pageIndex: 3, childrenIds: [] },
            { id: 'virtual', parentId: null, pageIndex: -1, childrenIds: ['root'] },
        ],
        rootId: 'virtual',
        version: 2 as const,
    };
    return { pages, tree };
};

describe('tetgram RawData export', () => {
    test('converts the displayed field into 22 top-to-bottom rows', () => {
        const field = new Field({});
        field.add(0, 0, Piece.I);
        field.add(1, 21, Piece.L);
        field.add(2, 22, Piece.T);

        const raw = JSON.parse(generateTetgramRawData([createPage(0, field)], null));

        expect(raw.pages[0]).toHaveLength(22);
        expect(raw.pages[0][21][0]).toBe(8);
        expect(raw.pages[0][0][1]).toBe(3);
        expect(raw.pages[0].flat()).not.toContain(9);
        expect(raw.listLayout).toEqual({ perPage: {}, cols: 5 });
    });

    test('exports actions with fumen-compatible loc values and resolved comments', () => {
        const first = createPage(0, new Field({}), { text: 'same' });
        first.piece = {
            type: Piece.T,
            rotation: Rotation.Reverse,
            coordinate: { x: 2, y: 2 },
        };
        const second = createPage(1, new Field({}), { ref: 0 });

        const rawText = generateTetgramRawData([first, second], null);
        const raw = JSON.parse(rawText);

        expect(raw.actions[0]).toMatchObject({
            piece: Piece.T,
            rotation: Rotation.Reverse,
            loc: 202,
            x: 0,
            y: 0,
        });
        expect(raw.actions[1]).toBeNull();
        expect(raw.comments).toEqual(['same', 'same']);
        expect(rawText).toContain('  "comments": ["same","same"],');
        expect(rawText).toContain('    {"piece":5,"rotation":2,"loc":202');
    });

    test('maps tree depth and lane to tetgram columns and rows', () => {
        const { pages, tree } = createTreePages();
        const raw = JSON.parse(generateTetgramRawData(pages, tree));

        expect(raw.listLayout.perPage).toEqual({
            0: { row: 'A', col: '1' },
            1: { row: 'A', col: '2' },
            2: { row: 'A', col: '3' },
            3: { row: 'B', col: '2' },
        });
        expect(raw.listLayout.cols).toBe(3);
    });
});

describe('tetgram RawData import', () => {
    test('restores fields, comments, actions, and tree order', () => {
        const { pages, tree } = createTreePages();
        pages[0].piece = {
            type: Piece.T,
            rotation: Rotation.Reverse,
            coordinate: { x: 2, y: 2 },
        };
        const raw = JSON.parse(generateTetgramRawData(pages, tree));
        const parsed = parseTetgramRawData(JSON.stringify(raw));

        expect('error' in parsed).toBe(false);
        if ('error' in parsed) return;

        expect(parsed.pages).toHaveLength(4);
        expect(parsed.pages[0].piece).toEqual(pages[0].piece);
        expect(parsed.pages[0].comment.text).toMatch(/^page-0\n#TREE=/);
        expect(parsed.pages[1].comment).toEqual({ text: 'page-1' });
        expect(parsed.tree).not.toBeNull();
        expect(flattenTreeToPageIndices(parsed.tree!)).toEqual([0, 1, 2, 3]);
    });

    test('recreates tetgram auto-placed pages and parent relationships', () => {
        const raw = {
            pages: [[], [], []],
            comments: ['a', 'b', 'c'],
            actions: [null, null, null],
            listLayout: {
                perPage: {
                    0: { row: 'A', col: '1' },
                    2: { row: 'B', col: '2' },
                },
                cols: 2,
            },
        };
        const parsed = parseTetgramRawData(JSON.stringify(raw));

        expect('error' in parsed).toBe(false);
        if ('error' in parsed) return;
        expect(parsed.tree).not.toBeNull();
        const root = parsed.tree!.nodes.find(node => node.id === parsed.tree!.rootId)!;
        const page0 = parsed.tree!.nodes.find(node => node.pageIndex === 0)!;
        const page1 = parsed.tree!.nodes.find(node => node.pageIndex === 1)!;
        const page2 = parsed.tree!.nodes.find(node => node.pageIndex === 2)!;
        expect(root.childrenIds).toEqual([page0.id]);
        expect(page0.childrenIds).toEqual([page1.id, page2.id]);
    });

    test('accepts missing rows and converts amino/ghost cells safely', () => {
        const raw = {
            pages: [[[1, 10, 999]]],
            comments: ['comment'],
            actions: [{ piece: 8, rotation: 0, loc: 0 }],
        };
        const parsed = parseTetgramRawData(JSON.stringify(raw));

        expect('error' in parsed).toBe(false);
        if ('error' in parsed) return;
        expect(parsed.pages[0].field.obj!.get(0, 21)).toBe(Piece.Gray);
        expect(parsed.pages[0].field.obj!.get(1, 21)).toBe(Piece.Empty);
        expect(parsed.pages[0].piece).toBeUndefined();
    });

    test('returns null tree for raw data without a layout', () => {
        const parsed = parseTetgramRawData(JSON.stringify({ pages: [[[]]] }));
        expect('error' in parsed).toBe(false);
        if ('error' in parsed) return;
        expect(parsed.tree).toBeNull();
    });
});

describe('looksLikeTetgramRawData', () => {
    test('recognizes JSON RawData without requiring pretty printing', () => {
        expect(looksLikeTetgramRawData('{"pages":[]}')).toBe(true);
        expect(looksLikeTetgramRawData('v115@vhAAgH')).toBe(false);
        expect(looksLikeTetgramRawData('{"comments":[]}')).toBe(false);
    });
});
