/**
 * @jest-environment jsdom
 */
import { Piece, Rotation } from '../../lib/enums';
import { Field } from '../../lib/fumen/field';
import { Page } from '../../lib/fumen/types';

// states.ts は env.ts（ビルド時置換）を読み込むため、テストでは初期値をここに持つ
interface SpawnMinoToggleState {
    pickArmed: boolean;
}
const initialSpawnMinoToggleState: SpawnMinoToggleState = { pickArmed: false };

const noopAction = () => () => undefined;
const mockRegisterHistoryTask = jest.fn((data: any) => {
    void data;
    return () => undefined;
});

jest.mock('../../actions', () => ({
    actions: {
        removeUnsettledItems: noopAction,
        reopenCurrentPage: noopAction,
        clearRectSelection: noopAction,
        registerHistoryTask: (data: any) => mockRegisterHistoryTask(data),
    },
    main: {},
}));

const mockShowToast = jest.fn();
jest.mock('../../lib/spawn_mino_toggle_toast', () => ({
    hasSpawnMinoToggleEffect: (effects: any) => (
        effects.lineClearLost || effects.persistsToLaterPages || effects.quizConsumptionChanged
    ),
    showSpawnMinoToggleToast: (effects: any) => mockShowToast(effects),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { convertActions } = require('../convert');

const defaultFlags = { lock: true, mirror: false, colorize: true, rise: false, quiz: false };

// T mino at (2,0) Spawn: (1,0) (2,0) (3,0) (2,1)
const tSpawn = { type: Piece.T, rotation: Rotation.Spawn, coordinate: { x: 2, y: 0 } };
const tCells = [1, 2, 3, 12];

const blockCommand = (index: number, piece: Piece) => ({
    piece,
    type: 'block' as const,
    x: index % 10,
    y: Math.floor(index / 10),
});

const commandsFor = (cells: { index: number, piece: Piece }[]) => {
    const pre: { [key: string]: any } = {};
    for (const cell of cells) {
        pre[`block-${cell.index}`] = blockCommand(cell.index, cell.piece);
    }
    return { pre };
};

const createPage = (overrides: Partial<Page> = {}): Page => ({
    index: 0,
    field: { obj: new Field({}) },
    comment: { text: '' },
    flags: { ...defaultFlags },
    ...overrides,
} as Page);

const createState = (pages: Page[], options: {
    currentIndex?: number;
    initField?: Field;
    spawnMinoToggle?: SpawnMinoToggleState;
} = {}) => ({
    fumen: {
        pages,
        currentIndex: options.currentIndex ?? 0,
        maxPage: pages.length,
    },
    cache: {
        currentInitField: options.initField ?? new Field({}),
    },
    editorUi: {
        primaryTool: 'paint',
        spawnMinoToggle: options.spawnMinoToggle ?? { ...initialSpawnMinoToggleState },
    },
}) as any;

const commandKeys = (page: Page) => Object.keys(page.commands?.pre ?? {}).sort();

beforeEach(() => {
    mockRegisterHistoryTask.mockClear();
    mockShowToast.mockClear();
});

describe('convertSpawnMinoToBlocks', () => {
    test('SPAWNミノを同じ位置・同じ色のブロックへ焼き付ける', () => {
        const page = createPage({ piece: { ...tSpawn } });
        const state = createState([page]);

        const next = convertActions.convertSpawnMinoToBlocks()(state);

        expect(page.piece).toBeUndefined();
        expect(commandKeys(page)).toEqual(tCells.map(cell => `block-${cell}`).sort());
        for (const cell of tCells) {
            expect(page.commands!.pre[`block-${cell}`].piece).toBe(Piece.T);
        }
        expect(mockRegisterHistoryTask).toHaveBeenCalledTimes(1);
        expect(mockRegisterHistoryTask.mock.calls[0][0]).toHaveProperty('task');
        expect(mockRegisterHistoryTask.mock.calls[0][0].mergeKey).toBeUndefined();
    });

    test('SPAWNミノがないときは何もしない', () => {
        const state = createState([createPage()]);
        expect(convertActions.convertSpawnMinoToBlocks()(state)).toBeUndefined();
        expect(mockRegisterHistoryTask).not.toHaveBeenCalled();
    });

    test('下に既存ブロックがあっても上書きする', () => {
        const initField = new Field({});
        initField.add(1, 0, Piece.Gray);
        const page = createPage({
            piece: { ...tSpawn },
            field: { obj: initField.copy() },
        });
        const state = createState([page], { initField });

        convertActions.convertSpawnMinoToBlocks()(state);

        expect(page.commands!.pre['block-1'].piece).toBe(Piece.T);
    });
});

describe('convertBlocksToSpawnMino', () => {
    const paintedPage = () => {
        const initField = new Field({});
        const page = createPage({
            field: { obj: initField.copy() },
            commands: commandsFor(tCells.map(index => ({ index, piece: Piece.T }))),
        });
        return { page, initField };
    };

    test('ミノ形のブロックを持ち上げてSPAWNミノにする', () => {
        const { page, initField } = paintedPage();
        const state = createState([page], { initField });

        convertActions.convertBlocksToSpawnMino({ index: 2 })(state);

        expect(page.piece).toEqual(tSpawn);
        expect(commandKeys(page)).toEqual([]);
        expect(mockRegisterHistoryTask).toHaveBeenCalledTimes(1);
    });

    test('既にSPAWNミノがあるページでは何もしない', () => {
        const { page, initField } = paintedPage();
        page.piece = { ...tSpawn };
        const state = createState([page], { initField });

        expect(convertActions.convertBlocksToSpawnMino({ index: 2 })(state)).toBeUndefined();
    });

    test('持ち上げられないセルでは何もしない', () => {
        const { page, initField } = paintedPage();
        const state = createState([page], { initField });

        expect(convertActions.convertBlocksToSpawnMino({ index: 99 })(state)).toBeUndefined();
        expect(mockRegisterHistoryTask).not.toHaveBeenCalled();
    });

    test('往復するとページの状態が元に戻る', () => {
        const page = createPage({ piece: { ...tSpawn } });
        const state = createState([page]);

        convertActions.convertSpawnMinoToBlocks()(state);
        expect(page.piece).toBeUndefined();

        convertActions.convertBlocksToSpawnMino({ index: tCells[0] })(createState([page]));
        expect(page.piece).toEqual(tSpawn);
        expect(commandKeys(page)).toEqual([]);
    });

    test('下に既存ブロックがあった場合、逆変換では空セルに戻る', () => {
        const initField = new Field({});
        initField.add(1, 0, Piece.Gray);
        const page = createPage({ piece: { ...tSpawn }, field: { obj: initField.copy() } });

        convertActions.convertSpawnMinoToBlocks()(createState([page], { initField }));
        convertActions.convertBlocksToSpawnMino({ index: 2 })(createState([page], { initField }));

        expect(page.piece).toEqual(tSpawn);
        // 灰色は復元されず、空セルにするコマンドが残る
        expect(page.commands!.pre['block-1'].piece).toBe(Piece.Empty);
    });
});

describe('意味変更の通知', () => {
    test('lock=true・ライン非完成・非Quizでは何も出さない', () => {
        const state = createState([createPage({ piece: { ...tSpawn } })]);
        convertActions.convertSpawnMinoToBlocks()(state);
        expect(mockShowToast).not.toHaveBeenCalled();
    });

    test('lock=false ではブロックが以降のページに残ることを通知する', () => {
        const page = createPage({ piece: { ...tSpawn }, flags: { ...defaultFlags, lock: false } });
        convertActions.convertSpawnMinoToBlocks()(createState([page]));
        expect(mockShowToast).toHaveBeenCalledTimes(1);
        expect(mockShowToast.mock.calls[0][0].persistsToLaterPages).toBe(true);
    });

    test('lockでラインが揃うときは消去が失われることを通知する', () => {
        // Iミノ横置きで最下段が埋まる盤面
        const initField = new Field({});
        for (const x of [0, 1, 2, 3, 8, 9]) {
            initField.add(x, 0, Piece.Gray);
        }
        const iSpawn = { type: Piece.I, rotation: Rotation.Spawn, coordinate: { x: 5, y: 0 } };
        const page = createPage({ piece: iSpawn, field: { obj: initField.copy() } });

        convertActions.convertSpawnMinoToBlocks()(createState([page], { initField }));

        expect(mockShowToast).toHaveBeenCalledTimes(1);
        expect(mockShowToast.mock.calls[0][0].lineClearLost).toBe(true);
    });

    test('QuizページではNEXT消費の変化を双方向で通知する', () => {
        const quizFlags = { ...defaultFlags, quiz: true };
        const page = createPage({ piece: { ...tSpawn }, flags: quizFlags });
        convertActions.convertSpawnMinoToBlocks()(createState([page]));
        expect(mockShowToast.mock.calls[0][0].quizConsumptionChanged).toBe(true);

        mockShowToast.mockClear();
        convertActions.convertBlocksToSpawnMino({ index: 2 })(createState([page]));
        expect(mockShowToast.mock.calls[0][0].quizConsumptionChanged).toBe(true);
    });

    test('複数該当してもトーストは1回だけ', () => {
        const initField = new Field({});
        for (const x of [0, 1, 2, 3, 8, 9]) {
            initField.add(x, 0, Piece.Gray);
        }
        const iSpawn = { type: Piece.I, rotation: Rotation.Spawn, coordinate: { x: 5, y: 0 } };
        const page = createPage({
            piece: iSpawn,
            field: { obj: initField.copy() },
            flags: { ...defaultFlags, quiz: true },
        });

        convertActions.convertSpawnMinoToBlocks()(createState([page], { initField }));

        expect(mockShowToast).toHaveBeenCalledTimes(1);
    });
});

describe('toggleSpawnMinoAndBlocks の決定木', () => {
    test('SPAWNミノがあれば対象が定まるのでそのままブロック化する', () => {
        const page = createPage({ piece: { ...tSpawn } });
        const next = convertActions.toggleSpawnMinoAndBlocks()(createState([page]));
        expect(page.piece).toBeUndefined();
        expect(next.editorUi.spawnMinoToggle.pickArmed).toBe(false);
    });

    test('ミノ化は自動で対象を決めず、必ず対象選択待ちになる', () => {
        const page = createPage({
            commands: commandsFor(tCells.map(index => ({ index, piece: Piece.T }))),
        });
        const next = convertActions.toggleSpawnMinoAndBlocks()(createState([page]));

        expect(page.piece).toBeUndefined();
        expect(commandKeys(page)).toEqual(tCells.map(cell => `block-${cell}`).sort());
        expect(next.editorUi.spawnMinoToggle.pickArmed).toBe(true);
        expect(mockRegisterHistoryTask).not.toHaveBeenCalled();
    });

    test('ブロック化した直後にもう一度押しても、往復せず対象選択待ちになる', () => {
        const page = createPage({ piece: { ...tSpawn } });
        convertActions.toggleSpawnMinoAndBlocks()(createState([page]));
        expect(page.piece).toBeUndefined();

        const second = convertActions.toggleSpawnMinoAndBlocks()(createState([page]));

        expect(page.piece).toBeUndefined();
        expect(second.editorUi.spawnMinoToggle.pickArmed).toBe(true);
    });

    test('継承ブロックのミノ形も等しく候補になる', () => {
        const inherited = new Field({});
        for (const cell of tCells) {
            inherited.add(cell % 10, Math.floor(cell / 10), Piece.T);
        }
        const base = createPage({ index: 0, field: { obj: inherited.copy() } });
        const current = createPage({ index: 1, field: { ref: 0 } } as Partial<Page>);
        const state = createState([base, current], { currentIndex: 1, initField: inherited });

        const next = convertActions.toggleSpawnMinoAndBlocks()(state);

        expect(current.piece).toBeUndefined();
        expect(next.editorUi.spawnMinoToggle.pickArmed).toBe(true);
    });

    test('対象選択待ちのあと、タップしたミノが持ち上がる', () => {
        const page = createPage({
            commands: commandsFor(tCells.map(index => ({ index, piece: Piece.T }))),
        });
        convertActions.toggleSpawnMinoAndBlocks()(createState([page]));

        convertActions.convertBlocksToSpawnMino({ index: 2 })(createState([page]));

        expect(page.piece).toEqual(tSpawn);
    });

    test('候補表示中にもう一度押すとキャンセルされる', () => {
        const page = createPage({
            commands: commandsFor(tCells.map(index => ({ index, piece: Piece.T }))),
        });
        const armed = convertActions.toggleSpawnMinoAndBlocks()(createState([page]));
        expect(armed.editorUi.spawnMinoToggle.pickArmed).toBe(true);

        const cancelled = convertActions.toggleSpawnMinoAndBlocks()(createState([page], {
            spawnMinoToggle: armed.editorUi.spawnMinoToggle,
        }));

        expect(cancelled.editorUi.spawnMinoToggle.pickArmed).toBe(false);
        // 盤面もSPAWNミノも変わらない
        expect(page.piece).toBeUndefined();
        expect(commandKeys(page)).toEqual(tCells.map(cell => `block-${cell}`).sort());
        expect(mockRegisterHistoryTask).not.toHaveBeenCalled();
    });

    test('候補表示中の再押下は、SPAWNミノがあってもキャンセルを優先する', () => {
        // 通常は起きない組み合わせだが、キャンセルが常に最優先であることを固定する
        const page = createPage({ piece: { ...tSpawn } });
        const next = convertActions.toggleSpawnMinoAndBlocks()(createState([page], {
            spawnMinoToggle: { pickArmed: true },
        }));

        expect(next.editorUi.spawnMinoToggle.pickArmed).toBe(false);
        expect(page.piece).toEqual(tSpawn);
    });

    test('候補がないときは何も起きない', () => {
        const page = createPage({
            commands: commandsFor([{ index: 0, piece: Piece.Gray }]),
        });
        const next = convertActions.toggleSpawnMinoAndBlocks()(createState([page]));
        expect(next).toEqual({});
        expect(mockRegisterHistoryTask).not.toHaveBeenCalled();
    });
});

describe('cancelSpawnMinoPick', () => {
    test('待機中ならフラグを下ろす', () => {
        const state = createState([createPage()], {
            spawnMinoToggle: { pickArmed: true },
        });
        const next = convertActions.cancelSpawnMinoPick()(state);
        expect(next.editorUi.spawnMinoToggle.pickArmed).toBe(false);
    });

    test('待機していないときは状態を作らない', () => {
        const state = createState([createPage()]);
        expect(convertActions.cancelSpawnMinoPick()(state)).toBeUndefined();
    });

});
