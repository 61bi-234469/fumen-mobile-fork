import { h } from 'hyperapp';
import { Component, px, style } from '../../lib/types';
import { i18n } from '../../locales/keys';
import { TreeOperationScope } from '../../lib/fumen/tree_types';

interface Props {
    scope: TreeOperationScope;
    opened: boolean;
    compact?: boolean;
    floatingBottom?: number;
    onToggle: () => void;
    onClose: () => void;
    onSelect: (scope: TreeOperationScope) => void;
}

const scopeOptions: { scope: TreeOperationScope; label: () => string }[] = [
    { scope: 'node', label: i18n.TreeView.OperationScope.Node },
    { scope: 'subtree', label: i18n.TreeView.OperationScope.Subtree },
    { scope: 'descendants', label: i18n.TreeView.OperationScope.Descendants },
];

const labelFor = (scope: TreeOperationScope): string => {
    return scopeOptions.find(option => option.scope === scope)?.label() ?? i18n.TreeView.OperationScope.Node();
};
export const TreeOperationScopeSelector: Component<Props> = ({
    scope,
    opened,
    compact = false,
    floatingBottom,
    onToggle,
    onClose,
    onSelect,
}) => {
    const rootStyle = style({
        position: floatingBottom === undefined ? 'relative' : 'fixed',
        ...(floatingBottom === undefined ? {} : {
            bottom: px(floatingBottom),
            left: px(8),
        }),
        zIndex: 125,
    });
    const chipStyle = style({
        minWidth: px(compact ? 112 : 188),
        height: px(compact ? 30 : 36),
        border: 'none',
        borderRadius: px(compact ? 15 : 18),
        padding: compact ? '0 10px' : '0 14px',
        backgroundColor: '#fff',
        color: '#334155',
        boxShadow: '0 4px 14px rgba(15,23,42,0.14)',
        cursor: 'pointer',
        fontSize: px(compact ? 12 : 13),
        fontWeight: 600,
        whiteSpace: 'nowrap',
    });
    const popoverStyle = style({
        position: 'absolute',
        left: 0,
        bottom: 'calc(100% + 8px)',
        minWidth: px(compact ? 170 : 230),
        padding: '6px 0',
        borderRadius: px(14),
        backgroundColor: '#fff',
        boxShadow: '0 10px 30px rgba(15,23,42,0.2)',
        border: '1px solid rgba(148,163,184,0.25)',
    });
    const optionStyle = (selected: boolean) => style({
        width: '100%',
        minHeight: px(38),
        display: 'flex',
        alignItems: 'center',
        gap: px(10),
        border: 'none',
        backgroundColor: selected ? '#EFF6FF' : '#fff',
        color: selected ? '#1D4ED8' : '#334155',
        padding: '8px 14px',
        textAlign: 'left',
        cursor: 'pointer',
        fontSize: px(13),
    });

    return h('div', {
        key: 'tree-operation-scope-selector',
        datatest: 'tree-operation-scope-selector',
        style: rootStyle,
    }, [
        ...(opened ? [h('div', {
            key: 'tree-scope-scrim',
            datatest: 'tree-scope-scrim',
            style: style({
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 0,
            }),
            onclick: onClose,
        })] : []),
        h('button', {
            key: 'btn-tree-scope-chip',
            datatest: 'btn-tree-scope-chip',
            type: 'button',
            title: `${i18n.TreeView.OperationScope.Label()}: ${labelFor(scope)}`,
            style: chipStyle,
            onclick: onToggle,
        }, `${compact ? '' : `${i18n.TreeView.OperationScope.Label()}: `}${labelFor(scope)} ▼`),
        ...(opened ? [h('div', {
            key: 'tree-scope-popover',
            datatest: 'tree-scope-popover',
            className: 'corner-glass',
            style: popoverStyle,
        }, scopeOptions.map(option => h('button', {
            key: `tree-scope-option-${option.scope}`,
            datatest: `tree-scope-option-${option.scope}`,
            type: 'button',
            style: optionStyle(option.scope === scope),
            onclick: () => onSelect(option.scope),
        }, [
            h('i', {
                className: 'material-icons',
                style: style({ fontSize: px(18), width: px(18) }),
            }, option.scope === scope ? 'radio_button_checked' : 'radio_button_unchecked'),
            option.label(),
        ])))] : []),
    ]);
};
