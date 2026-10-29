import { div, span } from '@hyperapp/html';
import {
    InputRulesPreset, InputStats, capB2bChain, displayB2b, displayRen, formatActionLabel,
} from '../../lib/input_stats';
import { px, style } from '../../lib/types';
import { CSSProperties } from 'typestyle/lib/types';
import { i18n } from '../../locales/keys';
import { InputStatsPanelTier } from './responsive_layout';
import { rotationSystemLabel } from '../../lib/input_snapshot';
import { RotationSystem } from '../../states';

export interface InputGarbagePanelState {
    last?: { attack: number; cancelled: number; sent: number; risen: number };
}

export interface InputChainPanelOptions {
    // Rules of the selected rotation system; only SRS+ counts a B2B chain (default).
    preset?: InputRulesPreset;
    // Named in the summary tier so a silent B2B under Classic/SRS is explained; the compact tier has no room.
    rotationSystem?: RotationSystem;
    // TETR.IO B2B charging threshold (Surge); undefined when the rules have no charging.
    surgeChargeAt?: number;
    // Opens the INPUT State sheet; the panel becomes a button when given.
    open?: () => void;
}

// Written straight onto the dark editor background, as s2-bot-lab does under HOLD.
const CHAIN_ACTIVE_COLOR = '#33d17a';
const CHAIN_IDLE_COLOR = '#9e9e9e';
const ACTION_COLOR = '#ffb000';

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
            display: 'flex', fontSize: px(11), fontVariantNumeric: 'tabular-nums', fontWeight: '700', gap: px(4),
            justifyContent: 'center', letterSpacing: '.04em', lineHeight: px(14), minWidth: '0',
            whiteSpace: 'nowrap',
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

// Which kick table scores the chains, as the settings call it (Classic / SRS / SRS+).
const rulesRow = (rotationSystem: RotationSystem, preset: InputRulesPreset) => div({
    key: 'input-stats-rules', datatest: 'input-stats-rules', 'data-preset': preset,
    style: style({
        color: CHAIN_IDLE_COLOR, fontSize: px(10), fontWeight: '700', letterSpacing: '.06em', lineHeight: px(14),
        textAlign: 'center', whiteSpace: 'nowrap',
    }),
}, rotationSystemLabel(rotationSystem).toUpperCase());

const panelStyle: CSSProperties = {
    boxSizing: 'border-box', marginTop: px(6), padding: '2px 0', width: '100%',
};

const panelAttributes = (open: (() => void) | undefined) => {
    if (open === undefined) return {};
    // PIECE operations run on pointerdown, so after a re-render the same finger's synthetic click can land
    // here. Accept only a pointer that started on the panel, or a keyboard click (as the queue slots do).
    let pointerStartedHere = false;
    return {
        role: 'button',
        tabindex: 0,
        title: i18n.InputState.Open(),
        'aria-label': i18n.InputState.Open(),
        onclick: (event: MouseEvent) => {
            if (event.detail === 0 || pointerStartedHere) open();
            pointerStartedHere = false;
            event.preventDefault();
            event.stopPropagation();
        },
        onpointerdown: (event: PointerEvent) => {
            pointerStartedHere = true;
            event.stopPropagation();
        },
        onpointercancel: () => {
            pointerStartedHere = false;
        },
        onkeydown: (event: KeyboardEvent) => {
            if (event.key === 'Enter' || event.key === ' ') {
                open();
                event.preventDefault();
                event.stopPropagation();
            }
        },
    };
};

// Too little room for the full panel: the chain counters alone still fit under HOLD.
export const inputChainPanel = (stats: InputStats, options: InputChainPanelOptions = {}) => div({
    key: 'input-stats', datatest: 'input-stats', ...panelAttributes(options.open),
    style: style({ ...panelStyle, cursor: options.open === undefined ? undefined : 'pointer' }),
}, chainRows(stats, options));

// The value wraps under its label in the narrow HOLD column instead of widening it.
const textValue = (key: string, label: string, current: string, dataValue: string) => div({
    key, datatest: key, 'data-value': dataValue,
    style: style({
        color: CHAIN_IDLE_COLOR, columnGap: px(4), display: 'flex', flexWrap: 'wrap', fontSize: px(10),
        fontWeight: '700', justifyContent: 'center', letterSpacing: '.04em', lineHeight: px(13), marginTop: px(2),
        minWidth: '0', textAlign: 'center',
    }),
}, [
    span({ key: `${key}-label` }, label),
    span({ key: `${key}-value` }, current),
]);

export const inputStatsPanel = (
    stats: InputStats,
    tier: Exclude<InputStatsPanelTier, 'hidden'>,
    garbage?: InputGarbagePanelState,
    options: InputChainPanelOptions = {},
) => {
    const action = stats.lastAction;
    const actionLabel = formatActionLabel(action);
    const lastGarbage = garbage?.last;
    return div({
        key: 'input-stats', datatest: 'input-stats', ...panelAttributes(options.open),
        style: style({ ...panelStyle, cursor: options.open === undefined ? undefined : 'pointer' }),
    }, [
        ...(options.rotationSystem === undefined
            ? [] : [rulesRow(options.rotationSystem, options.preset ?? 'tetrioS2')]),
        ...chainRows(stats, options),
        div({ key: 'input-stats-action', datatest: 'input-stats-action',
            'data-lines': String(action?.clearedLines ?? 0), 'data-spin': action?.spin ?? 'none',
            style: style({ color: actionLabel === '—' ? CHAIN_IDLE_COLOR : ACTION_COLOR, fontSize: px(11),
                fontWeight: '700', letterSpacing: '.04em', lineHeight: px(14), minHeight: px(14),
                textAlign: 'center' }) },
        actionLabel),
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
    ]);
};
