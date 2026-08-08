import { EngineInitializeParams } from '@haelp/teto/engine';

// Resolved .ttrm options -> engine config. Ported unchanged from the verified
// P0 harness (docs/notes/poc-ttrm/ttrm_replay_poc.js). Note that 4.2.7
// requires options.stock / misc.stride / misc.allowed.undo / misc.allowed.retry,
// which minomuncher's engineConfig lacks (see plan §3-6 trap #4).
export const buildEngineConfig = (
    o: { [key: string]: any },
    opponents: number[],
): EngineInitializeParams => {
    return {
        board: { width: o.boardwidth ?? 10, height: o.boardheight ?? 20, buffer: 20 },
        kickTable: o.kickset ?? 'SRS+',
        options: {
            comboTable: o.combotable ?? 'multiplier',
            garbageBlocking: o.garbageblocking ?? 'combo blocking',
            clutch: o.clutch ?? true,
            garbageTargetBonus: o.garbagetargetbonus ?? 'none',
            spinBonuses: o.spinbonuses ?? 'all-mini+',
            stock: o.stock ?? 0,
        },
        queue: { minLength: 10, seed: o.seed, type: o.bagtype ?? '7-bag' },
        garbage: {
            cap: {
                absolute: o.garbageabsolutecap ?? 0,
                increase: o.garbagecapincrease ?? 0,
                max: o.garbagecapmax ?? 40,
                value: o.garbagecap ?? 8,
                marginTime: o.garbagecapmargin ?? 0,
            },
            boardWidth: o.boardwidth ?? 10,
            garbage: { speed: o.garbagespeed ?? 20, holeSize: o.garbageholesize ?? 1 },
            messiness: {
                change: o.messiness_change ?? 1,
                nosame: o.messiness_nosame ?? false,
                timeout: o.messiness_timeout ?? 0,
                within: o.messiness_inner ?? 0,
                center: o.messiness_center ?? false,
            },
            multiplier: {
                value: o.garbagemultiplier ?? 1,
                increase: o.garbageincrease ?? 0.008,
                marginTime: o.garbagemargin ?? 10800,
            },
            bombs: o.usebombs ?? false,
            specialBonus: o.garbagespecialbonus ?? false,
            openerPhase: o.openerphase ?? 0,
            seed: o.seed,
            rounding: o.roundmode ?? 'down',
        },
        gravity: { value: o.g ?? 0.02, increase: o.gincrease ?? 0, marginTime: o.gmargin ?? 0 },
        handling: {
            arr: o.handling?.arr ?? 0,
            das: o.handling?.das ?? 6,
            dcd: o.handling?.dcd ?? 0,
            sdf: o.handling?.sdf ?? 41,
            safelock: o.handling?.safelock ?? false,
            cancel: o.handling?.cancel ?? false,
            may20g: o.handling?.may20g ?? true,
            irs: o.handling?.irs ?? 'tap',
            ihs: o.handling?.ihs ?? 'tap',
        },
        b2b: {
            chaining: !!o.b2bchaining,
            charging: o.b2bcharging ? { at: 4, base: o.b2bcharge_base ?? 3 } : false,
        },
        pc: { b2b: o.allclear_b2b ?? 0, garbage: o.allclear_garbage ?? 0 },
        misc: {
            allowed: {
                hardDrop: o.allowharddrop ?? true,
                spin180: o.allow180 ?? true,
                hold: o.display_hold ?? true,
                undo: false,
                retry: false,
            },
            infiniteHold: o.infinite_hold ?? false,
            stride: o.stride ?? false,
            movement: {
                infinite: false,
                lockResets: o.lockresets ?? 15,
                lockTime: 30,
                may20G: o.gravitymay20 ?? o.gravitymay20g ?? true,
            },
            username: o.username,
        },
        multiplayer: { opponents, passthrough: o.passthrough ?? 'zero' },
    } as EngineInitializeParams;
};
