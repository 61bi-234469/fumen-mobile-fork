import { HistoryTask, isOperationTask, toDecoratorOperationTask } from './history_task';
import { generateKey } from './lib/random';
import { Page } from './lib/fumen/types';
import { TreeOperationScope, TreeViewMode } from './lib/fumen/tree_types';
import { encode } from './lib/fumen/fumen';
import { EditorSidePanelTab, PieceLayoutMode, RotationSystem } from './states';
import { InitialScreenSetting, initialScreenSettingFrom } from './lib/initial_screen';
import lodash from 'lodash';

interface SaverProp {
    saveKey: string;
    pages: Page[];
}

type SaverObj = { save: (key: string) => Promise<void> };

const saverState = {
    isWorking: false,
    last: {
        key: generateKey(),
        saverObj: undefined as (SaverObj | undefined),
    },
};

const sequentialEncode = async (pages: Page[]): Promise<string> => {
    saverState.isWorking = true;
    const data = await encode(pages, true);
    saverState.isWorking = false;
    return `v115@${data}`;
};

const toSaver = ({ saveKey, pages }: SaverProp, saveCallback: (data: string) => void) => {
    let isSaved = false;
    return {
        save: async (key: string) => {
            if (isSaved || key !== saveKey) {
                return;
            }
            isSaved = true;

            const data = await sequentialEncode(pages);
            setTimeout(() => saveCallback(data), 0);

            const last = saverState.last;
            if (last.saverObj !== undefined) {
                await last.saverObj.save(last.key);
            }
        },
    };
};

const saver = (() => {
    return (pages: Page[]) => {
        const key = generateKey();
        const saverObj: SaverObj = toSaver({
            pages,
            saveKey: key,
        }, (data: string) => {
            localStorageWrapper.saveFumen(data);
        });
        saverState.last = { key, saverObj };

        setTimeout(() => {
            saverObj.save(saverState.last.key)
                .catch(error => console.error(error));
        }, saverState.isWorking ? 3000 : 0);
    };
})();

interface Result {
    pages: Page[];
    index: number;
    undoCount: number;
    redoCount: number;
    treeViewMode?: TreeViewMode;
}

export const memento = (() => {
    const undoQueue: HistoryTask[] = [];
    const undoViewModes: (TreeViewMode | undefined)[] = [];
    // undoQueue[i] を適用し終えた状態が「ミノのスポーン直後」であることを示す
    const undoSpawnFlags: boolean[] = [];
    let redoQueue: HistoryTask[] = [];
    let redoViewModes: (TreeViewMode | undefined)[] = [];
    let redoSpawnFlags: boolean[] = [];

    // undoQueue[0] はフメン読み込みの基点タスクで戻せないため、境界探索は1以上に限る。
    // フメン読み込み (toFumenTask) はページ全体を差し替える fixed タスクで、
    // 読み込みより前は別のキューセッションになる。そこを越えて巻き戻すと1回の戻るで
    // 以前のフメンへ戻ってしまうため、探索の停止点にする。
    const lastSpawnIndexAtMost = (maxIndex: number): number => {
        for (let i = Math.min(maxIndex, undoQueue.length - 1); 1 <= i; i -= 1) {
            if (undoQueue[i].fixed) {
                return -1;
            }
            if (undoSpawnFlags[i]) {
                return i;
            }
        }
        return -1;
    };

    // 巻き戻し先として残すインデックス。undefinedのときは単発undoへフォールバックする
    const findRewindTarget = (currentPieceSpawned: boolean): number | undefined => {
        const top = undoQueue.length - 1;
        if (top < 1) {
            return undefined;
        }

        const current = lastSpawnIndexAtMost(top);
        if (current < 0) {
            return undefined;
        }
        const previous = lastSpawnIndexAtMost(current - 1);

        // カレントミノがあるときは一つ手前のスポーンまで、ないときは直近のスポーンまで戻す
        const candidates = currentPieceSpawned ? [previous, current] : [current, previous];
        for (const candidate of candidates) {
            if (1 <= candidate && candidate < top) {
                return candidate;
            }
        }
        return undefined;
    };

    const revertOnce = async (pages: Page[]): Promise<Result | undefined> => {
        const lastTask = undoQueue.pop();
        const lastViewMode = undoViewModes.pop();
        const lastSpawnFlag = undoSpawnFlags.pop() ?? false;
        if (lastTask === undefined) {
            return undefined;
        }

        redoQueue.push(lastTask);
        redoViewModes.push(lastViewMode);
        redoSpawnFlags.push(lastSpawnFlag);

        const result = lastTask.fixed ? (await lastTask.revert()) : lastTask.revert(pages);
        return {
            pages: result.pages,
            index: result.index,
            undoCount: undoQueue.length - 1,
            redoCount: redoQueue.length,
            treeViewMode: lastViewMode,
        };
    };

    const replayOnce = async (pages: Page[]): Promise<Result | undefined> => {
        const lastTask = redoQueue.pop();
        const lastViewMode = redoViewModes.pop();
        const lastSpawnFlag = redoSpawnFlags.pop() ?? false;
        if (lastTask === undefined) {
            return undefined;
        }

        undoQueue.push(lastTask);
        undoViewModes.push(lastViewMode);
        undoSpawnFlags.push(lastSpawnFlag);

        const result = lastTask.fixed ? (await lastTask.replay()) : lastTask.replay(pages);
        return {
            pages: result.pages,
            index: result.index,
            undoCount: undoQueue.length - 1,
            redoCount: redoQueue.length,
            treeViewMode: lastViewMode,
        };
    };

    const isOnSpawnBoundary = (): boolean => {
        return 1 <= undoQueue.length && undoSpawnFlags[undoQueue.length - 1];
    };

    return {
        // 自動保存
        save: (pages: Page[]) => {
            saver(pages);
        },
        // タスクの追加
        register: (
            task: HistoryTask, mergeKey?: string, viewMode?: TreeViewMode, pieceSpawn: boolean = false,
        ): number => {
            const lastTask = undoQueue[undoQueue.length - 1];

            if (lastTask !== undefined && lastTask.key === mergeKey
                && isOperationTask(lastTask) && isOperationTask(task)
            ) {
                // keyが同じときはくっつける
                // 現時点では OperationTask 同士のみ対応
                // 結合後のエントリの終端状態は新しいタスクの終端状態になるため、フラグも上書きする
                undoQueue[undoQueue.length - 1] = toDecoratorOperationTask(lastTask, task);
                undoViewModes[undoViewModes.length - 1] = viewMode;
                undoSpawnFlags[undoSpawnFlags.length - 1] = pieceSpawn;
            } else {
                // そのまま追加する
                if (undoQueue.length < 200) {
                    undoQueue.push(task);
                    undoViewModes.push(viewMode);
                    undoSpawnFlags.push(pieceSpawn);
                } else {
                    undoQueue.shift();
                    undoViewModes.shift();
                    undoSpawnFlags.shift();
                    undoQueue.push(task);
                    undoViewModes.push(viewMode);
                    undoSpawnFlags.push(pieceSpawn);
                }
            }

            redoQueue = [];
            redoViewModes = [];
            redoSpawnFlags = [];
            return undoQueue.length - 1;
        },
        undo: async (pages: Page[]): Promise<Result | undefined> => {
            return revertOnce(pages);
        },
        // INPUT + NEXTキュー用。一つ手前のミノがスポーンされた直後の状態まで一括で戻す
        undoToPieceSpawn: async (
            pages: Page[], { currentPieceSpawned }: { currentPieceSpawned: boolean },
        ): Promise<Result | undefined> => {
            const target = findRewindTarget(currentPieceSpawned);
            if (target === undefined) {
                return revertOnce(pages);
            }

            let result: Result | undefined;
            let currentPages = pages;
            while (target < undoQueue.length - 1) {
                const reverted = await revertOnce(currentPages);
                if (reverted === undefined) {
                    break;
                }
                result = reverted;
                currentPages = reverted.pages;
            }
            return result;
        },
        redo: async (pages: Page[]): Promise<Result | undefined> => {
            return replayOnce(pages);
        },
        // undoToPieceSpawn と対称。境界上にいるときだけ次のスポーン直後まで一括で進める
        redoToPieceSpawn: async (pages: Page[]): Promise<Result | undefined> => {
            if (!isOnSpawnBoundary()) {
                return replayOnce(pages);
            }

            let result: Result | undefined;
            let currentPages = pages;
            while (0 < redoQueue.length) {
                const replayed = await replayOnce(currentPages);
                if (replayed === undefined) {
                    break;
                }
                result = replayed;
                currentPages = replayed.pages;
                if (isOnSpawnBoundary()) {
                    break;
                }
            }
            return result;
        },
        lastKey: (): (string | undefined) => {
            const lastTask = undoQueue[undoQueue.length - 1];
            return lastTask !== undefined ? lastTask.key : undefined;
        },
    };
})();

interface UserSettings {
    ghostVisible: boolean;
    deleteSpawnMinoOnPaintDrag: boolean;
    paintPaletteMinoDesign: boolean;
    flagsHidden: boolean;
    initialScreen: InitialScreenSetting;
    openTreeScreenOnTreeData: boolean;
    utilsMenuPinned: boolean;
    loop: boolean;
    shortcutLabelVisible: boolean;
    gradient: string;  // Pieceの順に数字で保存する e.g., 112233001
    paletteShortcuts: string;  // JSON文字列で保存
    editShortcuts: string;  // JSON文字列で保存
    pieceShortcuts: string;  // JSON文字列で保存
    pieceShortcutDasFrames: number;
    pieceShortcutArrFrames: number;
    pieceShortcutDasCutFrames: number;
    pieceShortcutSdf: number | string;
    pieceShortcutSoftDropPriority: boolean;
    pieceShortcutDasMs?: number;
    pieceShortcutArrMs?: number;
    gifFrameDelayMs: number;
    rotationSystem: RotationSystem;
    sevenBagGrayEnabled: boolean;
    pageRotationLimit: number;
}

interface ViewSettings {
    trimTopBlank: boolean;
    shortenUrls: boolean;
    listViewMenuTab: 'export' | 'import';
    treeOperationScope: TreeOperationScope;
    grayAfterLineClear: boolean;
    editorSidePanel: boolean;
    editorSidePanelTab: EditorSidePanelTab;
    editorSidePanelWidth: number | null;
    pieceLayout: PieceLayoutMode;
    coldClearTopBranchCount: number;
    coldClearHoldAllowed: boolean;
    coldClearSpeculate: boolean;
    coldClearNextLimit: number | null;
    coldClearWeightsPreset: number;
    coldClearThinkMs: number;
}

const safer = {
    fumenV115: (value: any): string | undefined => {
        const safeString = safer.string(value);
        const re = /^v115@[a-zA-Z0-9+/?]+$/;
        return safeString && re.test(safeString) ? safeString : undefined;
    },
    string: (value: any): string | undefined => {
        return lodash.isString(value) ? value : undefined;
    },
    boolean: (value: any): boolean | undefined => {
        return lodash.isBoolean(value) ? value : undefined;
    },
    number: (value: any): number | undefined => {
        return lodash.isNumber(value) && !isNaN(value) ? value : undefined;
    },
    // 欠損・不正値時はguideline SRS相当の 'srs' にフォールバックする（後方互換重視）。
    rotationSystem: (value: any): RotationSystem => {
        return value === 'classic' || value === 'srs' || value === 'srsPlus' ? value : 'srs';
    },
    editorSidePanelTab: (value: any): EditorSidePanelTab | undefined => {
        return value === 'list' || value === 'tree' ? value : undefined;
    },
    listViewMenuTab: (value: any): 'export' | 'import' | undefined => {
        return value === 'export' || value === 'import' ? value : undefined;
    },
    pieceLayout: (value: any): PieceLayoutMode | undefined => {
        return value === 'play' || value === 'select' ? value : undefined;
    },
    treeOperationScope: (value: any): TreeOperationScope | undefined => {
        return value === 'node' || value === 'subtree' || value === 'descendants' ? value : undefined;
    },
};

export const localStorageWrapper = {
    saveFumen: (data: string) => {
        localStorage.setItem('data@1', data);
    },
    loadFumen: (): string | undefined => {
        const data = localStorage.getItem('data@1');
        return safer.fumenV115(data);
    },
    saveUserSettings: (data: UserSettings) => {
        localStorage.setItem('user-settings@1', JSON.stringify(data));
    },
    loadUserSettings: (): Partial<UserSettings> => {
        const data = localStorage.getItem('user-settings@1');
        if (!data) {
            return {};
        }
        const obj = JSON.parse(data);

        return {
            ghostVisible: safer.boolean(obj.ghostVisible),
            deleteSpawnMinoOnPaintDrag: safer.boolean(obj.deleteSpawnMinoOnPaintDrag),
            paintPaletteMinoDesign: safer.boolean(obj.paintPaletteMinoDesign),
            flagsHidden: safer.boolean(obj.flagsHidden),
            initialScreen: initialScreenSettingFrom(obj),
            openTreeScreenOnTreeData: safer.boolean(obj.openTreeScreenOnTreeData),
            utilsMenuPinned: safer.boolean(obj.utilsMenuPinned),
            loop: safer.boolean(obj.loop),
            shortcutLabelVisible: safer.boolean(obj.shortcutLabelVisible),
            gradient: safer.string(obj.gradient),
            paletteShortcuts: safer.string(obj.paletteShortcuts),
            editShortcuts: safer.string(obj.editShortcuts),
            pieceShortcuts: safer.string(obj.pieceShortcuts),
            pieceShortcutDasFrames: safer.number(obj.pieceShortcutDasFrames),
            pieceShortcutArrFrames: safer.number(obj.pieceShortcutArrFrames),
            pieceShortcutDasCutFrames: safer.number(obj.pieceShortcutDasCutFrames),
            pieceShortcutSdf: obj.pieceShortcutSdf === 'Infinity' ? Infinity : safer.number(obj.pieceShortcutSdf),
            pieceShortcutSoftDropPriority: safer.boolean(obj.pieceShortcutSoftDropPriority),
            pieceShortcutDasMs: safer.number(obj.pieceShortcutDasMs),
            pieceShortcutArrMs: safer.number(obj.pieceShortcutArrMs),
            gifFrameDelayMs: safer.number(obj.gifFrameDelayMs),
            rotationSystem: safer.rotationSystem(obj.rotationSystem),
            sevenBagGrayEnabled: safer.boolean(obj.sevenBagGrayEnabled),
            pageRotationLimit: safer.number(obj.pageRotationLimit),
        };
    },
    saveViewSettings: (data: ViewSettings) => {
        localStorage.setItem('view-settings@1', JSON.stringify(data));
    },
    loadViewSettings: (): Partial<ViewSettings> => {
        const data = localStorage.getItem('view-settings@1');
        if (!data) {
            return {};
        }

        let obj: any;
        try {
            obj = JSON.parse(data);
        } catch {
            return {};
        }

        const legacyScope = safer.boolean(obj.buttonDropMovesSubtree);
        return {
            trimTopBlank: safer.boolean(obj.trimTopBlank),
            shortenUrls: safer.boolean(obj.shortenUrls),
            listViewMenuTab: safer.listViewMenuTab(obj.listViewMenuTab),
            treeOperationScope: safer.treeOperationScope(obj.treeOperationScope)
                ?? (legacyScope === undefined ? undefined : legacyScope ? 'subtree' : 'node'),
            grayAfterLineClear: safer.boolean(obj.grayAfterLineClear),
            editorSidePanel: safer.boolean(obj.editorSidePanel),
            editorSidePanelTab: safer.editorSidePanelTab(obj.editorSidePanelTab),
            editorSidePanelWidth: obj.editorSidePanelWidth === null
                ? null
                : safer.number(obj.editorSidePanelWidth),
            pieceLayout: safer.pieceLayout(obj.pieceLayout),
            coldClearTopBranchCount: safer.number(obj.coldClearTopBranchCount),
            coldClearHoldAllowed: safer.boolean(obj.coldClearHoldAllowed),
            coldClearSpeculate: safer.boolean(obj.coldClearSpeculate),
            coldClearNextLimit: obj.coldClearNextLimit === null
                ? null
                : safer.number(obj.coldClearNextLimit),
            coldClearWeightsPreset: safer.number(obj.coldClearWeightsPreset),
            coldClearThinkMs: safer.number(obj.coldClearThinkMs),
        };
    },
};
