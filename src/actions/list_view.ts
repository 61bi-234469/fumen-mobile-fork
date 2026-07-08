import { NextState, sequence } from './commons';
import { action, actions, main } from '../actions';
import { Screens } from '../lib/enums';
import { resources, State } from '../states';
import { PageFieldOperation, Pages } from '../lib/pages';
import { OperationTask, PrimitivePage, toInsertPageTask, toPage, toPrimitivePage } from '../history_task';
import { generateKey } from '../lib/random';
import { Page } from '../lib/fumen/types';
import { Field } from '../lib/fumen/field';
import {
    downloadBlob,
    downloadImage,
    generateListViewExportImage,
    generateTreeViewExportImage,
} from '../lib/thumbnail';
import { generateGifBlob } from '../lib/gif_export';
import { decode, encode } from '../lib/fumen/fumen';
import { SerializedTree, TreeViewMode } from '../lib/fumen/tree_types';
import { persistViewSettings } from './view_settings';
import {
    createTreeFromPages,
    embedTreeInPages,
    ensureVirtualRoot,
    extractTreeFromPages,
    findNode,
    findNodeByPageIndex,
    getPathToNode,
    isVirtualNode,
    removeTreeFromComment,
} from '../lib/fumen/tree_utils';

declare const M: any;

type ClipboardImportMode = 'import' | 'add';

interface ParsedClipboardInput {
    fumen: string;
    treeParam?: boolean;
    treeViewMode?: TreeViewMode;
}

const parseBooleanParam = (value: string | undefined): boolean | undefined => {
    if (value === undefined) {
        return undefined;
    }
    const normalized = value.toLowerCase();
    if (normalized === '1' || normalized === 'true') {
        return true;
    }
    if (normalized === '0' || normalized === 'false') {
        return false;
    }
    return undefined;
};

const parseTreeViewModeParam = (value: string | undefined): TreeViewMode | undefined => {
    if (!value) {
        return undefined;
    }
    const normalized = value.toLowerCase();
    if (normalized === 'tree') {
        return TreeViewMode.Tree;
    }
    if (normalized === 'list') {
        return TreeViewMode.List;
    }
    return undefined;
};

const safeDecodeURIComponent = (value: string): string => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

const parseClipboardParams = (raw: string): ParsedClipboardInput | null => {
    if (!/[?#].*d=/.test(raw)) {
        return null;
    }
    const parseParams = (paramString: string): ParsedClipboardInput | null => {
        const params = new URLSearchParams(paramString);
        const dParam = params.get('d');
        if (!dParam) {
            return null;
        }
        return {
            fumen: safeDecodeURIComponent(dParam),
            treeParam: parseBooleanParam(params.get('tree') ?? undefined),
            treeViewMode: parseTreeViewModeParam(params.get('treeView') ?? undefined),
        };
    };

    const hashIndex = raw.indexOf('#');
    if (hashIndex >= 0) {
        let hash = raw.slice(hashIndex + 1);
        if (hash.startsWith('?')) {
            hash = hash.slice(1);
        }
        const parsed = parseParams(hash);
        if (parsed) {
            return parsed;
        }
    }

    const queryIndex = raw.indexOf('?');
    if (queryIndex >= 0) {
        const query = raw.slice(queryIndex + 1);
        return parseParams(query);
    }

    return null;
};

const parseClipboardInput = (value: string): ParsedClipboardInput | null => {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    try {
        const url = new URL(trimmed);
        const hash = url.hash.startsWith('#?') ? url.hash.slice(2) : url.hash.replace(/^#/, '');
        const hashParams = new URLSearchParams(hash);
        const searchParams = url.searchParams;
        const getParam = (key: string) => hashParams.get(key) ?? searchParams.get(key);
        const dParam = getParam('d');
        if (dParam) {
            return {
                fumen: safeDecodeURIComponent(dParam),
                treeParam: parseBooleanParam(getParam('tree') ?? undefined),
                treeViewMode: parseTreeViewModeParam(getParam('treeView') ?? undefined),
            };
        }
    } catch {
        // Not a URL; fall through
    }

    const parsedParams = parseClipboardParams(trimmed);
    if (parsedParams) {
        return parsedParams;
    }

    const fumenMatch = trimmed.match(/[vdVDmM](?:110|115)@[a-zA-Z0-9+/?]+/);
    if (!fumenMatch) {
        return null;
    }

    return { fumen: fumenMatch[0] };
};

const offsetTreeIndices = (tree: SerializedTree, offset: number): SerializedTree => {
    return {
        ...tree,
        nodes: tree.nodes.map(node => ({
            ...node,
            childrenIds: [...node.childrenIds],
            pageIndex: node.pageIndex >= 0 ? node.pageIndex + offset : node.pageIndex,
        })),
    };
};

const mergeIndependentTrees = (
    baseTree: SerializedTree,
    incomingTree: SerializedTree,
    offset: number,
): SerializedTree => {
    const normalizedBase = ensureVirtualRoot(baseTree);
    const normalizedIncoming = ensureVirtualRoot(incomingTree);
    if (!normalizedBase.rootId) {
        return offsetTreeIndices(normalizedIncoming, offset);
    }

    const baseRootId = normalizedBase.rootId;
    const baseNodes = normalizedBase.nodes.map(node => ({
        ...node,
        childrenIds: [...node.childrenIds],
    }));
    const baseRoot = baseNodes.find(node => node.id === baseRootId);
    if (!baseRoot) {
        return normalizedBase;
    }

    const offsetIncomingNodes = normalizedIncoming.nodes.map(node => ({
        ...node,
        childrenIds: [...node.childrenIds],
        pageIndex: node.pageIndex >= 0 ? node.pageIndex + offset : node.pageIndex,
    }));
    const incomingRoot = offsetIncomingNodes.find(node => node.id === normalizedIncoming.rootId);
    if (!incomingRoot) {
        return normalizedBase;
    }

    let incomingTopLevelIds: string[] = [];
    let incomingNodesToAdd = offsetIncomingNodes;

    if (isVirtualNode(incomingRoot)) {
        incomingTopLevelIds = [...incomingRoot.childrenIds];
        incomingNodesToAdd = offsetIncomingNodes
            .filter(node => node.id !== incomingRoot.id)
            .map(node => (incomingTopLevelIds.includes(node.id)
                ? { ...node, parentId: baseRootId }
                : node));
    } else {
        incomingTopLevelIds = [incomingRoot.id];
        incomingNodesToAdd = offsetIncomingNodes.map(node => (node.id === incomingRoot.id
            ? { ...node, parentId: baseRootId }
            : node));
    }

    const updatedBaseNodes = baseNodes.map(node => (node.id === baseRootId
        ? { ...node, childrenIds: [...node.childrenIds, ...incomingTopLevelIds] }
        : node));

    return {
        ...normalizedBase,
        nodes: [...updatedBaseNodes, ...incomingNodesToAdd],
        rootId: baseRootId,
    };
};

export interface ListViewActions {
    changeToEditorFromListView: () => action;
    setListViewDragState: (data: { draggingIndex: number | null; dropTargetIndex: number | null }) => action;
    setListViewScale: (data: { scale: number }) => action;
    setListViewTrimTopBlank: (data: { enabled: boolean }) => action;
    setListViewSettingsOpened: (data: { opened: boolean }) => action;
    setListViewShortenUrls: (data: { enabled: boolean }) => action;
    reorderPage: (data: { fromIndex: number; toSlotIndex: number }) => action;
    updatePageComment: (data: { pageIndex: number; comment: string }) => action;
    navigateToPageFromListView: (data: { pageIndex: number }) => action;
    exportListViewAsImage: () => action;
    exportListViewAsGif: () => action;
    exportListViewAsUrl: () => action;
    exportLeftSegmentAsUrl: () => action;
    copyListViewUrlToClipboard: () => action;
    exportLeftSegmentAsImage: () => action;
    exportLeftSegmentAsGif: () => action;
    setExportScope: (data: { scope: 'all' | 'left' }) => action;
    openListViewInFumenZui: () => action;
    openListViewInFumenForMobile: () => action;
    openListViewInExternalSite: () => action;
    copyLeftSegmentToClipboard: () => action;
    replaceAllComments: (data: { searchText: string; replaceText: string }) => action;
    importPagesFromClipboard: (data: { mode: ClipboardImportMode }) => action;
    addPagesFromClipboard: (data: {
        pages: Page[];
        treeEnabledParam?: boolean;
        treeViewModeParam?: TreeViewMode;
    }) => action;
}

const createTimestampedImageFileName = (prefix: string, extension: 'png' | 'gif' = 'png'): string => {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const ss = String(now.getSeconds()).padStart(2, '0');
    return `${prefix}_${yyyy}_${mm}_${dd}_${hh}${min}${ss}.${extension}`;
};

const copyTextToClipboard = (text: string): boolean => {
    const element = document.createElement('pre');
    element.style.position = 'fixed';
    element.style.left = '-100%';
    element.textContent = text;
    document.body.appendChild(element);

    try {
        const selection = document.getSelection();
        if (!selection) {
            return false;
        }
        selection.selectAllChildren(element);
        return document.execCommand('copy');
    } finally {
        document.body.removeChild(element);
    }
};

const openGeneratedUrl = (url: string, shortenUrls: boolean): void => {
    if (shortenUrls) {
        const params = new URLSearchParams();
        params.set('url', url);
        window.open(`https://tinyurl.com/create.php?${params.toString()}`, '_blank');
        return;
    }
    window.open(url, '_blank');
};

const showToast = (html: string, displayLength: number = 1500): void => {
    M.toast({ html, displayLength, classes: 'top-toast' });
};

// Resolve the tree to embed for export, mirroring the previous per-callsite hasTreeData logic exactly.
const getExportTree = (state: Readonly<State>): SerializedTree | null => {
    const hasTreeData = state.tree.enabled && state.tree.nodes.length > 0 && state.tree.rootId !== null;
    if (hasTreeData) {
        return { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 1 as const };
    }
    return state.tree.enabled ? createTreeFromPages(state.fumen.pages) : null;
};

// Resolve the pages to encode, honoring exportScope('left') for tree-enabled exports.
const resolvePagesToEncode = (state: Readonly<State>): { pages: Page[] } | { error: string } => {
    if (state.tree.enabled && state.listView.exportScope === 'left') {
        return extractRootToActiveSegmentPages(state);
    }
    return { pages: embedTreeInPages(state.fumen.pages, getExportTree(state), state.tree.enabled) };
};

const buildShareParams = (
    state: Readonly<State>,
    encoded: string,
    opts: { includeTreeParams: boolean },
): URLSearchParams => {
    const params = new URLSearchParams();
    params.set('d', `v115@${encoded}`);
    params.set('screen', 'list');
    if (opts.includeTreeParams) {
        params.set('tree', state.tree.enabled ? '1' : '0');
        params.set('treeView', state.tree.viewMode === TreeViewMode.Tree ? 'tree' : 'list');
    } else {
        params.set('tree', '0');
    }
    return params;
};

export const extractRootToActiveSegmentPages = (state: Readonly<State>): { pages: Page[] } | { error: string } => {
    const tree: SerializedTree = {
        nodes: state.tree.nodes,
        rootId: state.tree.rootId,
        version: 1 as const,
    };

    let activeNode = state.tree.activeNodeId
        ? findNode(tree, state.tree.activeNodeId)
        : undefined;
    if (!activeNode) {
        activeNode = findNodeByPageIndex(tree, state.fumen.currentIndex);
    }
    if (!activeNode) {
        return { error: 'Cannot resolve active node' };
    }

    const pathIds = getPathToNode(tree, activeNode.id);
    const chainNodes = pathIds
        .map(id => findNode(tree, id))
        .filter((node): node is NonNullable<typeof activeNode> => node !== undefined && !isVirtualNode(node));

    if (chainNodes.length === 0) {
        return { error: 'No nodes in chain' };
    }

    const allPages = state.fumen.pages;
    const pagesObj = new Pages(allPages);
    const extractedPages: Page[] = [];

    for (const node of chainNodes) {
        const page = allPages[node.pageIndex];
        if (!page) {
            return { error: `Page not found at index ${node.pageIndex}` };
        }

        let resolvedField: Page['field'];
        try {
            resolvedField = { obj: pagesObj.getField(node.pageIndex, PageFieldOperation.None) };
        } catch {
            return { error: 'Failed to resolve field reference' };
        }

        let resolvedComment = page.comment;
        if (page.comment.ref !== undefined) {
            let refIndex: number | undefined = page.comment.ref;
            let resolvedText: string | undefined;
            while (refIndex !== undefined) {
                const refPage: Page | undefined = allPages[refIndex];
                if (refPage && refPage.comment.text !== undefined) {
                    resolvedText = refPage.comment.text;
                    break;
                }
                refIndex = refPage?.comment.ref;
            }
            if (resolvedText === undefined) {
                return { error: 'Failed to resolve comment reference' };
            }
            resolvedComment = { text: resolvedText };
        }

        extractedPages.push({
            ...page,
            field: resolvedField,
            comment: resolvedComment,
        });
    }

    const originalFirstColorize = extractedPages[0]?.flags.colorize ?? true;
    const originalFirstSrs = extractedPages[0]?.flags.srs ?? true;
    const reindexedPages: Page[] = extractedPages.map((page, i) => ({
        ...page,
        index: i,
        flags: i === 0
            ? { ...page.flags, colorize: originalFirstColorize, srs: originalFirstSrs }
            : page.flags,
    }));

    const cleanedPages: Page[] = reindexedPages.map((page) => {
        if (page.comment.text !== undefined) {
            return {
                ...page,
                comment: { text: removeTreeFromComment(page.comment.text) },
            };
        }
        return page;
    });

    return { pages: cleanedPages };
};

export const toReorderPageTask = (
    fromIndex: number,
    toSlotIndex: number,
    primitivePrevPages: PrimitivePage[],
): OperationTask => {
    // Calculate actual target index from slot
    const actualTargetIndex = fromIndex < toSlotIndex
        ? toSlotIndex - 1
        : toSlotIndex;

    return {
        replay: (pages: Page[]) => {
            const newPages = reorderPagesInternal([...pages], fromIndex, actualTargetIndex);
            return { pages: newPages, index: actualTargetIndex };
        },
        revert: (pages: Page[]) => {
            return { pages: primitivePrevPages.map(toPage), index: fromIndex };
        },
        fixed: false,
        key: generateKey(),
    };
};

function reorderPagesInternal(pages: Page[], fromIndex: number, toIndex: number): Page[] {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
        return pages;
    }

    // 元の最初のページのcolorizeフラグを保存
    const originalFirstPageColorize = pages[0]?.flags.colorize ?? true;
    const originalFirstPageSrs = pages[0]?.flags.srs ?? true;

    const [movedPage] = pages.splice(fromIndex, 1);

    // toIndex is already adjusted by the caller (reorderPage action)
    // so no additional adjustment is needed here
    pages.splice(toIndex, 0, movedPage);

    return rebuildPageRefs(pages, originalFirstPageColorize, originalFirstPageSrs);
}

function rebuildPageRefs(
    pages: Page[],
    originalFirstPageColorize: boolean,
    originalFirstPageSrs: boolean,
): Page[] {
    const oldIndexToNewIndex = new Map<number, number>();
    pages.forEach((page, newIndex) => {
        oldIndexToNewIndex.set(page.index, newIndex);
    });

    return pages.map((page, newIndex) => {
        const newPage = { ...page, index: newIndex };

        // 最初のページのcolorizeフラグを元の値に維持する
        // （テト譜の仕様により、最初のページのflagsが全体に反映されるため）
        if (newIndex === 0) {
            newPage.flags = {
                ...page.flags,
                colorize: originalFirstPageColorize,
                srs: originalFirstPageSrs,
            };
        }

        if (page.field.ref !== undefined) {
            const mappedRef = oldIndexToNewIndex.get(page.field.ref);
            if (mappedRef !== undefined && mappedRef < newIndex) {
                newPage.field = { ...page.field, ref: mappedRef };
            } else {
                // Resolve the field reference before reorder using oldIndexToNewIndex
                // We need to find the actual field by following the ref chain
                let resolvedField: import('../lib/fumen/field').Field | undefined;
                let refIndex: number | undefined = page.field.ref;
                while (refIndex !== undefined) {
                    const refPage = pages.find(p => oldIndexToNewIndex.get(p.index) !== undefined &&
                        p.index === refIndex);
                    if (refPage && refPage.field.obj) {
                        resolvedField = refPage.field.obj.copy();
                        break;
                    }
                    refIndex = refPage?.field.ref;
                }
                if (resolvedField) {
                    newPage.field = { obj: resolvedField };
                } else {
                    // Fallback: create empty field if resolution fails
                    newPage.field = { obj: new Field({}) };
                }
            }
        }

        if (page.comment.ref !== undefined) {
            const mappedRef = oldIndexToNewIndex.get(page.comment.ref);
            if (mappedRef !== undefined && mappedRef < newIndex) {
                newPage.comment = { ...page.comment, ref: mappedRef };
            } else {
                // Resolve the comment reference before reorder using oldIndexToNewIndex
                // We need to find the actual comment by following the ref chain
                let resolvedText: string | undefined;
                let refIndex: number | undefined = page.comment.ref;
                while (refIndex !== undefined) {
                    const refPage = pages.find(p => p.index === refIndex);
                    if (refPage && refPage.comment.text !== undefined) {
                        resolvedText = refPage.comment.text;
                        break;
                    }
                    refIndex = refPage?.comment.ref;
                }
                newPage.comment = { text: resolvedText ?? '' };
            }
        }

        return newPage;
    });
}

export const listViewActions: Readonly<ListViewActions> = {
    changeToEditorFromListView: () => (state): NextState => {
        if (resources.konva.stage.isReady) {
            resources.konva.stage.reload((done) => {
                main.changeScreen({ screen: Screens.Editor });
                done();
            });
        } else {
            main.changeScreen({ screen: Screens.Editor });
        }
        // Keep current index (do not reset to 0) - tree mode may have set a specific page
        return sequence(state, [
            actions.reopenCurrentPage(),
        ]);
    },
    setListViewDragState: ({ draggingIndex, dropTargetIndex }) => (state): NextState => {
        return {
            listView: {
                ...state.listView,
                dragState: {
                    draggingIndex,
                    dropTargetIndex,
                },
            },
        };
    },
    setListViewScale: ({ scale }) => (state): NextState => {
        const clampedScale = Math.max(0.5, Math.min(3.0, scale));
        return {
            listView: {
                ...state.listView,
                scale: clampedScale,
            },
        };
    },
    setListViewSettingsOpened: ({ opened }) => (state): NextState => {
        if (state.listView.settingsOpened === opened) {
            return undefined;
        }
        return {
            listView: {
                ...state.listView,
                settingsOpened: opened,
            },
        };
    },
    setListViewTrimTopBlank: ({ enabled }) => (state): NextState => {
        if (state.listView.trimTopBlank === enabled) {
            return undefined;
        }

        persistViewSettings(state, { trimTopBlank: enabled });
        return {
            listView: {
                ...state.listView,
                trimTopBlank: enabled,
            },
        };
    },
    reorderPage: ({ fromIndex, toSlotIndex }) => (state): NextState => {
        if (state.tree.enabled) {
            return {
                listView: {
                    ...state.listView,
                    dragState: {
                        draggingIndex: null,
                        dropTargetIndex: null,
                    },
                },
            };
        }

        // Calculate actual target index from slot
        // Slot N means "insert at position N after removal"
        // If fromIndex < toSlotIndex, after removal the slot index shifts by -1
        const actualTargetIndex = fromIndex < toSlotIndex
            ? toSlotIndex - 1
            : toSlotIndex;

        if (fromIndex === actualTargetIndex) {
            return undefined;
        }

        const primitivePrevPages = state.fumen.pages.map(toPrimitivePage);

        const newPages = reorderPagesInternal([...state.fumen.pages], fromIndex, actualTargetIndex);

        const task = toReorderPageTask(fromIndex, toSlotIndex, primitivePrevPages);

        return sequence(state, [
            actions.registerHistoryTask({ task }),
            () => ({
                fumen: {
                    ...state.fumen,
                    pages: newPages,
                    currentIndex: actualTargetIndex,
                },
                listView: {
                    ...state.listView,
                    dragState: {
                        draggingIndex: null,
                        dropTargetIndex: null,
                    },
                },
            }),
        ]);
    },
    updatePageComment: ({ pageIndex, comment }) => (state): NextState => {
        const pages = [...state.fumen.pages];
        const pagesObj = new Pages(pages);
        pagesObj.setComment(pageIndex, comment);

        return {
            fumen: {
                ...state.fumen,
                pages: pagesObj.pages,
            },
        };
    },
    navigateToPageFromListView: ({ pageIndex }) => (state): NextState => {
        if (resources.konva.stage.isReady) {
            resources.konva.stage.reload((done) => {
                main.changeScreen({ screen: Screens.Editor });
                done();
            });
        } else {
            main.changeScreen({ screen: Screens.Editor });
        }
        return sequence(state, [
            () => ({
                fumen: {
                    ...state.fumen,
                    currentIndex: pageIndex,
                },
            }),
            actions.reopenCurrentPage(),
        ]);
    },
    exportListViewAsImage: () => (state): NextState => {
        // Check if tree mode is enabled and showing tree view
        const isTreeView = state.tree.enabled && state.tree.viewMode === TreeViewMode.Tree;

        let dataURL: string;
        let filenamePrefix: string;

        if (isTreeView) {
            // Export tree view
            const tree = {
                nodes: state.tree.nodes,
                rootId: state.tree.rootId,
                version: 1 as const,
            };
            dataURL = generateTreeViewExportImage(
                state.fumen.pages,
                state.fumen.guideLineColor,
                tree,
                state.listView.trimTopBlank,
            );
            filenamePrefix = 'fumen_tree';
        } else {
            // Export list view
            dataURL = generateListViewExportImage(
                state.fumen.pages,
                state.fumen.guideLineColor,
                state.listView.trimTopBlank,
            );
            filenamePrefix = 'fumen_list';
        }

        if (dataURL) {
            const filename = createTimestampedImageFileName(filenamePrefix);
            downloadImage(dataURL, filename);
        }

        return undefined;
    },
    exportListViewAsGif: () => (state): NextState => {
        const blob = generateGifBlob(
            state.fumen.pages,
            state.fumen.guideLineColor,
            state.listView.trimTopBlank,
            state.mode.gifFrameDelayMs,
        );

        if (blob) {
            const filename = createTimestampedImageFileName('fumen_gif', 'gif');
            downloadBlob(blob, filename);
        }

        return undefined;
    },
    exportListViewAsUrl: () => (state): NextState => {
        (async () => {
            try {
                const pagesToEncode = embedTreeInPages(state.fumen.pages, getExportTree(state), state.tree.enabled);
                const encoded = await encode(pagesToEncode);

                const params = buildShareParams(state, encoded, { includeTreeParams: true });
                const base = `${window.location.origin}${window.location.pathname}`;
                const url = `${base}#?${params.toString()}`;
                openGeneratedUrl(url, state.listView.shortenUrls);
            } catch (error) {
                console.error(error);
                showToast(`Failed to export URL: ${error}`);
            }
        })();

        return undefined;
    },
    exportLeftSegmentAsUrl: () => (state): NextState => {
        (async () => {
            try {
                const segment = extractRootToActiveSegmentPages(state);
                if ('error' in segment) {
                    showToast(segment.error);
                    return;
                }

                // 6. Encode (no tree embedding)
                const encoded = await encode(segment.pages);

                const params = buildShareParams(state, encoded, { includeTreeParams: false });
                const base = `${window.location.origin}${window.location.pathname}`;
                const url = `${base}#?${params.toString()}`;
                openGeneratedUrl(url, state.listView.shortenUrls);
            } catch (error) {
                console.error(error);
                showToast(`Failed to export URL: ${error}`);
            }
        })();

        return undefined;
    },
    copyListViewUrlToClipboard: () => (state): NextState => {
        (async () => {
            try {
                const isLeftScope = state.tree.enabled && state.listView.exportScope === 'left';
                const resolved = resolvePagesToEncode(state);
                if ('error' in resolved) {
                    showToast(resolved.error);
                    return;
                }

                const encoded = await encode(resolved.pages);
                const params = buildShareParams(state, encoded, { includeTreeParams: !isLeftScope });

                const base = `${window.location.origin}${window.location.pathname}`;
                const url = `${base}#?${params.toString()}`;
                if (state.listView.shortenUrls) {
                    openGeneratedUrl(url, true);
                } else if (copyTextToClipboard(url)) {
                    showToast('Copied share URL', 1000);
                } else {
                    showToast('Failed to copy');
                }
            } catch (error) {
                console.error(error);
                showToast(`Failed to copy URL: ${error}`);
            }
        })();

        return undefined;
    },
    exportLeftSegmentAsImage: () => (state): NextState => {
        const segment = extractRootToActiveSegmentPages(state);
        if ('error' in segment) {
            showToast(segment.error);
            return undefined;
        }

        const dataURL = generateListViewExportImage(
            segment.pages,
            state.fumen.guideLineColor,
            state.listView.trimTopBlank,
        );

        if (dataURL) {
            const filename = createTimestampedImageFileName('fumen_list_active');
            downloadImage(dataURL, filename);
        }

        return undefined;
    },
    exportLeftSegmentAsGif: () => (state): NextState => {
        const segment = extractRootToActiveSegmentPages(state);
        if ('error' in segment) {
            showToast(segment.error);
            return undefined;
        }

        const blob = generateGifBlob(
            segment.pages,
            state.fumen.guideLineColor,
            state.listView.trimTopBlank,
            state.mode.gifFrameDelayMs,
        );

        if (blob) {
            const filename = createTimestampedImageFileName('fumen_gif_active', 'gif');
            downloadBlob(blob, filename);
        }

        return undefined;
    },
    setExportScope: ({ scope }) => (state): NextState => {
        return {
            listView: {
                ...state.listView,
                exportScope: scope,
            },
        };
    },
    setListViewShortenUrls: ({ enabled }) => (state): NextState => {
        if (state.listView.shortenUrls === enabled) {
            return undefined;
        }

        persistViewSettings(state, { shortenUrls: enabled });
        return {
            listView: {
                ...state.listView,
                shortenUrls: enabled,
            },
        };
    },
    openListViewInFumenZui: () => (state): NextState => {
        (async () => {
            try {
                const resolved = resolvePagesToEncode(state);
                if ('error' in resolved) {
                    showToast(resolved.error);
                    return;
                }

                const encoded = await encode(resolved.pages);
                openGeneratedUrl(`https://fumen.zui.jp/?v115@${encoded}`, state.listView.shortenUrls);
            } catch (error) {
                console.error(error);
                showToast(`Failed to open: ${error}`);
            }
        })();

        return undefined;
    },
    openListViewInFumenForMobile: () => (state): NextState => {
        (async () => {
            try {
                const resolved = resolvePagesToEncode(state);
                if ('error' in resolved) {
                    showToast(resolved.error);
                    return;
                }

                const encoded = await encode(resolved.pages);
                openGeneratedUrl(
                    `https://knewjade.github.io/fumen-for-mobile/#?d=v115@${encoded}`,
                    state.listView.shortenUrls,
                );
            } catch (error) {
                console.error(error);
                showToast(`Failed to open: ${error}`);
            }
        })();

        return undefined;
    },
    openListViewInExternalSite: () => (state): NextState => {
        (async () => {
            try {
                const resolved = resolvePagesToEncode(state);
                if ('error' in resolved) {
                    showToast(resolved.error);
                    return;
                }

                const encoded = await encode(resolved.pages);
                const url = `https://fumen.zui.jp/?D115@${encoded}`;
                openGeneratedUrl(url, state.listView.shortenUrls);
            } catch (error) {
                console.error(error);
                showToast(`Failed to open: ${error}`);
            }
        })();

        return undefined;
    },
    copyLeftSegmentToClipboard: () => (state): NextState => {
        const segment = extractRootToActiveSegmentPages(state);
        if ('error' in segment) {
            showToast(segment.error);
            return undefined;
        }

        // 独立したページ列のため tree 埋め込みは行わない
        (async () => {
            try {
                const encoded = await encode(segment.pages);
                const url = `v115@${encoded}`;

                if (copyTextToClipboard(url)) {
                    showToast(`Copied ${segment.pages.length} pages`, 1000);
                } else {
                    showToast('Failed to copy');
                }
            } catch (error) {
                showToast(`Failed to copy: ${error}`);
            }
        })();

        return undefined;
    },
    replaceAllComments: ({ searchText, replaceText }) => (state): NextState => {
        if (!searchText) {
            return undefined;
        }

        const pages = [...state.fumen.pages];
        const pagesObj = new Pages(pages);

        for (let i = 0; i < pages.length; i += 1) {
            const commentResult = pagesObj.getComment(i);
            let currentText = '';
            if ('text' in commentResult) {
                currentText = commentResult.text;
            } else if ('quiz' in commentResult) {
                currentText = commentResult.quiz;
            }

            if (currentText.includes(searchText)) {
                const newText = currentText.split(searchText).join(replaceText);
                pagesObj.setComment(i, newText);
            }
        }

        return {
            fumen: {
                ...state.fumen,
                pages: pagesObj.pages,
            },
        };
    },
    addPagesFromClipboard: ({ pages, treeEnabledParam, treeViewModeParam }) => (state): NextState => {
        if (pages.length === 0) {
            return undefined;
        }

        const { cleanedPages, tree } = extractTreeFromPages(pages);
        const normalizedImportedTree = tree ? ensureVirtualRoot(tree) : null;

        const insertIndex = state.fumen.pages.length;
        const pagesObj = new Pages([...state.fumen.pages]);
        pagesObj.insertPage(insertIndex, cleanedPages);
        const newPages = pagesObj.pages;

        const hasExistingTreeData = state.tree.rootId !== null && state.tree.nodes.length > 0;
        const shouldUseTree = hasExistingTreeData
            || normalizedImportedTree !== null
            || state.tree.enabled
            || treeEnabledParam === true;

        const baseTree: SerializedTree | null = hasExistingTreeData
            ? {
                nodes: state.tree.nodes,
                rootId: state.tree.rootId,
                version: 1 as const,
            }
            : (shouldUseTree ? createTreeFromPages(state.fumen.pages) : null);

        let incomingTree: SerializedTree | null = normalizedImportedTree;
        if (!incomingTree && shouldUseTree) {
            incomingTree = createTreeFromPages(cleanedPages);
        }

        let mergedTree: SerializedTree | null = null;
        if (shouldUseTree && incomingTree) {
            if (baseTree && baseTree.nodes.length > 0 && baseTree.rootId) {
                mergedTree = mergeIndependentTrees(baseTree, incomingTree, insertIndex);
            } else {
                mergedTree = offsetTreeIndices(ensureVirtualRoot(incomingTree), insertIndex);
            }
        } else if (baseTree) {
            mergedTree = ensureVirtualRoot(baseTree);
        }

        let treeState = state.tree;
        if (mergedTree) {
            const normalizedMerged = ensureVirtualRoot(mergedTree);
            const currentNode = findNodeByPageIndex(normalizedMerged, insertIndex);
            treeState = {
                ...state.tree,
                enabled: true,
                nodes: normalizedMerged.nodes,
                rootId: normalizedMerged.rootId,
                activeNodeId: currentNode?.id ?? state.tree.activeNodeId,
            };
        }

        if (treeEnabledParam !== undefined) {
            treeState = {
                ...treeState,
                enabled: treeEnabledParam,
            };
        }

        if (treeViewModeParam !== undefined) {
            treeState = {
                ...treeState,
                viewMode: treeViewModeParam,
            };
        }

        const primitiveNexts = cleanedPages.map(toPrimitivePage);
        const task = toInsertPageTask(insertIndex, primitiveNexts, state.fumen.currentIndex);

        return sequence(state, [
            actions.registerHistoryTask({ task }),
            () => ({
                fumen: {
                    ...state.fumen,
                    pages: newPages,
                    maxPage: newPages.length,
                    currentIndex: insertIndex,
                },
                tree: treeState,
            }),
            actions.reopenCurrentPage(),
        ]);
    },
    importPagesFromClipboard: ({ mode }) => (state): NextState => {
        (async () => {
            try {
                // Read text from clipboard
                const text = await navigator.clipboard.readText();

                const parsedInput = parseClipboardInput(text);
                if (!parsedInput) {
                    showToast('No fumen data in clipboard');
                    return;
                }

                const fumenData = parsedInput.fumen;

                // Decode (decode function supports v/d/D/V/m/M formats)
                const decodedPages = await decode(fumenData);
                const { tree: importedTree } = extractTreeFromPages(decodedPages);
                const hasImportedTree = importedTree !== null && importedTree.nodes.length > 0;
                const treeEnabledParam = !state.tree.enabled && hasImportedTree ? true : parsedInput.treeParam;
                const treeViewModeParam = parsedInput.treeViewMode;

                if (mode === 'import') {
                    // Replace all pages
                    main.loadPages({
                        treeEnabledParam,
                        treeViewModeParam,
                        pages: decodedPages,
                        loadedFumen: fumenData,
                    });
                    const msg = `Replaced with ${decodedPages.length} pages`;
                    showToast(msg, 1000);
                    return;
                }

                // Add as independent tree
                main.addPagesFromClipboard({
                    treeEnabledParam,
                    treeViewModeParam,
                    pages: decodedPages,
                });
                const msg = `Added ${decodedPages.length} pages`;
                showToast(msg, 1000);
            } catch (error) {
                console.error(error);
                showToast(`Failed to import: ${error}`);
            }
        })();

        // Close the modal
        return sequence(state, [
            actions.closeListViewMenuModal(),
        ]);
    },
};
