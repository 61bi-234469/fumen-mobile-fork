import { div, span } from '@hyperapp/html';
import {
    InputRulesPreset, InputStats, capB2bChain, displayB2b, displayRen, formatActionLabel,
} from '../../lib/input_stats';
import { px, style } from '../../lib/types';
import { i18n } from '../../locales/keys';
import { InputStatsPanelTier } from './responsive_layout';

export interface InputGarbagePanelState {
    last?: { attack: number; cancelled: number; sent: number; risen: number };
}

export interface InputChainPanelOptions {
    // Rules of the selected rotation system; only SRS+ counts a B2B chain (default).
    preset?: InputRulesPreset;
    // TETR.IO B2B charging threshold (Surge); undefined when the rules have no charging.
    surgeChargeAt?: number;
}

const CHAIN_ACTIVE_COLOR = '#2e7d32';
const CHAIN_IDLE_COLOR = '#9e9e9e';

// Same counting as s2-bot-lab: B2B shows the engine's counter (0 after the first
// B2B-eligible clear, — with no chain) and COMBO opens at 1 on the second clear in a row.
// SRS keeps B2B as a flag, shown as 1 while it is on; classic has no B2B.
export const shownB2b = (b2bChain: number, preset: InputRulesPreset = 'tetrioS2'): string => {
    const chain = capB2bChain(b2bChain, preset);
    if (chain <= 0) return '—';
    return preset === 'tetrioS2' ? String(chain - 1) : '1';
};
export const shownCombo = (renChain: number): string => renChain > 1 ? String(renChain - 1) : '—';

const chainRow = (key: string, label: string, shown: string, active: boolean, dataValue: number, surge = false) =>
    div({
        key, datatest: key, 'data-value': dataValue === 0 ? '' : String(dataValue),
        'data-active': active ? 'true' : 'false',
        ...(surge ? { 'data-surge': 'true', title: i18n.InputStats.SurgeCharged() } : {}),
        style: style({
            color: active ? CHAIN_ACTIVE_COLOR : CHAIN_IDLE_COLOR,
            display: 'flex', fontSize: px(11), fontVariantNumeric: 'tabular-nums', fontWeight: '800', gap: px(2),
            justifyContent: 'space-between', lineHeight: px(13), minWidth: '0', padding: '1px 5px',
        }),
    }, [
        span({ key: `${key}-label` }, label),
        span({ key: `${key}-value` }, surge ? `${shown}⚡` : shown),
    ]);

const chainRows = (stats: InputStats, options: InputChainPanelOptions) => {
    const preset = options.preset ?? 'tetrioS2';
    const b2bChain = capB2bChain(stats.b2bChain, preset);
    return [
        chainRow('input-stats-b2b', 'B2B', shownB2b(b2bChain, preset), b2bChain > 0, displayB2b(b2bChain),
            preset === 'tetrioS2' && options.surgeChargeAt !== undefined && b2bChain > options.surgeChargeAt),
        chainRow('input-stats-combo', 'COMBO', shownCombo(stats.renChain), stats.renChain > 1,
            displayRen(stats.renChain)),
    ];
};

const panelStyle = style({
    background: '#fafafa', border: '1px solid #333', boxShadow: '0 2px 5px rgba(0, 0, 0, .16)',
    boxSizing: 'border-box', color: '#333', marginTop: px(6), width: '100%',
});

// Too little room for the full panel: the chain counters alone still fit under HOLD.
export const inputChainPanel = (stats: InputStats, options: InputChainPanelOptions = {}) => div({
    key: 'input-stats', datatest: 'input-stats', style: style({ ...panelStyle, padding: '1px 0' }),
}, chainRows(stats, options));

const value = (key: string, label: string, current: number | undefined) => div({
    key, datatest: key, 'data-value': current === undefined || current === 0 ? '' : String(current),
    style: style({
        display: 'flex', fontSize: px(11), fontWeight: '700', justifyContent: 'space-between',
        lineHeight: px(13), padding: '1px 5px',
    }),
}, [
    span({ key: `${key}-label` }, label),
    span({ key: `${key}-value` }, current === undefined || current === 0 ? '—' : String(current)),
]);

// The value wraps under its label in the narrow HOLD column instead of widening it.
const textValue = (key: string, label: string, current: string, dataValue: string) => div({
    key, datatest: key, 'data-value': dataValue,
    style: style({
        columnGap: px(2), display: 'flex', flexWrap: 'wrap', fontSize: px(10), fontWeight: '700',
        justifyContent: 'space-between', lineHeight: px(13), minWidth: '0', padding: '1px 5px',
    }),
}, [
    span({ key: `${key}-label` }, label),
    span({ key: `${key}-value`, style: style({ marginLeft: 'auto', textAlign: 'right' }) }, current),
]);

export const inputStatsPanel = (
    stats: InputStats,
    tier: Exclude<InputStatsPanelTier, 'hidden'>,
    garbage?: InputGarbagePanelState,
    options: InputChainPanelOptions = {},
) => {
    const action = stats.lastAction;
    const lastGarbage = garbage?.last;
    return div({
        key: 'input-stats', datatest: 'input-stats', style: panelStyle,
    }, [
        div({ key: 'input-stats-action', datatest: 'input-stats-action',
            'data-lines': String(action?.clearedLines ?? 0), 'data-spin': action?.spin ?? 'none',
            style: style({ background: '#e8f1fb', borderBottom: '1px solid #333', color: '#0d47a1', fontSize: px(11),
                fontWeight: '800', lineHeight: px(13), padding: '4px 2px', textAlign: 'center' }) },
        formatActionLabel(action)),
        ...chainRows(stats, options),
        ...(garbage !== undefined && tier !== 'compact' ? [
            textValue(
                'input-garbage-damage', i18n.InputStats.Attack(),
                lastGarbage === undefined
                    ? '—'
                    : `${lastGarbage.attack} / ${i18n.InputStats.Cancelled()} ${lastGarbage.cancelled}`
                        + ` / ${i18n.InputStats.Sent()} ${lastGarbage.sent}`,
                lastGarbage === undefined ? ''
                    : `${lastGarbage.attack}:${lastGarbage.cancelled}:${lastGarbage.sent}:${lastGarbage.risen}`,
            ),
        ] : []),
        ...(tier === 'full' ? [
            value('input-stats-total-pieces', i18n.InputStats.Pieces(), stats.pieces),
            value('input-stats-total-lines', i18n.InputStats.Lines(), stats.lines),
            value('input-stats-total-pc', i18n.InputStats.PerfectClears(), stats.perfectClears),
        ] : []),
    ]);
};
