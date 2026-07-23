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
            listViewMenuTab: 'import',
            treeOperationScope: 'descendants',
            grayAfterLineClear: false,
            editorSidePanel: false,
            editorSidePanelTab: 'list',
            editorSidePanelWidth: null,
            coldClearTopBranchCount: 3,
            coldClearHoldAllowed: true,
            coldClearSpeculate: true,
            coldClearNextLimit: null,
            coldClearWeightsPreset: 0,
            coldClearThinkMs: 1000,
        });

        const saved = JSON.parse(localStorage.getItem('view-settings@1')!);
        expect(saved.treeOperationScope).toBe('descendants');
        expect(saved.listViewMenuTab).toBe('import');
        expect(saved.buttonDropMovesSubtree).toBeUndefined();
    });

    test('loads valid import/export tabs and rejects invalid values', () => {
        localStorage.setItem('view-settings@1', JSON.stringify({ listViewMenuTab: 'import' }));
        expect(localStorageWrapper.loadViewSettings().listViewMenuTab).toBe('import');

        localStorage.setItem('view-settings@1', JSON.stringify({ listViewMenuTab: 'invalid' }));
        expect(localStorageWrapper.loadViewSettings().listViewMenuTab).toBeUndefined();
    });
});
