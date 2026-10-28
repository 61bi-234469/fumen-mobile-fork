import type { GarbageQueueInitializeParams, GarbageQueueSnapshot, IncomingGarbage } from '@haelp/teto/engine';
import type { Page } from './fumen/types';
import {
    InputGarbageSegment,
    InputReplayComboTable,
    InputReplayContext,
    InputReplayLastGarbage,
    InputReplayRules,
    cloneInputReplayContext,
    createDefaultInputReplayContext,
    inputGarbageSegments,
} from './input_replay';
import { InputStats, computeInputStats, toCommentCombo } from './input_stats';
import { PageFieldOperation, Pages, recomputeQuizFlags, resolvePageCommentText } from './pages';
import { withInputRotationEvidence, withSevenBagGrayDisplay, withSevenBagGrayProgress } from './comment_metadata';
import { parseQueueStateComment } from './cold_clear/queueParser';
import { createSpawnMove } from './piece';
import { isMinoPiece } from './enums';
import type { SerializedTree } from './fumen/tree_types';
import { appendTreeToComment } from './fumen/tree_utils';
import { FUMEN_COMMENT_MAX_ESCAPED_LENGTH } from './fumen/fumen';

export type InputSnapshotRotationSystem = 'classic' | 'srs' | 'srsPlus';

export interface InputSnapshot {
    context: InputReplayContext;
    rotationSystem: InputSnapshotRotationSystem;
    /** Written only into the dedicated share URL: the receiver opens the page in INPUT. */
    openInput: boolean;
}

export type InputSnapshotParseResult =
    | { status: 'ok', snapshot: InputSnapshot }
    | { status: 'unsupported' }
    | { status: 'invalid' };

const TOKEN_PREFIX = 'isnap=';
const TOKEN_REGEX = /^isnap=([0-9]{1,4})\.([A-Za-z0-9_-]+)$/;
const METADATA_SEPARATOR = ' | ';
const CURRENT_VERSION = 1;
// A full custom-rule token is about 1KB; anything near the comment limit is not ours.
const MAX_TOKEN_LENGTH = 4000;
const MAX_JSON_LENGTH = 3000;
const MAX_QUEUE_ITEMS = 200;
const MAX_QUEUE_ROWS = 4000;
const MAX_AMOUNT = 1000;
const MAX_COUNTER = 1e9;
const MAX_FRAME = 1e10;
const BOARD_WIDTH = 10;

const COMBO_TABLES: InputReplayComboTable[] = ['none', 'classic guideline', 'modern guideline', 'multiplier'];
const ROTATION_SYSTEMS: InputSnapshotRotationSystem[] = ['classic', 'srs', 'srsPlus'];
const RULE_NAME_REGEX = /^[A-Za-z0-9+_ -]{1,32}$/;

export const isInputSnapshotToken = (token: string): boolean => token.startsWith(TOKEN_PREFIX);

// ---------------------------------------------------------------------------
// base64url (UTF-8)

const toBase64Url = (text: string): string => btoa(unescape(encodeURIComponent(text)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64Url = (data: string): string => {
    const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    return decodeURIComponent(escape(atob(padded)));
};

// ---------------------------------------------------------------------------
// League default detection

const leagueContext = (stats: InputStats, seed: number): InputReplayContext => (
    createDefaultInputReplayContext(stats, seed)
);

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

// options.seed only seeds a fresh GarbageQueue; restoring from the snapshot replaces the RNG, so it is ignored.
const withoutSeed = (options: GarbageQueueInitializeParams) => ({ ...options, seed: 0 });

const RULE_KEYS: (keyof InputReplayRules)[] = [
    'spinBonuses', 'comboTable', 'garbageTargetBonus', 'b2bChaining', 'b2bCharging', 'b2bChargeAt',
    'b2bChargeBase', 'allClearGarbage', 'allClearB2b', 'specialBonus', 'multiplier', 'multiplierIncrease',
    'multiplierMargin', 'garbageCap', 'garbageCapIncrease', 'garbageCapMargin', 'garbageCapMax', 'garbageSpeed',
    'roundMode', 'openerPhase',
];

const canonicalOptions = (options: GarbageQueueInitializeParams): GarbageQueueInitializeParams => ({
    cap: {
        value: options.cap.value, marginTime: options.cap.marginTime, increase: options.cap.increase,
        absolute: options.cap.absolute, max: options.cap.max,
    },
    messiness: {
        change: options.messiness.change, within: options.messiness.within, nosame: options.messiness.nosame,
        timeout: options.messiness.timeout, center: options.messiness.center,
    },
    garbage: { speed: options.garbage.speed, holeSize: options.garbage.holeSize },
    multiplier: {
        value: options.multiplier.value, increase: options.multiplier.increase,
        marginTime: options.multiplier.marginTime,
    },
    bombs: options.bombs,
    seed: options.seed,
    boardWidth: options.boardWidth,
    rounding: options.rounding,
    openerPhase: options.openerPhase,
    specialBonus: options.specialBonus,
});

const canonicalRules = (rules: InputReplayRules): InputReplayRules => {
    const result: { [key: string]: unknown } = {};
    for (const key of RULE_KEYS) result[key] = rules[key];
    return result as unknown as InputReplayRules;
};

const sameRules = (a: InputReplayContext, b: InputReplayContext): boolean => (
    sameJson(withoutSeed(canonicalOptions(a.garbage.options)), withoutSeed(canonicalOptions(b.garbage.options)))
    && sameJson(canonicalRules(a.garbage.rules), canonicalRules(b.garbage.rules))
);

// Autosave serializes every INPUT page, so the league reference is built only once.
let leagueReference: InputReplayContext | undefined;

export const isLeagueInputRules = (context: InputReplayContext): boolean => {
    if (leagueReference === undefined) {
        leagueReference = leagueContext({ b2bChain: 0, renChain: 0, pieces: 0, lines: 0, perfectClears: 0 }, 1);
    }
    return sameRules(context, leagueReference);
};

// ---------------------------------------------------------------------------
// Serialize

type RulesPayload = 'league' | '^' | { o: GarbageQueueInitializeParams, u: InputReplayRules };

interface SnapshotPayload {
    v: number;
    rs: InputSnapshotRotationSystem;
    o?: 1;
    s: [number, number, number, number, number];
    g: {
        f: number;
        p: number;
        q: [number, number, number, number][];
        r: RulesPayload;
        n: [number, number, number | null, number, boolean, number];
        c?: { [cid: string]: number };
        l?: [number, number, number, number];
    };
}

const pendingQueue = (snapshot: GarbageQueueSnapshot): IncomingGarbage[] => (
    snapshot.queue.filter(item => item.confirmed && item.amount > 0)
);

export interface SerializeInputSnapshotOptions {
    rotationSystem: InputSnapshotRotationSystem;
    openInput?: boolean;
    /** The context of the token written just before this one; equal rules are written as "^". */
    previous?: InputReplayContext;
}

export const serializeInputSnapshot = (
    context: InputReplayContext,
    { rotationSystem, openInput = false, previous }: SerializeInputSnapshotOptions,
): string => {
    const garbage = context.garbage;
    const snapshot = garbage.snapshot;
    const queue = pendingQueue(snapshot);
    const rules: RulesPayload = isLeagueInputRules(context) ? 'league'
        : previous !== undefined && sameRules(context, previous) ? '^'
            : { o: canonicalOptions(garbage.options), u: canonicalRules(garbage.rules) };
    const columns: { [cid: string]: number } = {};
    for (const item of queue) {
        const column = garbage.columns?.[item.cid];
        if (column !== undefined) columns[String(item.cid)] = column;
    }
    const payload: SnapshotPayload = {
        v: CURRENT_VERSION,
        rs: rotationSystem,
        ...(openInput ? { o: 1 as const } : {}),
        s: [
            context.stats.b2bChain, context.stats.renChain, context.stats.pieces,
            context.stats.lines, context.stats.perfectClears,
        ],
        g: {
            f: garbage.frame,
            p: garbage.pieces,
            q: queue.map(item => [item.frame, item.amount, item.cid, item.size] as [number, number, number, number]),
            r: rules,
            n: [
                snapshot.seed, snapshot.lastTankTime, snapshot.lastColumn, snapshot.sent,
                snapshot.hasChangedColumn, snapshot.lastReceivedCount,
            ],
            ...(Object.keys(columns).length === 0 ? {} : { c: columns }),
            ...(garbage.last === undefined ? {} : {
                l: [garbage.last.attack, garbage.last.cancelled, garbage.last.sent, garbage.last.risen] as
                    [number, number, number, number],
            }),
        },
    };
    return `${TOKEN_PREFIX}${CURRENT_VERSION}.${toBase64Url(JSON.stringify(payload))}`;
};

// ---------------------------------------------------------------------------
// Parse and validate

const isObject = (value: unknown): value is { [key: string]: unknown } => (
    typeof value === 'object' && value !== null && !Array.isArray(value)
);
const hasOnlyKeys = (value: { [key: string]: unknown }, keys: string[]): boolean => (
    Object.keys(value).every(key => keys.indexOf(key) !== -1)
);
const isCount = (value: unknown, max: number = MAX_COUNTER): value is number => (
    typeof value === 'number' && Number.isSafeInteger(value) && 0 <= value && value <= max
);
const isInteger = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value);
const isFrame = (value: unknown): value is number => (
    typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= MAX_FRAME
);
const isNonNegative = (value: unknown, max: number = MAX_FRAME): value is number => (
    typeof value === 'number' && Number.isFinite(value) && 0 <= value && value <= max
);
const isRatio = (value: unknown): value is number => isNonNegative(value, 1);
const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean';
const isColumn = (value: unknown): value is number => isCount(value, BOARD_WIDTH - 1);

const parseOptions = (value: unknown): GarbageQueueInitializeParams | undefined => {
    if (!isObject(value) || !hasOnlyKeys(value, [
        'cap', 'messiness', 'garbage', 'multiplier', 'bombs', 'seed', 'boardWidth', 'rounding', 'openerPhase',
        'specialBonus',
    ])) return undefined;
    const { cap, messiness, garbage, multiplier } = value;
    if (!isObject(cap) || !hasOnlyKeys(cap, ['value', 'marginTime', 'increase', 'absolute', 'max'])
        || !isNonNegative(cap.value) || !isNonNegative(cap.marginTime) || !isNonNegative(cap.increase)
        || !isNonNegative(cap.absolute) || !isNonNegative(cap.max)) return undefined;
    if (!isObject(messiness) || !hasOnlyKeys(messiness, ['change', 'within', 'nosame', 'timeout', 'center'])
        || !isRatio(messiness.change) || !isRatio(messiness.within) || !isBoolean(messiness.nosame)
        || !isNonNegative(messiness.timeout) || !isBoolean(messiness.center)) return undefined;
    if (!isObject(garbage) || !hasOnlyKeys(garbage, ['speed', 'holeSize'])
        || !isNonNegative(garbage.speed) || !isCount(garbage.holeSize, BOARD_WIDTH)
        || garbage.holeSize < 1) return undefined;
    if (!isObject(multiplier) || !hasOnlyKeys(multiplier, ['value', 'increase', 'marginTime'])
        || !isNonNegative(multiplier.value) || !isNonNegative(multiplier.increase)
        || !isNonNegative(multiplier.marginTime)) return undefined;
    if (!isBoolean(value.bombs) || (value.seed !== undefined && !isInteger(value.seed))
        || value.boardWidth !== BOARD_WIDTH || (value.rounding !== 'down' && value.rounding !== 'rng')
        || !isCount(value.openerPhase) || !isBoolean(value.specialBonus)) return undefined;
    return {
        cap: {
            value: cap.value, marginTime: cap.marginTime, increase: cap.increase, absolute: cap.absolute,
            max: cap.max,
        },
        messiness: {
            change: messiness.change, within: messiness.within, nosame: messiness.nosame,
            timeout: messiness.timeout, center: messiness.center,
        },
        garbage: { speed: garbage.speed, holeSize: garbage.holeSize },
        multiplier: { value: multiplier.value, increase: multiplier.increase, marginTime: multiplier.marginTime },
        bombs: value.bombs,
        seed: value.seed === undefined ? 0 : value.seed,
        boardWidth: BOARD_WIDTH,
        rounding: value.rounding,
        openerPhase: value.openerPhase,
        specialBonus: value.specialBonus,
    };
};

const parseRules = (value: unknown, options: GarbageQueueInitializeParams): InputReplayRules | undefined => {
    if (!isObject(value) || !hasOnlyKeys(value, RULE_KEYS as string[])) return undefined;
    const v = value;
    if (typeof v.spinBonuses !== 'string' || !RULE_NAME_REGEX.test(v.spinBonuses)
        || COMBO_TABLES.indexOf(v.comboTable as InputReplayComboTable) === -1
        || typeof v.garbageTargetBonus !== 'string' || !RULE_NAME_REGEX.test(v.garbageTargetBonus)
        || !isBoolean(v.b2bChaining) || !isBoolean(v.b2bCharging)
        || !isNonNegative(v.b2bChargeAt) || !isNonNegative(v.b2bChargeBase)
        || !isNonNegative(v.allClearGarbage) || !isNonNegative(v.allClearB2b)
        || !isBoolean(v.specialBonus) || !isNonNegative(v.multiplier) || !isNonNegative(v.multiplierIncrease)
        || !isNonNegative(v.multiplierMargin) || !isNonNegative(v.garbageCap) || !isNonNegative(v.garbageCapIncrease)
        || !isNonNegative(v.garbageCapMargin) || !isNonNegative(v.garbageCapMax) || !isNonNegative(v.garbageSpeed)
        || (v.roundMode !== 'down' && v.roundMode !== 'rng') || !isCount(v.openerPhase)) return undefined;
    const rules: InputReplayRules = {
        spinBonuses: v.spinBonuses,
        comboTable: v.comboTable as InputReplayComboTable,
        garbageTargetBonus: v.garbageTargetBonus,
        b2bChaining: v.b2bChaining,
        b2bCharging: v.b2bCharging,
        b2bChargeAt: v.b2bChargeAt,
        b2bChargeBase: v.b2bChargeBase,
        allClearGarbage: v.allClearGarbage,
        allClearB2b: v.allClearB2b,
        specialBonus: v.specialBonus,
        multiplier: v.multiplier,
        multiplierIncrease: v.multiplierIncrease,
        multiplierMargin: v.multiplierMargin,
        garbageCap: v.garbageCap,
        garbageCapIncrease: v.garbageCapIncrease,
        garbageCapMargin: v.garbageCapMargin,
        garbageCapMax: v.garbageCapMax,
        garbageSpeed: v.garbageSpeed,
        roundMode: v.roundMode,
        openerPhase: v.openerPhase,
    };
    // The rules are derived from the queue options; a mismatch means the payload was not written by us.
    const consistent = rules.specialBonus === options.specialBonus
        && rules.multiplier === options.multiplier.value
        && rules.multiplierIncrease === options.multiplier.increase
        && rules.multiplierMargin === options.multiplier.marginTime
        && rules.garbageCap === options.cap.value
        && rules.garbageCapIncrease === options.cap.increase
        && rules.garbageCapMargin === options.cap.marginTime
        && rules.garbageCapMax === options.cap.max
        && rules.garbageSpeed === options.garbage.speed
        && rules.roundMode === options.rounding
        && rules.openerPhase === options.openerPhase;
    return consistent ? rules : undefined;
};

const parsePayload = (
    value: unknown, previous: InputReplayContext | undefined,
): InputSnapshot | undefined => {
    if (!isObject(value) || !hasOnlyKeys(value, ['v', 'rs', 'o', 's', 'g'])) return undefined;
    if (value.v !== CURRENT_VERSION) return undefined;
    const rotationSystem = value.rs as InputSnapshotRotationSystem;
    if (ROTATION_SYSTEMS.indexOf(rotationSystem) === -1) return undefined;
    if (value.o !== undefined && value.o !== 1) return undefined;
    const s = value.s;
    if (!Array.isArray(s) || s.length !== 5 || !s.every(item => isCount(item))) return undefined;
    const stats: InputStats = {
        b2bChain: s[0], renChain: s[1], pieces: s[2], lines: s[3], perfectClears: s[4],
    };

    const g = value.g;
    if (!isObject(g) || !hasOnlyKeys(g, ['f', 'p', 'q', 'r', 'n', 'c', 'l'])) return undefined;
    if (!isNonNegative(g.f) || !isCount(g.p)) return undefined;

    let base: InputReplayContext;
    if (g.r === 'league') {
        base = leagueContext(stats, 1);
    } else if (g.r === '^') {
        if (previous === undefined) return undefined;
        base = cloneInputReplayContext(previous);
    } else {
        if (!isObject(g.r) || !hasOnlyKeys(g.r, ['o', 'u'])) return undefined;
        const options = parseOptions(g.r.o);
        const rules = options === undefined ? undefined : parseRules(g.r.u, options);
        if (options === undefined || rules === undefined) return undefined;
        base = leagueContext(stats, 1);
        base.garbage.options = options;
        base.garbage.rules = rules;
    }
    const holeSize = base.garbage.options.garbage.holeSize;

    const n = g.n;
    if (!Array.isArray(n) || n.length !== 6 || !isInteger(n[0]) || !isInteger(n[1])
        || !(n[2] === null || isColumn(n[2])) || !isCount(n[3]) || !isBoolean(n[4]) || !isCount(n[5])) {
        return undefined;
    }

    const q = g.q;
    if (!Array.isArray(q) || MAX_QUEUE_ITEMS < q.length) return undefined;
    const cids = new Set<number>();
    let rows = 0;
    const queue: IncomingGarbage[] = [];
    for (const item of q) {
        if (!Array.isArray(item) || item.length !== 4) return undefined;
        const [frame, amount, cid, size] = item;
        if (!isFrame(frame) || !isCount(amount, MAX_AMOUNT) || amount < 1 || !isCount(cid)
            || cids.has(cid) || size !== holeSize) return undefined;
        cids.add(cid);
        rows += amount;
        queue.push({ frame, amount, cid, size, gameid: 0, confirmed: true });
    }
    if (MAX_QUEUE_ROWS < rows) return undefined;

    let columns: { [cid: number]: number } | undefined;
    if (g.c !== undefined) {
        if (!isObject(g.c)) return undefined;
        columns = {};
        for (const key of Object.keys(g.c)) {
            const cid = Number(key);
            const column = g.c[key];
            if (!/^(0|[1-9][0-9]*)$/.test(key) || !cids.has(cid) || !isColumn(column)) return undefined;
            columns[cid] = column;
        }
        if (Object.keys(columns).length === 0) columns = undefined;
    }

    let last: InputReplayLastGarbage | undefined;
    if (g.l !== undefined) {
        const l = g.l;
        if (!Array.isArray(l) || l.length !== 4 || !l.every(item => isCount(item))) return undefined;
        last = { attack: l[0], cancelled: l[1], sent: l[2], risen: l[3] };
    }

    const context: InputReplayContext = {
        stats,
        garbage: {
            snapshot: {
                queue,
                seed: n[0], lastTankTime: n[1], lastColumn: n[2], sent: n[3], hasChangedColumn: n[4],
                lastReceivedCount: n[5],
            },
            frame: g.f,
            pieces: g.p,
            options: base.garbage.options,
            rules: base.garbage.rules,
            ...(last === undefined ? {} : { last }),
            ...(columns === undefined ? {} : { columns }),
        },
    };
    return { rotationSystem, context: cloneInputReplayContext(context), openInput: value.o === 1 };
};

/** Parses one `isnap=` token. `previous` resolves a "^" rules reference. */
export const parseInputSnapshotToken = (
    token: string, previous?: InputReplayContext,
): InputSnapshotParseResult => {
    if (MAX_TOKEN_LENGTH < token.length) return { status: 'invalid' };
    const match = TOKEN_REGEX.exec(token);
    if (match === null) return { status: 'invalid' };
    if (Number(match[1]) !== CURRENT_VERSION) return { status: 'unsupported' };
    if (MAX_JSON_LENGTH * 4 / 3 + 4 < match[2].length) return { status: 'invalid' };
    let value: unknown;
    try {
        const json = fromBase64Url(match[2]);
        if (MAX_JSON_LENGTH < json.length) return { status: 'invalid' };
        value = JSON.parse(json);
    } catch {
        return { status: 'invalid' };
    }
    if (isObject(value) && isInteger(value.v) && value.v !== CURRENT_VERSION) return { status: 'unsupported' };
    const snapshot = parsePayload(value, previous);
    return snapshot === undefined ? { status: 'invalid' } : { snapshot, status: 'ok' };
};

// ---------------------------------------------------------------------------
// Comment helpers

const splitTokens = (text: string): string[][] => text.split(METADATA_SEPARATOR).map(segment => segment.split(' '));

/** The `isnap=` tokens of a comment, in order. */
export const findInputSnapshotTokens = (text: string): string[] => {
    const tokens: string[] = [];
    for (const segment of splitTokens(text)) {
        for (const token of segment) {
            if (isInputSnapshotToken(token)) tokens.push(token);
        }
    }
    return tokens;
};

/** Add or replace only our token in the metadata section, as withSevenBagGrayProgress does. */
export const withInputSnapshot = (text: string, token: string | undefined): string => {
    const segments = splitTokens(text)
        .map(segment => segment.filter(item => !isInputSnapshotToken(item)).join(' '))
        .filter(segment => segment !== '');
    if (token === undefined) return segments.join(METADATA_SEPARATOR);
    return [token].concat(segments).join(METADATA_SEPARATOR);
};

export const isCommentWithinFumenLimit = (text: string): boolean => (
    escape(text).length <= FUMEN_COMMENT_MAX_ESCAPED_LENGTH
);

// ---------------------------------------------------------------------------
// Pages

export interface EmbedInputSnapshotsResult {
    pages: Page[];
    /** Page indices whose context could not be stored because the comment would exceed the fumen limit. */
    skipped: number[];
}

/**
 * Writes each page's own INPUT context into its comment for local storage.
 * A page that only inherited its comment gets the resolved text, so pages that
 * later inherit from it (including quiz progress) read the same comment after decoding.
 * Run it before embedding #TREE=, which would make the first page's quiz unreadable while resolving;
 * `tree` only reserves room for it on the first page (the tree takes priority over the token).
 */
export const embedInputSnapshotsInPages = (
    pages: Page[],
    { rotationSystem, tree }: { rotationSystem: InputSnapshotRotationSystem, tree?: SerializedTree | null },
): EmbedInputSnapshotsResult => {
    if (!pages.some(page => page.internal?.inputReplayContext !== undefined)) {
        return { pages, skipped: [] };
    }
    const skipped: number[] = [];
    let previous: InputReplayContext | undefined;
    const result = pages.map((page, index) => {
        const context = page.internal?.inputReplayContext;
        if (context === undefined) return page;
        const base = page.comment.text ?? resolvePageCommentText(pages, index);
        const token = serializeInputSnapshot(context, { rotationSystem, previous });
        const text = withInputSnapshot(base, token);
        const stored = index === 0 && tree ? appendTreeToComment(text, tree) : text;
        // A token the loader would reject is as lost as one cut off by the encoder.
        if (!isCommentWithinFumenLimit(stored) || parseInputSnapshotToken(token, previous).status !== 'ok') {
            skipped.push(index);
            // "^" refers only to a token that was actually written.
            previous = undefined;
            return page;
        }
        previous = context;
        return { ...page, comment: { text } };
    });
    return { skipped, pages: result };
};

export interface ExtractInputSnapshotsResult {
    pages: Page[];
    snapshots: (InputSnapshot | undefined)[];
    unsupported: boolean;
}

/**
 * Restores INPUT contexts from `isnap=` tokens and removes the tokens from the comments.
 * Only pages with their own comment are read; pages that inherit a comment inherit the cleaned text.
 */
export const extractInputSnapshotsFromPages = (pages: Page[]): ExtractInputSnapshotsResult => {
    const snapshots: (InputSnapshot | undefined)[] = pages.map(() => undefined);
    if (!pages.some(page => page.comment.text !== undefined && page.comment.text.indexOf(TOKEN_PREFIX) !== -1)) {
        return { pages, snapshots, unsupported: false };
    }
    let unsupported = false;
    let changed = false;
    let previous: InputReplayContext | undefined;
    const cleaned = pages.map((page, index) => {
        const text = page.comment.text;
        if (text === undefined) return page;
        const tokens = findInputSnapshotTokens(text);
        if (tokens.length === 0) return page;
        changed = true;
        let snapshot: InputSnapshot | undefined;
        if (tokens.length === 1) {
            const parsed = parseInputSnapshotToken(tokens[0], previous);
            if (parsed.status === 'ok') snapshot = parsed.snapshot;
            if (parsed.status === 'unsupported') unsupported = true;
        }
        previous = snapshot?.context;
        snapshots[index] = snapshot;
        return {
            ...page,
            comment: { text: withInputSnapshot(text, undefined) },
            ...(snapshot === undefined ? {} : {
                internal: { ...page.internal, inputReplayContext: snapshot.context },
            }),
        };
    });
    // Removing the token can turn "isnap=... | #Q=..." into a quiz comment.
    return { snapshots, unsupported, pages: changed ? recomputeQuizFlags(cleaned) : pages };
};

// ---------------------------------------------------------------------------
// Share URL page

const CHAIN_TOKEN_REGEX = /^(b2b=(true|false|\d+)|combo=-?\d+)$/;

// Replaces b2b=/combo= outside the queue segment with the current values; other metadata stays.
const withChainTokens = (text: string, b2bChain: number, renChain: number): string => {
    const segments = text.split(METADATA_SEPARATOR)
        .map(segment => segment.startsWith('#Q=') ? segment
            : segment.split(' ').filter(token => !CHAIN_TOKEN_REGEX.test(token)).join(' '))
        .filter(segment => segment !== '');
    const combo = toCommentCombo(renChain);
    const tokens = [
        ...(b2bChain > 0 ? [`b2b=${b2bChain}`] : []),
        ...(combo > 0 ? [`combo=${combo}`] : []),
    ];
    return (tokens.length === 0 ? segments : [tokens.join(' ')].concat(segments)).join(METADATA_SEPARATOR);
};

/** The context this page's INPUT state is shared with: the page's own, or league rules with no garbage. */
export interface InputShareOptions {
    rotationSystem: InputSnapshotRotationSystem;
    tree?: SerializedTree;
    /** Hole RNG seed for a page without its own context. */
    seed: number;
}

export const resolveInputShareContext = (
    pages: Page[], index: number, { rotationSystem, tree, seed }: InputShareOptions,
): InputReplayContext | undefined => {
    const page = pages[index];
    if (page === undefined) return undefined;
    const stats = { ...computeInputStats(pages, index, { rotationSystem, tree }), lastAction: undefined };
    const own = page.internal?.inputReplayContext;
    // Ancestors' contexts are not used: the gauge, hard drop and AI all read only the current page's own context.
    if (own === undefined) return createDefaultInputReplayContext(stats, seed);
    const context = cloneInputReplayContext(own);
    context.stats = stats;
    return context;
};

export type InputSharePageResult =
    | { status: 'ok', page: Page, context: InputReplayContext }
    | { status: 'tooLong' }
    | { status: 'invalid' };

/** One standalone page carrying this moment of INPUT, for the dedicated share URL. */
export const buildInputSharePage = (
    pages: Page[], index: number, options: InputShareOptions,
): InputSharePageResult => {
    const page = pages[index];
    const context = resolveInputShareContext(pages, index, options);
    if (page === undefined || context === undefined) return { status: 'invalid' };
    const token = serializeInputSnapshot(context, { rotationSystem: options.rotationSystem, openInput: true });
    // The receiver must accept exactly what is sent.
    if (parseInputSnapshotToken(token).status !== 'ok') return { status: 'invalid' };

    // INPUT rotation evidence means nothing at spawn, and 7bag gray progress is not shared.
    let text = withSevenBagGrayDisplay(withSevenBagGrayProgress(withInputRotationEvidence(
        withInputSnapshot(resolvePageCommentText(pages, index), undefined), undefined,
    ), undefined), undefined);
    if (parseQueueStateComment(text) !== null) {
        text = withChainTokens(text, context.stats.b2bChain, context.stats.renChain);
    }
    text = withInputSnapshot(text, token);
    if (!isCommentWithinFumenLimit(text)) return { status: 'tooLong' };

    const field = new Pages(pages).getField(index, PageFieldOperation.Command);
    const piece = page.piece !== undefined && isMinoPiece(page.piece.type)
        ? createSpawnMove(page.piece.type, options.rotationSystem !== 'classic')
        : undefined;
    return {
        context,
        status: 'ok',
        page: {
            piece,
            index: 0,
            field: { obj: field.copy() },
            comment: { text },
            flags: { ...page.flags, colorize: pages[0]?.flags.colorize ?? true },
        },
    };
};

// ---------------------------------------------------------------------------
// INPUT State sheet

export interface InputStateDescription {
    segments: InputGarbageSegment[];
    total: number;
    last?: InputReplayLastGarbage;
    stats: InputStats;
    rules: 'league' | 'replay';
}

// Product names, the same in every language.
export const rotationSystemLabel = (rotationSystem: InputSnapshotRotationSystem): string => {
    switch (rotationSystem) {
    case 'classic': return 'Classic';
    case 'srs': return 'SRS';
    case 'srsPlus': return 'SRS+';
    }
};

export const describeInputState = (context: InputReplayContext): InputStateDescription => {
    const segments = inputGarbageSegments(context);
    return {
        segments,
        total: segments.reduce((sum, segment) => sum + segment.amount, 0),
        last: context.garbage.last,
        stats: context.stats,
        rules: isLeagueInputRules(context) ? 'league' : 'replay',
    };
};
