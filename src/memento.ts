import { HistoryTask, isOperationTask, toDecoratorOperationTask } from './history_task';
import { generateKey } from './lib/random';
import { Page } from './lib/fumen/types';
import { TreeOperationScope, TreeViewMode } from './lib/fumen/tree_types';
import { encode } from './lib/fumen/fumen';
import { EditorSidePanelTab, RotationSystem } from './states';
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
    let redoQueue: HistoryTask[] = [];
    let redoViewModes: (TreeViewMode | undefined)[] = [];

    return {
        // 自動保存
        save: (pages: Page[]) => {
            saver(pages);
        },
        // タスクの追加
        register: (task: HistoryTask, mergeKey?: string, viewMode?: TreeViewMode): number => {
            const lastTask = undoQueue[undoQueue.length - 1];

            if (lastTask !== undefined && lastTask.key === mergeKey
                && isOperationTask(lastTask) && isOperationTask(task)
            ) {
                // keyが同じときはくっつける
                // 現時点では OperationTask 同士のみ対応
                undoQueue[undoQueue.length - 1] = toDecoratorOperationTask(lastTask, task);
                undoViewModes[undoViewModes.length - 1] = viewMode;
            } else {
                // そのまま追加する
                if (undoQueue.length < 200) {
                    undoQueue.push(task);
                    undoViewModes.push(viewMode);
                } else {
                    undoQueue.shift();
                    undoViewModes.shift();
                    undoQueue.push(task);
                    undoViewModes.push(viewMode);
                }
            }

            redoQueue = [];
            redoViewModes = [];
            return undoQueue.length - 1;
        },
        undo: async (pages: Page[]): Promise<Result | undefined> => {
            const lastTask = undoQueue.pop();
            const lastViewMode = undoViewModes.pop();
            if (lastTask === undefined) {
                return undefined;
            }

            redoQueue.push(lastTask);
            redoViewModes.push(lastViewMode);

            const result = lastTask.fixed ? (await lastTask.revert()) : lastTask.revert(pages);
            return {
                pages: result.pages,
                index: result.index,
                undoCount: undoQueue.length - 1,
                redoCount: redoQueue.length,
                treeViewMode: lastViewMode,
            };
        },
        redo: async (pages: Page[]): Promise<Result | undefined> => {
            const lastTask = redoQueue.pop();
            const lastViewMode = redoViewModes.pop();
            if (lastTask === undefined) {
                return undefined;
            }

            undoQueue.push(lastTask);
            undoViewModes.push(lastViewMode);

            const result = lastTask.fixed ? (await lastTask.replay()) : lastTask.replay(pages);
            return {
                pages: result.pages,
                index: result.index,
                undoCount: undoQueue.length - 1,
                redoCount: redoQueue.length,
                treeViewMode: lastViewMode,
            };
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
    flagsHidden: boolean;
    initialScreen: InitialScreenSetting;
    openTreeScreenOnTreeData: boolean;
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
    pieceShortcutDasMs?: number;
    pieceShortcutArrMs?: number;
    gifFrameDelayMs: number;
    rotationSystem: RotationSystem;
    noGrayAfterHardDrop: boolean;
}

interface ViewSettings {
    trimTopBlank: boolean;
    shortenUrls: boolean;
    treeOperationScope: TreeOperationScope;
    grayAfterLineClear: boolean;
    editorSidePanel: boolean;
    editorSidePanelTab: EditorSidePanelTab;
    editorSidePanelWidth: number | null;
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
            flagsHidden: safer.boolean(obj.flagsHidden),
            initialScreen: initialScreenSettingFrom(obj),
            openTreeScreenOnTreeData: safer.boolean(obj.openTreeScreenOnTreeData),
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
            pieceShortcutDasMs: safer.number(obj.pieceShortcutDasMs),
            pieceShortcutArrMs: safer.number(obj.pieceShortcutArrMs),
            gifFrameDelayMs: safer.number(obj.gifFrameDelayMs),
            rotationSystem: safer.rotationSystem(obj.rotationSystem),
            noGrayAfterHardDrop: safer.boolean(obj.noGrayAfterHardDrop),
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
            treeOperationScope: safer.treeOperationScope(obj.treeOperationScope)
                ?? (legacyScope === undefined ? undefined : legacyScope ? 'subtree' : 'node'),
            grayAfterLineClear: safer.boolean(obj.grayAfterLineClear),
            editorSidePanel: safer.boolean(obj.editorSidePanel),
            editorSidePanelTab: safer.editorSidePanelTab(obj.editorSidePanelTab),
            editorSidePanelWidth: obj.editorSidePanelWidth === null
                ? null
                : safer.number(obj.editorSidePanelWidth),
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
