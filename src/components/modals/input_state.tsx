import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { i18n } from '../../locales/keys';
import { InputStateDescription } from '../../lib/input_snapshot';
import { InputRulesPreset, capB2bChain } from '../../lib/input_stats';
import { shownB2b, shownCombo } from '../../views/editor/input_stats_panel';
import { INPUT_CHAIN_MAX } from '../../actions/input_window';

interface InputStatePaneProps {
    description: InputStateDescription;
    preset: InputRulesPreset;
    actions: {
        setInputChainCounters: (data: { b2bChain?: number; renChain?: number }) => void;
    };
}

// The number edited is the chain itself; the large value is how the HOLD panel shows it.
const row = (
    key: string, label: string, shown: string, chain: number, max: number,
    onchange: (chain: number) => void,
) => (
    <div
        key={key}
        datatest={key}
        data-value={String(chain)}
        style={style({
            alignItems: 'center', borderBottom: '1px solid #e0e0e0', columnGap: px(12), display: 'flex',
            flexWrap: 'wrap', justifyContent: 'space-between', padding: '8px 0',
        })}
    >
        <span key="label" style={style({ fontWeight: '700' })}>{label}</span>
        <span key="value" style={style({ marginLeft: 'auto', textAlign: 'right' })}>
            <span key="main" datatest={`${key}-value`} style={style({ fontSize: px(16), fontWeight: '700' })}>
                {shown}
            </span>
            <label key="chain" style={style({
                alignItems: 'center', color: '#757575', display: 'flex', fontSize: px(12), gap: px(4),
                justifyContent: 'flex-end',
            })}>
                <span key="chain-label">{i18n.InputState.ChainLabel()}</span>
                <input
                    key={`${key}-input`}
                    datatest={`${key}-input`}
                    type="number"
                    inputmode="numeric"
                    min={0}
                    max={max}
                    step={1}
                    disabled={max === 0}
                    value={String(chain)}
                    onchange={(event: Event) => {
                        const input = event.target as HTMLInputElement;
                        const value = Number.parseInt(input.value, 10);
                        // Shown again as the current count; a rejected or capped entry then reads correctly.
                        input.value = String(chain);
                        onchange(Number.isFinite(value) ? value : 0);
                    }}
                    style={style({ height: px(28), margin: '0', textAlign: 'center', width: px(72) })}
                />
            </label>
        </span>
    </div>
);

export const InputStatePane: Component<InputStatePaneProps> = ({ description, preset, actions }) => {
    const { stats } = description;
    const b2bChain = capB2bChain(stats.b2bChain, preset);
    // SRS keeps B2B as a flag and classic has none.
    const b2bMax = preset === 'tetrioS2' ? INPUT_CHAIN_MAX : preset === 'ppt' ? 1 : 0;

    return (
        <div key="panel-input-window-state" datatest="panel-input-window-state">
            {row('input-state-b2b', 'B2B', shownB2b(b2bChain, preset), b2bChain, b2bMax,
                chain => actions.setInputChainCounters({ b2bChain: chain }))}
            {row('input-state-combo', 'COMBO', shownCombo(stats.renChain), stats.renChain, INPUT_CHAIN_MAX,
                chain => actions.setInputChainCounters({ renChain: chain }))}
        </div>
    );
};
