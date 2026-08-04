import { div, span } from '@hyperapp/html';
import { InputStats, displayB2b, displayRen, formatActionLabel } from '../../lib/input_stats';
import { px, style } from '../../lib/types';
import { i18n } from '../../locales/keys';
import { InputStatsPanelTier } from './responsive_layout';

const value = (key: string, label: string, current: number | undefined) => div({
    key, datatest: key, 'data-value': current === undefined || current === 0 ? '' : String(current),
    style: style({
        display: 'flex', fontSize: px(11), fontWeight: '700', justifyContent: 'space-between', padding: '2px 5px',
    }),
}, [
    span({ key: `${key}-label` }, label),
    span({ key: `${key}-value` }, current === undefined || current === 0 ? '—' : String(current)),
]);

export const inputStatsPanel = (stats: InputStats, tier: Exclude<InputStatsPanelTier, 'hidden'>) => {
    const action = stats.lastAction;
    return div({
        key: 'input-stats', datatest: 'input-stats',
        style: style({ background: '#fafafa', border: '1px solid #333', boxShadow: '0 2px 5px rgba(0, 0, 0, .16)',
            boxSizing: 'border-box', color: '#333', marginTop: px(6), width: '100%' }),
    }, [
        div({ key: 'input-stats-action', datatest: 'input-stats-action',
            'data-lines': String(action?.clearedLines ?? 0), 'data-spin': action?.spin ?? 'none',
            style: style({ background: '#e8f1fb', borderBottom: '1px solid #333', color: '#0d47a1', fontSize: px(11),
                fontWeight: '800', padding: '4px 2px', textAlign: 'center' }) }, formatActionLabel(action)),
        value('input-stats-b2b', 'B2B', displayB2b(stats.b2bChain)),
        value('input-stats-ren', 'REN', displayRen(stats.renChain)),
        ...(tier === 'full' ? [
            value('input-stats-total-pieces', i18n.InputStats.Pieces(), stats.pieces),
            value('input-stats-total-lines', i18n.InputStats.Lines(), stats.lines),
            value('input-stats-total-pc', i18n.InputStats.PerfectClears(), stats.perfectClears),
        ] : []),
    ]);
};
