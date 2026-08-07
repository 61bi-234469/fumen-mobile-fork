/** @jest-environment jsdom */

jest.mock('../env', () => ({
    PageEnv: { Version: 'test', Debug: false },
}));

// states.ts は読み込み時にkonvaオブジェクトを実際に生成する。
// 既定ショートカット表の検証には不要なので、どのクラス名でも生成できるスタブに差し替える。
jest.mock('konva', () => {
    const stub = new Proxy({}, {
        get: () => class {
            add() { /* noop */ }
            on() { /* noop */ }
        },
    });
    return { __esModule: true, default: stub };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { defaultEditShortcuts, defaultPaletteShortcuts, defaultPieceShortcuts } = require('../states');

describe('default shortcut assignments', () => {
    test('MinoBlockToggle defaults to KeyB', () => {
        expect(defaultEditShortcuts.MinoBlockToggle).toBe('KeyB');
    });

    test('MinoBlockToggle does not collide with any other default', () => {
        // Space（InsertPage/HardDrop）とKeyC（Comp/Hold）はPIECE状態で解決される意図的な重複なので、
        // 全体の一意性ではなく「新しい既定が既存のどれとも衝突しない」ことだけを確認する。
        const others = [
            ...Object.entries(defaultEditShortcuts as Record<string, string>)
                .filter(([key]) => key !== 'MinoBlockToggle')
                .map(([, code]) => code),
            ...Object.values(defaultPaletteShortcuts) as string[],
            ...Object.values(defaultPieceShortcuts) as string[],
        ];

        expect(others).not.toContain(defaultEditShortcuts.MinoBlockToggle);
    });
});
