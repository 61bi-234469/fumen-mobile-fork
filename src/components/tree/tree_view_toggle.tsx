/**
 * TreeViewToggle component - Toggle tree mode and view type (List/Tree)
 *
 * Two-tier control kept intentionally:
 *   - An always-visible tree ON/OFF switch so the presence of a tree structure
 *     is readable at a glance (and a tree-off list is never confused with a
 *     tree-on list).
 *   - A List/Graph segmented control that appears only while tree mode is on.
 *
 * Laid out as a single "tree mode" group that lights up (blue) when enabled, and
 * sized to fit small screens (iPhone SE / 320px) without overflowing the toolbar.
 */

import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { TreeViewMode } from '../../lib/fumen/tree_types';

// ============================================================================
// Props Interface
// ============================================================================

interface Props {
    treeEnabled: boolean;
    currentViewMode: TreeViewMode;
    height: number;
    listShortcutLabel?: string;
    treeShortcutLabel?: string;
    actions: {
        onTreeToggle: () => void;
        onViewModeChange: (mode: TreeViewMode) => void;
    };
}

// ============================================================================
// Main Component
// ============================================================================

// The toolbar cascades a tall line-height onto .material-icons, so every icon
// here needs an explicit box or the glyph height balloons / gets clipped.
const iconBox = (size: number, box: number) => style({
    display: 'block',
    width: px(box),
    height: px(box),
    fontSize: px(size),
    lineHeight: px(box),
    textAlign: 'center',
});

export const TreeViewToggle: Component<Props> = ({
    treeEnabled,
    currentViewMode,
    height,
    listShortcutLabel,
    treeShortcutLabel,
    actions,
}) => {
    const containerStyle = style({
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        height: px(height),
        padding: '0 2px',
    });

    // Single "tree mode" group: muted when off, lit (blue panel) when on so the
    // presence of a tree structure is obvious at a glance.
    const groupStyle = style({
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: px(5),
        height: px(Math.min(height, 34)),
        padding: '0 6px',
        borderRadius: '17px',
        backgroundColor: treeEnabled ? '#283593' : 'rgba(255,255,255,0.12)',
        transition: 'background-color 0.2s',
    });

    const treeIconStyle = style({
        ...iconBox(18, 22),
        color: treeEnabled ? '#fff' : '#cfd8dc',
        cursor: 'pointer',
        flex: 'none',
    });

    // Switch toggle styles (intentionally compact; the wide segment is the
    // primary mis-tap-resistant target).
    const switchStyle = style({
        position: 'relative',
        width: '28px',
        height: '16px',
        backgroundColor: treeEnabled ? '#3B82F6' : '#9e9e9e',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'background-color 0.3s',
        flex: 'none',
    });

    const switchKnobStyle = style({
        position: 'absolute',
        top: '2px',
        left: treeEnabled ? '14px' : '2px',
        width: '12px',
        height: '12px',
        backgroundColor: '#fff',
        borderRadius: '50%',
        transition: 'left 0.3s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
    });

    // Icon-only segmented control (List / Graph)
    const segmentStyle = style({
        display: 'flex',
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: '8px',
        padding: '2px',
        gap: '2px',
    });

    const segmentButtonStyle = (isActive: boolean) => style({
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '36px',
        height: '24px',
        border: 'none',
        borderRadius: '6px',
        padding: 0,
        cursor: 'pointer',
        outline: 'none',
        backgroundColor: isActive ? '#3B82F6' : 'transparent',
        color: '#fff',
        transition: 'background-color 0.2s',
    });

    // White hint with a soft shadow stays legible over both the blue selected
    // button and the dark indigo group.
    const shortcutLabelStyle = style({
        position: 'absolute',
        right: px(1),
        bottom: px(-1),
        fontSize: px(8),
        lineHeight: '1',
        fontWeight: 500,
        color: '#fff',
        textShadow: '0 0 2px rgba(0,0,0,0.45)',
        pointerEvents: 'none',
    });

    return (
        <div key="tree-view-toggle" style={containerStyle}>
            <div style={groupStyle}>
                {/* Tree mode toggle (icon + switch, both toggle tree mode) */}
                <i
                    className="material-icons"
                    style={treeIconStyle}
                    onclick={() => actions.onTreeToggle()}
                >account_tree</i>
                <div
                    key="tree-switch"
                    style={switchStyle}
                    onclick={() => actions.onTreeToggle()}
                    title={treeEnabled ? 'Disable tree mode' : 'Enable tree mode'}
                >
                    <div style={switchKnobStyle} />
                </div>

                {/* View mode buttons (only shown when tree is enabled) */}
                {treeEnabled && (
                    <div style={segmentStyle}>
                        <button
                            key="btn-list-view"
                            style={segmentButtonStyle(currentViewMode === TreeViewMode.List)}
                            onclick={() => actions.onViewModeChange(TreeViewMode.List)}
                            title="Show pages in list view"
                        >
                            <i className="material-icons" style={iconBox(20, 22)}>view_list</i>
                            {listShortcutLabel && (
                                <span style={shortcutLabelStyle}>
                                    {listShortcutLabel}
                                </span>
                            )}
                        </button>
                        <button
                            key="btn-tree-view"
                            style={segmentButtonStyle(currentViewMode === TreeViewMode.Tree)}
                            onclick={() => actions.onViewModeChange(TreeViewMode.Tree)}
                            title="Show pages in tree graph view"
                        >
                            <i className="material-icons" style={iconBox(20, 22)}>device_hub</i>
                            {treeShortcutLabel && (
                                <span style={shortcutLabelStyle}>
                                    {treeShortcutLabel}
                                </span>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
