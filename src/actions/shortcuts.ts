import { Piece, Screens } from '../lib/enums';
import { isModifierKey, matchShortcut } from '../lib/shortcuts';
import { EditShortcuts, PaletteShortcuts, PieceShortcuts, State } from '../states';
import { Actions } from '../actions';
import { TreeViewMode } from '../lib/fumen/tree_types';
import { executePieceShortcut, PieceShortcutKey } from '../lib/piece_shortcut';
import { endDasHold, endSoftDropHold, startDasHold, startSoftDropHold } from '../lib/piece_das';

const LONG_PRESS_DURATION = 500;

// アクティブなショートカット種別
type ActiveShortcut = {
    type: 'palette';
    key: PaletteKey;
} | {
    type: 'edit';
    key: EditShortcutKey;
} | {
    type: 'piece';
    key: PieceShortcutKey;
};

// 押下中のキーごとの状態（同時押しに対応するためMapで管理）
interface PressedKeyState {
    shortcut: ActiveShortcut;
    longPressTimer: ReturnType<typeof setTimeout> | null;
    longPressExecuted: boolean;
}

const pressedKeys = new Map<string, PressedKeyState>();

// ピース移動ホールド（DAS/ARR）のID
const keyboardHoldId = (code: string) => `keyboard:${code}`;

// パレットキーの種類
type PaletteKey = keyof PaletteShortcuts;

// 編集用ショートカットキーの種類
type EditShortcutKey = keyof EditShortcuts;

// ピースショートカットキーの種類
// 画面ごとに許可される編集用ショートカット
export const allowedEditShortcuts: { [screen in Screens]: EditShortcutKey[] } = {
    [Screens.Editor]: [
        'InsertPage', 'PrevPage', 'NextPage', 'Menu', 'ListView', 'TreeView', 'EditHome',
        'Undo', 'Redo', 'Add', 'Insert', 'Copy', 'Cut',
    ],
    [Screens.Reader]: ['Menu', 'ListView', 'TreeView', 'PrevPage', 'NextPage', 'EditHome', 'Insert', 'Copy', 'Cut'],
    [Screens.ListView]: ['ListView', 'TreeView', 'EditHome', 'Menu', 'Undo', 'Redo', 'Insert', 'Copy', 'Cut'],
};

// どれか1つでもモーダルが開いていればグローバルショートカットを無効化する。
// フラグを列挙すると追加時に漏れるため、modal の全フィールドを走査する。
const isAnyModalOpen = (state: State): boolean => {
    return Object.values(state.modal).some(flag => flag);
};

// 入力フィールドにフォーカスしているかチェック
// readonly属性がついている場合はfalseを返す（ショートカットを有効にする）
const isInputFocused = (): boolean => {
    const el = document.activeElement;
    if (!el) return false;
    const tagName = el.tagName.toLowerCase();
    if (tagName === 'input') {
        const inputEl = el as HTMLInputElement;
        // readonly属性がある場合は入力を受け付けないのでfalse
        if (inputEl.readOnly) return false;
        return true;
    }
    if (tagName === 'textarea') {
        const textareaEl = el as HTMLTextAreaElement;
        // readonly属性がある場合は入力を受け付けないのでfalse
        if (textareaEl.readOnly) return false;
        return true;
    }
    if (tagName === 'select') {
        return true;
    }
    if ((el as HTMLElement).isContentEditable) {
        return true;
    }
    return false;
};

// 割当表から code に一致するキーを逆引きする
const findKeyByCode = <T extends Record<string, string>>(
    shortcuts: T, code: string,
): (keyof T) | null => {
    for (const key of Object.keys(shortcuts) as (keyof T)[]) {
        if (shortcuts[key] === code) {
            return key;
        }
    }
    return null;
};

// イベントから編集用ショートカットを検索（Mod+対応）
const findEditShortcutByEvent = (
    shortcuts: EditShortcuts, event: KeyboardEvent,
): EditShortcutKey | null => {
    for (const key of Object.keys(shortcuts) as EditShortcutKey[]) {
        if (matchShortcut(event, shortcuts[key])) {
            return key;
        }
    }
    return null;
};

// パレットキーからPiece enumに変換
const paletteToPiece = (palette: PaletteKey): Piece | null => {
    switch (palette) {
    case 'I': return Piece.I;
    case 'L': return Piece.L;
    case 'O': return Piece.O;
    case 'Z': return Piece.Z;
    case 'T': return Piece.T;
    case 'J': return Piece.J;
    case 'S': return Piece.S;
    case 'Empty': return Piece.Empty;
    case 'Gray': return Piece.Gray;
    case 'Comp': return null; // Compは特殊扱い
    }
};

// パレット短押し動作を実行
const executePaletteShortPress = (palette: PaletteKey, actions: Actions) => {
    const piece = paletteToPiece(palette);
    actions.selectEditorPalette({ selection: piece === null ? 'comp' : piece });
};

// パレット長押し動作を実行
const executePaletteLongPress = (palette: PaletteKey, actions: Actions) => {
    const piece = paletteToPiece(palette);
    actions.executeEditorPaletteShortcut({ selection: piece === null ? 'comp' : piece });
};

// 編集用ショートカット短押し動作を実行
const executeEditShortPress = (key: EditShortcutKey, state: State, actions: Actions) => {
    const screen = state.mode.screen;
    const loop = state.mode.loop;

    switch (key) {
    case 'InsertPage':
        actions.duplicatePageOnly({ index: state.fumen.currentIndex + 1 });
        break;
    case 'PrevPage':
        actions.backPage({ loop });
        break;
    case 'NextPage':
        actions.nextPage({ loop });
        break;
    case 'Menu':
        actions.openMenuModal();
        break;
    case 'ListView':
        if (screen === Screens.ListView) {
            // ListView画面ではListモードに切り替え
            actions.setTreeViewMode({ mode: TreeViewMode.List });
        } else {
            actions.changeToListViewScreen();
        }
        break;
    case 'TreeView':
        actions.changeToTreeViewScreen();
        break;
    case 'EditHome':
        if (screen === Screens.Editor) {
            actions.changeToDrawingToolMode();
        } else if (screen === Screens.Reader) {
            actions.changeToDrawerScreen({ refresh: true });
        } else if (screen === Screens.ListView) {
            actions.changeToEditorFromListView();
        }
        break;
    case 'Undo':
        actions.undo();
        break;
    case 'Redo':
        actions.redo();
        break;
    case 'Add':
        actions.insertNewPage({ index: state.fumen.currentIndex + 1 });
        break;
    case 'Insert':
        actions.importPagesFromClipboard({ mode: 'add' });
        break;
    case 'Copy':
        actions.copyCurrentPageToClipboard();
        break;
    case 'Cut':
        actions.cutCurrentPage();
        break;
    }
};

// 編集用ショートカット長押し動作を実行
const executeEditLongPress = (key: EditShortcutKey, state: State, actions: Actions) => {
    switch (key) {
    case 'PrevPage':
        actions.firstPage();
        break;
    case 'NextPage':
        actions.lastPage();
        break;
    case 'ListView':
        // ListView長押し → TreeView
        actions.changeToTreeViewScreen();
        break;
    case 'Insert':
        actions.importPagesFromClipboard({ mode: 'import' });
        break;
    case 'Copy':
        actions.copyAllPagesToClipboard();
        break;
    case 'Cut':
        actions.cutAllPages();
        break;
    case 'Menu':
        actions.executeNewFumen();
        break;
    // InsertPage, TreeView, Undo, Redo, Add は長押し動作なし
    }
};

// 長押し動作があるかどうか
const hasEditLongPress = (key: EditShortcutKey): boolean => {
    return key === 'PrevPage' || key === 'NextPage' || key === 'ListView'
        || key === 'Insert' || key === 'Copy' || key === 'Cut' || key === 'Menu';
};

// 現在のページにピースがあるかチェック
const currentPageHasPiece = (state: State): boolean => {
    const page = state.fumen.pages[state.fumen.currentIndex];
    return page?.piece !== undefined;
};

// DAS動作（移動ホールド）があるかどうか
const hasPieceDas = (key: PieceShortcutKey): boolean => {
    return key === 'MoveLeft' || key === 'MoveRight';
};

// ピース移動ホールドを開始する（押下時に1回移動し、DAS後はARR設定に従いリピート）
const startPieceMoveHold = (code: string, key: PieceShortcutKey, state: State) => {
    const move = () => {
        const actions = getActions!();
        if (key === 'MoveLeft') {
            actions.moveToLeft();
        } else {
            actions.moveToRight();
        }
    };
    const moveToEnd = () => {
        const actions = getActions!();
        if (key === 'MoveLeft') {
            actions.moveToLeftEnd();
        } else {
            actions.moveToRightEnd();
        }
    };
    startDasHold(keyboardHoldId(code), {
        move,
        moveToEnd,
        dasFrames: state.mode.pieceShortcutDasFrames,
        arrFrames: state.mode.pieceShortcutArrFrames,
    });
};

const startPieceSoftDropHold = (code: string, state: State) => {
    startSoftDropHold(keyboardHoldId(code), () => {
        const currentActions = getActions!();
        if (state.mode.pieceShortcutSdf === Infinity) {
            currentActions.softdrop();
        } else {
            currentActions.softdropStep();
        }
    }, state.mode.pieceShortcutSdf);
};

// 現在の状態を取得するためのgetter (mainから呼び出し時に設定)
let getState: (() => State) | null = null;
let getActions: (() => Actions) | null = null;

export const initShortcutHandlers = (
    stateGetter: () => State,
    actionsGetter: () => Actions,
) => {
    getState = stateGetter;
    getActions = actionsGetter;

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);
};

const handleKeyDown = (event: KeyboardEvent) => {
    if (!getState || !getActions) return;

    const state = getState();
    const actions = getActions();
    const screen = state.mode.screen;

    // モーダル表示中は無効
    if (isAnyModalOpen(state)) return;

    // 入力フォーカス中は無効
    if (isInputFocused()) return;

    if (event.key === 'Escape') {
        if (state.editorUi.inspector !== 'none') {
            actions.closeEditorInspector();
            event.preventDefault();
            return;
        }
        if (state.rectSelect.status === 'selecting' || state.rectSelect.status === 'floating') {
            actions.cancelRectSelectionPreview();
            event.preventDefault();
            return;
        }
    }

    if (state.editorUi?.primaryTool === 'select'
        && (event.key === 'Delete' || event.key === 'Backspace')
        && (state.rectSelect?.status === 'selected' || state.rectSelect?.status === 'floating')) {
        actions.deleteRectSelection();
        event.preventDefault();
        return;
    }

    // 修飾キー自体は無視
    if (isModifierKey(event.code)) return;

    // リピート防止（event.code のみで判定）
    if (pressedKeys.has(event.code)) return;

    const pieceModeShortcut = screen === Screens.Editor
        && state.editorUi?.primaryTool === 'piece'
        && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey
        ? findKeyByCode(state.mode.pieceShortcuts, event.code) : null;
    if (pieceModeShortcut) {
        event.preventDefault();
        pressedKeys.set(event.code, {
            shortcut: { type: 'piece', key: pieceModeShortcut },
            longPressTimer: null,
            longPressExecuted: false,
        });
        if (currentPageHasPiece(state)) {
            if (pieceModeShortcut === 'SoftDrop') {
                startPieceSoftDropHold(event.code, state);
            } else if (hasPieceDas(pieceModeShortcut)) {
                startPieceMoveHold(event.code, pieceModeShortcut, state);
            } else {
                executePieceShortcut(pieceModeShortcut, actions);
            }
        }
        return;
    }

    // 編集用ショートカットを検索（Mod+対応）
    const editShortcut = findEditShortcutByEvent(state.mode.editShortcuts, event);
    const allowedKeys = allowedEditShortcuts[screen];

    if (state.editorUi?.primaryTool === 'select' && editShortcut !== null) {
        if (editShortcut === 'Copy' && state.rectSelect?.status === 'selected') {
            actions.copyRectSelection();
            event.preventDefault();
            return;
        }
        if (editShortcut === 'Cut' && state.rectSelect?.status === 'selected') {
            actions.cutRectSelection();
            event.preventDefault();
            return;
        }
    }

    if (editShortcut && allowedKeys.includes(editShortcut)) {
        event.preventDefault();
        const pressState: PressedKeyState = {
            shortcut: { type: 'edit', key: editShortcut },
            longPressTimer: null,
            longPressExecuted: false,
        };

        // 長押しタイマー開始（長押し動作がある場合のみ）
        if (hasEditLongPress(editShortcut)) {
            pressState.longPressTimer = setTimeout(() => {
                executeEditLongPress(editShortcut, getState!(), getActions!());
                pressState.longPressExecuted = true;
                pressState.longPressTimer = null;
            }, LONG_PRESS_DURATION);
        }
        pressedKeys.set(event.code, pressState);
        return;
    }

    // 修飾キー押下中はパレット/ピースショートカット無効
    if (event.ctrlKey || event.altKey || event.metaKey) return;

    // エディタ画面以外はパレット/ピースショートカット無効
    if (screen !== Screens.Editor) return;

    // パレットショートカットを検索
    const palette = findKeyByCode(state.mode.paletteShortcuts, event.code);
    if (!palette) return;

    event.preventDefault();
    const palettePressState: PressedKeyState = {
        shortcut: { type: 'palette', key: palette },
        longPressTimer: null,
        longPressExecuted: false,
    };

    // 長押しタイマー開始
    palettePressState.longPressTimer = setTimeout(() => {
        executePaletteLongPress(palette, getActions!());
        palettePressState.longPressExecuted = true;
        palettePressState.longPressTimer = null;
    }, LONG_PRESS_DURATION);
    pressedKeys.set(event.code, palettePressState);
};

const handleKeyUp = (event: KeyboardEvent) => {
    const pressState = pressedKeys.get(event.code);
    if (pressState === undefined) return;
    pressedKeys.delete(event.code);

    // 移動ホールド（DAS/ARR）を停止
    endDasHold(keyboardHoldId(event.code));
    endSoftDropHold(keyboardHoldId(event.code));

    if (!getState || !getActions) {
        if (pressState.longPressTimer !== null) {
            clearTimeout(pressState.longPressTimer);
        }
        return;
    }

    const state = getState();
    const actions = getActions();
    const shortcut = pressState.shortcut;

    // ピースショートカットはkeydownで実行済み、keyupでは何もしない
    if (shortcut.type === 'piece') {
        return;
    }

    // 長押しタイマーが残っていれば短押し
    if (pressState.longPressTimer !== null) {
        clearTimeout(pressState.longPressTimer);
        pressState.longPressTimer = null;

        if (shortcut.type === 'edit') {
            // 非Editor画面では Cut の短押しを無効化（長押しのみ有効）
            // Copy/Insert は Reader/ListView で短押し有効
            const screen = state.mode.screen;
            const isCutShortcut = shortcut.key === 'Cut';
            if (!(screen !== Screens.Editor && isCutShortcut)) {
                executeEditShortPress(shortcut.key, state, actions);
            }
        } else if (shortcut.type === 'palette') {
            executePaletteShortPress(shortcut.key, actions);
        }
    } else if (!pressState.longPressExecuted) {
        // 長押し動作がなかった場合（タイマー設定されない編集ショートカット）
        if (shortcut.type === 'edit' && !hasEditLongPress(shortcut.key)) {
            executeEditShortPress(shortcut.key, state, actions);
        }
    }
};

const handleBlur = () => {
    for (const [code, pressState] of Array.from(pressedKeys.entries())) {
        if (pressState.longPressTimer !== null) {
            clearTimeout(pressState.longPressTimer);
        }
        endDasHold(keyboardHoldId(code));
    }
    pressedKeys.clear();
};
