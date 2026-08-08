import { TtrmFile, TtrmPlayerRound } from './types';

// FR-06: real samples are ~1MB; leave generous headroom.
export const MAX_TTRM_TEXT_LENGTH = 8 * 1024 * 1024;

export class TtrmError extends Error {
    constructor(readonly stage: string, message: string) {
        super(message);
        this.name = 'TtrmError';
        // ES5 target: restore the prototype chain so instanceof works.
        Object.setPrototypeOf(this, TtrmError.prototype);
    }
}

const isObject = (value: any): value is { [key: string]: any } => {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
};

// FR-03: some exports wrap the whole file as { replay: <ttrm> }. Peel until
// we reach the level whose `replay.rounds` is the actual rounds array.
const unwrapReplay = (root: any): any => {
    let current = root;
    for (let depth = 0; depth < 8; depth += 1) {
        if (isObject(current) && isObject(current.replay) && Array.isArray(current.replay.rounds)) {
            return current;
        }
        if (isObject(current) && isObject(current.replay)) {
            current = current.replay;
            continue;
        }
        break;
    }
    throw new TtrmError('structure', 'replay.rounds not found in file');
};

// 有限な非負整数か。frame/frames はここが崩れると simulator の tick ループが
// 終了条件を満たせず、Worker が解析中表示のまま無限ループする（P1 レビュー指摘）。
const isFiniteNonNegativeInt = (value: any): value is number =>
    typeof value === 'number' && Number.isInteger(value) && value >= 0;

const validateEvents = (events: any[], round: number, playerId: string): void => {
    events.forEach((event, index) => {
        if (!isObject(event) || typeof event.type !== 'string' || !isFiniteNonNegativeInt(event.frame)) {
            throw new TtrmError(
                'structure',
                `round ${round}: player ${playerId} has an invalid event at index ${index}`,
            );
        }
    });
};

const validatePlayer = (player: any, round: number, slot: number): TtrmPlayerRound => {
    if (!isObject(player) || typeof player.id !== 'string') {
        throw new TtrmError('structure', `round ${round}: player ${slot} has no id`);
    }
    const replay = player.replay;
    if (!isObject(replay) || !Array.isArray(replay.events)
        || typeof replay.frames !== 'number' || !isObject(replay.options)) {
        throw new TtrmError('structure', `round ${round}: player ${player.id} is missing replay data`);
    }
    if (!isFiniteNonNegativeInt(replay.frames)) {
        throw new TtrmError('structure', `round ${round}: player ${player.id} has an invalid frames value`);
    }
    validateEvents(replay.events, round, player.id);
    if (!isObject(replay.results) || !isObject(replay.results.stats)) {
        throw new TtrmError('structure', `round ${round}: player ${player.id} is missing results.stats`);
    }
    return player as TtrmPlayerRound;
};

export const parseTtrm = (text: string): TtrmFile => {
    if (text.length > MAX_TTRM_TEXT_LENGTH) {
        throw new TtrmError(
            'size',
            `file is too large (${Math.ceil(text.length / (1024 * 1024))}MB > 8MB)`,
        );
    }

    let root: any;
    try {
        root = JSON.parse(text);
    } catch (e) {
        throw new TtrmError('json', `not a valid JSON file: ${e instanceof Error ? e.message : String(e)}`);
    }

    const file = unwrapReplay(root);

    // FR-04: only the known multiplayer format is accepted; anything else is
    // rejected explicitly instead of being simulated on a guess.
    if (file.version !== 1) {
        throw new TtrmError('version', `unsupported replay version: ${String(file.version)}`);
    }

    const rounds = file.replay.rounds;
    if (rounds.length === 0) {
        throw new TtrmError('structure', 'replay has no rounds');
    }
    rounds.forEach((round: any, roundIndex: number) => {
        if (!Array.isArray(round) || round.length === 0) {
            throw new TtrmError('structure', `round ${roundIndex} has no players`);
        }
        round.forEach((player: any, slot: number) => validatePlayer(player, roundIndex, slot));
    });

    return file as TtrmFile;
};
