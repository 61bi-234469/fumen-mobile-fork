import { TtrmPlayerReplay } from './types';

// Measured defaults (FR-07): fallback values verified against the real
// samples in P0. Lowest priority in the merge below.
export const DEFAULT_TTRM_OPTIONS: { [key: string]: any } = {
    boardwidth: 10,
    boardheight: 20,
    kickset: 'SRS+',
    bagtype: '7-bag',
    combotable: 'multiplier',
    garbageblocking: 'combo blocking',
    clutch: true,
    garbagetargetbonus: 'none',
    spinbonuses: 'all-mini+',
    stock: 0,
    garbageabsolutecap: 0,
    garbagecapincrease: 0,
    garbagecapmax: 40,
    garbagecap: 8,
    garbagecapmargin: 0,
    garbagespeed: 20,
    garbageholesize: 1,
    messiness_change: 1,
    messiness_nosame: false,
    messiness_timeout: 0,
    messiness_inner: 0,
    messiness_center: false,
    garbagemultiplier: 1,
    garbageincrease: 0.008,
    garbagemargin: 10800,
    usebombs: false,
    garbagespecialbonus: false,
    openerphase: 0,
    roundmode: 'down',
    g: 0.02,
    gincrease: 0,
    gmargin: 0,
    b2bchaining: false,
    b2bcharging: false,
    b2bcharge_base: 3,
    allclear_b2b: 0,
    allclear_garbage: 0,
    allowharddrop: true,
    allow180: true,
    display_hold: true,
    infinite_hold: false,
    stride: false,
    lockresets: 15,
    gravitymay20g: true,
    passthrough: 'zero',
};

export interface ResolvedTtrmOptions {
    options: { [key: string]: any };
    warnings: string[];
}

// FR-07: key-wise merge, lowest priority first:
//   DEFAULT_TTRM_OPTIONS < end.data.options < replay.options
// A key present in both sources with different values is recorded as a warning.
export const resolveTtrmOptions = (playerReplay: TtrmPlayerReplay): ResolvedTtrmOptions => {
    const endEvent = playerReplay.events.find(e => e.type === 'end');
    const endOptions: { [key: string]: any } =
        endEvent && endEvent.data && endEvent.data.options ? endEvent.data.options : {};
    const replayOptions = playerReplay.options;

    const warnings: string[] = [];
    for (const key of Object.keys(replayOptions)) {
        if (key in endOptions
            && JSON.stringify(endOptions[key]) !== JSON.stringify(replayOptions[key])) {
            warnings.push(
                `option "${key}" differs: end=${JSON.stringify(endOptions[key])}`
                + ` replay=${JSON.stringify(replayOptions[key])}`,
            );
        }
    }

    return {
        warnings,
        options: { ...DEFAULT_TTRM_OPTIONS, ...endOptions, ...replayOptions },
    };
};
