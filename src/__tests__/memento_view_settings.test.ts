/** @jest-environment jsdom */

import { localStorageWrapper } from '../memento';

describe('view settings tree operation scope migration', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('migrates the legacy boolean true to subtree', () => {
        localStorage.setItem('view-settings@1', JSON.stringify({ buttonDropMovesSubtree: true }));

        expect(localStorageWrapper.loadViewSettings().treeOperationScope).toBe('subtree');
    });

    test('migrates the legacy boolean false to node', () => {
        localStorage.setItem('view-settings@1', JSON.stringify({ buttonDropMovesSubtree: false }));

        expect(localStorageWrapper.loadViewSettings().treeOperationScope).toBe('node');
    });

    test('prefers a valid enum value and rejects an invalid value without legacy data', () => {
        localStorage.setItem('view-settings@1', JSON.stringify({ treeOperationScope: 'descendants' }));
        expect(localStorageWrapper.loadViewSettings().treeOperationScope).toBe('descendants');

        localStorage.setItem('view-settings@1', JSON.stringify({ treeOperationScope: 'invalid' }));
        expect(localStorageWrapper.loadViewSettings().treeOperationScope).toBeUndefined();
    });

    test('saves the enum under the new key only', () => {
        localStorageWrapper.saveViewSettings({
            trimTopBlank: false,
            shortenUrls: false,
            exportShowPageNumbers: true,
            exportShowComments: false,
            listViewMenuTab: 'import',
            treeOperationScope: 'descendants',
            grayAfterLineClear: false,
            editorSidePanel: false,
            editorSidePanelTab: 'list',
            editorSidePanelWidth: null,
            pieceLayout: 'play',
            coldClearTopBranchCount: 3,
            coldClearHoldAllowed: true,
            coldClearSpeculate: true,
            coldClearNextLimit: null,
            coldClearWeightsPreset: 0,
            coldClearThinkMs: 1000,
            coldClearInputGuideEnabled: true,
            replaySelfPlayer: null,
            replayShowOpponent: true,
            replayAnalysisThinkMs: 100,
        });

        const saved = JSON.parse(localStorage.getItem('view-settings@1')!);
        expect(saved.treeOperationScope).toBe('descendants');
        expect(saved.listViewMenuTab).toBe('import');
        expect(saved.exportShowPageNumbers).toBe(true);
        expect(saved.exportShowComments).toBe(false);
        expect(saved.pieceLayout).toBe('play');
        expect(saved.coldClearInputGuideEnabled).toBe(true);
        expect(saved.buttonDropMovesSubtree).toBeUndefined();
        expect(localStorageWrapper.loadViewSettings().pieceLayout).toBe('play');
    });

    // FR-34: 相手盤面の表示可否
    test('saves and restores the opponent board visibility', () => {
        localStorage.setItem('view-settings@1', JSON.stringify({ replayShowOpponent: false }));
        expect(localStorageWrapper.loadViewSettings().replayShowOpponent).toBe(false);

        localStorage.setItem('view-settings@1', JSON.stringify({ replayShowOpponent: true }));
        expect(localStorageWrapper.loadViewSettings().replayShowOpponent).toBe(true);
    });

    test('rejects a non-boolean opponent visibility so the default stays in effect', () => {
        localStorage.setItem('view-settings@1', JSON.stringify({ replayShowOpponent: 'yes' }));
        expect(localStorageWrapper.loadViewSettings().replayShowOpponent).toBeUndefined();

        localStorage.setItem('view-settings@1', JSON.stringify({}));
        expect(localStorageWrapper.loadViewSettings().replayShowOpponent).toBeUndefined();
    });

    test('ignores the removed garbage visibility setting while preserving known settings', () => {
        localStorage.setItem('view-settings@1', JSON.stringify({
            replayShowGarbage: false,
            replayShowOpponent: false,
        }));
        const loaded = localStorageWrapper.loadViewSettings();
        expect(loaded.replayShowOpponent).toBe(false);
        expect((loaded as any).replayShowGarbage).toBeUndefined();
    });

    test('loads a valid PIECE layout and rejects anything else', () => {
        localStorage.setItem('view-settings@1', JSON.stringify({ pieceLayout: 'select' }));
        expect(localStorageWrapper.loadViewSettings().pieceLayout).toBe('select');

        localStorage.setItem('view-settings@1', JSON.stringify({ pieceLayout: 'queue' }));
        expect(localStorageWrapper.loadViewSettings().pieceLayout).toBeUndefined();

        localStorage.setItem('view-settings@1', JSON.stringify({}));
        expect(localStorageWrapper.loadViewSettings().pieceLayout).toBeUndefined();
    });

    test('loads valid import/export tabs and rejects invalid values', () => {
        localStorage.setItem('view-settings@1', JSON.stringify({ listViewMenuTab: 'import' }));
        expect(localStorageWrapper.loadViewSettings().listViewMenuTab).toBe('import');

        localStorage.setItem('view-settings@1', JSON.stringify({ listViewMenuTab: 'invalid' }));
        expect(localStorageWrapper.loadViewSettings().listViewMenuTab).toBeUndefined();
    });

    test('loads a boolean INPUT AI guide preference and rejects other values', () => {
        localStorage.setItem('view-settings@1', JSON.stringify({ coldClearInputGuideEnabled: true }));
        expect(localStorageWrapper.loadViewSettings().coldClearInputGuideEnabled).toBe(true);

        localStorage.setItem('view-settings@1', JSON.stringify({ coldClearInputGuideEnabled: 'yes' }));
        expect(localStorageWrapper.loadViewSettings().coldClearInputGuideEnabled).toBeUndefined();
    });

    test('loads boolean image export visibility settings and rejects other values', () => {
        localStorage.setItem('view-settings@1', JSON.stringify({
            exportShowPageNumbers: false,
            exportShowComments: true,
        }));
        expect(localStorageWrapper.loadViewSettings().exportShowPageNumbers).toBe(false);
        expect(localStorageWrapper.loadViewSettings().exportShowComments).toBe(true);

        localStorage.setItem('view-settings@1', JSON.stringify({
            exportShowPageNumbers: 'no',
            exportShowComments: 1,
        }));
        expect(localStorageWrapper.loadViewSettings().exportShowPageNumbers).toBeUndefined();
        expect(localStorageWrapper.loadViewSettings().exportShowComments).toBeUndefined();
    });
});
