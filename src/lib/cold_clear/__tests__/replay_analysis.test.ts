import { Piece } from '../../enums';
import { simulatePlayerRound } from '../../ttrm/simulator';
import { pointAt } from '../../ttrm/timeline';
import { PlayerRoundIR, TtrmFile } from '../../ttrm/types';
import { CC_HOLD_NONE, PIECE_TO_CC } from '../types';
import { toCellKey } from '../move_match';
import {
    ANALYSIS_CANDIDATE_COUNT,
    ANALYSIS_NEXT_COUNT,
    ANALYSIS_THINK_MS_DEFAULT,
    AnalysisSettings,
    analysisMoveCount,
    buildAnalysisPosition,
    buildAnalysisPositions,
    frameToX,
    gradeOf,
    lossOf,
    lossScaleOf,
    normalizeAnalysisThinkMs,
    percentile,
    summarizeAnalysis,
} from '../replay_analysis';

const leagueLoss = require('../../ttrm/__tests__/fixtures/league_loss.json') as TtrmFile;

const settings: AnalysisSettings = {
    thinkMs: 100,
    holdAllowed: true,
    speculate: true,
    weightsPreset: 0,
};

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

// 実 IR を 1 度だけ作って共有する（Engine の再生は重い）
const loser: PlayerRoundIR =
    simulatePlayerRound(leagueLoss.replay.rounds[0].find(player => player.id === 'player-a-id')!);

describe('replay_analysis: 局面の組み立て', () => {
    test('解析対象は lock 1..L で、frame は lock frame と一致する', () => {
        const positions = buildAnalysisPositions(loser, settings);
        expect(analysisMoveCount(loser)).toEqual(loser.locks.length);
        expect(positions).toHaveLength(loser.locks.length);
        expect(positions[0].index).toEqual(1);
        positions.forEach((position, offset) => {
            expect(position.frame).toEqual(loser.locks[offset].frame);
        });
    });

    // LockPoint の hold/current/next は lock 後の値。1 手ずれると全ての評価が壊れる。
    test('キューは lock 後ではなく直前ポイントから作る', () => {
        const positions = buildAnalysisPositions(loser, settings);
        const analyzed = positions.filter(position => position.request !== undefined);
        expect(analyzed.length).toBeGreaterThan(0);

        for (const position of analyzed) {
            const previous = pointAt(loser, position.index - 1);
            const request = position.request!;
            expect(request.queue).toHaveLength(ANALYSIS_NEXT_COUNT + 1);
            expect(request.queue[0]).toEqual(PIECE_TO_CC[previous.current!]);
            expect(request.queue.slice(1)).toEqual(
                previous.next.slice(0, ANALYSIS_NEXT_COUNT).map(piece => PIECE_TO_CC[piece]));
            expect(request.hold).toEqual(
                previous.hold === null ? CC_HOLD_NONE : PIECE_TO_CC[previous.hold]);
            expect(request.candidateCount).toEqual(ANALYSIS_CANDIDATE_COUNT);
            expect(request.thinkMs).toEqual(settings.thinkMs);
        }
    });

    test('実手のセルキーは IR の設置セルから作る', () => {
        const position = buildAnalysisPositions(loser, settings)
            .find(candidate => candidate.request !== undefined)!;
        const lock = loser.locks[position.index - 1];
        expect(lock.cells).toBeDefined();
        expect(lock.cells).toHaveLength(4);
        expect(position.request!.placedCellKey).toEqual(toCellKey(lock.cells!));
    });

    // LockPoint.fieldBefore は名前に反して設置後の盤面。渡す盤面には実手のミノが
    // 入っていてはならない（入っていると Cold Clear は別の局面を評価する）。
    test('渡す盤面は設置直前のもので、実手のセルは空いている', () => {
        const positions = buildAnalysisPositions(loser, settings)
            .filter(position => position.request !== undefined);
        expect(positions.length).toBeGreaterThan(0);

        for (const position of positions) {
            const lock = loser.locks[position.index - 1];
            const field = position.request!.field;
            for (const [x, y] of lock.cells!) {
                expect(field[y * 10 + x]).toEqual(0);
            }
        }
    });

    test('B2B / REN は直前 lock のエンジン統計から導く（非成立は -1）', () => {
        const player = clone(loser);
        player.locks[0].clear.b2b = -1;
        player.locks[0].clear.ren = -1;
        player.locks[1].clear.b2b = 2;
        player.locks[1].clear.ren = 3;

        // 1 手目の直前は「まだ何も置いていない」
        expect(buildAnalysisPosition(player, 1, settings).request!.b2b).toBe(false);
        expect(buildAnalysisPosition(player, 1, settings).request!.combo).toEqual(0);
        // 2 手目の入力は locks[0]、3 手目の入力は locks[1]
        expect(buildAnalysisPosition(player, 2, settings).request!.b2b).toBe(false);
        expect(buildAnalysisPosition(player, 2, settings).request!.combo).toEqual(0);
        expect(buildAnalysisPosition(player, 3, settings).request!.b2b).toBe(true);
        expect(buildAnalysisPosition(player, 3, settings).request!.combo).toEqual(4);
    });

    // 被弾して負けるラウンドなので、保留ガベージのある局面が必ず含まれる
    test('incoming は次の非消去 lock でせり上がる行数になる', () => {
        const positions = buildAnalysisPositions(loser, settings);
        const incomings = positions
            .filter(position => position.request !== undefined)
            .map(position => position.request!.incoming);
        expect(incomings.every(incoming => incoming >= 0)).toBe(true);
        expect(incomings.some(incoming => incoming > 0)).toBe(true);
    });

    test('解析できない局面は理由つきで除外する', () => {
        const noCells = clone(loser);
        delete noCells.locks[0].cells;
        expect(buildAnalysisPosition(noCells, 1, settings).skipReason).toEqual('noCells');

        // 23 行に収まらない局面は Cold Clear へ渡せる盤面にならない
        const clipped = clone(loser);
        clipped.visual!.boards.forEach((board) => { board.clippedRowCount = 2; });
        expect(buildAnalysisPosition(clipped, 1, settings).skipReason).toEqual('clipped');

        // NEXT が足りない手はスコアの尺度が変わるため解析しない
        const shortQueue = clone(loser);
        shortQueue.initial.next = shortQueue.initial.next.slice(0, ANALYSIS_NEXT_COUNT - 1);
        expect(buildAnalysisPosition(shortQueue, 1, settings).skipReason).toEqual('shortQueue');

        const noCurrent = clone(loser);
        noCurrent.initial.current = null;
        expect(buildAnalysisPosition(noCurrent, 1, settings).skipReason).toEqual('noCurrent');

        // 同一 frame の連続設置などで、直前の盤面に既にこの手のセルが埋まっている場合
        const occupied = clone(loser);
        occupied.visual!.boards.forEach((board) => {
            for (const [x, y] of occupied.locks[0].cells!) {
                board.field[y * 10 + x] = Piece.Gray;
            }
        });
        expect(buildAnalysisPosition(occupied, 1, settings).skipReason).toEqual('occupiedCells');

        const completeLine = clone(loser);
        completeLine.locks[0].cells = [[0, 20], [1, 20], [2, 20], [3, 20]];
        completeLine.visual!.boards.forEach((board) => {
            for (let x = 0; x < 10; x += 1) {
                board.field[x] = Piece.Gray;
            }
        });
        expect(buildAnalysisPosition(completeLine, 1, settings).skipReason).toEqual('completeLine');
    });

    test('思考時間はプリセット以外を既定へ丸める', () => {
        expect(normalizeAnalysisThinkMs(100)).toEqual(100);
        expect(normalizeAnalysisThinkMs(2000)).toEqual(2000);
        expect(normalizeAnalysisThinkMs(50)).toEqual(ANALYSIS_THINK_MS_DEFAULT);
        expect(normalizeAnalysisThinkMs(123)).toEqual(ANALYSIS_THINK_MS_DEFAULT);
    });
});

describe('replay_analysis: 指標', () => {
    const moves = [
        { status: 'ok', loss: 0, rank: 1 },
        { status: 'ok', loss: 10, rank: 3 },
        { status: 'ok', loss: 90, rank: 8 },
        { status: 'ok', loss: 0, rank: 1 },
        { status: 'unmatched' },
        { status: 'skipped' },
        { status: 'pending' },
    ];

    test('損失は 0 未満にしない（探索の揺れで実手が最善を上回ることがある）', () => {
        expect(lossOf(100, 40)).toEqual(60);
        expect(lossOf(100, 140)).toEqual(0);
    });

    test('集計は解析成功手だけを分母にする', () => {
        const summary = summarizeAnalysis(moves);
        expect(summary.analyzed).toEqual(4);
        expect(summary.best).toEqual(2);
        expect(summary.matchRate).toBeCloseTo(0.5);
        expect(summary.meanLoss).toBeCloseTo(25);
        expect(summary.maxLoss).toEqual(90);
        expect(summary.totalLoss).toEqual(100);
        expect(summary.unmatched).toEqual(1);
        expect(summary.skipped).toEqual(1);
        expect(summary.failed).toEqual(0);
    });

    test('解析結果が無ければ集計はすべて 0', () => {
        const summary = summarizeAnalysis([{ status: 'pending' }]);
        expect(summary.analyzed).toEqual(0);
        expect(summary.matchRate).toEqual(0);
        expect(summary.meanLoss).toEqual(0);
        expect(summary.maxLoss).toEqual(0);
    });

    test('スケールは上位 10% の損失。全手最善でも 0 にはしない', () => {
        expect(percentile([], 0.9)).toEqual(0);
        expect(percentile([1, 2, 3, 4, 5], 0.9)).toEqual(5);
        expect(percentile([1, 2, 3, 4, 5], 0.5)).toEqual(3);
        expect(lossScaleOf(moves)).toEqual(90);
        expect(lossScaleOf([{ status: 'ok', loss: 0, rank: 1 }])).toBeGreaterThan(0);
    });

    // 単位が不明な評価値を絶対しきい値で切らず、この解析の中での相対で色分けする
    test('相対比で緩手・疑問手・悪手を分ける', () => {
        const scale = 100;
        expect(gradeOf(0, 1, scale)).toEqual('best');
        expect(gradeOf(40, 1, scale)).toEqual('best');   // rank 1 は常に最善扱い
        expect(gradeOf(5, 2, scale)).toEqual('minor');
        expect(gradeOf(15, 4, scale)).toEqual('mid');
        expect(gradeOf(49, 4, scale)).toEqual('mid');
        expect(gradeOf(50, 9, scale)).toEqual('major');
        expect(gradeOf(500, 9, scale)).toEqual('major');
    });

    // タイムライン・ガベージマーカー帯と同じ写像でなければ 3 つの帯が揃わない
    test('frameToX はフレーム軸を幅へ線形に写す', () => {
        expect(frameToX(0, 1200, 300)).toEqual(0);
        expect(frameToX(600, 1200, 300)).toEqual(150);
        expect(frameToX(1200, 1200, 300)).toEqual(300);
        expect(frameToX(-10, 1200, 300)).toEqual(0);
        expect(frameToX(9999, 1200, 300)).toEqual(300);
        expect(frameToX(5, 0, 300)).toEqual(300);
    });
});
