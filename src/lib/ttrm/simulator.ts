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
    ReplayIR,
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
    let totalLines = 0;
    let prevAttack = 0;

    // falling.lock fires after the piece merges, so the pre-lock board and
    // piece pose are snapshotted on falling.lock.pre.
    let preLock: {
        fieldBefore: ReturnType<typeof convertEngineBoard>;
        piece: Piece;
        rotation: number;
        x: number;
        y: number;
    } | null = null;

    engine.events.on('falling.lock.pre', () => {
        preLock = {
            fieldBefore: convertEngineBoard(engine.board.state as EngineBoardState),
            piece: minoToPiece(engine.falling.symbol),
            rotation: engine.falling.rotation,
            x: engine.falling.x,
            y: engine.falling.y,
        };
    });

    engine.events.on('falling.lock', (res) => {
        const after = convertEngineBoard(engine.board.state as EngineBoardState);
        totalLines += res.lines || 0;
        const attack = Math.max(0, (res.stats.garbage.attack ?? 0) - prevAttack);
        prevAttack = res.stats.garbage.attack ?? prevAttack;
        locks.push({
            attack,
            pieceIndex: locks.length,
            frame: engine.frame,
            fieldBefore: preLock ? preLock.fieldBefore.field : after.field,
            fieldAfter: after.field,
            piece: preLock ? preLock.piece : minoToPiece(res.mino),
            rotation: preLock ? preLock.rotation : 0,
            x: preLock ? preLock.x : 0,
            y: preLock ? preLock.y : 0,
            hold: engine.held !== null ? minoToPiece(engine.held) : null,
            current: readFalling(engine),
            next: readQueue(engine),
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
        preLock = null;
    });

    // P3 §3-3。ゲージ恒等式（receive − cancel − tank == garbageQueue.size）が
    // 成り立つのは passthrough 相殺後の amount のほう。originalAmount では合わない。
    engine.events.on('garbage.receive', (ev) => {
        garbageEvents.push({
            frame: engine.frame, kind: 'receive', iid: ev.iid, amount: ev.amount ?? 0,
        });
    });
    // 送信元（gameid）と送信側クロックのフレーム。FR-45 の攻撃元表示に使う。
    engine.events.on('garbage.confirm', (ev) => {
        garbageEvents.push({
            frame: engine.frame, kind: 'confirm', iid: ev.iid, amount: 0,
            gameid: ev.gameid, senderFrame: ev.frame,
        });
    });
    engine.events.on('garbage.tank', (ev) => {
        garbageEvents.push({
            frame: engine.frame, kind: 'tank', iid: ev.iid,
            amount: ev.amount ?? 0, column: ev.column, size: ev.size,
        });
    });
    engine.events.on('garbage.cancel', (ev) => {
        garbageEvents.push({
            frame: engine.frame, kind: 'cancel', iid: ev.iid,
            amount: ev.amount ?? 0, size: ev.size,
        });
    });

    // Tick loop ported unchanged from the verified P0 harness. 'end' events
    // are skipped and the engine keeps ticking to replay.frames (trap #1).
    const events = playerRound.replay.events.slice();
    while (events.length > 0) {
        while (engine.frame < events[0].frame) {
            engine.tick([]);
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
    }
    while (engine.frame < playerRound.replay.frames) {
        engine.tick([]);
    }

    const terminalBoard = convertEngineBoard(engine.board.state as EngineBoardState);
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
            hold: engine.held !== null ? minoToPiece(engine.held) : null,
            current: readFalling(engine),
            next: readQueue(engine),
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
