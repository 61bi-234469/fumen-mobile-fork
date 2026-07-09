import { Field } from '../field';
import { Page } from '../types';
import {
    createTreeFromPages,
    embedTreeInPages,
    extractTreeFromPages,
    isVirtualNode,
    removeTreeFromComment,
    serializeTreeToComment,
    parseTreeFromComment,
} from '../tree_utils';

const defaultFlags = {
    lock: false,
    mirror: false,
    colorize: true,
    rise: false,
    quiz: false,
};

const createPages = (): Page[] => [
    {
        index: 0,
        field: { obj: new Field({}) },
        comment: { text: 'hello' },
        flags: { ...defaultFlags },
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

describe('#TREE= comment round trip', () => {
    test('serialize then parse preserves node count, virtual root, and parent/child pageIndex relationships', () => {
        const tree = createTreeFromPages(createPages());
        const serialized = serializeTreeToComment(tree);
        const parsed = parseTreeFromComment(serialized);

        expect(parsed).not.toBeNull();
        const parsedTree = parsed!;

        expect(parsedTree.nodes).toHaveLength(4);

        const root = parsedTree.nodes.find(n => n.id === parsedTree.rootId);
        expect(root).toBeDefined();
        expect(isVirtualNode(root!)).toBe(true);
        expect(root!.pageIndex).toBe(-1);

        const byPageIndex = (pageIndex: number) => parsedTree.nodes.find(n => n.pageIndex === pageIndex);
        const original = tree;
        const originalByPageIndex = (pageIndex: number) => original.nodes.find(n => n.pageIndex === pageIndex);

        [0, 1, 2].forEach((pageIndex) => {
            const parsedNode = byPageIndex(pageIndex);
            const originalNode = originalByPageIndex(pageIndex);
            expect(parsedNode).toBeDefined();
            expect(originalNode).toBeDefined();

            const parsedParent = parsedNode!.parentId
                ? parsedTree.nodes.find(n => n.id === parsedNode!.parentId)
                : null;
            const originalParent = originalNode!.parentId
                ? original.nodes.find(n => n.id === originalNode!.parentId)
                : null;
            expect(parsedParent?.pageIndex).toBe(originalParent?.pageIndex);

            const parsedChildPageIndices = parsedNode!.childrenIds
                .map(id => parsedTree.nodes.find(n => n.id === id)?.pageIndex)
                .sort();
            const originalChildPageIndices = originalNode!.childrenIds
                .map(id => original.nodes.find(n => n.id === id)?.pageIndex)
                .sort();
            expect(parsedChildPageIndices).toEqual(originalChildPageIndices);
        });
    });

    test('embedTreeInPages appends #TREE= and extractTreeFromPages cleanly removes it', () => {
        const pages = createPages();
        const tree = createTreeFromPages(pages);

        const embeddedPages = embedTreeInPages(pages, tree, true);
        expect(embeddedPages[0].comment.text).toMatch(/^hello\n#TREE=/);

        const { cleanedPages, tree: extractedTree } = extractTreeFromPages(embeddedPages);
        expect(cleanedPages[0].comment.text).toBe('hello');
        expect(extractedTree).not.toBeNull();
    });

    test('removeTreeFromComment is a no-op when there is no #TREE= marker', () => {
        expect(removeTreeFromComment('hello')).toBe('hello');
    });
});
