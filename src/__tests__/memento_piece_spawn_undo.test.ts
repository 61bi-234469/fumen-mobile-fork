/** @jest-environment jsdom */

import { OperationTask } from '../history_task';
import { Page } from '../lib/fumen/types';

// memento はモジュールシングルトンなので、テストごとに読み込み直す
const loadMemento = () => {
    jest.resetModules();
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('../memento').memento as typeof import('../memento').memento;
};

// 適用順を記録するだけのスタブタスク。pagesは配列の中身を書き換えず、そのまま次へ渡す
const createTask = (name: string, log: string[]): OperationTask => ({
    replay: (pages: Page[]) => {
        log.push(`replay:${name}`);
        return { pages, index: 0 };
    },
    revert: (pages: Page[]) => {
        log.push(`revert:${name}`);
        return { pages, index: 0 };
    },
    fixed: false,
    key: name,
});

describe('memento piece spawn boundaries', () => {
    const pages = [] as Page[];

    // [0]基点 [1]S(T) [2]move [3]softdrop [4]insert [5]comment [6]S(I) [7]move
    const registerHardDropHistory = (memento: ReturnType<typeof loadMemento>, log: string[]) => {
        memento.register(createTask('base', log));
        memento.register(createTask('spawnT', log), undefined, undefined, true);
        memento.register(createTask('moveT', log));
        memento.register(createTask('softdrop', log));
        memento.register(createTask('insert', log));
        memento.register(createTask('comment', log));
        memento.register(createTask('spawnI', log), undefined, undefined, true);
        memento.register(createTask('moveI', log));
    };

    test('rewinds to the previous spawn when a current piece is spawned', async () => {
        const memento = loadMemento();
        const log: string[] = [];
        registerHardDropHistory(memento, log);

        const result = await memento.undoToPieceSpawn(pages, { currentPieceSpawned: true });

        expect(log).toEqual([
            'revert:moveI', 'revert:spawnI', 'revert:comment', 'revert:insert',
            'revert:softdrop', 'revert:moveT',
        ]);
        // [0]基点 と [1]spawnT が残る
        expect(result!.undoCount).toBe(1);
        expect(result!.redoCount).toBe(6);
    });

    test('rewinds to the latest spawn when no current piece is spawned', async () => {
        const memento = loadMemento();
        const log: string[] = [];
        registerHardDropHistory(memento, log);

        const result = await memento.undoToPieceSpawn(pages, { currentPieceSpawned: false });

        expect(log).toEqual(['revert:moveI']);
        expect(result!.undoCount).toBe(6);
        expect(result!.redoCount).toBe(1);
    });

    test('rewinds to the latest spawn when the queue ran out and left no current piece', async () => {
        const memento = loadMemento();
        const log: string[] = [];
        // キュー切れでスポーンできず、ハードドロップ分のエントリだけが積まれた状態
        memento.register(createTask('base', log));
        memento.register(createTask('spawnT', log), undefined, undefined, true);
        memento.register(createTask('moveT', log));
        memento.register(createTask('softdrop', log));
        memento.register(createTask('insert', log));
        memento.register(createTask('comment', log));

        const result = await memento.undoToPieceSpawn(pages, { currentPieceSpawned: false });

        expect(log).toEqual(['revert:comment', 'revert:insert', 'revert:softdrop', 'revert:moveT']);
        expect(result!.undoCount).toBe(1);
    });

    // HOLD入れ替えは境界を登録しない（spawnPieceのhistoryBoundary=false）。
    // 同じキュー単位の中の操作として、その手前のキューミノまでまとめて戻る。
    test('skips a non-boundary spawn such as a hold swap', async () => {
        const memento = loadMemento();
        const log: string[] = [];
        registerHardDropHistory(memento, log);
        memento.register(createTask('holdComment', log));
        memento.register(createTask('holdSpawn', log));
        memento.register(createTask('moveHold', log));

        const result = await memento.undoToPieceSpawn(pages, { currentPieceSpawned: true });

        expect(log).toEqual([
            'revert:moveHold', 'revert:holdSpawn', 'revert:holdComment',
            'revert:moveI', 'revert:spawnI', 'revert:comment', 'revert:insert',
            'revert:softdrop', 'revert:moveT',
        ]);
        // [0]基点 と [1]spawnT が残る
        expect(result!.undoCount).toBe(1);
    });

    // フメン読み込み (toFumenTask) はページ全体を差し替える fixed タスク。
    // 読み込みより前は別のキューセッションなので、境界探索はそこで止める。
    test('never rewinds across a fumen load task', async () => {
        const memento = loadMemento();
        const log: string[] = [];
        const fumenTask = {
            replay: async () => {
                log.push('replay:loadFumen');
                return { pages: pages as any, index: 0 };
            },
            revert: async () => {
                log.push('revert:loadFumen');
                return { pages: pages as any, index: 0 };
            },
            fixed: true as const,
            key: 'loadFumen',
        };

        // フメンA側のキュー操作
        memento.register(createTask('base', log));
        memento.register(createTask('spawnA1', log), undefined, undefined, true);
        memento.register(createTask('moveA1', log));
        memento.register(createTask('spawnA2', log), undefined, undefined, true);
        memento.register(createTask('moveA2', log));
        // 別フメンの読み込み
        memento.register(fumenTask);
        // フメンB側のキュー操作（境界は1つだけ）
        memento.register(createTask('spawnB1', log), undefined, undefined, true);
        memento.register(createTask('moveB1', log));

        const result = await memento.undoToPieceSpawn(pages, { currentPieceSpawned: true });

        // フメンAの境界へは戻らず、フメンB側の現在のキュー単位の先頭で止まる
        expect(log).toEqual(['revert:moveB1']);
        expect(log).not.toContain('revert:loadFumen');
        expect(result!.undoCount).toBe(6);
    });

    test('does not cross a fumen load task even without a boundary above it', async () => {
        const memento = loadMemento();
        const log: string[] = [];
        const fumenTask = {
            replay: async () => {
                log.push('replay:loadFumen');
                return { pages: pages as any, index: 0 };
            },
            revert: async () => {
                log.push('revert:loadFumen');
                return { pages: pages as any, index: 0 };
            },
            fixed: true as const,
            key: 'loadFumen',
        };

        memento.register(createTask('base', log));
        memento.register(createTask('spawnA1', log), undefined, undefined, true);
        memento.register(createTask('moveA1', log));
        memento.register(fumenTask);
        memento.register(createTask('drawB', log));

        // 読み込み後に境界が無いので単発undoへフォールバックする
        const result = await memento.undoToPieceSpawn(pages, { currentPieceSpawned: true });

        expect(log).toEqual(['revert:drawB']);
        expect(result!.undoCount).toBe(3);
    });

    test('falls back to a single undo when no spawn boundary exists', async () => {
        const memento = loadMemento();
        const log: string[] = [];
        memento.register(createTask('base', log));
        memento.register(createTask('draw1', log));
        memento.register(createTask('draw2', log));

        const result = await memento.undoToPieceSpawn(pages, { currentPieceSpawned: true });

        expect(log).toEqual(['revert:draw2']);
        expect(result!.undoCount).toBe(1);
    });

    test('never pops the base task', async () => {
        const memento = loadMemento();
        const log: string[] = [];
        memento.register(createTask('base', log));
        memento.register(createTask('spawnT', log), undefined, undefined, true);
        memento.register(createTask('moveT', log));

        // 一つ手前の境界がないため、現在の境界（spawnT）まで戻す
        await memento.undoToPieceSpawn(pages, { currentPieceSpawned: true });
        expect(log).toEqual(['revert:moveT']);

        // これ以上は基点しか残らないので、単発undoのフォールバックで1件だけ戻る
        log.length = 0;
        const result = await memento.undoToPieceSpawn(pages, { currentPieceSpawned: true });
        expect(log).toEqual(['revert:spawnT']);
        expect(result!.undoCount).toBe(0);
    });

    test('redoes forward to the next spawn from a boundary', async () => {
        const memento = loadMemento();
        const log: string[] = [];
        registerHardDropHistory(memento, log);
        await memento.undoToPieceSpawn(pages, { currentPieceSpawned: true });
        log.length = 0;

        const result = await memento.redoToPieceSpawn(pages);

        expect(log).toEqual([
            'replay:moveT', 'replay:softdrop', 'replay:insert', 'replay:comment', 'replay:spawnI',
        ]);
        expect(result!.undoCount).toBe(6);
        expect(result!.redoCount).toBe(1);
    });

    test('redoes a single entry when not on a boundary', async () => {
        const memento = loadMemento();
        const log: string[] = [];
        registerHardDropHistory(memento, log);
        // 境界（spawnI）より下まで単発undoしてから進める
        await memento.undo(pages);
        await memento.undo(pages);
        log.length = 0;

        await memento.redoToPieceSpawn(pages);

        expect(log).toEqual(['replay:spawnI']);
    });

    // ツリー有効時のページ追加は toTreeOperationTask になり、revertは引数のpagesを捨てて
    // 自身のスナップショットを返す。一括revertでも単発undoの連打と同じ結果になることを固定する。
    test('matches sequential undos when a snapshot task is included', async () => {
        const before = ['page0'] as any;
        const after = ['page0', 'page1'] as any;
        const buildHistory = (memento: ReturnType<typeof loadMemento>, log: string[]) => {
            const pageTask = (name: string, index: number): OperationTask => ({
                replay: (target: any) => {
                    log.push(`replay:${name}`);
                    return { index, pages: target };
                },
                revert: (target: any) => {
                    log.push(`revert:${name}`);
                    return { index, pages: target };
                },
                fixed: false,
                key: name,
            });
            const snapshotTask = (name: string): OperationTask => ({
                replay: () => {
                    log.push(`replay:${name}`);
                    return { pages: [...after] as any, index: 1 };
                },
                revert: () => {
                    log.push(`revert:${name}`);
                    return { pages: [...before] as any, index: 0 };
                },
                fixed: false,
                key: name,
            });

            memento.register(pageTask('base', 0));
            memento.register(pageTask('spawnT', 0), undefined, undefined, true);
            memento.register(pageTask('moveT', 0));
            memento.register(pageTask('softdrop', 0));
            memento.register(snapshotTask('insert'));
            memento.register(pageTask('comment', 1));
            memento.register(pageTask('spawnI', 1), undefined, undefined, true);
            memento.register(pageTask('moveI', 1));
        };

        const sequentialLog: string[] = [];
        const sequential = loadMemento();
        buildHistory(sequential, sequentialLog);
        let sequentialResult: any;
        let sequentialPages: any = after;
        for (let i = 0; i < 6; i += 1) {
            sequentialResult = await sequential.undo(sequentialPages);
            sequentialPages = sequentialResult!.pages;
        }

        const batchLog: string[] = [];
        const batch = loadMemento();
        buildHistory(batch, batchLog);
        const batchResult = await batch.undoToPieceSpawn(after, { currentPieceSpawned: true });

        expect(batchLog).toEqual(sequentialLog);
        expect(batchResult!.pages).toEqual(sequentialResult!.pages);
        expect(batchResult!.index).toEqual(sequentialResult!.index);
        expect(batchResult!.undoCount).toEqual(sequentialResult!.undoCount);
        expect(batchResult!.redoCount).toEqual(sequentialResult!.redoCount);
        expect(batchResult!.pages).toEqual(before);
    });

    test('overwrites the boundary flag when a task is merged into the last entry', async () => {
        const memento = loadMemento();
        const log: string[] = [];
        memento.register(createTask('base', log));
        memento.register(createTask('spawnT', log), undefined, undefined, true);
        // spawnT と同じキーでマージされるため、境界フラグは新しいタスクの値（false）で上書きされる
        memento.register(createTask('merged', log), 'spawnT');
        memento.register(createTask('moveT', log));

        const result = await memento.undoToPieceSpawn(pages, { currentPieceSpawned: true });

        expect(log).toEqual(['revert:moveT']);
        expect(result!.undoCount).toBe(1);
    });
});
