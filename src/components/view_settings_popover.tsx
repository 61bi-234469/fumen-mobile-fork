import { Component, px, style } from '../lib/types';
import { h } from 'hyperapp';
import { div } from '@hyperapp/html';
import { i18n } from '../locales/keys';
import { snapZoomPercent } from '../lib/zoom';

interface Props {
    // fixed: full-screen tree/list view (viewport-relative) / absolute: side panel (panel-relative)
    positioning: { type: 'fixed' | 'absolute'; right: number; bottom: number };
    isTreeView: boolean;
    trimTopBlank: boolean;
    grayAfterLineClear: boolean;
    zoom: {
        percent: number;
        min: number;
        max: number;
    };
    actions: {
        onTrimTopBlankToggle: () => void;
        onGrayAfterLineClearToggle: () => void;
        onZoomChange: (percent: number) => void;
        onZoomReset: () => void;
    };
}

const treeButtonToggleLabelStyle = style({
    fontSize: px(12),
    fontWeight: 600,
    color: '#334155',
    whiteSpace: 'nowrap',
    letterSpacing: '0.01em',
});

const treeButtonToggleSwitchStyle = (isOn: boolean) => style({
    position: 'relative',
    width: px(42),
    height: px(24),
    backgroundColor: isOn ? '#2563EB' : '#CBD5E1',
    borderRadius: px(12),
    transition: 'background-color 0.25s ease',
    flex: 'none',
    boxShadow: 'inset 0 1px 2px rgba(15,23,42,0.12)',
});

const treeButtonToggleKnobStyle = (isOn: boolean) => style({
    position: 'absolute',
    top: px(2),
    left: isOn ? px(20) : px(2),
    width: px(20),
    height: px(20),
    backgroundColor: '#fff',
    borderRadius: '50%',
    transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    boxShadow: '0 1px 3px rgba(15,23,42,0.35)',
});

const settingsRowStyle = style({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: px(16),
    padding: '10px 16px',
    cursor: 'pointer',
});

const settingsDividerStyle = style({
    height: px(1),
    margin: '0 12px',
    backgroundColor: 'rgba(148,163,184,0.25)',
    flex: 'none',
});

const zoomResetButtonStyle = style({
    minWidth: px(52),
    height: px(28),
    border: 'none',
    borderRadius: px(14),
    backgroundColor: 'transparent',
    color: '#2563EB',
    fontSize: px(13),
    fontWeight: 600,
    cursor: 'pointer',
    padding: '0 6px',
    fontVariantNumeric: 'tabular-nums',
});

const renderSettingsRow = (
    key: string,
    label: string,
    isOn: boolean,
    onClick: () => void,
) => div({
    key,
    style: settingsRowStyle,
    onclick: onClick,
}, [
    h('span', { style: treeButtonToggleLabelStyle }, label),
    h('div', {
        style: treeButtonToggleSwitchStyle(isOn),
    }, [
        h('div', { style: treeButtonToggleKnobStyle(isOn) }),
    ]),
]);

export const ViewSettingsPopover: Component<Props> = (
    { positioning, isTreeView, trimTopBlank, grayAfterLineClear, zoom, actions },
) => {
    const rootStyle = style({
        position: positioning.type,
        right: px(positioning.right),
        bottom: px(positioning.bottom),
        minWidth: px(230),
        borderRadius: px(16),
        padding: '6px 0',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 120,
    });

    const toggleRows = isTreeView ? [
        renderSettingsRow(
            'settings-trim-top',
            i18n.ListView.TrimTopBlank(),
            trimTopBlank,
            () => actions.onTrimTopBlankToggle(),
        ),
        div({ key: 'settings-divider-1', style: settingsDividerStyle }),
        renderSettingsRow(
            'settings-gray-clear',
            i18n.TreeView.GrayAfterLineClear(),
            grayAfterLineClear,
            () => actions.onGrayAfterLineClearToggle(),
        ),
    ] : [
        renderSettingsRow(
            'settings-trim-top',
            i18n.ListView.TrimTopBlank(),
            trimTopBlank,
            () => actions.onTrimTopBlankToggle(),
        ),
    ];

    return div({
        key: 'view-settings-popover',
        className: 'corner-glass',
        style: rootStyle,
    }, [
        ...toggleRows,
        div({ key: 'settings-divider-zoom', style: settingsDividerStyle }),
        div({
            key: 'settings-zoom-row',
            style: style({ padding: '10px 16px' }),
        }, [
            div({
                key: 'settings-zoom-label-row',
                style: style({
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: px(6),
                }),
            }, [
                h('span', { style: treeButtonToggleLabelStyle }, i18n.ListView.Zoom()),
                h('button', {
                    key: 'btn-view-zoom-reset',
                    datatest: 'btn-view-zoom-reset',
                    title: i18n.TreeView.ZoomReset(),
                    style: zoomResetButtonStyle,
                    onclick: () => actions.onZoomReset(),
                }, `${zoom.percent}%`),
            ]),
            h('input', {
                key: 'range-view-zoom',
                datatest: 'range-view-zoom',
                type: 'range',
                min: String(zoom.min),
                max: String(zoom.max),
                step: '5',
                value: String(zoom.percent),
                className: 'browser-default',
                style: style({ width: '100%' }),
                oninput: (e: Event) => {
                    const raw = Number((e.target as HTMLInputElement).value);
                    actions.onZoomChange(snapZoomPercent(raw));
                },
            }),
        ]),
    ]);
};
