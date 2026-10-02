import { Component, ComponentWithText, px, style } from '../../lib/types';
import { i } from '@hyperapp/html';
import { h } from 'hyperapp';

interface SettingButtonProps {
    key: string;
    classNames?: string[];
    iconSize: number;
}

export const Icon: ComponentWithText<SettingButtonProps> = (
    { key, classNames = [], iconSize }, children,
) => {
    const className = ['notranslate', 'material-icons'].concat(classNames).join(' ');
    return <i
        key={key}
        class={className}
        style={style({
            fontSize: px(iconSize),
        })}
    >
        {children}
    </i>;
};

export const BlockIcon: ComponentWithText<SettingButtonProps> = (
    { key, classNames = [], iconSize }, children,
) => {
    const className = ['notranslate', 'material-icons'].concat(classNames).join(' ');
    return <i
        key={key}
        class={className}
        style={style({
            display: 'block',
            fontSize: px(iconSize),
            margin: px(0),
        })}
    >
        {children}
    </i>;
};

export interface SizedIconProps {
    height: number;
    fontSize: number;
    enable?: boolean;
    colors: {
        baseClass: string;
        baseCode: string;
        darkCode: string;
    };
}

export const SizedIcon: Component<SizedIconProps> = (
    { height, fontSize, colors, enable }, children,
) => {
    const colorCode = enable ? colors.darkCode : colors.baseCode;
    const properties = style({
        display: 'block',
        fontSize: px(fontSize),
        height: px(height),
        lineHeight: px(height),
        width: '100%',
        border: `solid 1px ${colorCode}`,
        boxSizing: 'border-box',
        textAlign: 'center',
        cursor: 'pointer',
        // 無効でもアイコンは描き、文字色だけ薄くする（opacity だと背景と枠線まで薄くなる）
        color: enable ? '#fff' : 'rgba(255,255,255,.4)',
    });

    const className = ['notranslate', 'material-icons', `darken-${enable ? 3 : 1}`, colors.baseClass].join(' ');

    return <i className={className} style={properties}>{children}</i>;
};
