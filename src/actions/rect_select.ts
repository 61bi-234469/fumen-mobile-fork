import { action, actions } from '../actions';
import { NextState, sequence } from './commons';
import { ModeTypes, Piece, TouchTypes } from '../lib/enums';
import { buildGoalField, containsPoint, extractCells, mirrorCells, normalizeRect, Rect } from '../lib/parts';
import { PageFieldOperation, Pages, parseToCommands } from '../lib/pages';
import {
    OperationTask,
    toFreezeCommentTask,
    toKeyPageTask,
    toPageTaskStack,
    toPrimitivePage,
    toSinglePageTask,
} from '../history_task';
import { State } from '../states';
import { persistViewSettings } from './view_settings';

export interface RectSelectActions {
    startRectSelectMode(): action;
    toggleRectSelectMenu(): action;
    exitRectSelectMode(): action;
    cancelRectSelect(): action;
    commitRectSelect(): action;
    mirrorSelection(): action;
    deleteSelection(): action;
    rectSelectTouchStart(data: { index: number }): action;
    rectSelectTouchMove(data: { index: number }): action;
    rectSelectTouchEnd(): action;
    setFloatingMenuEnabled(data: { enabled: boolean }): action;
    setFloatingMenuPosition(data: { position: { x: number, y: number } | null, persist?: boolean }): action;
    setFloatingMenuScale(data: { scale: number, persist?: boolean }): action;
    toggleSpawnAsParts(): action;
}

const emptyRectSelect = (): State['rectSelect'] => ({
    phase: 'none', dragAnchor: null, rect: null, floating: null, moveAnchor: null,
});

const currentField = (state: State) => new Pages(state.fumen.pages)
    .getField(state.fumen.currentIndex, PageFieldOperation.Command);

const rectFromFloating = (floating: NonNullable<State['rectSelect']['floating']>): Rect => ({
    minX: floating.x,
    minY: floating.y,
    maxX: floating.x + floating.width - 1,
    maxY: floating.y + floating.height - 1,
});

const commitEdit = (edit: Parameters<typeof buildGoalField>[1]) => (state: State): NextState => {
    const currentIndex = state.fumen.currentIndex;
    const pages = state.fumen.pages;
    const pagesObj = new Pages(pages);
    const tasks: OperationTask[] = [];
    const page = pages[currentIndex];
    if (!page) return { rectSelect: emptyRectSelect() };

    if (page.field.obj === undefined) {
        pagesObj.toKeyPage(currentIndex);
        tasks.push(toKeyPageTask(currentIndex));
    }
    if (page.comment.ref !== undefined) {
        pagesObj.freezeComment(currentIndex);
        tasks.push(toFreezeCommentTask(currentIndex));
    }
    const primitivePage = toPrimitivePage(page);
    const initField = pagesObj.getField(currentIndex, PageFieldOperation.Command);
    const goalField = buildGoalField(initField, edit);
    if (tasks.length === 0 && initField.equals(goalField)) return { rectSelect: emptyRectSelect() };

    const prevField = pagesObj.getField(currentIndex, PageFieldOperation.None);
    page.commands = parseToCommands(prevField, goalField);
    tasks.push(toSinglePageTask(currentIndex, primitivePage, page));
    return sequence(state, [
        actions.registerHistoryTask({ task: toPageTaskStack(tasks, currentIndex) }),
        () => ({ fumen: { ...state.fumen, pages: [...pages] }, rectSelect: emptyRectSelect() }),
        actions.reopenCurrentPage(),
    ]);
};

const liftSelection = (state: State) => {
    const rect = state.rectSelect.rect;
    if (!rect) return null;
    const width = rect.maxX - rect.minX + 1;
    const height = rect.maxY - rect.minY + 1;
    return {
        width, height, cells: extractCells(currentField(state), rect),
        x: rect.minX, y: rect.minY, sourceRect: rect,
    };
};

export const rectSelectActions: Readonly<RectSelectActions> = {
    startRectSelectMode: () => (state): NextState => sequence(state, [
        actions.removeUnsettledItems(),
        () => ({
            mode: { ...state.mode, type: ModeTypes.Select, touch: TouchTypes.Select, piece: undefined },
            floatingMenu: { ...state.floatingMenu, enabled: true },
        }),
    ]),
    toggleRectSelectMenu: () => (state): NextState => ({
        floatingMenu: {
            ...state.floatingMenu,
            enabled: !state.floatingMenu.enabled,
        },
    }),
    exitRectSelectMode: () => (state): NextState => ({
        rectSelect: emptyRectSelect(),
        mode: { ...state.mode, type: ModeTypes.DrawingTool, touch: TouchTypes.Drawing, piece: undefined },
    }),
    cancelRectSelect: () => (): NextState => ({ rectSelect: emptyRectSelect() }),
    commitRectSelect: () => (state): NextState => {
        const floating = state.rectSelect.floating;
        if (!floating) return { rectSelect: emptyRectSelect() };
        return commitEdit({
            clearRect: floating.sourceRect,
            place: { ...floating, blackTransparent: state.mode.blackTransparentPaste },
        })(state);
    },
    mirrorSelection: () => (state): NextState => {
        const floating = state.rectSelect.floating || liftSelection(state);
        if (!floating) return undefined;
        return {
            rectSelect: {
                ...state.rectSelect,
                phase: 'floating',
                floating: { ...floating, cells: mirrorCells(floating.cells, floating.width, floating.height) },
                rect: rectFromFloating(floating),
                moveAnchor: null,
            },
        };
    },
    deleteSelection: () => (state): NextState => {
        if (state.rectSelect.floating && !state.rectSelect.floating.sourceRect) {
            return { rectSelect: emptyRectSelect() };
        }
        const clearRect = state.rectSelect.floating
            ? state.rectSelect.floating.sourceRect : state.rectSelect.rect;
        return clearRect ? commitEdit({ clearRect })(state) : undefined;
    },
    rectSelectTouchStart: ({ index }) => (state): NextState => {
        const point = { x: index % 10, y: Math.floor(index / 10) };
        const selectedPart = state.parts.items.find(part => part.id === state.parts.selectedId);
        if (selectedPart && state.rectSelect.phase === 'none') {
            const x = point.x - Math.floor(selectedPart.width / 2);
            const y = point.y - Math.floor(selectedPart.height / 2);
            return {
                rectSelect: {
                    phase: 'floating', dragAnchor: null,
                    rect: { minX: x, minY: y, maxX: x + selectedPart.width - 1, maxY: y + selectedPart.height - 1 },
                    floating: { ...selectedPart, x, y, sourceRect: null },
                    moveAnchor: { dx: point.x - x, dy: point.y - y },
                },
            };
        }
        const floating = state.rectSelect.floating;
        if (floating) {
            const rect = rectFromFloating(floating);
            if (!containsPoint(rect, point.x, point.y)) return rectSelectActions.commitRectSelect()(state);
            return {
                rectSelect: {
                    ...state.rectSelect,
                    moveAnchor: { dx: point.x - floating.x, dy: point.y - floating.y },
                },
            };
        }
        if (state.rectSelect.phase === 'selected' && state.rectSelect.rect
            && containsPoint(state.rectSelect.rect, point.x, point.y)) {
            const lifted = liftSelection(state)!;
            return {
                rectSelect: {
                    ...state.rectSelect, phase: 'floating', floating: lifted,
                    moveAnchor: { dx: point.x - lifted.x, dy: point.y - lifted.y },
                },
            };
        }
        return {
            rectSelect: {
                phase: 'selecting', dragAnchor: point, rect: normalizeRect(point, point),
                floating: null, moveAnchor: null,
            },
        };
    },
    rectSelectTouchMove: ({ index }) => (state): NextState => {
        const point = { x: index % 10, y: Math.floor(index / 10) };
        if (state.rectSelect.phase === 'selecting' && state.rectSelect.dragAnchor) {
            return { rectSelect: { ...state.rectSelect, rect: normalizeRect(state.rectSelect.dragAnchor, point) } };
        }
        if (state.rectSelect.phase === 'floating' && state.rectSelect.floating && state.rectSelect.moveAnchor) {
            const x = point.x - state.rectSelect.moveAnchor.dx;
            const y = point.y - state.rectSelect.moveAnchor.dy;
            const floating = { ...state.rectSelect.floating, x, y };
            return { rectSelect: { ...state.rectSelect, floating, rect: rectFromFloating(floating) } };
        }
        return undefined;
    },
    rectSelectTouchEnd: () => (state): NextState => {
        if (state.rectSelect.phase === 'selecting') {
            return { rectSelect: { ...state.rectSelect, phase: 'selected', dragAnchor: null } };
        }
        if (state.rectSelect.phase === 'floating') {
            return { rectSelect: { ...state.rectSelect, moveAnchor: null } };
        }
        return undefined;
    },
    setFloatingMenuEnabled: ({ enabled }) => (state): NextState => ({
        floatingMenu: { ...state.floatingMenu, enabled },
    }),
    setFloatingMenuPosition: ({ position, persist = true }) => (state): NextState => {
        if (persist) persistViewSettings(state, { rectFloatingMenuPosition: position });
        return { floatingMenu: { ...state.floatingMenu, position } };
    },
    setFloatingMenuScale: ({ scale, persist = true }) => (state): NextState => {
        const nextScale = Math.max(0.75, Math.min(1.25, scale));
        if (persist) persistViewSettings(state, { rectFloatingMenuScale: nextScale });
        return { floatingMenu: { ...state.floatingMenu, scale: nextScale } };
    },
    toggleSpawnAsParts: () => (state): NextState => ({
        floatingMenu: { ...state.floatingMenu, spawnAsParts: !state.floatingMenu.spawnAsParts },
    }),
};
