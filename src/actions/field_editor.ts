import { isMinoPiece, Piece, Rotation, toPositionIndex, TouchTypes } from '../lib/enums';
import { action, actions } from '../actions';
import { NextState, sequence } from './commons';
import { putPieceActions } from './put_piece';
import { drawBlockActions } from './draw_block';
import { fillActions } from './fill';
import { toPrimitivePage, toSinglePageTask } from '../history_task';
import { movePieceActions } from './move_piece';
import { PageFieldOperation, Pages, resolvePageCommentText } from '../lib/pages';
import { testLeftRotation, testRightRotation } from '../lib/srs';
import { classicTestLeftRotation, classicTestRightRotation } from '../lib/classic_rotation';
import { test180Rotation, testLeftRotationSrsPlus, testRightRotationSrsPlus } from '../lib/srs_plus';
import { fillRowActions } from './fill_row';
import {
    coldClearActions,
    createRandomSevenBagQueue,
    fillInfiniteQueueToMinimum,
    getCurrentColdClearQueueComment,
} from './cold_clear';
import { ViewError } from '../lib/errors';
import { Field } from '../lib/fumen/field';
import { State } from '../states';
import { createSpawnMove, getBlockPositions } from '../lib/piece';
import { shouldReturnCurrentPieceOnRightClick } from './field_editor_right_click';
import { intermediateCellIndices } from '../lib/grid_line';
import { legacyModeForPaintTool } from '../lib/editor_interaction';
import { activeSelectionRect, isIndexInRect } from '../lib/rect_selection';
import { buildQueueStateComment, parseQueueStateComment } from '../lib/cold_clear/queueParser';
import { activateDasCut, cutDasHolds } from '../lib/piece_das';
import { withInputRotationEvidence } from '../lib/comment_metadata';
import { computeInputStats, toCommentCombo } from '../lib/input_stats';

export interface FieldEditorActions {
    fixInferencePiece(): action;

    clearInferencePiece(): action;

    resetInferencePiece(): action;

    removeUnsettledItemsInField(): action;

    ontouchStartField(data: { index: number }): action;

    ontouchMoveField(data: { index: number }): action;

    ontouchEnd(): action;

    ontouchStartSentLine(data: { index: number }): action;

    ontouchMoveSentLine(data: { index: number }): action;

    resetFieldTouchTrail(): action;

    onrightStartField(data: { index: number }): action;

    onrightMoveField(data: { index: number }): action;

    onrightEnd(): action;

    onrightStartSentLine(data: { index: number }): action;

    onrightMoveSentLine(data: { index: number }): action;

    selectPieceColor(data: { piece: Piece }): action;

    selectFillPieceColor(data: { piece: Piece }): action;

    selectInferencePieceColor(): action;

    // historyBoundaryをfalseにすると、INPUT + NEXTキューのキュー単位Undoの巻き戻し先にならない。
    // HOLD入れ替えのように、同じキュー単位の中でカレントを差し替えるだけの操作で使う。
    spawnPiece(data: { piece: Piece, srs: boolean, historyBoundary?: boolean }): action;

    clearPiece(): action;

    resetPiece(): action;

    clearFieldAndPiece(): action;

    resetFieldAndPiece(): action;

    rotateToLeft(): action;

    rotateToRight(): action;

    rotateTo180(): action;

    moveToLeft(): action;

    moveToLeftEnd(): action;

    moveToRight(): action;

    moveToRightEnd(): action;

    softdrop(): action;
    softdropStep(): action;

    harddrop(): action;

    spawnNextPieceFromColdClearQueue(): action;
}

// Right-click is an eraser in every primary tool. Area erase (fill / fillRow) only
// follows the paint tool inside PAINT, where the user can see which tool is armed.
// SELECT and PIECE always erase a single cell so a right-click cannot wipe a region
// by surprise.
export const getRightClickOverride = (state: State): { touch: TouchTypes; piece: Piece } => ({
    touch: state.editorUi?.primaryTool === 'paint'
        ? legacyModeForPaintTool(state.editorUi.paintTool).touch
        : TouchTypes.Drawing,
    piece: Piece.Empty,
});

// A selection — a settled rect, a moved preview, or a part preview — is a single
// deletable object for the eraser, exactly like the SPAWN mino: touching it deletes
// the whole thing rather than the cell under the pointer.
export const isSelectionCell = (state: State, index: number): boolean => {
    if (state.rectSelect === undefined) {
        return false;
    }
    const rect = activeSelectionRect(state.rectSelect);
    return rect !== null && isIndexInRect(index, rect);
};

// COMP leftovers: while an inference set has not resolved into a mino, its cells render
// as white 'inference' blocks. They live in `events.inferences`, not in the field, so the
// eraser override cannot reach them.
export const isInferenceDebrisCell = (state: State, index: number): boolean => (
    state.field[index]?.piece === 'inference'
);

const eraseInferenceDebris = (index: number) => (state: State): NextState => {
    if (!isInferenceDebrisCell(state, index)) {
        return undefined;
    }
    return sequence(state, [
        () => ({
            events: {
                ...state.events,
                inferences: state.events.inferences.filter(e => e !== index),
            },
        }),
        actions.openPage({ index: state.fumen.currentIndex }),
    ]);
};

const setRightStroke = (rightStroke: 'erase' | 'suppressed' | undefined) => (state: State): NextState => {
    if (state.events.rightStroke === rightStroke) {
        return undefined;
    }
    return { events: { ...state.events, rightStroke } };
};

// Wrapper to run an action with overridden mode (for right-click erase). The
// stroke marker is re-applied to the result so delegated actions that rebuild
// `events` cannot drop it mid-stroke.
const runWithOverride = (
    state: State,
    actionFn: (s: State) => NextState,
): NextState => {
    const override = getRightClickOverride(state);
    const patched: State = {
        ...state,
        mode: { ...state.mode, touch: override.touch, piece: override.piece },
        events: { ...state.events, rightStroke: 'erase' },
    };
    const next = actionFn(patched);
    if (next === undefined || next.events === undefined) {
        return next;
    }
    return { ...next, events: { ...next.events, rightStroke: 'erase' } };
};

const FIELD_GRID_WIDTH = 10;
const clearLastPieceManipulation = (state: State) => ({
    events: { ...state.events, lastPieceManipulation: undefined },
});
const dispatchTouchMoveField = (index: number) => (state: State): NextState => {
    // The eraser drag deletes the SPAWN mino and the selection it passes over, whether it
    // comes from the paint tool or from a right-click in any primary tool.
    const erasing = state.editorUi?.primaryTool === 'paint' || state.events.rightStroke === 'erase';
    if (erasing && state.mode.deleteSpawnMinoOnPaintDrag && state.mode.piece === Piece.Empty) {
        const removals: (action | undefined)[] = [
            isSelectionCell(state, index) ? actions.deleteSelectionUnderEraser() : undefined,
            isSpawnMinoCell(state, index) ? actions.clearPiece() : undefined,
        ];
        if (removals.some(removal => removal !== undefined)) {
            return sequence(state, removals);
        }
    }
    if (state.events.pieceDragFromPaint) {
        return movePieceActions.ontouchMoveField({ index })(state);
    }
    switch (state.mode.touch) {
    case TouchTypes.Drawing:
        return drawBlockActions.ontouchMoveField({ index })(state);
    case TouchTypes.Piece:
        return putPieceActions.ontouchMoveField({ index })(state);
    case TouchTypes.MovePiece:
        return movePieceActions.ontouchMoveField({ index })(state);
    case TouchTypes.FillRow:
        return fillRowActions.ontouchMoveField({ index })(state);
    case TouchTypes.Fill:
        return fillActions.ontouchMoveField({ index })(state);
    case TouchTypes.Select:
        return actions.moveRectSelection({ index })(state);
    }
    return undefined;
};

// Callers decide whether the current stroke may act on the SPAWN mino; this only
// answers whether the cell belongs to it with no field block underneath.
const isSpawnMinoCell = (state: State, index: number): boolean => {
    const piece = state.fumen.pages[state.fumen.currentIndex]?.piece;
    if (piece === undefined || !isMinoPiece(piece.type)) {
        return false;
    }
    const rawField = new Pages(state.fumen.pages)
        .getField(state.fumen.currentIndex, PageFieldOperation.Command);
    if (rawField.getAtIndex(index, true) !== Piece.Empty) {
        return false;
    }
    return getBlockPositions(
        piece.type,
        piece.rotation,
        piece.coordinate.x,
        piece.coordinate.y,
    ).some(position => toPositionIndex(position) === index);
};

const restorePaintTouchState = (state: State): NextState => ({
    mode: {
        ...state.mode,
        touch: legacyModeForPaintTool(state.editorUi.paintTool).touch,
    },
    events: {
        ...state.events,
        pieceDragFromPaint: false,
    },
});

const dispatchTouchMoveSentLine = (index: number) => (state: State): NextState => {
    switch (state.mode.touch) {
    case TouchTypes.Drawing:
        return drawBlockActions.ontouchMoveSentLine({ index })(state);
    case TouchTypes.FillRow:
        return fillRowActions.ontouchMoveSentLine({ index })(state);
    case TouchTypes.Fill:
        return fillActions.ontouchMoveSentLine({ index })(state);
    }
    return undefined;
};

// Stroke interpolation targets the block pen (Drawing with a selected piece,
// including the right-click erase override) and row fill. Inference drawing
// (4-cell set semantics), piece move, and flood fill keep per-cell events only.
const shouldInterpolateStroke = (state: State): boolean => {
    if (state.events.piece === undefined) {
        return false;
    }
    switch (state.mode.touch) {
    case TouchTypes.Drawing:
        return state.mode.piece !== undefined;
    case TouchTypes.FillRow:
        return true;
    }
    return false;
};

const setTouchTrail = (
    field: number | undefined,
    sentLine: number | undefined,
) => (state: State): NextState => {
    if (state.events.lastTouchedIndex === field && state.events.lastTouchedSentIndex === sentLine) {
        return undefined;
    }
    return {
        events: {
            ...state.events,
            lastTouchedIndex: field,
            lastTouchedSentIndex: sentLine,
        },
    };
};

export const fieldEditorActions: Readonly<FieldEditorActions> = {
    fixInferencePiece: () => (state): NextState => {
        switch (state.mode.touch) {
        case TouchTypes.Drawing:
            return drawBlockActions.fixInferencePiece()(state);
        case TouchTypes.Piece:
            return putPieceActions.fixInferencePiece()(state);
        }
        return undefined;
    },
    clearInferencePiece: () => (state): NextState => {
        switch (state.mode.touch) {
        case TouchTypes.Drawing:
            return drawBlockActions.clearInferencePiece()(state);
        case TouchTypes.Piece:
            return putPieceActions.clearInferencePiece()(state);
        }
        return undefined;
    },
    resetInferencePiece: () => (state): NextState => {
        switch (state.mode.touch) {
        case TouchTypes.Drawing:
            return drawBlockActions.resetInferencePiece()(state);
        case TouchTypes.Piece:
            return putPieceActions.resetInferencePiece()(state);
        }
        return undefined;
    },
    removeUnsettledItemsInField: () => (state): NextState => {
        return sequence(state, [
            fieldEditorActions.fixInferencePiece(),
            fieldEditorActions.resetInferencePiece(),
            actions.cancelRectSelectionPreview(),
        ]);
    },
    ontouchStartField: ({ index }) => (state): NextState => {
        const dispatch = (newState: State): NextState => {
            // The paint eraser deletes a selection it is tapped on, like the SPAWN mino below.
            // SELECT keeps its own left-click behaviour (grab and move the selection).
            if (newState.editorUi?.primaryTool === 'paint'
                && newState.mode.piece === Piece.Empty
                && isSelectionCell(newState, index)) {
                return actions.deleteSelectionUnderEraser()(newState);
            }
            // Left-click keeps the SPAWN mino tap/drag shortcut inside the paint tool only.
            // Right-click handles the SPAWN mino itself in onrightStartField.
            if (newState.editorUi?.primaryTool === 'paint' && isSpawnMinoCell(newState, index)) {
                if (newState.mode.piece === Piece.Empty) {
                    return actions.clearPiece()(newState);
                }
                return movePieceActions.ontouchStartField({ index })({
                    ...newState,
                    mode: {
                        ...newState.mode,
                        touch: TouchTypes.MovePiece,
                    },
                    events: {
                        ...newState.events,
                        pieceDragFromPaint: true,
                    },
                });
            }
            switch (newState.mode.touch) {
            case TouchTypes.Drawing:
                return drawBlockActions.ontouchStartField({ index })(newState);
            case TouchTypes.Piece:
                if (newState.editorUi.pieceAction === 'spawn') {
                    return sequence(newState, [
                        actions.spawnPiece({
                            piece: newState.editorUi.lastMino,
                            srs: newState.mode.rotationSystem !== 'classic',
                        }),
                        actions.changePieceAction({ pieceAction: 'drag' }),
                    ]);
                }
                return putPieceActions.ontouchStartField({ index })(newState);
            case TouchTypes.MovePiece:
                return movePieceActions.ontouchStartField({ index })(newState);
            case TouchTypes.FillRow:
                return fillRowActions.ontouchStartField({ index })(newState);
            case TouchTypes.Fill:
                return fillActions.ontouchStartField({ index })(newState);
            case TouchTypes.Select:
                return actions.startRectSelection({ index })(newState);
            }
            return undefined;
        };

        // A stale trail or right-stroke marker (e.g. a lost mouseup) must never bridge
        // into a new stroke. Both setters no-op when there is nothing to clear.
        return sequence(state, [
            setTouchTrail(undefined, undefined),
            setRightStroke(undefined),
            dispatch,
        ]);
    },
    ontouchMoveField: ({ index }) => (state): NextState => {
        if (!shouldInterpolateStroke(state) || state.events.lastTouchedIndex === index) {
            return dispatchTouchMoveField(index)(state);
        }

        // Fast pointers skip cells between events; replay the same edit on the
        // Bresenham line from the previous cell so strokes have no gaps.
        const last = state.events.lastTouchedIndex;
        const intermediates = last !== undefined
            ? intermediateCellIndices(last, index, FIELD_GRID_WIDTH)
            : [];
        return sequence(state, [
            ...intermediates.map(dispatchTouchMoveField),
            dispatchTouchMoveField(index),
            setTouchTrail(index, undefined),
        ]);
    },
    ontouchEnd: () => (state): NextState => {
        const dispatch = (newState: State): NextState => {
            if (newState.events.pieceDragFromPaint) {
                return sequence(newState, [
                    movePieceActions.ontouchEnd(),
                    restorePaintTouchState,
                ]);
            }
            switch (newState.mode.touch) {
            case TouchTypes.Drawing:
                return drawBlockActions.ontouchEnd()(newState);
            case TouchTypes.Piece:
                return putPieceActions.ontouchEnd()(newState);
            case TouchTypes.MovePiece:
                return movePieceActions.ontouchEnd()(newState);
            case TouchTypes.FillRow:
                return fillRowActions.ontouchEnd()(newState);
            case TouchTypes.Fill:
                return fillActions.ontouchEnd()(newState);
            case TouchTypes.Select:
                return actions.endRectSelection()(newState);
            }
            return undefined;
        };

        if (state.events.lastTouchedIndex === undefined && state.events.lastTouchedSentIndex === undefined) {
            return dispatch(state);
        }
        return sequence(state, [
            dispatch,
            setTouchTrail(undefined, undefined),
        ]);
    },
    ontouchStartSentLine: ({ index }) => (state): NextState => {
        const dispatch = (newState: State): NextState => {
            switch (newState.mode.touch) {
            case TouchTypes.Drawing:
                return drawBlockActions.ontouchStartSentLine({ index })(newState);
            case TouchTypes.FillRow:
                return fillRowActions.ontouchStartSentLine({ index })(newState);
            case TouchTypes.Fill:
                return fillActions.ontouchStartSentLine({ index })(newState);
            }
            return undefined;
        };

        return sequence(state, [
            setTouchTrail(undefined, undefined),
            setRightStroke(undefined),
            dispatch,
        ]);
    },
    ontouchMoveSentLine: ({ index }) => (state): NextState => {
        if (!shouldInterpolateStroke(state) || state.events.lastTouchedSentIndex === index) {
            return dispatchTouchMoveSentLine(index)(state);
        }

        const last = state.events.lastTouchedSentIndex;
        const intermediates = last !== undefined
            ? intermediateCellIndices(last, index, FIELD_GRID_WIDTH)
            : [];
        return sequence(state, [
            ...intermediates.map(dispatchTouchMoveSentLine),
            dispatchTouchMoveSentLine(index),
            setTouchTrail(undefined, index),
        ]);
    },
    resetFieldTouchTrail: () => (state): NextState => {
        return setTouchTrail(undefined, undefined)(state);
    },
    // Right-click follows one policy in every primary tool (PAINT / SELECT / PIECE):
    // inside a selection it cancels the preview or deletes the settled rect, otherwise it
    // returns the SPAWN mino to the queue or erases.
    onrightStartField: ({ index }) => (state): NextState => {
        if (isSelectionCell(state, index)) {
            return sequence(state, [
                setRightStroke('suppressed'),
                actions.deleteSelectionUnderEraser(),
            ]);
        }
        // Only when the clicked cell is part of the SPAWN mino AND has no underlying field
        // block. Normal blocks take priority: if a field block exists beneath the SPAWN
        // mino, erase it instead.
        const page = state.fumen.pages[state.fumen.currentIndex];
        if (page?.piece && isMinoPiece(page.piece.type)) {
            const rawField = new Pages(state.fumen.pages)
                .getField(state.fumen.currentIndex, PageFieldOperation.Command);
            const rawPiece = rawField.getAtIndex(index, true);
            if (shouldReturnCurrentPieceOnRightClick(rawPiece, page.piece, index)) {
                return sequence(state, [
                    setRightStroke('erase'),
                    coldClearActions.returnCurrentPieceToQueue(),
                ]);
            }
        }
        return sequence(state, [
            setRightStroke('erase'),
            eraseInferenceDebris(index),
            newState => runWithOverride(newState, (patchedState) => {
                return fieldEditorActions.ontouchStartField({ index })(patchedState);
            }),
        ]);
    },
    onrightMoveField: ({ index }) => (state): NextState => {
        if (state.events.rightStroke === 'suppressed') {
            return undefined;
        }
        return sequence(state, [
            setRightStroke('erase'),
            eraseInferenceDebris(index),
            newState => runWithOverride(newState, (patchedState) => {
                return fieldEditorActions.ontouchMoveField({ index })(patchedState);
            }),
        ]);
    },
    onrightEnd: () => (state): NextState => {
        if (state.events.rightStroke === 'suppressed') {
            return setRightStroke(undefined)(state);
        }
        return sequence(state, [
            newState => runWithOverride(newState, (patchedState) => {
                return fieldEditorActions.ontouchEnd()(patchedState);
            }),
            setRightStroke(undefined),
        ]);
    },
    onrightStartSentLine: ({ index }) => (state): NextState => {
        return sequence(state, [
            setRightStroke('erase'),
            newState => runWithOverride(newState, (patchedState) => {
                return fieldEditorActions.ontouchStartSentLine({ index })(patchedState);
            }),
        ]);
    },
    onrightMoveSentLine: ({ index }) => (state): NextState => {
        return sequence(state, [
            setRightStroke('erase'),
            newState => runWithOverride(newState, (patchedState) => {
                return fieldEditorActions.ontouchMoveSentLine({ index })(patchedState);
            }),
        ]);
    },
    selectPieceColor: ({ piece }) => (state): NextState => {
        return sequence(state, [
            actions.removeUnsettledItems(),
            newState => ({
                mode: {
                    ...newState.mode,
                    piece,
                    touch: TouchTypes.Drawing,
                },
            }),
        ]);
    },
    selectFillPieceColor: ({ piece }) => (state): NextState => {
        return sequence(state, [
            actions.removeUnsettledItems(),
            newState => ({
                mode: {
                    ...newState.mode,
                    piece,
                },
            }),
        ]);
    },
    selectInferencePieceColor: () => (state): NextState => {
        return sequence(state, [
            actions.removeUnsettledItems(),
            newState => ({
                mode: {
                    ...newState.mode,
                    piece: undefined,
                    touch: TouchTypes.Drawing,
                },
            }),
        ]);
    },
    spawnPiece: ({ piece, srs, historyBoundary = true }) => (state): NextState => {
        if (piece === Piece.Gray || piece === Piece.Empty) {
            throw new ViewError(`Unsupported piece: ${piece}`);
        }

        const pages = state.fumen.pages;
        const pageIndex = state.fumen.currentIndex;
        const page = pages[pageIndex];
        if (page === undefined) {
            return undefined;
        }

        const next = createSpawnMove(piece, srs);

        const currentMove = page.piece;
        if (currentMove !== undefined
            && currentMove.type === next.type
            && currentMove.rotation === next.rotation
            && currentMove.coordinate.x === next.coordinate.x
            && currentMove.coordinate.y === next.coordinate.y
        ) {
            return sequence(state, [
                fieldEditorActions.resetInferencePiece(),
            ]);
        }

        const prevPage = toPrimitivePage(page);
        page.piece = next;
        activateDasCut(state.mode.pieceShortcutDasCutFrames);

        return sequence(state, [
            fieldEditorActions.resetInferencePiece(),
            // INPUT + NEXTキューのキュー単位Undoは、この履歴エントリを巻き戻し先の境界として使う
            actions.registerHistoryTask({
                task: toSinglePageTask(pageIndex, prevPage, page),
                pieceSpawn: historyBoundary,
            }),
            actions.reopenCurrentPage(),
        ]);
    },
    clearPiece: () => (state): NextState => {
        const pages = state.fumen.pages;
        const pageIndex = state.fumen.currentIndex;
        const page = pages[pageIndex];
        if (page === undefined) {
            return undefined;
        }

        if (page.piece === undefined) {
            return fieldEditorActions.resetInferencePiece()(state);
        }

        const prevPage = toPrimitivePage(page);
        page.piece = undefined;

        return sequence(state, [
            fieldEditorActions.resetInferencePiece(),
            actions.registerHistoryTask({ task: toSinglePageTask(pageIndex, prevPage, page) }),
            actions.reopenCurrentPage(),
        ]);
    },
    resetPiece: () => (state): NextState => {
        const page = state.fumen.pages[state.fumen.currentIndex];
        const piece = page?.piece?.type;
        const spawnPiece = piece !== undefined && piece !== Piece.Empty && piece !== Piece.Gray
            ? piece
            : state.editorUi.lastMino;
        return sequence(state, [
            actions.spawnPiece({
                piece: spawnPiece,
                srs: state.mode.rotationSystem !== 'classic',
            }),
            nextState => ({
                editorUi: {
                    ...nextState.editorUi,
                    pieceAction: 'drag',
                    lastMino: spawnPiece,
                },
            }),
        ]);
    },
    clearFieldAndPiece: () => (state): NextState => {
        return sequence(state, [
            actions.clearField(),
            fieldEditorActions.clearPiece(),
        ]);
    },
    resetFieldAndPiece: () => (state): NextState => {
        const pageIndex = state.fumen.currentIndex;
        const page = state.fumen.pages[pageIndex];
        if (page === undefined) {
            return undefined;
        }

        if (!state.editorUi.infinitePieceQueue) {
            return sequence(state, [
                actions.commitCommentText(),
                actions.clearFieldAndPiece(),
            ]);
        }

        const randomQueue = createRandomSevenBagQueue();
        const current = randomQueue.current as State['editorUi']['lastMino'];
        const queueComment = randomQueue.comment;

        return sequence(state, [
            actions.commitCommentText(),
            actions.clearFieldAndPiece(),
            actions.setCommentText({ pageIndex, text: queueComment }),
            actions.spawnPiece({
                piece: current,
                srs: state.mode.rotationSystem !== 'classic',
            }),
            actions.changePieceAction({ pieceAction: 'drag' }),
            nextState => ({
                editorUi: {
                    ...nextState.editorUi,
                    lastMino: current,
                },
            }),
        ]);
    },
    rotateToLeft: () => (state): NextState => {
        const pages = state.fumen.pages;
        const pageIndex = state.fumen.currentIndex;
        const page = pages[pageIndex];
        if (page === undefined) {
            return undefined;
        }

        const piece = page.piece;
        if (piece === undefined) {
            return undefined;
        }

        const pagesObj = new Pages(pages);
        const field = pagesObj.getField(pageIndex, PageFieldOperation.Command);

        const rotationSystem = state.mode.rotationSystem;
        const testObj = rotationSystem === 'classic'
            ? classicTestLeftRotation(piece.type, piece.rotation, field, piece.coordinate.x, piece.coordinate.y)
            : rotationSystem === 'srsPlus'
                ? testLeftRotationSrsPlus(piece.type, piece.rotation)
                : testLeftRotation(piece.type, piece.rotation);
        const nextRotation = testObj.rotation;
        const test = testCallback(field, piece.type, nextRotation);

        const coordinate = piece.coordinate;
        const testPositions = testObj.test.map((value) => {
            return [value[0] + coordinate.x, value[1] + coordinate.y];
        });

        const kickIndex = testPositions.findIndex(position => test(position[0], position[1]));
        if (kickIndex === -1) {
            return undefined;
        }
        const element = testPositions[kickIndex];

        const prevPage = toPrimitivePage(page);
        page.piece = {
            ...piece,
            rotation: nextRotation,
            coordinate: {
                x: element[0],
                y: element[1],
            },
        };
        cutDasHolds(state.mode.pieceShortcutDasCutFrames);

        return sequence(state, [
            fieldEditorActions.resetInferencePiece(),
            () => ({ events: { ...state.events, lastPieceManipulation: { kickIndex, direction: 'ccw' } } }),
            actions.registerHistoryTask({ task: toSinglePageTask(pageIndex, prevPage, page) }),
            actions.reopenCurrentPage(),
        ]);
    },
    rotateToRight: () => (state): NextState => {
        const pages = state.fumen.pages;
        const pageIndex = state.fumen.currentIndex;
        const page = pages[pageIndex];
        if (page === undefined) {
            return undefined;
        }

        const piece = page.piece;
        if (piece === undefined) {
            return undefined;
        }

        const pagesObj = new Pages(pages);
        const field = pagesObj.getField(pageIndex, PageFieldOperation.Command);

        const rotationSystem = state.mode.rotationSystem;
        const testObj = rotationSystem === 'classic'
            ? classicTestRightRotation(piece.type, piece.rotation, field, piece.coordinate.x, piece.coordinate.y)
            : rotationSystem === 'srsPlus'
                ? testRightRotationSrsPlus(piece.type, piece.rotation)
                : testRightRotation(piece.type, piece.rotation);
        const nextRotation = testObj.rotation;
        const test = testCallback(field, piece.type, nextRotation);

        const coordinate = piece.coordinate;
        const testPositions = testObj.test.map((value) => {
            return [value[0] + coordinate.x, value[1] + coordinate.y];
        });

        const kickIndex = testPositions.findIndex(position => test(position[0], position[1]));
        if (kickIndex === -1) {
            return undefined;
        }
        const element = testPositions[kickIndex];

        const prevPage = toPrimitivePage(page);
        page.piece = {
            ...piece,
            rotation: nextRotation,
            coordinate: {
                x: element[0],
                y: element[1],
            },
        };
        cutDasHolds(state.mode.pieceShortcutDasCutFrames);

        return sequence(state, [
            fieldEditorActions.resetInferencePiece(),
            () => ({ events: { ...state.events, lastPieceManipulation: { kickIndex, direction: 'cw' } } }),
            actions.registerHistoryTask({ task: toSinglePageTask(pageIndex, prevPage, page) }),
            actions.reopenCurrentPage(),
        ]);
    },
    rotateTo180: () => (state): NextState => {
        if (state.mode.rotationSystem !== 'srsPlus') {
            return undefined;
        }

        const pages = state.fumen.pages;
        const pageIndex = state.fumen.currentIndex;
        const page = pages[pageIndex];
        if (page === undefined) {
            return undefined;
        }

        const piece = page.piece;
        if (piece === undefined) {
            return undefined;
        }

        const pagesObj = new Pages(pages);
        const field = pagesObj.getField(pageIndex, PageFieldOperation.Command);

        const testObj = test180Rotation(piece.type, piece.rotation);
        const nextRotation = testObj.rotation;
        const test = testCallback(field, piece.type, nextRotation);

        const coordinate = piece.coordinate;
        const testPositions = testObj.test.map((value) => {
            return [value[0] + coordinate.x, value[1] + coordinate.y];
        });

        const kickIndex = testPositions.findIndex(position => test(position[0], position[1]));
        if (kickIndex === -1) {
            return undefined;
        }
        const element = testPositions[kickIndex];

        const prevPage = toPrimitivePage(page);
        page.piece = {
            ...piece,
            rotation: nextRotation,
            coordinate: {
                x: element[0],
                y: element[1],
            },
        };
        cutDasHolds(state.mode.pieceShortcutDasCutFrames);

        return sequence(state, [
            fieldEditorActions.resetInferencePiece(),
            () => ({ events: { ...state.events, lastPieceManipulation: { kickIndex, direction: '180' } } }),
            actions.registerHistoryTask({ task: toSinglePageTask(pageIndex, prevPage, page) }),
            actions.reopenCurrentPage(),
        ]);
    },
    moveToLeft: () => (state): NextState => {
        const pages = state.fumen.pages;
        const pageIndex = state.fumen.currentIndex;
        const page = pages[pageIndex];
        if (page === undefined) {
            return undefined;
        }

        const piece = page.piece;
        if (piece === undefined) {
            return undefined;
        }

        const pagesObj = new Pages(pages);
        const field = pagesObj.getField(pageIndex, PageFieldOperation.Command);

        const test = testCallback(field, piece.type, piece.rotation);

        const coordinate = piece.coordinate;
        if (!test(coordinate.x - 1, coordinate.y)) {
            return undefined;
        }

        const prevPage = toPrimitivePage(page);
        page.piece = {
            ...piece,
            coordinate: {
                x: coordinate.x - 1,
                y: coordinate.y,
            },
        };

        return sequence(state, [
            fieldEditorActions.resetInferencePiece(),
            clearLastPieceManipulation,
            actions.registerHistoryTask({ task: toSinglePageTask(pageIndex, prevPage, page) }),
            actions.reopenCurrentPage(),
        ]);
    },
    moveToLeftEnd: () => (state): NextState => {
        const pages = state.fumen.pages;
        const pageIndex = state.fumen.currentIndex;
        const page = pages[pageIndex];
        if (page === undefined) {
            return undefined;
        }

        const piece = page.piece;
        if (piece === undefined) {
            return undefined;
        }

        const pagesObj = new Pages(pages);
        const field = pagesObj.getField(pageIndex, PageFieldOperation.Command);

        const test = testCallback(field, piece.type, piece.rotation);

        const coordinate = piece.coordinate;
        let x = coordinate.x;
        while (test(x - 1, coordinate.y)) {
            x -= 1;
        }

        if (x === coordinate.x) {
            return undefined;
        }

        const prevPage = toPrimitivePage(page);
        page.piece = {
            ...piece,
            coordinate: {
                x,
                y: coordinate.y,
            },
        };

        return sequence(state, [
            fieldEditorActions.resetInferencePiece(),
            clearLastPieceManipulation,
            actions.registerHistoryTask({ task: toSinglePageTask(pageIndex, prevPage, page) }),
            actions.reopenCurrentPage(),
        ]);
    },
    moveToRight: () => (state): NextState => {
        const pages = state.fumen.pages;
        const pageIndex = state.fumen.currentIndex;
        const page = pages[pageIndex];
        if (page === undefined) {
            return undefined;
        }

        const piece = page.piece;
        if (piece === undefined) {
            return undefined;
        }

        const pagesObj = new Pages(pages);
        const field = pagesObj.getField(pageIndex, PageFieldOperation.Command);

        const test = testCallback(field, piece.type, piece.rotation);

        const coordinate = piece.coordinate;
        if (!test(coordinate.x + 1, coordinate.y)) {
            return undefined;
        }

        const prevPage = toPrimitivePage(page);
        page.piece = {
            ...piece,
            coordinate: {
                x: coordinate.x + 1,
                y: coordinate.y,
            },
        };

        return sequence(state, [
            fieldEditorActions.resetInferencePiece(),
            clearLastPieceManipulation,
            actions.registerHistoryTask({ task: toSinglePageTask(pageIndex, prevPage, page) }),
            actions.reopenCurrentPage(),
        ]);
    },
    moveToRightEnd: () => (state): NextState => {
        const pages = state.fumen.pages;
        const pageIndex = state.fumen.currentIndex;
        const page = pages[pageIndex];
        if (page === undefined) {
            return undefined;
        }

        const piece = page.piece;
        if (piece === undefined) {
            return undefined;
        }

        const pagesObj = new Pages(pages);
        const field = pagesObj.getField(pageIndex, PageFieldOperation.Command);

        const test = testCallback(field, piece.type, piece.rotation);

        const coordinate = piece.coordinate;
        let x = coordinate.x;
        while (test(x + 1, coordinate.y)) {
            x += 1;
        }

        if (x === coordinate.x) {
            return undefined;
        }

        const prevPage = toPrimitivePage(page);
        page.piece = {
            ...piece,
            coordinate: {
                x,
                y: coordinate.y,
            },
        };

        return sequence(state, [
            fieldEditorActions.resetInferencePiece(),
            clearLastPieceManipulation,
            actions.registerHistoryTask({ task: toSinglePageTask(pageIndex, prevPage, page) }),
            actions.reopenCurrentPage(),
        ]);
    },
    softdropStep: () => (state): NextState => {
        const pageIndex = state.fumen.currentIndex;
        const page = state.fumen.pages[pageIndex];
        const piece = page?.piece;
        if (!page || !piece) return undefined;
        const field = new Pages(state.fumen.pages).getField(pageIndex, PageFieldOperation.Command);
        const test = testCallback(field, piece.type, piece.rotation);
        if (!test(piece.coordinate.x, piece.coordinate.y - 1)) return undefined;
        const prevPage = toPrimitivePage(page);
        page.piece = { ...piece, coordinate: { ...piece.coordinate, y: piece.coordinate.y - 1 } };
        return sequence(state, [
            fieldEditorActions.resetInferencePiece(),
            clearLastPieceManipulation,
            actions.registerHistoryTask({ task: toSinglePageTask(pageIndex, prevPage, page) }),
            actions.reopenCurrentPage(),
        ]);
    },
    softdrop: () => (state): NextState => {
        const pages = state.fumen.pages;
        const pageIndex = state.fumen.currentIndex;
        const page = pages[pageIndex];
        if (page === undefined) {
            return undefined;
        }

        const piece = page.piece;
        if (piece === undefined) {
            return undefined;
        }

        const pagesObj = new Pages(pages);
        const field = pagesObj.getField(pageIndex, PageFieldOperation.Command);

        const test = testCallback(field, piece.type, piece.rotation);
        let currentY = piece.coordinate.y;
        for (let y = piece.coordinate.y - 1; 0 <= y; y -= 1) {
            if (!test(piece.coordinate.x, y)) {
                break;
            }
            currentY = y;
        }

        if (currentY === piece.coordinate.y) {
            return undefined;
        }

        const prevPage = toPrimitivePage(page);
        page.piece = {
            ...piece,
            coordinate: {
                ...piece.coordinate,
                y: currentY,
            },
        };

        return sequence(state, [
            fieldEditorActions.resetInferencePiece(),
            clearLastPieceManipulation,
            actions.registerHistoryTask({ task: toSinglePageTask(pageIndex, prevPage, page) }),
            actions.reopenCurrentPage(),
        ]);
    },
    harddrop: () => (state): NextState => {
        return sequence(state, [
            fieldEditorActions.softdrop(),
            (nextState) => {
                const pageIndex = nextState.fumen.currentIndex;
                const page = nextState.fumen.pages[pageIndex];
                if (page?.piece === undefined || !page.flags.lock) {
                    return undefined;
                }

                const field = new Pages(nextState.fumen.pages)
                    .getField(pageIndex, PageFieldOperation.Command);
                const piece = page.piece;
                if (!field.isOnGround(piece.type, piece.rotation, piece.coordinate.x, piece.coordinate.y)) {
                    return undefined;
                }

                const nextPageIndex = pageIndex + 1;
                const isInput = nextState.editorUi.primaryTool === 'piece'
                    && nextState.editorUi.pieceLayout === 'play';
                const currentComment = resolvePageCommentText(nextState.fumen.pages, pageIndex);
                const commentWithEvidence = isInput
                    ? withInputRotationEvidence(currentComment, nextState.events.lastPieceManipulation)
                    : currentComment;
                return sequence(nextState, [
                    ...(commentWithEvidence === currentComment ? [] : [
                        actions.setCommentText({ pageIndex, text: commentWithEvidence }),
                    ]),
                    actions.insertPage({
                        index: nextPageIndex,
                        skipGrayAfterLineClear: nextState.tree.grayAfterLineClear
                            && nextState.mode.noGrayAfterHardDrop,
                    }),
                    actions.openPage({ index: nextPageIndex }),
                    actions.spawnNextPieceFromColdClearQueue(),
                    clearLastPieceManipulation,
                ]);
            },
        ]);
    },

    spawnNextPieceFromColdClearQueue: () => (state): NextState => {
        const currentComment = getCurrentColdClearQueueComment(state);
        const parsed = currentComment === null ? null : parseQueueStateComment(currentComment);
        if (!parsed) {
            return actions.changePieceAction({ pieceAction: 'spawn' })(state);
        }

        const pageIndex = state.fumen.currentIndex;
        const page = state.fumen.pages[pageIndex];
        const isInput = state.editorUi.primaryTool === 'piece'
            && state.editorUi.pieceLayout === 'play';
        const tree = state.tree.enabled
            ? { nodes: state.tree.nodes, rootId: state.tree.rootId, version: 2 as const }
            : undefined;
        const inputStats = isInput
            ? computeInputStats(state.fumen.pages, pageIndex, {
                tree,
                rotationSystem: state.mode.rotationSystem,
            })
            : undefined;
        const nextB2b = inputStats === undefined ? parsed.b2b : inputStats.b2bChain >= 1;
        const nextCombo = inputStats === undefined ? parsed.combo : toCommentCombo(inputStats.renChain);
        // Quizページのrefコメントは取得時点で設置操作が反映済み。
        // メタデータ付き等の非Quizコメントは、直前ページで設置したミノがカレントに残ったままのため
        // ここでQuiz相当の進行 (Direct/Swap/Stock) を行う
        const isAdvancedQuizComment = page !== undefined && page.flags.quiz && page.comment.text === undefined;

        let hold = parsed.hold;
        let current = parsed.current;
        let queue = parsed.queue;
        if (!isAdvancedQuizComment && current !== null) {
            const prevPage = state.fumen.pages[pageIndex - 1];
            const placedPiece = prevPage?.flags.lock && prevPage.piece && isMinoPiece(prevPage.piece.type)
                ? prevPage.piece.type
                : undefined;
            if (placedPiece !== undefined) {
                if (placedPiece === current) {
                    current = null;
                } else if (placedPiece === hold) {
                    hold = current;
                    current = null;
                } else if (hold === null && placedPiece === queue[0]) {
                    hold = current;
                    current = null;
                    queue = queue.slice(1);
                }
            }
        }

        // カレントが空のときはNEXT先頭を取り出してカレントにする
        if (current === null) {
            if (queue.length === 0) {
                // スポーンできなくても、進行後の状態はコメントに反映しておく
                const advancedComment = buildQueueStateComment(
                    hold, null, [], nextB2b, nextCombo, parsed.suffix,
                );
                if (advancedComment !== currentComment) {
                    return sequence(state, [
                        actions.setCommentText({ pageIndex, text: advancedComment }),
                        actions.changePieceAction({ pieceAction: 'spawn' }),
                    ]);
                }
                return actions.changePieceAction({ pieceAction: 'spawn' })(state);
            }
            current = queue[0];
            queue = queue.slice(1);
        }

        const spawnPiece = current;
        // 既知ミノ数はカレントを含めて数える
        const nextQueue = state.editorUi.infinitePieceQueue
            ? fillInfiniteQueueToMinimum(queue, queue.length + 1)
            : queue;
        const nextComment = buildQueueStateComment(
            hold,
            spawnPiece,
            nextQueue,
            nextB2b,
            nextCombo,
            parsed.suffix,
        );

        return sequence(state, [
            actions.setCommentText({ pageIndex, text: nextComment }),
            actions.spawnPiece({
                piece: spawnPiece,
                srs: state.mode.rotationSystem !== 'classic',
            }),
            actions.changePieceAction({ pieceAction: 'drag' }),
        ]);
    },
};

const testCallback = (field: Field, piece: Piece, rotation: Rotation) => {
    return (x: number, y: number) => {
        const positions = getBlockPositions(piece, rotation, x, y);
        const isGroundOver = positions.some(pos => pos[0] < 0 || 10 <= pos[0] || pos[1] < 0 || 24 <= pos[1]);
        if (isGroundOver) {
            return false;
        }

        const isConflicted = positions.map(toPositionIndex).some(i => field.getAtIndex(i, true) !== Piece.Empty);
        return !isConflicted;
    };
};
