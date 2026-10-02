import { h } from 'hyperapp';
import { Component, px, style } from '../../lib/types';
import { SizedIcon, SizedIconProps } from '../atomics/icons';

// 長押し状態のグローバル管理（再レンダリングでリセットされないようにする）
const longPressState: {
    timer: ReturnType<typeof setTimeout> | null;
    triggered: boolean;
    activeKey: string | null;
} = {
    timer: null,
    triggered: false,
    activeKey: null,
};

interface Props {
    width: number;
    iconName: string;
    datatest?: string;
    title?: string;
    ariaLabel?: string;
    key: string;
    shortcutLabel?: string;
    shortcutLabelColor?: string;
    colors: {
        baseClass: string;
        baseCode: string;
        darkCode: string;
    };
    actions: {
        onclick?: (e: MouseEvent) => void;
        onlongpress?: () => void;
    };
}

export const ToolButton: Component<Props & SizedIconProps> = (
    {
        height, width, fontSize, key, iconName,
        datatest, title, ariaLabel, shortcutLabel, shortcutLabelColor, colors, enable = true, actions,
    },
) => {
    const aProperties = style({
        height: px(height),
        lineHeight: px(height),
        width: px(width),
        flexShrink: 0,
        position: shortcutLabel ? 'relative' : undefined,
    });
    // enable は見た目だけで、無効でもクリックの処理は動く（各アクション側で何もしない）
    const ariaDisabled = enable ? 'false' : 'true';

    const shortcutLabelElement = shortcutLabel ? (
        <span style={style({
            position: 'absolute',
            right: px(2),
            bottom: px(0),
            fontSize: px(9),
            lineHeight: '1',
            color: shortcutLabelColor ?? '#fff',
            pointerEvents: 'none',
        })}>
            {shortcutLabel}
        </span>
    ) : null;

    const onclick = actions.onclick;
    const onlongpress = actions.onlongpress;

    const clearLongPressTimer = () => {
        if (longPressState.timer !== null) {
            clearTimeout(longPressState.timer);
            longPressState.timer = null;
        }
    };

    const onpointerdown = onlongpress !== undefined ? (event: PointerEvent) => {
        clearLongPressTimer();
        longPressState.triggered = false;
        longPressState.activeKey = key;

        longPressState.timer = setTimeout(() => {
            if (longPressState.activeKey === key) {
                longPressState.triggered = true;
                onlongpress();
            }
        }, 500);
    } : undefined;

    const onpointerup = onlongpress !== undefined ? (event: PointerEvent) => {
        clearLongPressTimer();

        // 長押しがトリガーされた場合はonclickを実行しない
        if (longPressState.triggered && longPressState.activeKey === key) {
            longPressState.triggered = false;
            longPressState.activeKey = null;
            event.stopPropagation();
            event.preventDefault();
            return;
        }

        longPressState.activeKey = null;

        // 通常のクリック処理
        // setTimeout で遅延させ、先にブラウザの合成 click イベントが <a> の onclick で
        // 抑制されてからアクションを実行する。これにより、モーダルオーバーレイが click
        // イベントより先に表示されて即閉じする問題を防ぐ。
        if (onclick !== undefined) {
            const handler = onclick;
            setTimeout(() => handler(event as any), 0);
            event.stopPropagation();
            event.preventDefault();
        }
    } : undefined;

    const onpointercancel = onlongpress !== undefined ? () => {
        clearLongPressTimer();
        longPressState.triggered = false;
        longPressState.activeKey = null;
    } : undefined;

    const onpointerleave = onlongpress !== undefined ? () => {
        clearLongPressTimer();
        longPressState.triggered = false;
        longPressState.activeKey = null;
    } : undefined;

    // 長押しでコンテキストメニューが出ないようにする
    const oncontextmenu = onlongpress !== undefined ? (event: Event) => {
        event.preventDefault();
    } : undefined;

    // 長押しがある場合はPointer Eventsで処理、ない場合は従来のonclick
    if (onlongpress !== undefined) {
        return (
            <a href="#"
               key={key}
               datatest={datatest}
               title={title}
               aria-label={ariaLabel ?? title}
               aria-disabled={ariaDisabled}
               style={aProperties}
               onpointerdown={onpointerdown}
               onpointerup={onpointerup}
               onpointercancel={onpointercancel}
               onpointerleave={onpointerleave}
               oncontextmenu={oncontextmenu}
               onclick={(event: MouseEvent) => {
                   event.stopPropagation();
                   event.preventDefault();
               }}>
                <SizedIcon height={height} fontSize={fontSize} colors={colors} enable={enable}>
                    {iconName}
                </SizedIcon>
                {shortcutLabelElement}
            </a>
        );
    }

    return (
        <a href="#"
           key={key}
           datatest={datatest}
           title={title}
           aria-label={ariaLabel ?? title}
           aria-disabled={ariaDisabled}
           style={aProperties}
           onclick={onclick !== undefined ? (event: MouseEvent) => {
               onclick(event);
               event.stopPropagation();
               event.preventDefault();
           } : undefined}>
            <SizedIcon height={height} fontSize={fontSize} colors={colors} enable={enable}>
                {iconName}
            </SizedIcon>
            {shortcutLabelElement}
        </a>
    );
};
