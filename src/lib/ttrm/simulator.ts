import { Engine } from '@haelp/teto/engine';
import { Piece } from '../enums';
import { convertEngineBoard, EngineBoardState, minoToPiece } from './board_converter';
import { buildEngineConfig } from './engine_config';
import { TtrmError } from './parser';
import { resolveTtrmOptions } from './options';
import {
    GarbageEvent,
    LockPoint,
    PlayerRoundIR,
    ReplayIR,
    RoundIR,
    TtrmFile,
    TtrmPlayerRound,
} from './types';

const NEXT_COUNT = 5;

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
        const gaugeQueue = (engine.garbageQueue as any).queue as any[] | undefined;
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
            next: Array.prototype.slice.call(engine.queue, 0, NEXT_COUNT).map(minoToPiece),
            clear: {
                lines: res.lines || 0,
                spin: res.spin || 'none',
                b2b: res.stats.b2b ?? 0,
                ren: res.stats.combo ?? 0,
                perfectClear: (res.lines || 0) > 0 && after.field.every(cell => cell === Piece.Empty),
            },
            garbageGauge: (engine.garbageQueue as any).size ?? 0,
            pendingHoles: gaugeQueue ? gaugeQueue.length : 0,
            sourceHeight: after.sourceHeight,
            clippedRowCount: after.clippedRowCount,
        });
        preLock = null;
    });

    engine.events.on('garbage.receive', (ev) => {
        garbageEvents.push({ frame: engine.frame, kind: 'receive', amount: ev.originalAmount ?? ev.amount ?? 0 });
    });
    engine.events.on('garbage.tank', (ev) => {
        garbageEvents.push({
            frame: engine.frame, kind: 'tank', amount: ev.amount ?? 0, column: ev.column, size: ev.size,
        });
    });
    engine.events.on('garbage.cancel', (ev) => {
        garbageEvents.push({ frame: engine.frame, kind: 'cancel', amount: ev.amount ?? 0, size: ev.size });
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

export const buildReplayIR = (file: TtrmFile): ReplayIR => {
    return {
        meta: {
            users: (file.users ?? []).map(user => ({ id: user.id, username: user.username })),
            gamemode: file.gamemode ?? '',
            ts: file.ts ?? '',
            version: file.version ?? 1,
        },
        rounds: file.replay.rounds.map(buildRound),
    };
};
