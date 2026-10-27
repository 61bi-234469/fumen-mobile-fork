import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { resources } from '../../states';
import { i18n } from '../../locales/keys';
import { InputStateDescription, InputSnapshotRotationSystem, rotationSystemLabel } from '../../lib/input_snapshot';
import { InputRulesPreset, capB2bChain } from '../../lib/input_stats';
import { shownB2b, shownCombo } from '../../views/editor/input_stats_panel';

declare const M: any;

interface InputStateModalProps {
    description: InputStateDescription;
    rotationSystem: InputSnapshotRotationSystem;
    preset: InputRulesPreset;
    actions: {
        closeInputStateModal: () => void;
        openInputGarbageModal: () => void;
        copyInputShareUrlToClipboard: (data?: { native?: boolean }) => void;
    };
}

const row = (key: string, label: string, value: string, dataValue: string, detail?: string) => (
    <div
        key={key}
        datatest={key}
        data-value={dataValue}
        style={style({
            borderBottom: '1px solid #e0e0e0', columnGap: px(12), display: 'flex', flexWrap: 'wrap',
            justifyContent: 'space-between', padding: '8px 0',
        })}
    >
        <span key="label" style={style({ fontWeight: '700' })}>{label}</span>
        <span key="value" style={style({ marginLeft: 'auto', textAlign: 'right' })}>
            <span key="main" datatest={`${key}-value`}>{value}</span>
            {detail === undefined ? undefined as any : (
                <span key="detail" style={style({ color: '#757575', display: 'block', fontSize: px(12) })}>
                    {detail}
                </span>
            )}
        </span>
    </div>
);

export const InputStateModal: Component<InputStateModalProps> = ({ description, rotationSystem, preset, actions }) => {
    const destroy = () => {
        resources.modals.inputState = undefined;
    };

    const close = () => {
        const modal = resources.modals.inputState;
        if (modal !== undefined) {
            modal.close();
        }
        destroy();
    };

    const oncreate = (element: HTMLDivElement) => {
        const instance = M.Modal.init(element, {
            onCloseStart: () => {
                actions.closeInputStateModal();
                destroy();
            },
        });

        instance.open();
        resources.modals.inputState = instance;
    };

    const share = (native: boolean) => {
        actions.copyInputShareUrlToClipboard({ native });
        actions.closeInputStateModal();
        close();
    };

    const editGarbage = () => {
        actions.closeInputStateModal();
        close();
        actions.openInputGarbageModal();
    };

    const { stats, segments, total, last } = description;
    const garbageValue = segments.length === 0 ? i18n.InputState.GarbageNone() : segments
        .map(segment => `${segment.amount} ${segment.column === null
            ? i18n.InputState.RandomHole() : i18n.InputState.HoleColumn(segment.column + 1)}`)
        .join(' · ');
    const garbageDetail = [
        ...(segments.length === 0 ? [] : [i18n.InputState.Total(total)]),
        ...(last === undefined ? [] : [
            `${i18n.InputStats.Attack()} ${last.attack} / ${i18n.InputStats.Cancelled()} ${last.cancelled}`
            + ` / ${i18n.InputStats.Sent()} ${last.sent}`,
        ]),
    ].join(' — ');
    const b2bChain = capB2bChain(stats.b2bChain, preset);
    const nativeShareAvailable = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

    return (
        <div key="input-state-modal-top">
            <div key="mdl-input-state" datatest="mdl-input-state" className="modal" oncreate={oncreate}>
                <div key="modal-content" className="modal-content">
                    <h4 key="title">{i18n.InputState.Title()}</h4>
                    <p key="description" style={style({ color: '#616161', fontSize: px(13) })}>
                        {i18n.InputState.Description()}
                    </p>
                    <div key="rows">
                        {row('input-state-garbage', i18n.InputState.Garbage(), garbageValue,
                            segments.map(segment => `${segment.amount}:${segment.column ?? 'r'}`).join(','),
                            garbageDetail === '' ? undefined : garbageDetail)}
                        {/* Kept out of the footer so the buttons fit one row on phones with native share. */}
                        <div key="edit-garbage" style={style({ textAlign: 'right' })}>
                            <a href="#" key="btn-edit-garbage" datatest="btn-input-state-edit-garbage"
                               className="waves-effect waves-teal btn-flat" onclick={editGarbage}
                               style={style({ padding: '0 8px', textTransform: 'none' })}>
                                {i18n.InputState.EditGarbage()}
                            </a>
                        </div>
                        {row('input-state-chain', 'B2B / COMBO',
                            `${shownB2b(b2bChain, preset)} / ${shownCombo(stats.renChain)}`,
                            `${b2bChain}:${stats.renChain}`,
                            `${i18n.InputState.Chain(b2bChain)} / ${i18n.InputState.Chain(stats.renChain)}`)}
                        {row('input-state-rules', i18n.InputState.Rules(),
                            `${description.rules === 'league' ? i18n.InputState.League() : i18n.InputState.Replay()}`
                            + ` · ${rotationSystemLabel(rotationSystem)}`,
                            description.rules)}
                    </div>
                </div>

                <div key="modal-footer" className="modal-footer">
                    <a href="#" key="btn-close" datatest="btn-input-state-close"
                       className="waves-effect waves-teal btn-flat" onclick={close}>
                        {i18n.InputState.Close()}
                    </a>
                    {nativeShareAvailable ? (
                        <a href="#" key="btn-share-native" datatest="btn-input-share-native"
                           className="waves-effect waves-teal btn-flat" onclick={() => share(true)}>
                            {i18n.InputState.NativeShare()}
                        </a>
                    ) : undefined as any}
                    <a href="#" key="btn-share" datatest="btn-input-share-url"
                       className="waves-effect waves-light btn" onclick={() => share(false)}>
                        {i18n.InputState.Share()}
                    </a>
                </div>
            </div>
        </div>
    );
};
