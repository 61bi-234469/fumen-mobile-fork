import { Piece, Rotation } from '../support/common';
import { operations } from '../support/operations';
import { play } from '../support/history_play';

describe('History (piece)', () => {
    it('Piece / Next Page / Lock', () => {
        const testCases = [
            {
                callback: () => {
                    operations.mode.piece.place(Piece.I, Rotation.Spawn, 4, 0);
                },
                fumen: 'v115@vhARQJ',
                // 新UIの配置はスポーンとドラッグが別履歴になる
                count: 2,
            },
            {
                callback: () => {
                    operations.mode.piece.place(Piece.Z, Rotation.Spawn, 4, 1);
                },
                fumen: 'v115@vhARQJehT4MeUGYAA',
                // ページ送り + スポーン + ドラッグ
                count: 4,
            },
            {
                callback: () => {
                    operations.mode.piece.place(Piece.L, Rotation.Right, 0, 1);
                },
                fumen: 'v115@vhARQJehT4MeUGYAAKhBtIeBtXeKJYAA',
                // ページ送り + スポーン + 回転 + ドラッグ
                count: 5,
            },
            {
                callback: () => {
                    operations.mode.tools.nextPage();
                },
                fumen: 'v115@vhARQJehT4MeUGYAAKhBtIeBtXeKJYAAvhAAgH',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.tools.nextPage();
                },
                fumen: 'v115@vhARQJehT4MeUGYAAKhBtIeBtXeKJYAAvhBAgHAgH',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.piece.place(Piece.O, Rotation.Spawn, 8, 0);
                },
                fumen: 'v115@vhARQJehT4MeUGYAAKhBtIeBtXeKJYAAvhBAgHTNJ',
                // スポーン + ドラッグ
                count: 2,
            },
            {
                callback: () => {
                    operations.mode.flags.open();
                    operations.mode.flags.lockToOff();
                },
                fumen: 'v115@vhARQJehT4MeUGYAAKhBtIeBtXeKJYAAvhBAgHTNn',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.tools.nextPage();
                },
                fumen: 'v115@vhARQJehT4MeUGYAAKhBtIeBtXeKJYAAvhCAgHTNnT?Nn',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.flags.open();
                    operations.mode.flags.lockToOn();
                },
                fumen: 'v115@vhARQJehT4MeUGYAAKhBtIeBtXeKJYAAvhCAgHTNnT?NJ',
                count: 1,
            },
        ];

        // Representative: canonical multi-operation walk (piece / next page / lock) keeps full
        // per-step undo/redo verification.
        play('v115@vhAAgH', testCases, { fullUndoRedo: true });
    });

    it('Remove', () => {
        const testCases = [
            {
                callback: () => {
                    operations.mode.piece.place(Piece.I, Rotation.Left, 9, 3);
                },
                // 新UI: 既にピースがあるページでのスポーンは新規ページを作らず置き換える
                fumen: 'v115@3gwwHeywwhGeR4whBtAeRpAeR4glwhg0BtRpAeilwh?i0JeO/IvhA5eB',
                count: 1,
            },
            {
                callback: () => {
                    operations.menu.lastPage();
                    operations.mode.piece.place(Piece.T, Rotation.Reverse, 2, 2);
                },
                fumen: 'v115@3gwwHeywwhGeR4whBtAeRpAeR4glwhg0BtRpAeilwh?i0JeO/IvhA5eBygQ4hlBeQpDeQ4glBeSpQ4BeQ4glCexhQ4?BtQ4xwAexhg0Q4glBtxwAei0Q4ilJeFlQAA',
                count: 1,
            },
            {
                callback: () => {
                    operations.menu.firstPage();
                    operations.mode.tools.nextPage();
                    operations.mode.tools.removePage();
                },
                fumen: 'v115@3gwwHeywwhGeR4whBtAeRpAeR4glwhg0BtRpAeilwh?i0JeO/IygA8hlBeQpDeA8glBeSpQ4BeA8glCexhQ4BtA8xw?Aexhg0Q4glBtxwAei0Q4ilJeFlQAA',
                count: 1,
            },
            {
                callback: () => {
                    operations.menu.firstPage();
                    operations.mode.tools.removePage();
                },
                fumen: 'v115@ygC8BeA8DeB8BeD8BeB8CeH8AeI8AeG8JeFFJ',
                count: 1,
            },
            {
                callback: () => {
                    operations.menu.lastPage();
                    operations.mode.tools.removePage();
                },
                // 唯一のページを削除すると空の新規ページになる
                fumen: 'v115@vhAAgH',
                count: 1,
            },
        ];

        play('v115@3gwwHeywwhGeR4whBtAeRpAeR4glwhg0BtRpAeilwh?i0JeO/IvhA6WB', testCases);
    });

    it('Insert new page', () => {
        const testCases = [
            {
                callback: () => {
                    operations.mode.tools.addNewPage();
                },
                fumen: 'v115@RhB8HeB8Re+NYFAooMDEPBAAAQhgHBAGegHBAFehHJ?eAgWAAQhg0B8Geg0B8Feh0Je3MYFAooMDEPBAAAvhAsLYFA?3XaDEEBAAAmhI8AINvhGAgHm7XYAFLDmClcJSAVDEHBEooR?BKoAVBaX9wC06ITHJpBJ9NJAgH',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.tools.nextPage();
                    operations.mode.tools.addNewPage();
                },
                fumen: 'v115@RhB8HeB8Re+NYFAooMDEPBAAAQhgHBAGegHBAFehHJ?eAgWAAQhg0B8Geg0B8Feh0Je3MYFAooMDEPBAAAQhgHBAEe?xDgHBADexDhHJeAgWAAQhg0B8EeR4g0B8DeR4h0JesLYFA3?XaDEEBAAAmhI8AINvhGAgHm7XYAFLDmClcJSAVDEHBEooRB?KoAVBaX9wC06ITHJpBJ9NJAgH',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.tools.nextPage();
                    operations.mode.tools.nextPage();
                    operations.mode.tools.addNewPage();
                },
                fumen: 'v115@RhB8HeB8Re+NYFAooMDEPBAAAQhgHBAGegHBAFehHJ?eAgWAAQhg0B8Geg0B8Feh0Je3MYFAooMDEPBAAAQhgHBAEe?xDgHBADexDhHJeAgWAAQhg0B8EeR4g0B8DeR4h0JesLYFA3?XaDEEBAAAmhI8AIN9ggHBeAPFegHxDBPCeBAhHxDAPCeKAK?eAgWAA9gg0BeAtFeg0R4BtCeB8h0R4AtCeK8KeAgWFA3XaD?EEBAAAvhFm7XYAFLDmClcJSAVDEHBEooRBKoAVBaX9wC06I?THJpBJ9NJAgH',
                count: 1,
            },
            {
                callback: () => {
                    operations.mode.tools.nextPage();
                    operations.mode.tools.nextPage();
                    operations.mode.tools.addNewPage();
                },
                fumen: 'v115@RhB8HeB8Re+NYFAooMDEPBAAAQhgHBAGegHBAFehHJ?eAgWAAQhg0B8Geg0B8Feh0Je3MYFAooMDEPBAAAQhgHBAEe?xDgHBADexDhHJeAgWAAQhg0B8EeR4g0B8DeR4h0JesLYFA3?XaDEEBAAAmhI8AIN9ggHBeAPFegHxDBPCeBAhHxDAPCeKAK?eAgWAA9gg0BeAtFeg0R4BtCeB8h0R4AtCeK8KeAgWFA3XaD?EEBAAAvhAm7XYAFLDmClcJSAVDEHBEooRBKoAVBaX9wC1gi?HEegHBeAPgHEegHxDBPCeBAhHxDAPCeKAKeAgWAA1gi0Eeg?0BeAtg0Eeg0R4BtCeB8h0R4AtCeK8Ke06XXAFLDmClcJSAV?DEHBEooRBaoAVBP+1BAvhDTHJpBJ9NJAgH',
                count: 1,
            },
        ];

        play('v115@RhB8HeB8Re+NYFAooMDEPBAAAvhB3MJsLYFA3XaDEE?BAAAmhI8AINvhGAgHm7XYAFLDmClcJSAVDEHBEooRBKoAVB?aX9wC06ITHJpBJ9NJAgH', testCases);
    });
});
