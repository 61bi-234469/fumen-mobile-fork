import {
    GarbageQueue,
    GarbageQueueInitializeParams,
    GarbageQueueSnapshot,
    Mino,
    garbageCalcV2,
} from '@haelp/teto/engine';
import { InputRotationEvidence } from './comment_metadata';
import { Piece, isMinoPiece } from './enums';
import { Field } from './fumen/field';
import type { Move, Page } from './fumen/types';
import type { SerializedTree } from './fumen/tree_types';
import { findNodeByPageIndex, getPathToNode } from './fumen/tree_utils';
import {
    InputStats,
    PlacementResult,
    evaluatePlacement,
} from './input_stats';
import { buildEngineConfig } from './ttrm/engine_config';
import { garbageAtFrame } from './ttrm/timeline';
import { PlayerRoundIR, TtrmSpinType } from './ttrm/types';

export type InputReplayComboTable = 'none' | 'classic guideline' | 'modern guideline' | 'multiplier';

/** Normalized TETR.IO options needed after the replay has been detached from its IR. */
export interface InputReplayRules {
    spinBonuses: string;
    comboTable: InputReplayComboTable;
    garbageTargetBonus: string;
    b2bChaining: boolean;
    b2bCharging: boolean;
    b2bChargeAt: number;
    b2bChargeBase: number;
    allClearGarbage: number;
    allClearB2b: number;
    specialBonus: boolean;
    multiplier: number;
    multiplierIncrease: number;
    multiplierMargin: number;
    garbageCap: number;
    garbageCapIncrease: number;
    garbageCapMargin: number;
    garbageCapMax: number;
    garbageSpeed: number;
    roundMode: 'down' | 'rng';
    openerPhase: number;
}

export interface InputReplayLastGarbage {
    attack: number;
    cancelled: number;
    sent: number;
    risen: number;
}

export interface InputReplayGarbageContext {
    snapshot: GarbageQueueSnapshot;
    /** Virtual Engine frame. INPUT advances it only when a no-clear lock needs to tank. */
    frame: number;
    /** Engine piece counter before the current, unplaced page piece. */
    pieces: number;
    /** Full queue configuration is retained for messiness, hole and opener behavior. */
    options: GarbageQueueInitializeParams;
    rules: InputReplayRules;
    last?: InputReplayLastGarbage;
}

export interface InputReplayContext {
    /** Statistics immediately before the current page's unplaced piece. */
    stats: InputStats;
    garbage: InputReplayGarbageContext;
}

export interface InputGarbageRow {
    column: number;
    size: number;
}

export interface InputGarbageView {
    gauge: number;
    nextRise?: InputGarbageRow;
    nextTankRows: InputGarbageRow[];
    nextTankFrame?: number;
}

export interface InputReplayPlacementResult extends PlacementResult {
    /** Number of cleared rows containing garbage; used by TETR.IO special bonus. */
    garbageCleared: number;
}

export interface InputReplayTransition {
    context: InputReplayContext;
    placement: InputReplayPlacementResult;
    /** Damage before cancellation, matching Engine LockRes.rawGarbage totals. */
    attack: number;
    cancelled: number;
    sent: number;
    /** Every row tanked by this no-clear lock, in application order. */
    tankRows: InputGarbageRow[];
}

export interface InputReplayContextSeed {
    stats: InputStats;
    snapshot: GarbageQueueSnapshot;
    frame: number;
    pieces?: number;
    options: GarbageQueueInitializeParams;
    rules: InputReplayRules;
}

const clonePlacement = (placement: PlacementResult | undefined): PlacementResult | undefined => (
    placement === undefined ? undefined : { ...placement }
);

const cloneStats = (stats: InputStats): InputStats => ({
    ...stats,
    lastAction: clonePlacement(stats.lastAction),
});

export const cloneGarbageQueueSnapshot = (snapshot: GarbageQueueSnapshot): GarbageQueueSnapshot => ({
    ...snapshot,
    queue: snapshot.queue.map(item => ({ ...item })),
});

const cloneGarbageOptions = (options: GarbageQueueInitializeParams): GarbageQueueInitializeParams => ({
    ...options,
    cap: { ...options.cap },
    messiness: { ...options.messiness },
    garbage: { ...options.garbage },
    multiplier: { ...options.multiplier },
});

export const cloneInputReplayContext = (context: InputReplayContext): InputReplayContext => ({
    stats: cloneStats(context.stats),
    garbage: {
        ...context.garbage,
        snapshot: cloneGarbageQueueSnapshot(context.garbage.snapshot),
        options: cloneGarbageOptions(context.garbage.options),
        rules: { ...context.garbage.rules },
        last: context.garbage.last === undefined ? undefined : { ...context.garbage.last },
    },
});

/** Returns a detached copy of the latest replay reset boundary on the active linear/tree route. */
export const inputReplayContextAt = (
    pages: Page[],
    currentIndex: number,
    tree?: SerializedTree,
): InputReplayContext | undefined => {
    if (pages.length === 0) return undefined;
    const resolvedIndex = Math.min(Math.max(0, currentIndex), pages.length - 1);
    const currentNode = tree === undefined ? undefined : findNodeByPageIndex(tree, currentIndex);
    const route = currentNode === undefined
        ? Array.from({ length: resolvedIndex + 1 }, (_, index) => index)
        : getPathToNode(tree!, currentNode.id)
            .map(nodeId => tree!.nodes.find(node => node.id === nodeId))
            .filter((node): node is NonNullable<typeof node> => node !== undefined && node.pageIndex >= 0)
            .map(node => node.pageIndex);
    for (let position = route.length - 1; position >= 0; position -= 1) {
        const context = pages[route[position]]?.internal?.inputReplayContext;
        if (context !== undefined) return cloneInputReplayContext(context);
    }
    return undefined;
};

export const createInputReplayContextFromSnapshot = (
    seed: InputReplayContextSeed,
): InputReplayContext => cloneInputReplayContext({
    stats: seed.stats,
    garbage: {
        snapshot: seed.snapshot,
        frame: Math.max(0, Math.floor(seed.frame)),
        pieces: seed.pieces ?? seed.stats.pieces,
        options: seed.options,
        rules: seed.rules,
    },
});

const replayPlacedCount = (player: PlayerRoundIR, pointIndex: number): number => (
    Math.min(player.locks.length, Math.max(0, Math.floor(pointIndex)))
);

const toInputSpin = (spin: TtrmSpinType): PlacementResult['spin'] => (
    spin === 'normal' ? 'full' : spin
);

/** Exact replay totals used to reset INPUT statistics at the imported page. */
export const inputReplayStatsAt = (player: PlayerRoundIR, pointIndex: number): InputStats => {
    const placed = replayPlacedCount(player, pointIndex);
    const locks = player.locks.slice(0, placed);
    const last = locks[locks.length - 1];
    return {
        b2bChain: last === undefined ? 0 : Math.max(0, last.clear.b2b + 1),
        renChain: last === undefined ? 0 : Math.max(0, last.clear.ren + 1),
        pieces: placed,
        lines: locks.reduce((sum, lock) => sum + lock.clear.lines, 0),
        perfectClears: locks.filter(lock => lock.clear.perfectClear).length,
        lastAction: last === undefined ? undefined : {
            clearedLines: last.clear.lines,
            spin: toInputSpin(last.clear.spin),
            perfectClear: last.clear.perfectClear,
            piece: last.piece,
        },
    };
};

const normalizedRules = (
    player: PlayerRoundIR,
    options: GarbageQueueInitializeParams,
): InputReplayRules => {
    const config = buildEngineConfig(player.resolvedOptions, []);
    const charging = config.b2b.charging;
    const pc = config.pc;
    return {
        spinBonuses: config.options.spinBonuses,
        comboTable: config.options.comboTable,
        garbageTargetBonus: config.options.garbageTargetBonus,
        b2bChaining: config.b2b.chaining,
        b2bCharging: charging !== false,
        b2bChargeAt: charging === false ? 4 : charging.at,
        b2bChargeBase: charging === false ? 3 : charging.base,
        allClearGarbage: pc === false ? 0 : pc.garbage,
        allClearB2b: pc === false ? 0 : pc.b2b,
        specialBonus: options.specialBonus,
        multiplier: options.multiplier.value,
        multiplierIncrease: options.multiplier.increase,
        multiplierMargin: options.multiplier.marginTime,
        garbageCap: options.cap.value,
        garbageCapIncrease: options.cap.increase,
        garbageCapMargin: options.cap.marginTime,
        garbageCapMax: options.cap.max,
        garbageSpeed: options.garbage.speed,
        roundMode: options.rounding,
        openerPhase: options.openerPhase,
    };
};

/**
 * Builds the editor-only battle context at an arbitrary replay cursor.
 * Missing visual snapshots are tolerated for legacy/manual IR fixtures and produce an empty queue.
 */
export const createInputReplayContext = (
    player: PlayerRoundIR,
    pointIndex: number,
    cursorFrame: number,
): InputReplayContext => {
    const config = buildEngineConfig(player.resolvedOptions, []);
    const empty = new GarbageQueue(config.garbage).snapshot();
    return createInputReplayContextFromSnapshot({
        stats: inputReplayStatsAt(player, pointIndex),
        snapshot: garbageAtFrame(player, cursorFrame)?.snapshot ?? empty,
        frame: cursorFrame,
        pieces: replayPlacedCount(player, pointIndex),
        options: config.garbage,
        rules: normalizedRules(player, config.garbage),
    });
};

const restoreQueue = (context: InputReplayContext): GarbageQueue => {
    const queue = new GarbageQueue(context.garbage.options);
    queue.fromSnapshot(cloneGarbageQueueSnapshot(context.garbage.snapshot));
    return queue;
};

const dynamicValue = (base: number, increase: number, margin: number, frame: number): number => (
    base + Math.max(0, frame - margin) * increase / 60
);

const dynamicMultiplier = (context: InputReplayContext, frame: number): number => {
    const rules = context.garbage.rules;
    return dynamicValue(rules.multiplier, rules.multiplierIncrease, rules.multiplierMargin, frame);
};

const dynamicCap = (context: InputReplayContext, frame: number): number => {
    const rules = context.garbage.rules;
    return dynamicValue(rules.garbageCap, rules.garbageCapIncrease, rules.garbageCapMargin, frame);
};

const nextTankFrame = (context: InputReplayContext): number | undefined => {
    const speed = context.garbage.options.garbage.speed;
    let next: number | undefined;
    for (const item of context.garbage.snapshot.queue) {
        if (!item.confirmed || item.amount <= 0) continue;
        const ready = item.frame + speed;
        if (next === undefined || ready < next) next = ready;
    }
    return next === undefined ? undefined : Math.max(context.garbage.frame, next);
};

const tankNext = (
    context: InputReplayContext,
    queue: GarbageQueue,
): { frame?: number, rows: InputGarbageRow[] } => {
    const frame = nextTankFrame(context);
    if (frame === undefined) return { rows: [] };
    const rows = queue.tank(frame, dynamicCap(context, frame), true)
        .map(({ column, size }) => ({ column, size }));
    return { frame, rows };
};

export const inputGarbageView = (context: InputReplayContext): InputGarbageView => {
    const queue = restoreQueue(context);
    const { frame, rows } = tankNext(context, queue);
    const gauge = context.garbage.snapshot.queue.reduce((sum, item) => sum + Math.max(0, item.amount), 0);
    return {
        gauge,
        nextRise: rows[0],
        nextTankRows: rows,
        nextTankFrame: frame,
    };
};

const minoOf = (piece: Piece | undefined): Mino | undefined => {
    switch (piece) {
    case Piece.I: return Mino.I;
    case Piece.J: return Mino.J;
    case Piece.L: return Mino.L;
    case Piece.O: return Mino.O;
    case Piece.S: return Mino.S;
    case Piece.T: return Mino.T;
    case Piece.Z: return Mino.Z;
    default: return undefined;
    }
};

interface ReplayStatsAdvance {
    stats: InputStats;
    rawB2b: number;
    rawRen: number;
    brokeB2b: false | number;
}

const advanceReplayStats = (
    stats: InputStats,
    placement: PlacementResult,
    rules: InputReplayRules,
): ReplayStatsAdvance => {
    let rawB2b = stats.b2bChain - 1;
    let rawRen = stats.renChain - 1;
    let brokeB2b: false | number = rawB2b;
    if (placement.clearedLines > 0) {
        rawRen += 1;
        const allClearB2b = placement.perfectClear ? rules.allClearB2b : 0;
        if ((placement.spin !== 'none' || placement.clearedLines >= 4) && allClearB2b === 0) {
            rawB2b += 1;
            brokeB2b = false;
        }
        if (allClearB2b !== 0) {
            rawB2b += allClearB2b;
            brokeB2b = false;
        }
        if (brokeB2b !== false) rawB2b = -1;
    } else {
        rawRen = -1;
        brokeB2b = false;
    }
    return {
        rawB2b,
        rawRen,
        brokeB2b,
        stats: {
            b2bChain: Math.max(0, rawB2b + 1),
            renChain: Math.max(0, rawRen + 1),
            pieces: stats.pieces + 1,
            lines: stats.lines + placement.clearedLines,
            perfectClears: stats.perfectClears + (placement.perfectClear ? 1 : 0),
            lastAction: placement,
        },
    };
};

const calculateAttackChunks = (
    context: InputReplayContext,
    queue: GarbageQueue,
    placement: InputReplayPlacementResult,
    advanced: ReplayStatsAdvance,
): number[] => {
    const mino = minoOf(placement.piece);
    if (mino === undefined) return [];
    const rules = context.garbage.rules;
    const multiplier = dynamicMultiplier(context, context.garbage.frame);
    const specialBonus = rules.specialBonus
        && placement.garbageCleared > 0
        && (placement.spin !== 'none' || placement.clearedLines >= 4) ? 1 : 0;
    const calculated = garbageCalcV2({
        lines: placement.clearedLines,
        spin: placement.spin === 'full' ? 'normal' : placement.spin,
        piece: mino,
        b2b: Math.max(advanced.rawB2b, 0),
        combo: Math.max(advanced.rawRen, 0),
        enemies: 0,
    }, {
        spinBonuses: rules.spinBonuses,
        comboTable: rules.comboTable,
        garbageTargetBonus: rules.garbageTargetBonus,
        b2b: {
            chaining: rules.b2bChaining,
            charging: rules.b2bCharging,
        },
    });
    const chunks: number[] = [];
    if (calculated.garbage > 0 || specialBonus > 0) {
        chunks.push(queue.round(calculated.garbage * multiplier + specialBonus));
    }
    if (advanced.brokeB2b !== false
        && rules.b2bCharging
        && advanced.brokeB2b + 1 > rules.b2bChargeAt) {
        const surged = Math.floor(
            (advanced.brokeB2b - rules.b2bChargeAt + rules.b2bChargeBase + 1) * multiplier,
        );
        const part = Math.round(surged / 3);
        chunks.unshift(part, part, surged - 2 * part);
    }
    if (placement.perfectClear) {
        chunks.push(queue.round(rules.allClearGarbage * multiplier));
    }
    return chunks.filter(amount => amount > 0);
};

const countGarbageCleared = (field: Field, piece: Move | undefined): number => {
    if (piece === undefined || !isMinoPiece(piece.type)) return 0;
    const placed = field.copy();
    placed.put(piece);
    let garbageCleared = 0;
    for (let y = 0; y < 23; y += 1) {
        const row = Array.from({ length: 10 }).map((_, x) => placed.get(x, y));
        if (row.every(cell => cell !== Piece.Empty) && row.some(cell => cell === Piece.Gray)) {
            garbageCleared += 1;
        }
    }
    return garbageCleared;
};

/**
 * Applies one INPUT lock with TETR.IO combo blocking semantics.
 * A clear may cancel FIFO garbage but never tanks; only a no-clear lock tanks all ready rows up to cap.
 */
export const advanceInputReplayContext = (
    context: InputReplayContext,
    field: Field,
    piece: Move | undefined,
    evidence?: InputRotationEvidence,
): InputReplayTransition => {
    const placement: InputReplayPlacementResult = {
        ...evaluatePlacement(field, piece, 'tetrioS2', evidence),
        garbageCleared: countGarbageCleared(field, piece),
    };
    const queue = restoreQueue(context);
    const advanced = advanceReplayStats(context.stats, placement, context.garbage.rules);
    const chunks = calculateAttackChunks(context, queue, placement, advanced);
    const attack = chunks.reduce((sum, amount) => sum + amount, 0);
    let cancelled = 0;
    let sent = attack;
    let tankRows: InputGarbageRow[] = [];
    let nextFrame = context.garbage.frame;

    if (placement.clearedLines > 0) {
        sent = 0;
        for (const amount of chunks) {
            const [remaining, removed] = queue.cancel(amount, context.garbage.pieces);
            cancelled += removed.reduce((sum, item) => sum + item.amount, 0);
            sent += remaining;
        }
    } else {
        const tanked = tankNext(context, queue);
        tankRows = tanked.rows;
        if (tanked.frame !== undefined) nextFrame = tanked.frame;
    }

    const nextContext: InputReplayContext = {
        stats: advanced.stats,
        garbage: {
            ...context.garbage,
            snapshot: queue.snapshot(),
            frame: nextFrame,
            pieces: context.garbage.pieces + 1,
            options: cloneGarbageOptions(context.garbage.options),
            rules: { ...context.garbage.rules },
            last: { attack, cancelled, sent, risen: tankRows.length },
        },
    };
    return {
        placement,
        attack,
        cancelled,
        sent,
        tankRows,
        context: nextContext,
    };
};

const writeGarbageRow = (field: Field, row: InputGarbageRow | undefined): void => {
    const holeFrom = row?.column ?? 0;
    const holeTo = holeFrom + (row?.size ?? 10);
    for (let x = 0; x < 10; x += 1) {
        field.setToSentLine(x, row !== undefined && (x < holeFrom || holeTo <= x) ? Piece.Gray : Piece.Empty);
    }
};

/** Burns tanked rows into a post-clear field and leaves only the following one-row preview in sentLine. */
export const applyInputGarbageRows = (
    field: Field,
    rows: InputGarbageRow[],
    nextRise?: InputGarbageRow,
): Field => {
    const result = field.copy();
    for (const row of rows) {
        writeGarbageRow(result, row);
        result.up();
    }
    writeGarbageRow(result, nextRise);
    return result;
};
