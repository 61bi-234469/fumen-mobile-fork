import {
    defaultEditShortcuts,
    defaultPaletteShortcuts,
    defaultPieceShortcuts,
    EditShortcuts,
    initState,
    PaletteShortcuts,
    PieceShortcuts,
    State,
} from './states';
import { view } from './view';
import { app } from 'hyperapp';
import { default as i18next } from 'i18next';
import { default as LanguageDetector } from 'i18next-browser-languagedetector';
import { resources as resourcesJa } from './locales/ja/translation';
import { resources as resourcesEn } from './locales/en/translation';
import { NextState } from './actions/commons';
import { fieldEditorActions, FieldEditorActions } from './actions/field_editor';
import { animationActions, AnimationActions } from './actions/animation';
import { modeActions, ScreenActions } from './actions/screen';
import { modalActions, ModalActions } from './actions/modal';
import { pageActions, PageActions } from './actions/pages';
import { setterActions, SetterActions } from './actions/setter';
import { UtilsActions, utilsActions } from './actions/utils';
import { mementoActions, MementoActions } from './actions/memento';
import { CommentActions, commentActions } from './actions/comment';
import { convertActions, ConvertActions } from './actions/convert';
import { userSettingsActions, UserSettingsActions } from './actions/user_settings';
import { listViewActions, ListViewActions } from './actions/list_view';
import { editorPanelActions, EditorPanelActions } from './actions/editor_panel';
import { treeOperationActions, TreeOperationActions } from './actions/tree_operations';
import { coldClearActions, ColdClearActions, initColdClearActions } from './actions/cold_clear';
import { i18n } from './locales/keys';
import { syncSeoMetadata } from './lib/seo';
import { getURLQuery, Query } from './params';
import { localStorageWrapper } from './memento';
import { TreeViewMode } from './lib/fumen/tree_types';
import { initShortcutHandlers } from './actions/shortcuts';
import { normalizeGifFrameDelayMs } from './lib/gif_export';
import { editorInteractionActions, EditorInteractionActions } from './actions/editor_interaction';
import { rectSelectActions, RectSelectActions } from './actions/rect_select';
import { replayActions, ReplayActions } from './actions/replay';
import { replayAnalysisActions, ReplayAnalysisActions } from './actions/replay_analysis';
import { isValidSdf, millisecondsToFrames, registerPieceDragGuard } from './lib/piece_das';
import { restoreViewSettings } from './actions/restore_view_settings';

export type action = (state: Readonly<State>) => NextState;

declare const __DEBUG__: boolean;

export type Actions = AnimationActions
    & ScreenActions
    & ModalActions
    & PageActions
    & SetterActions
    & UtilsActions
    & MementoActions
    & FieldEditorActions
    & CommentActions
    & ConvertActions
    & UserSettingsActions
    & ListViewActions
    & EditorPanelActions
    & TreeOperationActions
    & ColdClearActions
    & EditorInteractionActions
    & RectSelectActions
    & ReplayActions
    & ReplayAnalysisActions;

export const actions: Readonly<Actions> = {
    ...animationActions,
    ...modeActions,
    ...modalActions,
    ...pageActions,
    ...setterActions,
    ...utilsActions,
    ...mementoActions,
    ...fieldEditorActions,
    ...commentActions,
    ...convertActions,
    ...userSettingsActions,
    ...listViewActions,
    ...editorPanelActions,
    ...treeOperationActions,
    ...coldClearActions,
    ...editorInteractionActions,
    ...rectSelectActions,
    ...replayActions,
    ...replayAnalysisActions,
};

// Current state getter for shortcut handlers
let currentState: State = initState;

// Mounting
const mount = (): Actions => {
    // Wrap view to track state changes
    const wrappedView = (state: State, actions: Actions) => {
        currentState = state;
        return view(state, actions);
    };
    if (__DEBUG__) {
        // This direct compile-time condition lets production builds remove the
        // logger module from the dependency graph altogether.
        // tslint:disable-next-line:no-var-requires
        const { withLogger } = require('@hyperapp/logger') as typeof import('@hyperapp/logger');
        return withLogger(app)(initState, actions, wrappedView, document.body);
    }
    return app<State, Actions>(initState, actions, wrappedView, document.body);
};
export const main = mount();

// Initialize shortcut handlers
initShortcutHandlers(
    () => currentState,
    () => main,
);
registerPieceDragGuard(() => currentState.events.drawing);

// Initialize Cold Clear actions reference
initColdClearActions(main as any);

// Track last loaded URL parameters to avoid duplicate loads
let lastUrlParams: {
    d: string | undefined;
    tree: string | undefined;
    treeView: string | undefined;
    screen: string | undefined;
} | null = null;

const handleUrlChange = () => {
    const urlQuery = getURLQuery();
    const currentParams = {
        d: urlQuery.get('d'),
        tree: urlQuery.get('tree'),
        treeView: urlQuery.get('treeView'),
        screen: urlQuery.get('screen'),
    };

    // Initialize on first call (initial page load handles this separately)
    if (lastUrlParams === null) {
        lastUrlParams = currentParams;
        return;
    }

    const dChanged = currentParams.d !== lastUrlParams.d;
    const treeChanged = currentParams.tree !== lastUrlParams.tree;
    const treeViewChanged = currentParams.treeView !== lastUrlParams.treeView;
    const screenChanged = currentParams.screen !== lastUrlParams.screen;

    // Update tracking
    lastUrlParams = currentParams;

    // Case 1: fumen data changed - reload via loadFumen
    // loadPages now handles screen param internally
    if (dChanged && currentParams.d !== undefined) {
        main.loadFumen({ fumen: currentParams.d });
        return;
    }

    // Case 2: Only tree/treeView/screen changed (d unchanged or absent)
    if (treeChanged || treeViewChanged || screenChanged) {
        applyParamsWithoutReload(currentParams);
    }
};

const applyParamsWithoutReload = (params: {
    tree: string | undefined;
    treeView: string | undefined;
    screen: string | undefined;
}) => {
    const treeEnabled = params.tree === '1' || params.tree === 'true';
    const isTreeView = params.treeView === 'tree';

    // Handle screen change with appropriate tree state
    if (params.screen === 'list') {
        if (treeEnabled && isTreeView) {
            main.changeToTreeViewScreen();
        } else {
            main.changeToListViewScreen();
        }
    } else if (params.screen === 'edit' || params.screen === 'editor') {
        main.changeToDrawerScreen({});
    } else if (params.screen === 'read' || params.screen === 'reader') {
        main.changeToReaderScreen();
    } else if (params.tree !== undefined || params.treeView !== undefined) {
        // No screen change but tree params changed
        main.setTreeState({
            enabled: params.tree !== undefined ? treeEnabled : undefined,
            viewMode: isTreeView ? TreeViewMode.Tree : TreeViewMode.List,
        });
    }
};

window.addEventListener('hashchange', handleUrlChange);
window.addEventListener('popstate', handleUrlChange);

window.onresize = () => {
    main.resize({
        width: window.document.body.clientWidth,
        height: window.document.body.clientHeight,
    });
};

declare const M: any;

window.addEventListener('load', () => {
    const urlQuery = getURLQuery();

    // Initialize URL tracking
    lastUrlParams = {
        d: urlQuery.get('d'),
        tree: urlQuery.get('tree'),
        treeView: urlQuery.get('treeView'),
        screen: urlQuery.get('screen'),
    };

    setupI18n(urlQuery);
    // loadFumen の decode は非同期のため、同期の loadUserSettings が必ず先に完了する。
    // loadPages(initialLoad) は state.mode の initialScreen 等を参照するので、この順序を崩さないこと。
    loadFumen(urlQuery);
    loadUserSettings();
});

const setupI18n = (urlQuery: Query) => {
    // i18nの設定
    const languageDetector = new LanguageDetector(null, {
        order: ['myQueryDetector', 'querystring', 'navigator', 'path', 'subdomain'],
        cookieMinutes: 0,
    });
    languageDetector.addDetector({
        name: 'myQueryDetector',
        lookup() {
            return urlQuery.get('lng');
        },
        cacheUserLanguage() {
            // do nothing
        },
    });
    i18next
        .use(languageDetector)
        .init({
            fallbackLng: 'en',
            resources: {
                en: { translation: resourcesEn },
                ja: { translation: resourcesJa },
            },
        })
        .then(() => {
            const language = (i18next.language || '').toLowerCase().startsWith('ja') ? 'ja' : 'en';
            syncSeoMetadata({
                language,
                title: i18n.Seo.Title(),
                description: i18n.Seo.Description(),
            });
            main.refresh();
        })
        .catch(() => {
            console.error('Failed to load i18n');
            // 初期化に失敗するとUIはfallbackLngの英語になるため、documentの言語と文面も英語へ揃える。
            // i18next.tはキー名をそのまま返すので、翻訳リソースを直接参照する。
            syncSeoMetadata({
                language: 'en',
                title: resourcesEn.Seo.Title,
                description: resourcesEn.Seo.Description,
            });
        });
};

const loadFumen = (urlQuery: Query) => {
    // URLからロードする
    {
        const fumen = urlQuery.get('d');
        if (fumen !== undefined) {
            return main.loadFumen({ fumen, initialLoad: true });
        }
    }

    // LocalStrageからロードする
    {
        const fumen = localStorageWrapper.loadFumen();
        if (fumen) {
            M.toast({ html: i18n.Top.RestoreFromStorage(), classes: 'top-toast', displayLength: 1500 });
            return main.loadFumen({ fumen, initialLoad: true });
        }
    }

    // 空のフィールドを読み込む
    return main.loadNewFumen({ initialLoad: true });
};

const loadUserSettings = () => {
    let updated = false;
    const settings = localStorageWrapper.loadUserSettings();

    if (settings.ghostVisible !== undefined) {
        main.changeGhostVisible({ visible: settings.ghostVisible });
        updated = true;
    }

    if (settings.deleteSpawnMinoOnPaintDrag !== undefined) {
        main.changeDeleteSpawnMinoOnPaintDrag({ enable: settings.deleteSpawnMinoOnPaintDrag });
        updated = true;
    }

    if (settings.paintPaletteMinoDesign !== undefined) {
        main.changePaintPaletteMinoDesign({ enable: settings.paintPaletteMinoDesign });
        updated = true;
    }

    if (settings.flagsHidden !== undefined) {
        main.changeFlagsHidden({ hidden: settings.flagsHidden });
        updated = true;
    }

    if (settings.initialScreen !== undefined) {
        main.changeInitialScreen({ initialScreen: settings.initialScreen });
        updated = true;
    }

    if (settings.openTreeScreenOnTreeData !== undefined) {
        main.changeOpenTreeScreenOnTreeData({ enable: settings.openTreeScreenOnTreeData });
        updated = true;
    }

    if (settings.utilsMenuPinned !== undefined) {
        main.changeUtilsMenuPinned({ enable: settings.utilsMenuPinned });
        updated = true;
    }

    if (settings.loop !== undefined) {
        main.changeLoop({ enable: settings.loop });
        updated = true;
    }

    if (settings.shortcutLabelVisible !== undefined) {
        main.changeShortcutLabelVisible({ visible: settings.shortcutLabelVisible });
        updated = true;
    }

    if (settings.gradient !== undefined) {
        main.changeGradient({ gradientStr: settings.gradient });
        updated = true;
    }

    if (settings.paletteShortcuts !== undefined) {
        try {
            const parsed = JSON.parse(settings.paletteShortcuts) as Partial<PaletteShortcuts>;
            const shortcuts: PaletteShortcuts = { ...defaultPaletteShortcuts };
            for (const key of Object.keys(shortcuts) as (keyof PaletteShortcuts)[]) {
                if (parsed[key] !== undefined) {
                    shortcuts[key] = parsed[key]!;
                }
            }
            main.changePaletteShortcuts({ paletteShortcuts: shortcuts });
            updated = true;
        } catch (e) {
            console.error('Failed to parse palette shortcuts:', e);
        }
    }

    if (settings.editShortcuts !== undefined) {
        try {
            const parsed = JSON.parse(settings.editShortcuts) as Partial<EditShortcuts>;
            const shortcuts: EditShortcuts = { ...defaultEditShortcuts };
            for (const key of Object.keys(shortcuts) as (keyof EditShortcuts)[]) {
                if (parsed[key] !== undefined) {
                    shortcuts[key] = parsed[key]!;
                }
            }
            main.changeEditShortcuts({ editShortcuts: shortcuts });
            updated = true;
        } catch (e) {
            console.error('Failed to parse edit shortcuts:', e);
        }
    }

    // Load piece shortcuts independently from palette and edit shortcuts.
    if (settings.pieceShortcuts !== undefined) {
        try {
            const parsed = JSON.parse(settings.pieceShortcuts) as Partial<PieceShortcuts>;
            const shortcuts: PieceShortcuts = { ...defaultPieceShortcuts };
            for (const key of Object.keys(shortcuts) as (keyof PieceShortcuts)[]) {
                if (parsed[key] !== undefined) {
                    shortcuts[key] = parsed[key]!;
                }
            }
            const legacyDrop = (parsed as Partial<PieceShortcuts> & { Drop?: string }).Drop;
            if (parsed.SoftDrop === undefined && legacyDrop !== undefined) {
                shortcuts.SoftDrop = legacyDrop;
            }

            main.changePieceShortcuts({ pieceShortcuts: shortcuts });
            updated = true;
        } catch (e) {
            console.error('Failed to parse piece shortcuts:', e);
        }
    }

    const dasFrames = settings.pieceShortcutDasFrames
        ?? (settings.pieceShortcutDasMs === undefined ? undefined
            : millisecondsToFrames(settings.pieceShortcutDasMs));
    if (dasFrames !== undefined) {
        main.changePieceShortcutDas({ dasFrames });
        updated = true;
    }

    const arrFrames = settings.pieceShortcutArrFrames
        ?? (settings.pieceShortcutArrMs === undefined ? undefined
            : millisecondsToFrames(settings.pieceShortcutArrMs));
    if (arrFrames !== undefined) {
        main.changePieceShortcutArr({ arrFrames });
        updated = true;
    }

    if (settings.pieceShortcutDasCutFrames !== undefined) {
        main.changePieceShortcutDasCut({ dasCutFrames: settings.pieceShortcutDasCutFrames });
        updated = true;
    }
    const sdf = settings.pieceShortcutSdf;
    if (isValidSdf(sdf)) {
        main.changePieceShortcutSdf({ sdf });
        updated = true;
    }
    if (settings.pieceShortcutSoftDropPriority !== undefined) {
        main.changePieceShortcutSoftDropPriority({ enable: settings.pieceShortcutSoftDropPriority });
        updated = true;
    }

    if (settings.gifFrameDelayMs !== undefined) {
        main.changeGifFrameDelay({ delayMs: normalizeGifFrameDelayMs(settings.gifFrameDelayMs) });
        updated = true;
    }

    if (settings.rotationSystem !== undefined) {
        main.changeRotationSystem({ rotationSystem: settings.rotationSystem });
        updated = true;
    }

    if (settings.sevenBagGrayEnabled !== undefined) {
        main.changeSevenBagGrayEnabled({ enable: settings.sevenBagGrayEnabled });
        updated = true;
    }

    if (settings.pageRotationLimit !== undefined) {
        main.changePageRotationLimit({ limit: settings.pageRotationLimit });
        updated = true;
    }

    restoreViewSettings(main, localStorageWrapper.loadViewSettings());

    if (updated) {
        main.reopenCurrentPage();
    }
};

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((registration) => {
            console.log('SW registered: ', registration);
        }).catch((registrationError) => {
            console.error('SW registration failed: ', registrationError);
        });
    });
}
