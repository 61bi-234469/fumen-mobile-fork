import { Engine } from '@haelp/teto/engine';
import { isMinoPiece, Piece } from '../enums';
import { convertEngineBoard, EngineBoardState, minoToPiece } from './board_converter';
import { buildEngineConfig } from './engine_config';
import { TtrmError } from './parser';
import { resolveTtrmOptions } from './options';
import {
    GarbageEvent,
    InitialPoint,
    LockPoint,
    PlayerRoundIR,
    ReplayActiveFrame,
    ReplayBoardFrame,
    ReplayGarbageFrame,
    ReplayIR,
    ReplayQueueFrame,
    ReplayVisualTimeline,
    RoundIR,
    TtrmFile,
    TtrmPlayerRound,
} from './types';

// NFR-02 の実測用。Worker でも jsdom でも使えるようにフォールバックを持つ。
export const nowMs = (): number =>
    typeof performance !== 'undefined' && typeof performance.now === 'function'
        ? performance.now()
        : Date.now();

// エンジンが保持しているキューを全部読む。表示件数で切らないのは、Editor へ
// 引き渡す NEXT をリプレイから読める分だけ残らず持たせるため（画面側で切る）。
// 実測ではバッグ補充の都合で 9〜15 個の幅がある。
const readQueue = (engine: Engine): Piece[] =>
    Array.prototype.slice.call(engine.queue).map(minoToPiece).filter(isMinoPiece);

// falling.lock / 終端時点の「操作対象のミノ」。エンジンは lock 処理内で次のミノを
// spawn するため、その時点の falling がそのまま次に置かれるミノになる
// （hold を挟むと入れ替わるが、盤面状態としては falling が正しい）。
const readFalling = (engine: Engine): Piece | null => {
    const symbol = engine.falling !== undefined ? engine.falling.symbol : undefined;
    if (symbol === undefined) {
        return null;
    }
    const piece = minoToPiece(symbol);
    return isMinoPiece(piece) ? piece : null;
};

const readActiveFrame = (engine: Engine, frame: number): ReplayActiveFrame | undefined => {
    if (engine.falling === undefined) {
        return undefined;
    }
    const piece = minoToPiece(engine.falling.symbol);
    if (!isMinoPiece(piece)) {
        return undefined;
    }
    return {
        frame,
        piece,
        rotation: engine.falling.rotation,
        x: engine.falling.x,
        y: engine.falling.y,
        cells: engine.falling.absoluteBlocks.map(([x, y]) => [x, y] as [number, number]),
    };
};

const readQueueFrame = (engine: Engine, frame: number): ReplayQueueFrame => ({
    frame,
    hold: engine.held !== null && engine.held !== undefined ? minoToPiece(engine.held) : null,
    current: readFalling(engine),
    next: readQueue(engine),
});

const readBoardFrame = (engine: Engine, frame: number): ReplayBoardFrame => {
    const board = convertEngineBoard(engine.board.state as EngineBoardState);
    return { frame, ...board };
};

const readGarbageFrame = (engine: Engine, frame: number): ReplayGarbageFrame => ({
    frame,
    snapshot: engine.garbageQueue.snapshot(),
});

const sameNumbers = (a: number[], b: number[]): boolean =>
    a.length === b.length && a.every((value, index) => value === b[index]);

const sameCells = (a: [number, number][], b: [number, number][]): boolean =>
    a.length === b.length
    && a.every((cell, index) => cell[0] === b[index][0] && cell[1] === b[index][1]);

const sameActive = (a: ReplayActiveFrame, b: ReplayActiveFrame): boolean =>
    a.piece === b.piece && a.rotation === b.rotation && a.x === b.x && a.y === b.y
    && sameCells(a.cells, b.cells);

const sameBoard = (a: ReplayBoardFrame, b: ReplayBoardFrame): boolean =>
    a.sourceHeight === b.sourceHeight && a.clippedRowCount === b.clippedRowCount
    && sameNumbers(a.field, b.field);

const sameQueue = (a: ReplayQueueFrame, b: ReplayQueueFrame): boolean =>
    a.hold === b.hold && a.current === b.current && sameNumbers(a.next, b.next);

const sameGarbage = (a: ReplayGarbageFrame, b: ReplayGarbageFrame): boolean =>
    JSON.stringify(a.snapshot) === JSON.stringify(b.snapshot);

// 同一 frame で hold → hard drop のように複数回変わる場合、UI が表示するのは
// その frame の最終状態だけ。同じ frame の末尾を置き換えて昇順を保つ。
const recordChange = <T extends { frame: number }>(
    points: T[], next: T, equal: (a: T, b: T) => boolean,
): void => {
    const last = points[points.length - 1];
    if (last !== undefined && last.frame === next.frame) {
        if (!equal(last, next)) {
            points[points.length - 1] = next;
        }
        return;
    }
    if (last === undefined || !equal(last, next)) {
        points.push(next);
    }
};

const rawConfirmSenderFrames = (playerRound: TtrmPlayerRound): Map<string, number[]> => {
    const frames = new Map<string, number[]>();
    for (const event of playerRound.replay.events) {
        const ige = event.type === 'ige' ? event.data : undefined;
        const envelope = ige !== undefined && ige.type === 'interaction_confirm'
            ? ige.data
            : undefined;
        const payload = envelope !== undefined && typeof envelope.data === 'object'
            ? envelope.data
            : undefined;
        const iid = envelope?.iid ?? payload?.iid;
        const gameid = envelope?.gameid ?? payload?.gameid;
        // Depending on the replay version the garbage payload is either the confirm envelope
        // itself or one level below it. Only this payload frame is the sender-side clock;
        // event.frame and the IGE envelope frame belong to the receiving player.
        const senderFrame = payload?.frame ?? envelope?.frame;
        const type = payload?.type ?? envelope?.type;
        if (envelope === undefined || type !== 'garbage'
            || typeof iid !== 'number' || typeof gameid !== 'number'
            || typeof senderFrame !== 'number' || !Number.isFinite(senderFrame)) {
            continue;
        }
        const key = `${gameid}:${iid}`;
        const values = frames.get(key) ?? [];
        values.push(senderFrame);
        frames.set(key, values);
    }
    return frames;
};

// ラウンド開始地点（P2 §3-3）。Engine#falling / Engine#queue は型定義上 optional では
// ないが、構築直後に未初期化だった場合に備えて 1 tick 進めてから読み直す。
const readInitialPoint = (engine: Engine): InitialPoint => {
    const read = (): InitialPoint => ({
        frame: 0,
        field: convertEngineBoard(engine.board.state as EngineBoardState).field,
        hold: engine.held !== null && engine.held !== undefined ? minoToPiece(engine.held) : null,
        current: readFalling(engine),
        next: readQueue(engine),
    });

    const initial = read();
    if (initial.current !== null && initial.next.length > 0) {
        return initial;
    }
    engine.tick([]);
    return read();
};

const collectOpponents = (playerRound: TtrmPlayerRound): number[] => {
    const opponents: number[] = [];
    for (const e of playerRound.replay.events) {
        const d = e.data && e.data.data;
        if (d && d.gameid !== null && d.gameid !== undefined && !opponents.includes(d.gameid)) {
            opponents.push(d.gameid);
        }
        if (d && d.targets) {
            for (const t of d.targets) {
                if (!opponents.includes(t)) {
                    opponents.push(t);
                }
            }
        }
    }
    return opponents;
};

// Simulate one player round: tick the engine over the input log, capture a
// lock point per placement, then keep ticking to replay.frames so that the
// terminal state includes post-lock garbage (plan §3-4: the losing side's
// killing garbage lands after the final lock).
export const simulatePlayerRound = (playerRound: TtrmPlayerRound): PlayerRoundIR => {
    const { options, warnings } = resolveTtrmOptions(playerRound.replay);

    if ((options.boardwidth ?? 10) !== 10) {
        throw new TtrmError('validate', `unsupported board width: ${options.boardwidth}`);
    }

    const engine = new Engine(buildEngineConfig(options, collectOpponents(playerRound)));

    // 手を進める前の開始局面。以降の tick で潰れるので必ずここで読む。
    const initial = readInitialPoint(engine);

    const locks: LockPoint[] = [];
    const garbageEvents: GarbageEvent[] = [];
    const visual: ReplayVisualTimeline = { active: [], boards: [], queues: [], garbage: [] };
    const confirmSenderFrames = rawConfirmSenderFrames(playerRound);
    let totalLines = 0;
    let prevAttack = 0;
    let prevGarbageCleared = 0;

    const recordActive = (frame: number): void => {
        const active = readActiveFrame(engine, frame);
        if (active !== undefined) {
            recordChange(visual.active, active, sameActive);
        }
    };
    const recordBoard = (frame: number, board?: ReturnType<typeof convertEngineBoard>): void => {
        const point = board !== undefined ? { frame, ...board } : readBoardFrame(engine, frame);
        recordChange(visual.boards, point, sameBoard);
    };
    const recordQueue = (frame: number, queue?: ReplayQueueFrame): void => {
        recordChange(visual.queues, queue ?? readQueueFrame(engine, frame), sameQueue);
    };
    const recordGarbage = (frame: number): void => {
        recordChange(visual.garbage, readGarbageFrame(engine, frame), sameGarbage);
    };

    recordActive(0);
    recordBoard(0);
    recordQueue(0, {
        frame: 0,
        hold: initial.hold,
        current: initial.current,
        next: initial.next,
    });
    recordGarbage(0);

    // falling.lock fires after the piece merges, so the pre-lock board and
    // piece pose are snapshotted on falling.lock.pre.
    let preLock: {
        fieldBefore: ReturnType<typeof convertEngineBoard>;
        piece: Piece;
        rotation: number;
        x: number;
        y: number;
        cells: [number, number][];
    } | null = null;

    engine.events.on('falling.lock.pre', () => {
        preLock = {
            fieldBefore: convertEngineBoard(engine.board.state as EngineBoardState),
            piece: minoToPiece(engine.falling.symbol),
            rotation: engine.falling.rotation,
            x: engine.falling.x,
            y: engine.falling.y,
            // AI 解析の実手同定に使う。エンジンの盤面は board.state[0] が最下段で
            // アプリ Field と同じ向きなので、この座標はそのまま流用できる。
            cells: engine.falling.absoluteBlocks.map(([x, y]) => [x, y] as [number, number]),
        };
    });

    // HOLD と lock 後の spawn は tick 終了を待たず、この raw frame で切り替わる。
    // 1 frame 内に複数回 spawn した場合は recordChange が最後の状態だけを残す。
    engine.events.on('falling.new', () => {
        recordActive(engine.frame);
        recordQueue(engine.frame);
    });
    engine.events.on('queue.add', () => {
        recordQueue(engine.frame);
    });

    engine.events.on('falling.lock', (res) => {
        const after = convertEngineBoard(engine.board.state as EngineBoardState);
        totalLines += res.lines || 0;
        const attack = Math.max(0, (res.stats.garbage.attack ?? 0) - prevAttack);
        prevAttack = res.stats.garbage.attack ?? prevAttack;
        const garbageCleared = Math.max(0,
            (res.stats.garbage.cleared ?? 0) - prevGarbageCleared);
        prevGarbageCleared = res.stats.garbage.cleared ?? prevGarbageCleared;
        const queue = readQueueFrame(engine, engine.frame);
        locks.push({
            attack,
            garbageCleared,
            pieceIndex: locks.length,
            frame: engine.frame,
            fieldBefore: preLock ? preLock.fieldBefore.field : after.field,
            fieldAfter: after.field,
            piece: preLock ? preLock.piece : minoToPiece(res.mino),
            rotation: preLock ? preLock.rotation : 0,
            x: preLock ? preLock.x : 0,
            y: preLock ? preLock.y : 0,
            cells: preLock ? preLock.cells : undefined,
            hold: queue.hold,
            current: queue.current,
            next: queue.next,
            clear: {
                lines: res.lines || 0,
                spin: res.spin || 'none',
                b2b: res.stats.b2b ?? 0,
                ren: res.stats.combo ?? 0,
                perfectClear: (res.lines || 0) > 0 && after.field.every(cell => cell === Piece.Empty),
            },
            garbageGauge: (engine.garbageQueue as any).size ?? 0,
            sourceHeight: after.sourceHeight,
            clippedRowCount: after.clippedRowCount,
        });
        recordBoard(engine.frame, after);
        recordActive(engine.frame);
        recordQueue(engine.frame, queue);
        recordGarbage(engine.frame);
        preLock = null;
    });

    // P3 §3-3。ゲージ恒等式（receive − cancel − tank == garbageQueue.size）が
    // 成り立つのは passthrough 相殺後の amount のほう。originalAmount では合わない。
    engine.events.on('garbage.receive', (ev) => {
        garbageEvents.push({
            frame: engine.frame, kind: 'receive', iid: ev.iid, amount: ev.amount ?? 0,
        });
        recordGarbage(engine.frame);
    });
    // 送信元（gameid）と送信側クロックのフレーム。FR-45 の攻撃元表示に使う。
    engine.events.on('garbage.confirm', (ev) => {
        const senderFrames = confirmSenderFrames.get(`${ev.gameid}:${ev.iid}`);
        const senderFrame = senderFrames !== undefined && senderFrames.length > 0
            ? senderFrames.shift()
            : undefined;
        garbageEvents.push({
            frame: engine.frame, kind: 'confirm', iid: ev.iid, amount: 0,
            gameid: ev.gameid, senderFrame: senderFrame ?? ev.frame,
        });
        recordGarbage(engine.frame);
    });
    engine.events.on('garbage.tank', (ev) => {
        garbageEvents.push({
            frame: engine.frame, kind: 'tank', iid: ev.iid,
            amount: ev.amount ?? 0, column: ev.column, size: ev.size,
        });
        recordBoard(engine.frame);
        recordGarbage(engine.frame);
    });
    engine.events.on('garbage.cancel', (ev) => {
        garbageEvents.push({
            frame: engine.frame, kind: 'cancel', iid: ev.iid,
            amount: ev.amount ?? 0, size: ev.size,
        });
        recordGarbage(engine.frame);
    });

    // Tick loop ported unchanged from the verified P0 harness. 'end' events
    // are skipped and the engine keeps ticking to replay.frames (trap #1).
    const events = playerRound.replay.events.slice();
    while (events.length > 0) {
        while (engine.frame < events[0].frame) {
            engine.tick([]);
            recordActive(engine.frame);
        }
        while (events.length && events[0].frame < engine.frame) {
            events.shift();
        }
        const toTick = [];
        while (events.length && events[0].frame === engine.frame) {
            const event = events.shift()!;
            if (event.type === 'end') {
                continue;
            }
            toTick.push(event);
        }
        engine.tick(toTick as any);
        recordActive(engine.frame);
    }
    while (engine.frame < playerRound.replay.frames) {
        engine.tick([]);
        recordActive(engine.frame);
    }

    const terminalBoard = convertEngineBoard(engine.board.state as EngineBoardState);
    const terminalQueue = readQueueFrame(engine, engine.frame);
    recordBoard(engine.frame, terminalBoard);
    recordQueue(engine.frame, terminalQueue);
    recordGarbage(engine.frame);
    const stats = playerRound.replay.results.stats;
    const actualSent = engine.stats.garbage.sent ?? 0;
    const verification = {
        piecesplaced: { expected: stats.piecesplaced, actual: locks.length },
        lines: { expected: stats.lines, actual: totalLines },
        sent: { expected: stats.garbage.sent, actual: actualSent },
        matched: stats.piecesplaced === locks.length
            && stats.lines === totalLines
            && stats.garbage.sent === actualSent,
    };

    return {
        initial,
        locks,
        garbageEvents,
        verification,
        visual,
        id: playerRound.id,
        username: playerRound.username,
        resolvedOptions: options,
        optionWarnings: warnings,
        terminal: {
            frame: engine.frame,
            field: terminalBoard.field,
            sourceHeight: terminalBoard.sourceHeight,
            clippedRowCount: terminalBoard.clippedRowCount,
            garbageGauge: (engine.garbageQueue as any).size ?? 0,
            hold: terminalQueue.hold,
            current: terminalQueue.current,
            next: terminalQueue.next,
            reason: playerRound.replay.results.gameoverreason,
            alive: playerRound.alive,
        },
    };
};

const buildRound = (round: TtrmPlayerRound[], index: number): RoundIR => {
    const reasons: { [playerId: string]: string } = {};
    for (const player of round) {
        reasons[player.id] = player.replay.results.gameoverreason;
    }
    const winner = round.find(player => player.replay.results.gameoverreason === 'winner');

    const base = {
        index,
        startFrame: 0,
        endFrame: Math.max(...round.map(player => player.replay.frames)),
        result: { reasons, winnerId: winner ? winner.id : null },
    };

    try {
        const players = round.map(simulatePlayerRound);
        const mismatched = players.find(player => !player.verification.matched);
        if (mismatched !== undefined) {
            const v = mismatched.verification;
            return {
                ...base,
                players,
                status: 'failed',
                failure: {
                    stage: 'verify',
                    message: `${mismatched.username}: pieces ${v.piecesplaced.actual}/${v.piecesplaced.expected},`
                        + ` lines ${v.lines.actual}/${v.lines.expected}, sent ${v.sent.actual}/${v.sent.expected}`,
                },
            };
        }
        return { ...base, players, status: 'ok' };
    } catch (e) {
        return {
            ...base,
            players: [],
            status: 'failed',
            failure: {
                stage: e instanceof TtrmError ? e.stage : 'simulate',
                message: e instanceof Error ? e.message : String(e),
            },
        };
    }
};

// startedAt を渡すと、そこからの経過を meta.parseMs にする（Worker は JSON パースも含めて計る）。
export const buildReplayIR = (file: TtrmFile, startedAt: number = nowMs()): ReplayIR => {
    const rounds = file.replay.rounds.map(buildRound);
    return {
        rounds,
        meta: {
            users: (file.users ?? []).map(user => ({ id: user.id, username: user.username })),
            gamemode: file.gamemode ?? '',
            ts: file.ts ?? '',
            version: file.version ?? 1,
            parseMs: Math.round(nowMs() - startedAt),
        },
    };
};
