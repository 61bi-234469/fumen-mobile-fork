import { isMinoPiece, ModeTypes, Piece, Rotation, toPositionIndex, TouchTypes } from '../lib/enums';
import { action, actions } from '../actions';
import { NextState, sequence } from './commons';
import { putPieceActions } from './put_piece';
import { drawBlockActions } from './draw_block';
import { fillActions } from './fill';
import { toPrimitivePage, toSinglePageTask } from '../history_task';
import { movePieceActions } from './move_piece';
import { PageFieldOperation, Pages } from '../lib/pages';
import { testLeftRotation, testRightRotation } from '../lib/srs';
import { classicTestLeftRotation, classicTestRightRotation } from '../lib/classic_rotation';
import { test180Rotation, testLeftRotationSrsPlus, testRightRotationSrsPlus } from '../lib/srs_plus';
import { fillRowActions } from './fill_row';
import { coldClearActions } from './cold_clear';
import { ViewError } from '../lib/errors';
import { Field } from '../lib/fumen/field';
import { State } from '../states';
import { getBlockPositions } from '../lib/piece';
import { shouldReturnCurrentPieceOnRightClick } from './field_editor_right_click';
import { intermediateCellIndices } from '../lib/grid_line';
import { rectSelectActions } from './rect_select';

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

    spawnPiece(data: { piece: Piece, srs: boolean }): action;

    clearPiece(): action;

    clearFieldAndPiece(): action;

    rotateToLeft(): action;

    rotateToRight(): action;

    rotateTo180(): action;

    moveToLeft(): action;

    moveToLeftEnd(): action;

    moveToRight(): action;

    moveToRightEnd(): action;

    harddrop(): action;
}

// Helper to determine right-click override mode based on current ModeType
const getRightClickOverride = (state: State): { touch: TouchTypes; piece: Piece } => ({
    touch: state.mode.type === ModeTypes.Fill ? TouchTypes.Fill
        : state.mode.type === ModeTypes.FillRow ? TouchTypes.FillRow
        : TouchTypes.Drawing,
    piece: Piece.Empty,
});

// Wrapper to run an action with overridden mode (for right-click erase)
const runWithOverride = (
    state: State,
    actionFn: (s: State) => NextState,
): NextState => {
    const override = getRightClickOverride(state);
    const patched: State = {
        ...state,
        mode: { ...state.mode, touch: override.touch, piece: override.piece },
    };
    return actionFn(patched);
};

const FIELD_GRID_WIDTH = 10;

const dispatchTouchMoveField = (index: number) => (state: State): NextState => {
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
        return rectSelectActions.rectSelectTouchMove({ index })(state);
    }
    return undefined;
};

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
            rectSelectActions.cancelRectSelect(),
        ]);
    },
    ontouchStartField: ({ index }) => (state): NextState => {
        const dispatch = (newState: State): NextState => {
            switch (newState.mode.touch) {
            case TouchTypes.Drawing:
                return drawBlockActions.ontouchStartField({ index })(newState);
            case TouchTypes.Piece:
                return putPieceActions.ontouchStartField({ index })(newState);
            case TouchTypes.MovePiece:
                return movePieceActions.ontouchStartField({ index })(newState);
            case TouchTypes.FillRow:
                return fillRowActions.ontouchStartField({ index })(newState);
            case TouchTypes.Fill:
                return fillActions.ontouchStartField({ index })(newState);
            case TouchTypes.Select:
                return rectSelectActions.rectSelectTouchStart({ index })(newState);
            }
            return undefined;
        };

        // A stale trail (e.g. a lost touchend) must never bridge into a new stroke.
        if (state.events.lastTouchedIndex === undefined && state.events.lastTouchedSentIndex === undefined) {
            return dispatch(state);
        }
        return sequence(state, [
            setTouchTrail(undefined, undefined),
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
                return rectSelectActions.rectSelectTouchEnd()(newState);
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

        if (state.events.lastTouchedIndex === undefined && state.events.lastTouchedSentIndex === undefined) {
            return dispatch(state);
        }
        return sequence(state, [
            setTouchTrail(undefined, undefined),
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
    onrightStartField: ({ index }) => (state): NextState => {
        if (state.mode.touch === TouchTypes.Select) return rectSelectActions.cancelRectSelect()(state);
        // In Piece/DrawingTool mode with a current mino: return piece to queue instead of erase,
        // but only when the clicked cell is part of the SPAWN mino AND has no underlying field block.
        // Normal blocks take priority: if a field block exists beneath the SPAWN mino, erase it instead.
        if (state.mode.type === ModeTypes.Piece || state.mode.type === ModeTypes.DrawingTool) {
            const page = state.fumen.pages[state.fumen.currentIndex];
            if (page?.piece && isMinoPiece(page.piece.type)) {
                const rawField = new Pages(state.fumen.pages)
                    .getField(state.fumen.currentIndex, PageFieldOperation.Command);
                const rawPiece = rawField.getAtIndex(index, true);
                if (shouldReturnCurrentPieceOnRightClick(rawPiece, page.piece, index)) {
                    return coldClearActions.returnCurrentPieceToQueue()(state);
                }
            }
        }
        return runWithOverride(state, (patchedState) => {
            return fieldEditorActions.ontouchStartField({ index })(patchedState);
        });
    },
    onrightMoveField: ({ index }) => (state): NextState => {
        if (state.mode.touch === TouchTypes.Select) return undefined;
        return runWithOverride(state, (patchedState) => {
            return fieldEditorActions.ontouchMoveField({ index })(patchedState);
        });
    },
    onrightEnd: () => (state): NextState => {
        if (state.mode.touch === TouchTypes.Select) return undefined;
        return runWithOverride(state, (patchedState) => {
            return fieldEditorActions.ontouchEnd()(patchedState);
        });
    },
    onrightStartSentLine: ({ index }) => (state): NextState => {
        return runWithOverride(state, (patchedState) => {
            return fieldEditorActions.ontouchStartSentLine({ index })(patchedState);
        });
    },
    onrightMoveSentLine: ({ index }) => (state): NextState => {
        return runWithOverride(state, (patchedState) => {
            return fieldEditorActions.ontouchMoveSentLine({ index })(patchedState);
        });
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
    spawnPiece: ({ piece, srs }) => (state): NextState => {
        if (piece === Piece.Gray || piece === Piece.Empty) {
            throw new ViewError(`Unsupported piece: ${piece}`);
        }

        const pages = state.fumen.pages;
        const pageIndex = state.fumen.currentIndex;
        const page = pages[pageIndex];
        if (page === undefined) {
            return undefined;
        }

        let next;
        if (srs) {
            next = { type: piece, rotation: Rotation.Spawn, coordinate: { x: 4, y: 20 } };
        } else if (piece === Piece.I) {
            next = { type: piece, rotation: Rotation.Spawn, coordinate: { x: 4, y: 21 } };
        } else if (piece === Piece.O) {
            next = { type: piece, rotation: Rotation.Reverse, coordinate: { x: 5, y: 21 } };
        } else {
            next = { type: piece, rotation: Rotation.Reverse, coordinate: { x: 4, y: 21 } };
        }

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

        return sequence(state, [
            fieldEditorActions.resetInferencePiece(),
            actions.registerHistoryTask({ task: toSinglePageTask(pageIndex, prevPage, page) }),
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
    clearFieldAndPiece: () => (state): NextState => {
        return sequence(state, [
            actions.clearField(),
            fieldEditorActions.clearPiece(),
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

        const element = testPositions.find(position => test(position[0], position[1]));
        if (element === undefined) {
            return undefined;
        }

        const prevPage = toPrimitivePage(page);
        page.piece = {
            ...piece,
            rotation: nextRotation,
            coordinate: {
                x: element[0],
                y: element[1],
            },
        };

        return sequence(state, [
            fieldEditorActions.resetInferencePiece(),
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

        const element = testPositions.find(position => test(position[0], position[1]));
        if (element === undefined) {
            return undefined;
        }

        const prevPage = toPrimitivePage(page);
        page.piece = {
            ...piece,
            rotation: nextRotation,
            coordinate: {
                x: element[0],
                y: element[1],
            },
        };

        return sequence(state, [
            fieldEditorActions.resetInferencePiece(),
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

        const element = testPositions.find(position => test(position[0], position[1]));
        if (element === undefined) {
            return undefined;
        }

        const prevPage = toPrimitivePage(page);
        page.piece = {
            ...piece,
            rotation: nextRotation,
            coordinate: {
                x: element[0],
                y: element[1],
            },
        };

        return sequence(state, [
            fieldEditorActions.resetInferencePiece(),
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
            actions.registerHistoryTask({ task: toSinglePageTask(pageIndex, prevPage, page) }),
            actions.reopenCurrentPage(),
        ]);
    },
    harddrop: () => (state): NextState => {
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
            actions.registerHistoryTask({ task: toSinglePageTask(pageIndex, prevPage, page) }),
            actions.reopenCurrentPage(),
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
