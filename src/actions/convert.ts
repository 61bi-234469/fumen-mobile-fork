import { NextState, sequence } from './commons';
import { action, actions } from '../actions';
import {
    OperationTask,
    toFreezeCommentTask,
    toKeyPageTask,
    toPageTaskStack,
    toPrimitivePage,
    toSinglePageTask,
} from '../history_task';
import { isQuizCommentResult, PageFieldOperation, Pages, parseToCommands } from '../lib/pages';
import { FieldConstants, isMinoPiece, ModeTypes, Piece, Rotation } from '../lib/enums';
import { getBlockPositions, getBlocks, getPieces } from '../lib/piece';
import { State } from '../states';
import { Field } from '../lib/fumen/field';
import { Move, Page } from '../lib/fumen/types';
import { findLiftableMinoAt, hasAnyLiftableMino, spawnMinoCellIndices } from '../lib/spawn_mino_convert';
import {
    hasSpawnMinoToggleEffect,
    showSpawnMinoToggleToast,
    SpawnMinoToggleEffects,
} from '../lib/spawn_mino_toggle_toast';

export interface ConvertActions {
    shiftToLeft: () => action;
    shiftToRight: () => action;
    shiftToUp: () => action;
    shiftToUpWithGray: () => action;
    shiftToBottom: () => action;
    convertToGray: () => action;
    convertToBlack: () => action;
    clearField: () => action;
    convertToMirror: () => action;
    convertAllToMirror: () => action;
    convertSpawnMinoToBlocks: () => action;
    convertBlocksToSpawnMino: (data: { index: number }) => action;
    toggleSpawnMinoAndBlocks: () => action;
    cancelSpawnMinoPick: () => action;
}

export const convertActions: Readonly<ConvertActions> = {
    shiftToLeft: () => (state): NextState => {
        if (state.mode.type === ModeTypes.Slide
            && state.rectSelect.status === 'floating'
            && state.rectSelect.floating !== null
            && state.rectSelect.floating.firstTapInProgress !== true) {
            return sequence(state, [
                actions.commitRectSelection(),
                newState => convertActions.shiftToLeft()(newState),
            ]);
        }
        const currentIndex = state.fumen.currentIndex;
        const pages = state.fumen.pages;
        const pagesObj = new Pages(pages);

        const page = pages[currentIndex];
        const primitivePage = toPrimitivePage(page);

        const goalField = pagesObj.getField(currentIndex, PageFieldOperation.Command);
        const goalFieldCopy = goalField.copy();
        goalField.shiftToLeft();

        const piece = page.piece;
        if (piece === undefined && goalFieldCopy.equals(goalField)) {
            return undefined;
        }

        const prevField = pagesObj.getField(currentIndex, PageFieldOperation.None);
        page.commands = parseToCommands(prevField, goalField);

        if (piece !== undefined) {
            const positions = getBlockPositions(piece.type, piece.rotation, piece.coordinate.x, piece.coordinate.y);
            const minX = Math.min(...positions.map(position => position[0]));
            if (minX < 1) {
                page.piece = undefined;
            } else {
                piece.coordinate.x -= 1;
            }
        }

        return sequence(state, [
            actions.registerHistoryTask({ task: toSinglePageTask(currentIndex, primitivePage, page) }),
            () => ({
                fumen: {
                    ...state.fumen,
                    pages,
                },
            }),
            actions.reopenCurrentPage(),
        ]);
    },
    shiftToRight: () => (state): NextState => {
        if (state.mode.type === ModeTypes.Slide
            && state.rectSelect.status === 'floating'
            && state.rectSelect.floating !== null
            && state.rectSelect.floating.firstTapInProgress !== true) {
            return sequence(state, [
                actions.commitRectSelection(),
                newState => convertActions.shiftToRight()(newState),
            ]);
        }
        const currentIndex = state.fumen.currentIndex;
        const pages = state.fumen.pages;
        const pagesObj = new Pages(pages);

        const page = pages[currentIndex];
        const primitivePage = toPrimitivePage(page);

        const goalField = pagesObj.getField(currentIndex, PageFieldOperation.Command);
        const goalFieldCopy = goalField.copy();
        goalField.shiftToRight();

        const piece = page.piece;
        if (piece === undefined && goalFieldCopy.equals(goalField)) {
            return undefined;
        }

        const prevField = pagesObj.getField(currentIndex, PageFieldOperation.None);
        page.commands = parseToCommands(prevField, goalField);

        if (piece !== undefined) {
            const positions = getBlockPositions(piece.type, piece.rotation, piece.coordinate.x, piece.coordinate.y);
            const maxX = Math.max(...positions.map(position => position[0]));
            if (8 < maxX) {
                page.piece = undefined;
            } else {
                piece.coordinate.x += 1;
            }
        }

        return sequence(state, [
            actions.registerHistoryTask({ task: toSinglePageTask(currentIndex, primitivePage, page) }),
            () => ({
                fumen: {
                    ...state.fumen,
                    pages,
                },
            }),
            actions.reopenCurrentPage(),
        ]);
    },
    shiftToUp: () => (state): NextState => {
        if (state.mode.type === ModeTypes.Slide
            && state.rectSelect.status === 'floating'
            && state.rectSelect.floating !== null
            && state.rectSelect.floating.firstTapInProgress !== true) {
            return sequence(state, [
                actions.commitRectSelection(),
                newState => convertActions.shiftToUp()(newState),
            ]);
        }
        const currentIndex = state.fumen.currentIndex;
        const pages = state.fumen.pages;
        const pagesObj = new Pages(pages);

        const page = pages[currentIndex];
        const primitivePage = toPrimitivePage(page);

        const goalField = pagesObj.getField(currentIndex, PageFieldOperation.Command);
        const goalFieldCopy = goalField.copy();
        goalField.shiftToUp();

        const piece = page.piece;
        if (piece === undefined && goalFieldCopy.equals(goalField)) {
            return undefined;
        }

        const prevField = pagesObj.getField(currentIndex, PageFieldOperation.None);
        page.commands = parseToCommands(prevField, goalField);

        if (piece !== undefined) {
            const positions = getBlockPositions(piece.type, piece.rotation, piece.coordinate.x, piece.coordinate.y);
            const maxY = Math.max(...positions.map(position => position[1]));
            if (FieldConstants.Height - 2 < maxY) {
                page.piece = undefined;
            } else {
                piece.coordinate.y += 1;
            }
        }

        return sequence(state, [
            actions.registerHistoryTask({ task: toSinglePageTask(currentIndex, primitivePage, page) }),
            () => ({
                fumen: {
                    ...state.fumen,
                    pages,
                },
            }),
            actions.reopenCurrentPage(),
        ]);
    },
    shiftToUpWithGray: () => (state): NextState => {
        if (state.mode.type === ModeTypes.Slide
            && state.rectSelect.status === 'floating'
            && state.rectSelect.floating !== null
            && state.rectSelect.floating.firstTapInProgress !== true) {
            return sequence(state, [
                actions.commitRectSelection(),
                newState => convertActions.shiftToUpWithGray()(newState),
            ]);
        }
        const currentIndex = state.fumen.currentIndex;
        const pages = state.fumen.pages;
        const pagesObj = new Pages(pages);

        const page = pages[currentIndex];
        const primitivePage = toPrimitivePage(page);

        const goalField = pagesObj.getField(currentIndex, PageFieldOperation.Command);
        const goalFieldCopy = goalField.copy();
        goalField.shiftToUpWithGray();

        const piece = page.piece;
        if (piece === undefined && goalFieldCopy.equals(goalField)) {
            return undefined;
        }

        const prevField = pagesObj.getField(currentIndex, PageFieldOperation.None);
        page.commands = parseToCommands(prevField, goalField);

        if (piece !== undefined) {
            const positions = getBlockPositions(piece.type, piece.rotation, piece.coordinate.x, piece.coordinate.y);
            const maxY = Math.max(...positions.map(position => position[1]));
            if (FieldConstants.Height - 2 < maxY) {
                page.piece = undefined;
            } else {
                piece.coordinate.y += 1;
            }
        }

        return sequence(state, [
            actions.registerHistoryTask({ task: toSinglePageTask(currentIndex, primitivePage, page) }),
            () => ({
                fumen: {
                    ...state.fumen,
                    pages,
                },
            }),
            actions.reopenCurrentPage(),
        ]);
    },
    shiftToBottom: () => (state): NextState => {
        if (state.mode.type === ModeTypes.Slide
            && state.rectSelect.status === 'floating'
            && state.rectSelect.floating !== null
            && state.rectSelect.floating.firstTapInProgress !== true) {
            return sequence(state, [
                actions.commitRectSelection(),
                newState => convertActions.shiftToBottom()(newState),
            ]);
        }
        const currentIndex = state.fumen.currentIndex;
        const pages = state.fumen.pages;
        const pagesObj = new Pages(pages);

        const page = pages[currentIndex];
        const primitivePage = toPrimitivePage(page);

        const goalField = pagesObj.getField(currentIndex, PageFieldOperation.Command);
        const goalFieldCopy = goalField.copy();
        goalField.shiftToBottom();

        const piece = page.piece;
        if (piece === undefined && goalFieldCopy.equals(goalField)) {
            return undefined;
        }

        const prevField = pagesObj.getField(currentIndex, PageFieldOperation.None);
        page.commands = parseToCommands(prevField, goalField);

        if (piece !== undefined) {
            const positions = getBlockPositions(piece.type, piece.rotation, piece.coordinate.x, piece.coordinate.y);
            const minY = Math.min(...positions.map(position => position[1]));
            if (minY < 1) {
                page.piece = undefined;
            } else {
                piece.coordinate.y -= 1;
            }
        }

        return sequence(state, [
            actions.registerHistoryTask({ task: toSinglePageTask(currentIndex, primitivePage, page) }),
            () => ({
                fumen: {
                    ...state.fumen,
                    pages,
                },
            }),
            actions.reopenCurrentPage(),
        ]);
    },
    convertToGray: () => (state): NextState => {
        return sequence(state, [
            actions.removeUnsettledItems(),
            actions.clearRectSelection !== undefined ? actions.clearRectSelection() : undefined,
            convertToGoalField((field) => {
                const copy = field.copy();
                copy.convertToGray();
                return copy;
            }),
        ]);
    },
    convertToBlack: () => (state): NextState => {
        return sequence(state, [
            actions.removeUnsettledItems(),
            actions.clearRectSelection !== undefined ? actions.clearRectSelection() : undefined,
            convertToGoalField((field) => {
                const copy = field.copy();
                copy.convertNonGrayToEmpty();
                return copy;
            }),
            actions.clearPiece(),
        ]);
    },
    clearField: () => (state): NextState => {
        return sequence(state, [
            actions.removeUnsettledItems(),
            actions.clearRectSelection !== undefined ? actions.clearRectSelection() : undefined,
            convertToGoalField(_ => new Field({})),
        ]);
    },
    convertToMirror: () => (state): NextState => {
        return sequence(state, [
            actions.removeUnsettledItems(),
            convertToMirror(),
            actions.mirrorRectSelection(),
        ]);
    },
    convertAllToMirror: () => (state): NextState => {
        return sequence(state, [
            actions.removeUnsettledItems(),
            actions.clearRectSelection !== undefined ? actions.clearRectSelection() : undefined,
            convertAllToMirror(),
        ]);
    },
    // SPAWNミノを、同じ位置・同じ色のペイントブロックへ焼き付ける。
    // 下に既存ブロックがあっても上書きする（逆変換では空セルに戻り、下の色は復元されない）。
    convertSpawnMinoToBlocks: () => (state): NextState => {
        const pageIndex = state.fumen.currentIndex;
        const page = state.fumen.pages[pageIndex];
        const piece = page !== undefined ? page.piece : undefined;
        if (page === undefined || piece === undefined || !isMinoPiece(piece.type)) {
            return undefined;
        }

        // 焼き付ける前の「lockしたらどうなるか」を見て、意味の変化を判定する
        const fieldAfterLock = new Pages(state.fumen.pages)
            .getField(pageIndex, PageFieldOperation.Command).copy();
        fieldAfterLock.put(piece);
        const effects: SpawnMinoToggleEffects = {
            lineClearLost: page.flags.lock && hasFilledLine(fieldAfterLock),
            persistsToLaterPages: !page.flags.lock,
            quizConsumptionChanged: page.flags.quiz && page.flags.lock,
        };

        const indices = spawnMinoCellIndices(piece);
        const prevPage = toPrimitivePage(page);
        for (const index of indices) {
            writeFieldBlock(page, state.cache.currentInitField, index, piece.type);
        }
        page.piece = undefined;

        return commitSpawnMinoToggle(state, pageIndex, prevPage, page, effects);
    },
    // ミノ形のペイントブロックを持ち上げてSPAWNミノにする。対象は index を含む同色4セル。
    convertBlocksToSpawnMino: ({ index }) => (state): NextState => {
        const pageIndex = state.fumen.currentIndex;
        const page = state.fumen.pages[pageIndex];
        if (page === undefined || page.piece !== undefined) {
            return undefined;
        }

        const rawField = new Pages(state.fumen.pages).getField(pageIndex, PageFieldOperation.Command);
        const mino = findLiftableMinoAt(rawField, index);
        if (mino === undefined) {
            return undefined;
        }

        const effects: SpawnMinoToggleEffects = {
            lineClearLost: false,
            persistsToLaterPages: false,
            quizConsumptionChanged: page.flags.quiz && page.flags.lock,
        };

        const prevPage = toPrimitivePage(page);
        for (const cell of mino.indices) {
            writeFieldBlock(page, state.cache.currentInitField, cell, Piece.Empty);
        }
        page.piece = { type: mino.piece, rotation: mino.rotation, coordinate: mino.coordinate };

        return commitSpawnMinoToggle(state, pageIndex, prevPage, page, effects);
    },
    toggleSpawnMinoAndBlocks: () => (state): NextState => {
        return sequence(state, [
            actions.removeUnsettledItems(),
            resolveSpawnMinoToggle,
        ]);
    },
    cancelSpawnMinoPick: () => (state): NextState => {
        if (!state.editorUi.spawnMinoToggle.pickArmed) {
            return undefined;
        }
        return {
            editorUi: {
                ...state.editorUi,
                spawnMinoToggle: { ...state.editorUi.spawnMinoToggle, pickArmed: false },
            },
        };
    },
};

// ペイントと同じ規則で1セル書く。最初のフィールドの状態に戻るときはコマンドを消す。
const writeFieldBlock = (page: Page, initField: Field, index: number, piece: Piece) => {
    if (!page.commands) {
        page.commands = { pre: {} };
    }
    const key = `block-${index}`;
    if (initField.getAtIndex(index, true) !== piece) {
        page.commands.pre[key] = {
            piece,
            type: 'block',
            x: index % FieldConstants.Width,
            y: Math.floor(index / FieldConstants.Width),
        };
    } else {
        delete page.commands.pre[key];
    }
};

const hasFilledLine = (field: Field): boolean => {
    for (let y = 0; y < FieldConstants.Height; y += 1) {
        let filled = true;
        for (let x = 0; x < FieldConstants.Width; x += 1) {
            if (field.getAtIndex(x + y * FieldConstants.Width, true) === Piece.Empty) {
                filled = false;
                break;
            }
        }
        if (filled) {
            return true;
        }
    }
    return false;
};

const commitSpawnMinoToggle = (
    state: State,
    pageIndex: number,
    prevPage: ReturnType<typeof toPrimitivePage>,
    page: Page,
    effects: SpawnMinoToggleEffects,
): NextState => {
    return sequence(state, [
        newState => ({
            fumen: { ...newState.fumen, pages: [...newState.fumen.pages] },
            editorUi: {
                ...newState.editorUi,
                spawnMinoToggle: { pickArmed: false },
            },
        }),
        actions.registerHistoryTask({ task: toSinglePageTask(pageIndex, prevPage, page) }),
        actions.reopenCurrentPage(),
        (): NextState => {
            if (hasSpawnMinoToggleEffect(effects)) {
                showSpawnMinoToggleToast(effects);
            }
            return undefined;
        },
    ]);
};

// 決定木。removeUnsettledItems のあとの状態に対して評価する。
// ミノ化の対象は自動で決めない。ボタンは候補をハイライトするところまでで、
// どのミノを持ち上げるかは必ずユーザーのタップが決める。
const resolveSpawnMinoToggle = (state: State): NextState => {
    // 候補表示中にもう一度押したらキャンセルする。出したのと同じ操作で引っ込められるようにする。
    if (state.editorUi.spawnMinoToggle.pickArmed) {
        return sequence(state, [
            convertActions.cancelSpawnMinoPick(),
            actions.reopenCurrentPage(),
        ]);
    }

    const pageIndex = state.fumen.currentIndex;
    const page = state.fumen.pages[pageIndex];
    if (page === undefined) {
        return undefined;
    }

    // ブロック化は対象がSPAWNミノ1つに定まるので、そのまま実行する
    if (page.piece !== undefined && isMinoPiece(page.piece.type)) {
        return convertActions.convertSpawnMinoToBlocks()(state);
    }

    // ミノ化は候補をハイライトして対象選択待ちへ。候補がなければ何もしない
    const rawField = new Pages(state.fumen.pages).getField(pageIndex, PageFieldOperation.Command);
    if (!hasAnyLiftableMino(rawField)) {
        return undefined;
    }
    return sequence(state, [
        () => ({
            editorUi: {
                ...state.editorUi,
                spawnMinoToggle: { pickArmed: true },
            },
        }),
        // ハイライトを盤面へ反映する
        actions.reopenCurrentPage(),
    ]);
};

const convertToGoalField = (callback: (field: Field) => Field) => (state: State): NextState => {
    const currentIndex = state.fumen.currentIndex;
    const pages = state.fumen.pages;
    const pagesObj = new Pages(pages);
    const tasks: OperationTask[] = [];

    const page = pages[currentIndex];

    // 現在のページをKeyにする
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
    const goalField = callback(initField);

    if (tasks.length === 0 && initField.equals(goalField)) {
        return undefined;
    }

    const prevField = pagesObj.getField(currentIndex, PageFieldOperation.None);
    page.commands = parseToCommands(prevField, goalField);

    tasks.push(toSinglePageTask(currentIndex, primitivePage, page));

    return sequence(state, [
        actions.registerHistoryTask({ task: toPageTaskStack(tasks, currentIndex) }),
        () => ({
            fumen: {
                ...state.fumen,
                pages: [...pages],
            },
        }),
        actions.reopenCurrentPage(),
    ]);
};

const mirrorPiece = (piece: Piece): Piece => {
    switch (piece) {
    case Piece.J:
        return Piece.L;
    case Piece.L:
        return Piece.J;
    case Piece.S:
        return Piece.Z;
    case Piece.Z:
        return Piece.S;
    }
    return piece;
};

const mirrorRotation = (rotation: Rotation): Rotation => {
    switch (rotation) {
    case Rotation.Left:
        return Rotation.Right;
    case Rotation.Right:
        return Rotation.Left;
    }
    return rotation;
};

const to = (type: Piece, rotation: Rotation, x: number, y: number): Move => {
    return { type, rotation, coordinate: { x, y } };
};

const mirrorMove = (move: Move): Move => {
    const { type, rotation, coordinate: { x, y } } = move;
    const positions = getBlocks(type, rotation);
    const maxX = Math.max(...positions.map(e => e[0]));
    const minY = Math.min(...positions.map(e => e[1]));

    const rx = x + maxX;
    const by = y + minY;

    const mType = mirrorPiece(type);
    const mRotation = mirrorRotation(rotation);
    const mPositions = getBlocks(mType, mRotation);
    const mMinX = Math.min(...mPositions.map(e => e[0]));
    const mMinY = Math.min(...mPositions.map(e => e[1]));

    const lx = 9 - rx;

    return to(mType, mRotation, lx - mMinX, by - mMinY);
};

const mirrorQuiz = (start: String): string => {
    let mirror = '';
    for (let index = 0; index < start.length; index += 1) {
        switch (start[index]) {
        case 'L': {
            mirror += 'J';
            break;
        }
        case 'J': {
            mirror += 'L';
            break;
        }
        case 'S': {
            mirror += 'Z';
            break;
        }
        case 'Z': {
            mirror += 'S';
            break;
        }
        default: {
            mirror += start[index];
            break;
        }
        }
    }
    return mirror;
};

const convertToMirror = () => (state: State): NextState => {
    const currentIndex = state.fumen.currentIndex;
    const pages = state.fumen.pages;
    const pagesObj = new Pages(pages);
    const tasks: OperationTask[] = [];

    // 次のKeyページのインデックスを取得
    let nextKeyIndex = pages.length;
    for (let index = currentIndex + 1; index < pages.length; index += 1) {
        if (pages[index].field.obj !== undefined) {
            nextKeyIndex = index;
            break;
        }
    }

    // 現在のページを反転させる
    {
        const page = pages[currentIndex];

        // 現在のページをKeyにする
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
        const goalField = new Field({});

        for (let y = -1; y < 23; y += 1) {
            for (let x = 0; x < 10; x += 1) {
                const piece = initField.get(9 - x, y);
                goalField.add(x, y, mirrorPiece(piece));
            }
        }

        if (page.piece !== undefined) {
            page.piece = mirrorMove(page.piece);
        }

        const comment = pagesObj.getComment(currentIndex);
        if (isQuizCommentResult(comment)) {
            const mirror = mirrorQuiz(comment.quiz);
            pagesObj.setComment(currentIndex, mirror);
        }

        const prevField = pagesObj.getField(currentIndex, PageFieldOperation.None);
        page.commands = parseToCommands(prevField, goalField);

        tasks.push(toSinglePageTask(currentIndex, primitivePage, page));
    }

    // 次のページ以降を反転させる
    for (let index = currentIndex + 1; index < nextKeyIndex; index += 1) {
        const page = pages[index];
        const primitivePage = toPrimitivePage(page);

        if (page.piece !== undefined) {
            page.piece = mirrorMove(page.piece);
        }

        const comment = pagesObj.getComment(currentIndex);
        if (page.comment.text !== undefined && isQuizCommentResult(comment)) {
            const mirror = mirrorQuiz(comment.quiz);
            pagesObj.setComment(currentIndex, mirror);
        }

        tasks.push(toSinglePageTask(index, primitivePage, page));
    }

    return sequence(state, [
        actions.registerHistoryTask({ task: toPageTaskStack(tasks, currentIndex) }),
        () => ({
            fumen: {
                ...state.fumen,
                pages: [...pages],
            },
        }),
        actions.reopenCurrentPage(),
    ]);
};

const convertAllToMirror = () => (state: State): NextState => {
    const currentIndex = state.fumen.currentIndex;
    const pages = state.fumen.pages;
    const pagesObj = new Pages(pages);
    const tasks: OperationTask[] = [];

    // すべてのページを反転させる
    for (let pageIndex = pages.length - 1; 0 <= pageIndex; pageIndex -= 1) {
        const page = pages[pageIndex];

        // ページをKeyにする
        if (page.field.obj === undefined) {
            pagesObj.toKeyPage(pageIndex);
            tasks.push(toKeyPageTask(pageIndex));
        }

        if (page.comment.ref !== undefined) {
            pagesObj.freezeComment(pageIndex);
            tasks.push(toFreezeCommentTask(pageIndex));
        }

        const primitivePage = toPrimitivePage(page);

        const initField = pagesObj.getField(pageIndex, PageFieldOperation.Command);
        const goalField = new Field({});

        for (let y = -1; y < 23; y += 1) {
            for (let x = 0; x < 10; x += 1) {
                const piece = initField.get(9 - x, y);
                goalField.add(x, y, mirrorPiece(piece));
            }
        }

        if (page.piece !== undefined) {
            page.piece = mirrorMove(page.piece);
        }

        const comment = pagesObj.getComment(pageIndex);
        if (isQuizCommentResult(comment)) {
            const mirror = mirrorQuiz(comment.quiz);
            pagesObj.setComment(pageIndex, mirror);
        }

        const prevField = pagesObj.getField(pageIndex, PageFieldOperation.None);
        page.commands = parseToCommands(prevField, goalField);

        tasks.push(toSinglePageTask(pageIndex, primitivePage, page));
    }

    return sequence(state, [
        actions.registerHistoryTask({ task: toPageTaskStack(tasks, currentIndex) }),
        () => ({
            fumen: {
                ...state.fumen,
                pages: [...pages],
            },
        }),
        actions.reopenCurrentPage(),
    ]);
};
