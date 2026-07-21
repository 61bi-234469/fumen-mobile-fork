import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { EditShortcuts, PaletteShortcuts, PieceShortcuts, resources, RotationSystem, UserSettingsTab } from '../../states';
import { i18n } from '../../locales/keys';
import { div } from '@hyperapp/html';
import { gradientPieces } from '../../actions/user_settings';
import { GradientPattern, parsePieceName } from '../../lib/enums';
import { displayShortcut, isModifierKey, normalizeShortcutFromEvent } from '../../lib/shortcuts';
import { SDF_MAX, SDF_MIN } from '../../lib/piece_das';

declare const M: any;

interface UserSettingsModalProps {
    ghostVisible: boolean;
    deleteSpawnMinoOnPaintDrag: boolean;
    skipReaderMode: boolean;
    loop: boolean;
    shortcutLabelVisible: boolean;
    gradient: string;
    paletteShortcuts: PaletteShortcuts;
    editShortcuts: EditShortcuts;
    pieceShortcuts: PieceShortcuts;
    pieceShortcutDasFrames: number;
    pieceShortcutArrFrames: number;
    pieceShortcutDasCutFrames: number;
    pieceShortcutSdf: number;
    gifFrameDelayMs: number;
    rotationSystem: RotationSystem;
    noGrayAfterHardDrop: boolean;
    grayAfterLineClear: boolean;
    trimTopBlank: boolean;
    editorSidePanel: boolean;
    currentTab: UserSettingsTab;
    actions: {
        closeUserSettingsModal: () => void;
        commitUserSettings: () => void;
        copyUserSettingsToTemporary: () => void;
        keepGhostVisible: (data: { visible: boolean }) => void;
        keepDeleteSpawnMinoOnPaintDrag: (data: { enable: boolean }) => void;
        keepSkipReaderMode: (data: { enable: boolean }) => void;
        keepLoop: (data: { enable: boolean }) => void;
        keepShortcutLabelVisible: (data: { visible: boolean }) => void;
        keepGradient: (data: { gradient: string }) => void;
        keepPaletteShortcut: (data: { palette: keyof PaletteShortcuts, code: string }) => void;
        keepEditShortcut: (data: { shortcut: keyof EditShortcuts, code: string }) => void;
        keepPieceShortcut: (data: { shortcut: keyof PieceShortcuts, code: string }) => void;
        keepPieceShortcutDas: (data: { dasFrames: number }) => void;
        keepPieceShortcutArr: (data: { arrFrames: number }) => void;
        keepPieceShortcutDasCut: (data: { dasCutFrames: number }) => void;
        keepPieceShortcutSdf: (data: { sdf: number }) => void;
        keepGifFrameDelay: (data: { delayMs: number }) => void;
        keepRotationSystem: (data: { rotationSystem: RotationSystem }) => void;
        keepNoGrayAfterHardDrop: (data: { enable: boolean }) => void;
        keepGrayAfterLineClear: (data: { enable: boolean }) => void;
        keepTrimTopBlank: (data: { enable: boolean }) => void;
        keepEditorSidePanel: (data: { enable: boolean }) => void;
        setUserSettingsTab: (data: { tab: UserSettingsTab }) => void;
    };
}

const paletteKeys: (keyof PaletteShortcuts)[] = ['I', 'L', 'O', 'Z', 'T', 'J', 'S', 'Empty', 'Gray', 'Comp'];
const editShortcutKeys: (keyof EditShortcuts)[] = [
    'InsertPage', 'PrevPage', 'NextPage', 'Menu', 'ListView', 'TreeView', 'EditHome',
    'Undo', 'Redo', 'Add', 'Insert', 'Copy', 'Cut',
];

const editShortcutLabels: Record<keyof EditShortcuts, () => string> = {
    InsertPage: i18n.UserSettings.EditShortcuts.InsertPage,
    PrevPage: i18n.UserSettings.EditShortcuts.PrevPage,
    NextPage: i18n.UserSettings.EditShortcuts.NextPage,
    Menu: i18n.UserSettings.EditShortcuts.Menu,
    ListView: i18n.UserSettings.EditShortcuts.ListView,
    TreeView: i18n.UserSettings.EditShortcuts.TreeView,
    EditHome: i18n.UserSettings.EditShortcuts.EditHome,
    Undo: i18n.UserSettings.EditShortcuts.Undo,
    Redo: i18n.UserSettings.EditShortcuts.Redo,
    Add: i18n.UserSettings.EditShortcuts.Add,
    Insert: i18n.UserSettings.EditShortcuts.Insert,
    Copy: i18n.UserSettings.EditShortcuts.Copy,
    Cut: i18n.UserSettings.EditShortcuts.Cut,
};

const pieceShortcutKeys: (keyof PieceShortcuts)[] = [
    'MoveLeft', 'MoveRight', 'SoftDrop', 'HardDrop', 'RotateLeft', 'RotateRight', 'Rotate180', 'Hold', 'Reset',
];

const pieceShortcutLabels: Record<keyof PieceShortcuts, () => string> = {
    MoveLeft: i18n.UserSettings.PieceShortcuts.MoveLeft,
    MoveRight: i18n.UserSettings.PieceShortcuts.MoveRight,
    SoftDrop: i18n.UserSettings.PieceShortcuts.SoftDrop,
    HardDrop: i18n.UserSettings.PieceShortcuts.HardDrop,
    RotateLeft: i18n.UserSettings.PieceShortcuts.RotateLeft,
    RotateRight: i18n.UserSettings.PieceShortcuts.RotateRight,
    Rotate180: i18n.UserSettings.PieceShortcuts.Rotate180,
    Reset: i18n.UserSettings.PieceShortcuts.Reset,
    Hold: i18n.UserSettings.PieceShortcuts.Hold,
};

const rotationSystemValues: RotationSystem[] = ['classic', 'srs', 'srsPlus'];

const rotationSystemLabels: Record<RotationSystem, () => string> = {
    classic: i18n.UserSettings.RotationSystem.Classic,
    srs: i18n.UserSettings.RotationSystem.Srs,
    srsPlus: i18n.UserSettings.RotationSystem.SrsPlus,
};

const tabKeys: UserSettingsTab[] = ['field', 'view', 'shortcuts', 'piece', 'misc'];

const tabLabels: Record<UserSettingsTab, () => string> = {
    field: i18n.UserSettings.Tabs.Field,
    view: i18n.UserSettings.Tabs.View,
    shortcuts: i18n.UserSettings.Tabs.Shortcuts,
    piece: i18n.UserSettings.Tabs.Piece,
    misc: i18n.UserSettings.Tabs.Misc,
};

export const UserSettingsModal: Component<UserSettingsModalProps> = (
    {
        ghostVisible,
        deleteSpawnMinoOnPaintDrag,
        skipReaderMode,
        loop,
        shortcutLabelVisible,
        gradient,
        paletteShortcuts,
        editShortcuts,
        pieceShortcuts,
        pieceShortcutDasFrames,
        pieceShortcutArrFrames,
        pieceShortcutDasCutFrames,
        pieceShortcutSdf,
        gifFrameDelayMs,
        rotationSystem,
        noGrayAfterHardDrop,
        grayAfterLineClear,
        trimTopBlank,
        editorSidePanel,
        currentTab,
        actions,
    },
) => {
    let isClosing = false;

    const oncreate = (element: HTMLDivElement) => {
        isClosing = false;
        const instance = M.Modal.init(element, {
            onCloseStart: () => {
                if (!isClosing) {
                    isClosing = true;
                    actions.closeUserSettingsModal();
                }
            },
        });

        actions.copyUserSettingsToTemporary();
        instance.open();

        resources.modals.userSettings = instance;
    };

    const ondestroy = () => {
        const modal = resources.modals.userSettings;
        resources.modals.userSettings = undefined;
        if (modal !== undefined) {
            isClosing = true;
            modal.close();
        }
    };

    const save = () => {
        isClosing = true;
        actions.commitUserSettings();
        actions.closeUserSettingsModal();
    };

    const cancel = () => {
        isClosing = true;
        actions.closeUserSettingsModal();
    };

    // switch要素の共通レンダラ(temporaryの値とcheckboxを同期する)
    const renderSwitch = ({ key, datatest, title, checked, offLabel, onLabel, onChange, disabled = false }: {
        key: string;
        datatest: string;
        title: string;
        checked: boolean;
        offLabel: string;
        onLabel: string;
        onChange: (checked: boolean) => void;
        disabled?: boolean;
    }) => {
        const onupdate = (e: HTMLInputElement) => {
            if (e.checked !== checked) {
                e.checked = checked;
            }
        };
        const onchange = (e: Event) => {
            if (!e || !e.target) {
                return;
            }
            const target = e.target as HTMLInputElement;
            onChange(target.checked);
        };
        return (
            <div key={key} class="switch">
                <h6>{title}</h6>

                <label>
                    {offLabel}
                    <input type="checkbox" dataTest={datatest} checked={checked} disabled={disabled}
                           onupdate={onupdate} onchange={onchange}/>
                    <span class="lever"/>
                    {onLabel}
                </label>
            </div>
        );
    };

    // ショートカット割当グリッドの共通レンダラ（パレット/編集/PIECEで共有）
    const renderShortcutGrid = <K extends string>({
        keys, getCode, renderLabel, labelMinWidth, onKeyDown, inputDatatest, notSetText,
    }: {
        keys: K[];
        getCode: (key: K) => string;
        renderLabel: (key: K) => string;
        labelMinWidth: number;
        onKeyDown: (key: K, e: KeyboardEvent) => void;
        inputDatatest?: (key: K) => string;
        notSetText: string;
    }) => (
        <div style={style({
            display: 'grid',
            gridTemplateColumns: 'auto 1fr',
            gap: px(8),
            alignItems: 'center',
        })}>
            {keys.map((key) => {
                const code = getCode(key);
                const display = code ? displayShortcut(code) : notSetText;
                return [
                    <div style={style({ fontWeight: 'bold', minWidth: px(labelMinWidth) })}>
                        {renderLabel(key)}
                    </div>,
                    <input
                        type="text"
                        datatest={inputDatatest ? inputDatatest(key) : undefined}
                        readonly
                        value={display}
                        onkeydown={(e: KeyboardEvent) => onKeyDown(key, e)}
                        style={style({
                            cursor: 'pointer',
                            textAlign: 'center',
                            color: code ? '#333' : '#999',
                            marginBottom: px(0),
                            height: px(32),
                        })}
                    />,
                ];
            })}
        </div>
    );

    // フレーム数値入力ブロックの共通レンダラ（ARR/DAS/DCD/GIF遅延で共有）
    const renderNumberField = ({
        labelDatatest, title, description, inputDatatest, value, min, max, step, onchange, width,
        unitDatatest, unit, outerMarginBottom,
    }: {
        labelDatatest?: string;
        title: string;
        description: string;
        inputDatatest?: string;
        value: number;
        min: number;
        max: number;
        step: number;
        onchange: (e: Event) => void;
        width: number;
        unitDatatest?: string;
        unit: string;
        outerMarginBottom?: number;
    }) => {
        const outerStyle = outerMarginBottom !== undefined
            ? style({ marginTop: px(15), marginBottom: px(outerMarginBottom) })
            : style({ marginTop: px(15) });
        return (
            <div style={outerStyle}>
                <div datatest={labelDatatest} style={style({ fontWeight: 'bold' })}>
                    {title}
                </div>
                <div style={style({ color: '#666', fontSize: px(12), marginBottom: px(5) })}>
                    {description}
                </div>
                <div style={style({ display: 'flex', alignItems: 'center', gap: px(4) })}>
                    <input
                        type="number"
                        datatest={inputDatatest}
                        value={value}
                        min={min}
                        max={max}
                        step={step}
                        onchange={onchange}
                        style={style({
                            width: px(width),
                            textAlign: 'center',
                        })}
                    />
                    <span datatest={unitDatatest}>{unit}</span>
                </div>
            </div>
        );
    };

    const onchangeGradient = (index: number, value: string) => {
        const replaced = gradient.substring(0, index) + value + gradient.substring(index + 1, gradient.length);
        actions.keepGradient({ gradient: replaced });
    };

    const onchangeRotationSystem = (value: RotationSystem) => {
        actions.keepRotationSystem({ rotationSystem: value });
    };

    const onkeydownShortcut = (palette: keyof PaletteShortcuts, e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // 修飾キーは無視
        if (isModifierKey(e.code)) {
            return;
        }

        // 修飾キー押下中は無視
        if (e.ctrlKey || e.altKey || e.metaKey) {
            return;
        }

        // Backspace/Delete でクリア
        if (e.code === 'Backspace' || e.code === 'Delete') {
            actions.keepPaletteShortcut({ palette, code: '' });
            return;
        }

        actions.keepPaletteShortcut({ palette, code: e.code });
    };

    const onkeydownEditShortcut = (shortcut: keyof EditShortcuts, e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // 修飾キー単体は無視
        if (isModifierKey(e.code)) {
            return;
        }

        // Backspace/Delete でクリア（修飾キーなしの場合のみ）
        if ((e.code === 'Backspace' || e.code === 'Delete') && !e.ctrlKey && !e.metaKey && !e.altKey) {
            actions.keepEditShortcut({ shortcut, code: '' });
            return;
        }

        // Mod+... 形式で保存（Ctrl/Cmd を共通の Mod として正規化）
        const normalizedCode = normalizeShortcutFromEvent(e);
        actions.keepEditShortcut({ shortcut, code: normalizedCode });
    };

    const onkeydownPieceShortcut = (shortcut: keyof PieceShortcuts, e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // 修飾キー単体は無視
        if (isModifierKey(e.code)) {
            return;
        }

        // 修飾キー押下中は無効（PIECEは修飾キーなしのみ）
        if (e.ctrlKey || e.altKey || e.metaKey || e.shiftKey) {
            return;
        }

        // Backspace/Delete でクリア
        if (e.code === 'Backspace' || e.code === 'Delete') {
            actions.keepPieceShortcut({ shortcut, code: '' });
            return;
        }

        actions.keepPieceShortcut({ shortcut, code: e.code });
    };

    const onchangeDas = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const value = parseFloat(target.value);
        if (!isNaN(value) && value >= 1 && value <= 60) {
            actions.keepPieceShortcutDas({ dasFrames: value });
        }
    };

    const onchangeArr = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const value = parseFloat(target.value);
        if (!isNaN(value) && value >= 0 && value <= 60) {
            actions.keepPieceShortcutArr({ arrFrames: value });
        }
    };

    const onchangeDasCut = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const value = parseFloat(target.value);
        if (!isNaN(value) && value >= 0 && value <= 60) {
            actions.keepPieceShortcutDasCut({ dasCutFrames: value });
        }
    };

    const onchangeSdf = (e: Event) => {
        const value = (e.target as HTMLSelectElement).value;
        actions.keepPieceShortcutSdf({ sdf: value === 'Infinity' ? Infinity : parseInt(value, 10) });
    };

    const onchangeGifFrameDelay = (e: Event) => {
        const target = e.target as HTMLInputElement;
        const value = parseInt(target.value, 10);
        if (!isNaN(value) && value >= 100 && value <= 10000) {
            actions.keepGifFrameDelay({ delayMs: value });
        }
    };

    const tabHeaderStyle = style({
        display: 'flex',
        flexDirection: 'row',
        marginTop: px(12),
        borderBottom: 'solid 1px #ddd',
        overflowX: 'auto',
    });

    const tabItemStyle = (active: boolean) => style({
        flexGrow: 1,
        padding: '8px 6px',
        textAlign: 'center',
        fontSize: px(13),
        whiteSpace: 'nowrap',
        color: active ? '#f44336' : '#666',
        fontWeight: active ? 'bold' : 'normal',
        borderBottom: active ? 'solid 2px #f44336' : 'solid 2px transparent',
        cursor: 'pointer',
    });

    const panelStyle = (tab: UserSettingsTab) => style({
        display: currentTab === tab ? 'block' : 'none',
    });

    const switchLabels = {
        off: i18n.UserSettings.Switch.Off(),
        on: i18n.UserSettings.Switch.On(),
    };

    return (
        <div key="user-settings-modal-top">
            <div key="mdl-user-settings" datatest="mdl-user-settings"
                 className="modal" oncreate={oncreate} ondestroy={ondestroy}>

                <div key="modal-content" className="modal-content">
                    <h4>{i18n.UserSettings.Title()}</h4>

                    <div style={style({ color: '#666' })}>
                        {i18n.UserSettings.Notice()}
                    </div>

                    <div key="user-settings-tabs" style={tabHeaderStyle}>
                        {tabKeys.map(tab => (
                            <a href="#" key={`tab-user-settings-${tab}`} datatest={`tab-user-settings-${tab}`}
                               style={tabItemStyle(currentTab === tab)}
                               onclick={(event: MouseEvent) => {
                                   actions.setUserSettingsTab({ tab });
                                   event.stopPropagation();
                                   event.preventDefault();
                               }}>
                                {tabLabels[tab]()}
                            </a>
                        ))}
                    </div>

                    <div style={style({ color: '#333', marginTop: px(15), minHeight: px(300) })}>
                        <div key="panel-user-settings-field" datatest="panel-user-settings-field"
                             style={panelStyle('field')}>
                            {renderSwitch({
                                key: 'switch-row-delete-spawn-mino-on-paint-drag',
                                datatest: 'switch-delete-spawn-mino-on-paint-drag',
                                title: i18n.UserSettings.DeleteSpawnMinoOnPaintDrag.Title(),
                                checked: deleteSpawnMinoOnPaintDrag,
                                offLabel: switchLabels.off,
                                onLabel: switchLabels.on,
                                onChange: checked => actions.keepDeleteSpawnMinoOnPaintDrag({ enable: checked }),
                            })}

                            {renderSwitch({
                                key: 'switch-row-gray-after-line-clear-field',
                                datatest: 'switch-gray-after-line-clear-field',
                                title: i18n.TreeView.GrayAfterLineClear(),
                                checked: grayAfterLineClear,
                                offLabel: switchLabels.off,
                                onLabel: switchLabels.on,
                                onChange: checked => actions.keepGrayAfterLineClear({ enable: checked }),
                            })}

                            {renderSwitch({
                                key: 'switch-row-no-gray-after-hard-drop',
                                datatest: 'switch-no-gray-after-hard-drop',
                                title: i18n.TreeView.NoGrayAfterHardDrop(),
                                checked: noGrayAfterHardDrop,
                                disabled: !grayAfterLineClear,
                                offLabel: switchLabels.off,
                                onLabel: switchLabels.on,
                                onChange: checked => actions.keepNoGrayAfterHardDrop({ enable: checked }),
                            })}

                            <details key="details-user-settings-gradient" datatest="details-user-settings-gradient">
                                <summary datatest="summary-user-settings-gradient"
                                         style={style({ cursor: 'pointer', marginTop: px(10) })}>
                                    {i18n.UserSettings.Gradient.Title()}
                                </summary>

                                <div datatest="gradient-piece-options" style={style({ marginTop: px(8) })}>
                                    {gradientPieces.map((piece, index) => {
                                        const name = `group${piece}`;
                                        const selected = gradient[index] || '0';
                                        const params = [
                                            { label: '■', value: `${GradientPattern.None}` },
                                            { label: '◢', value: `${GradientPattern.Triangle}` },
                                            { label: '/', value: `${GradientPattern.Line}` },
                                            { label: '●', value: `${GradientPattern.Circle}` },
                                        ];
                                        const labels = params.map(({ label, value }) => {
                                            return <label>
                                                <input name={name} type="radio" checked={value === selected}
                                                       onchange={() => onchangeGradient(index, value)}/>
                                                <span style={style({ marginRight: px(20) })}>{label}</span>
                                            </label>;
                                        });

                                        return div([
                                            <div>{parsePieceName(piece)}</div>,
                                            ...labels,
                                        ]);
                                    })}
                                </div>
                            </details>
                        </div>

                        <div key="panel-user-settings-view" datatest="panel-user-settings-view"
                             style={panelStyle('view')}>
                            {renderSwitch({
                                key: 'switch-row-trim-top-blank',
                                datatest: 'switch-trim-top-blank',
                                title: i18n.ListView.TrimTopBlank(),
                                checked: trimTopBlank,
                                offLabel: switchLabels.off,
                                onLabel: switchLabels.on,
                                onChange: checked => actions.keepTrimTopBlank({ enable: checked }),
                            })}

                            {renderSwitch({
                                key: 'switch-row-gray-after-line-clear-view',
                                datatest: 'switch-gray-after-line-clear-view',
                                title: i18n.TreeView.GrayAfterLineClear(),
                                checked: grayAfterLineClear,
                                offLabel: switchLabels.off,
                                onLabel: switchLabels.on,
                                onChange: checked => actions.keepGrayAfterLineClear({ enable: checked }),
                            })}

                            {renderSwitch({
                                key: 'switch-row-editor-side-panel',
                                datatest: 'switch-editor-side-panel',
                                title: i18n.UserSettings.EditorSidePanel(),
                                checked: editorSidePanel,
                                offLabel: switchLabels.off,
                                onLabel: switchLabels.on,
                                onChange: checked => actions.keepEditorSidePanel({ enable: checked }),
                            })}
                        </div>

                        <div key="panel-user-settings-shortcuts" datatest="panel-user-settings-shortcuts"
                             style={panelStyle('shortcuts')}>
                            {renderSwitch({
                                key: 'switch-row-shortcut-label',
                                datatest: 'switch-shortcut-label',
                                title: i18n.UserSettings.ShortcutLabel.Title(),
                                checked: shortcutLabelVisible,
                                offLabel: i18n.UserSettings.ShortcutLabel.Off(),
                                onLabel: i18n.UserSettings.ShortcutLabel.On(),
                                onChange: checked => actions.keepShortcutLabelVisible({ visible: checked }),
                            })}

                            <div>
                                <h6>{i18n.UserSettings.PaletteShortcuts.Title()}</h6>
                                <div style={style({ color: '#666', marginBottom: px(10), fontSize: px(12) })}>
                                    {i18n.UserSettings.PaletteShortcuts.Description()}
                                </div>

                                {renderShortcutGrid({
                                    keys: paletteKeys,
                                    getCode: palette => paletteShortcuts[palette],
                                    renderLabel: palette => palette,
                                    labelMinWidth: 50,
                                    onKeyDown: onkeydownShortcut,
                                    notSetText: i18n.UserSettings.PaletteShortcuts.NotSet(),
                                })}
                            </div>

                            <div>
                                <h6>{i18n.UserSettings.EditShortcuts.Title()}</h6>
                                <div style={style({ color: '#666', marginBottom: px(10), fontSize: px(12) })}>
                                    {i18n.UserSettings.EditShortcuts.Description()}
                                </div>

                                {renderShortcutGrid({
                                    keys: editShortcutKeys,
                                    getCode: shortcut => editShortcuts[shortcut],
                                    renderLabel: shortcut => editShortcutLabels[shortcut](),
                                    labelMinWidth: 80,
                                    onKeyDown: onkeydownEditShortcut,
                                    notSetText: i18n.UserSettings.EditShortcuts.NotSet(),
                                })}
                            </div>
                        </div>

                        <div key="panel-user-settings-piece" datatest="panel-user-settings-piece"
                             style={panelStyle('piece')}>
                            <div>
                                <h6>{i18n.UserSettings.PieceShortcuts.Title()}</h6>
                                <div style={style({ color: '#666', marginBottom: px(10), fontSize: px(12) })}>
                                    {i18n.UserSettings.PieceShortcuts.Description()}
                                </div>

                                {renderShortcutGrid({
                                    keys: pieceShortcutKeys,
                                    getCode: shortcut => pieceShortcuts[shortcut],
                                    renderLabel: shortcut => pieceShortcutLabels[shortcut](),
                                    labelMinWidth: 80,
                                    onKeyDown: onkeydownPieceShortcut,
                                    inputDatatest: shortcut => `input-piece-shortcut-${shortcut}`,
                                    notSetText: i18n.UserSettings.PieceShortcuts.NotSet(),
                                })}

                                {renderSwitch({
                                    key: 'switch-row-ghost-visible',
                                    datatest: 'switch-ghost-visible',
                                    title: i18n.UserSettings.Ghost.Title(),
                                    checked: ghostVisible,
                                    offLabel: i18n.UserSettings.Ghost.Off(),
                                    onLabel: i18n.UserSettings.Ghost.On(),
                                    onChange: checked => actions.keepGhostVisible({ visible: checked }),
                                })}

                                <div>
                                    <h6>{i18n.UserSettings.RotationSystem.Title()}</h6>

                                    {rotationSystemValues.map((value) => {
                                        return <label>
                                            <input name="rotation-system" type="radio"
                                                   checked={value === rotationSystem}
                                                   dataTest={`radio-rotation-system-${value}`}
                                                   onchange={() => onchangeRotationSystem(value)}/>
                                            <span style={style({ marginRight: px(20) })}>
                                                {rotationSystemLabels[value]()}
                                            </span>
                                        </label>;
                                    })}
                                </div>

                                {renderNumberField({
                                    labelDatatest: 'label-piece-arr',
                                    title: i18n.UserSettings.PieceShortcuts.ArrFrames(),
                                    description: i18n.UserSettings.PieceShortcuts.ArrDescription(),
                                    inputDatatest: 'input-piece-arr',
                                    value: pieceShortcutArrFrames,
                                    min: 0,
                                    max: 60,
                                    step: 0.1,
                                    onchange: onchangeArr,
                                    width: 80,
                                    unitDatatest: 'unit-piece-arr',
                                    unit: 'F',
                                })}

                                {renderNumberField({
                                    labelDatatest: 'label-piece-das',
                                    title: i18n.UserSettings.PieceShortcuts.DasFrames(),
                                    description: i18n.UserSettings.PieceShortcuts.DasDescription(),
                                    inputDatatest: 'input-piece-das',
                                    value: pieceShortcutDasFrames,
                                    min: 1,
                                    max: 60,
                                    step: 0.1,
                                    onchange: onchangeDas,
                                    width: 80,
                                    unitDatatest: 'unit-piece-das',
                                    unit: 'F',
                                })}

                                <div style={style({ marginTop: px(15) })}>
                                    <div datatest="label-piece-dcd" style={style({ fontWeight: 'bold' })}>
                                        {i18n.UserSettings.PieceShortcuts.DasCutFrames()}
                                    </div>
                                    <div style={style({ color: '#666', fontSize: px(12), marginBottom: px(5) })}>
                                        {i18n.UserSettings.PieceShortcuts.DasCutDescription()}
                                    </div>
                                    <div style={style({ display: 'flex', alignItems: 'center', gap: px(4) })}>
                                        <input
                                            type="number"
                                            datatest="input-piece-dcd"
                                            value={pieceShortcutDasCutFrames}
                                            min={0}
                                            max={60}
                                            step={0.1}
                                            onchange={onchangeDasCut}
                                            style={style({
                                                width: px(80),
                                                textAlign: 'center',
                                            })}
                                        />
                                        <span datatest="unit-piece-dcd">F</span>
                                    </div>
                                </div>

                                <div style={style({ marginTop: px(15) })}>
                                    <div datatest="label-piece-sdf" style={style({ fontWeight: 'bold' })}>
                                        {i18n.UserSettings.PieceShortcuts.Sdf()}
                                    </div>
                                    <div style={style({ color: '#666', fontSize: px(12), marginBottom: px(5) })}>
                                        {i18n.UserSettings.PieceShortcuts.SdfDescription()}
                                    </div>
                                    <select datatest="input-piece-sdf" className="browser-default"
                                            value={String(pieceShortcutSdf)}
                                            onchange={onchangeSdf}
                                            style={style({ width: px(80), height: px(32) })}>
                                        {Array.from({ length: SDF_MAX - SDF_MIN + 1 }, (_, i) => SDF_MIN + i)
                                            .map(value => <option value={String(value)}>{value}</option>)}
                                        <option value="Infinity">∞</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div key="panel-user-settings-misc" datatest="panel-user-settings-misc"
                             style={panelStyle('misc')}>
                            {renderSwitch({
                                key: 'switch-row-loop',
                                datatest: 'switch-loop',
                                title: i18n.UserSettings.Loop.Title(),
                                checked: loop,
                                offLabel: i18n.UserSettings.Loop.Off(),
                                onLabel: i18n.UserSettings.Loop.On(),
                                onChange: checked => actions.keepLoop({ enable: checked }),
                            })}

                            {renderSwitch({
                                key: 'switch-row-skip-reader-mode',
                                datatest: 'switch-skip-reader-mode',
                                title: i18n.UserSettings.SkipReaderMode.Title(),
                                checked: skipReaderMode,
                                offLabel: switchLabels.off,
                                onLabel: switchLabels.on,
                                onChange: checked => actions.keepSkipReaderMode({ enable: checked }),
                            })}

                            {renderNumberField({
                                title: i18n.UserSettings.GifFrameDelayMs.Title(),
                                description: i18n.UserSettings.GifFrameDelayMs.Description(),
                                value: gifFrameDelayMs,
                                min: 100,
                                max: 10000,
                                step: 100,
                                onchange: onchangeGifFrameDelay,
                                width: 100,
                                unit: 'ms',
                                outerMarginBottom: 15,
                            })}
                        </div>
                    </div>
                </div>

                <div key="modal-footer" className="modal-footer">
                    <a href="#" key="btn-cancel" datatest="btn-cancel" id="btn-cancel"
                       className="waves-effect waves-teal btn-flat" onclick={cancel}>
                        {i18n.UserSettings.Buttons.Cancel()}
                    </a>

                    <a href="#" key="btn-save" datatest="btn-save" id="btn-save"
                       className="waves-effect waves-light btn red" onclick={save}>
                        {i18n.UserSettings.Buttons.Save()}
                    </a>
                </div>
            </div>
        </div>
    );
};
