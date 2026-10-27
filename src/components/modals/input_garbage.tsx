import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { i18n } from '../../locales/keys';
import { InputGarbageSegment } from '../../lib/input_replay';
import { INPUT_GARBAGE_MAX_AMOUNT, INPUT_GARBAGE_MAX_SEGMENTS } from '../../actions/input_garbage';

interface InputGarbagePaneProps {
    segments: InputGarbageSegment[];
    actions: {
        updateInputGarbageDraft: (data: { segments: InputGarbageSegment[] }) => void;
    };
}

const DEFAULT_SEGMENT: InputGarbageSegment = { amount: 4, column: null };

const stepButton = (
    kind: 'decrease' | 'increase' | 'remove', index: number, label: string, icon: string, disabled: boolean,
    onclick: () => void,
) => (
    <button
        key={`btn-input-garbage-${kind}-${index}`}
        datatest={`btn-input-garbage-${kind}-${index}`}
        type="button"
        className="btn-flat waves-effect"
        title={label}
        aria-label={label}
        disabled={disabled}
        onclick={onclick}
        style={style({
            height: px(32), lineHeight: px(32), minWidth: px(32), padding: '0',
        })}
    >
        <i className="material-icons notranslate" style={style({ fontSize: px(20), lineHeight: px(32) })}>{icon}</i>
    </button>
);

// The draft reaches the page when the window leaves this tab or closes (see closeInputWindow).
export const InputGarbagePane: Component<InputGarbagePaneProps> = ({ segments, actions }) => {
    const update = (index: number, patch: Partial<InputGarbageSegment>) => {
        actions.updateInputGarbageDraft({
            segments: segments.map((segment, current) => current === index ? { ...segment, ...patch } : segment),
        });
    };

    const total = segments.reduce((sum, segment) => sum + segment.amount, 0);

    const rows = segments.map((segment, index) => (
        <div
            key={`input-garbage-segment-${index}`}
            datatest={`input-garbage-segment-${index}`}
            data-amount={String(segment.amount)}
            data-column={segment.column === null ? 'random' : String(segment.column)}
            style={style({
                alignItems: 'center', borderBottom: '1px solid #e0e0e0', columnGap: px(8), display: 'flex',
                flexWrap: 'wrap', padding: '6px 0', rowGap: px(4),
            })}
        >
            <span key="label" style={style({ fontWeight: '700', minWidth: px(56) })}>
                {i18n.InputGarbage.Segment(index + 1)}
            </span>
            <span key="amount" style={style({ alignItems: 'center', display: 'flex' })}>
                {stepButton('decrease', index, i18n.InputGarbage.Decrease(), 'remove',
                    segment.amount <= 1, () => update(index, { amount: segment.amount - 1 }))}
                <span
                    key="value"
                    datatest={`input-garbage-amount-${index}`}
                    aria-label={i18n.InputGarbage.Amount()}
                    style={style({ fontSize: px(16), fontWeight: '700', minWidth: px(28), textAlign: 'center' })}
                >
                    {String(segment.amount)}
                </span>
                {stepButton('increase', index, i18n.InputGarbage.Increase(), 'add',
                    INPUT_GARBAGE_MAX_AMOUNT <= segment.amount, () => update(index, { amount: segment.amount + 1 }))}
            </span>
            <label key="column" style={style({ alignItems: 'center', color: '#333', display: 'flex', gap: px(4) })}>
                <span key="column-label">{i18n.InputGarbage.Column()}</span>
                <select
                    key="column-select"
                    datatest={`input-garbage-column-${index}`}
                    className="browser-default"
                    onchange={(event: Event) => {
                        const value = (event.target as HTMLSelectElement).value;
                        update(index, { column: value === 'random' ? null : Number(value) });
                    }}
                    style={style({ height: px(32), padding: '0 4px', width: 'auto' })}
                >
                    <option key="random" value="random" selected={segment.column === null}>
                        {i18n.InputGarbage.Random()}
                    </option>
                    {...Array.from({ length: 10 }).map((_, column) => (
                        <option key={`column-${column}`} value={String(column)} selected={segment.column === column}>
                            {String(column + 1)}
                        </option>
                    ))}
                </select>
            </label>
            {stepButton('remove', index, i18n.InputGarbage.Remove(), 'delete', false,
                () => actions.updateInputGarbageDraft({
                    segments: segments.filter((_, current) => current !== index),
                }))}
        </div>
    ));

    return (
        <div key="panel-input-window-garbage" datatest="panel-input-window-garbage">
            <p key="description" style={style({ color: '#616161', fontSize: px(13) })}>
                {i18n.InputGarbage.Description()}
            </p>
            <div key="segments" datatest="input-garbage-segments">
                {segments.length === 0
                    ? <p key="empty" datatest="input-garbage-empty" style={style({ color: '#9e9e9e' })}>
                        {i18n.InputGarbage.Empty()}
                    </p>
                    // Stack bottom-up like the in-game gauge: segment 1 sits at the bottom.
                    : rows.slice().reverse()}
            </div>
            <div
                key="summary"
                style={style({
                    alignItems: 'center', columnGap: px(8), display: 'flex', flexWrap: 'wrap', marginTop: px(8),
                })}
            >
                <button
                    key="btn-add"
                    datatest="btn-input-garbage-add"
                    type="button"
                    className="btn-flat waves-effect"
                    disabled={INPUT_GARBAGE_MAX_SEGMENTS <= segments.length}
                    onclick={() => actions.updateInputGarbageDraft({
                        segments: [...segments, DEFAULT_SEGMENT],
                    })}
                    style={style({ padding: '0 8px' })}
                >
                    <i key="icon" className="material-icons left notranslate">add</i>
                    {i18n.InputGarbage.Add()}
                </button>
                <button
                    key="btn-clear"
                    datatest="btn-input-garbage-clear"
                    type="button"
                    className="btn-flat waves-effect"
                    disabled={segments.length === 0}
                    onclick={() => actions.updateInputGarbageDraft({ segments: [] })}
                    style={style({ padding: '0 8px' })}
                >
                    {i18n.InputGarbage.ClearAll()}
                </button>
                <span key="total" datatest="input-garbage-total" data-total={String(total)}
                      style={style({ color: '#e53935', fontWeight: '700', marginLeft: 'auto' })}>
                    {i18n.InputGarbage.Total(total)}
                </span>
            </div>
        </div>
    );
};
