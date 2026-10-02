import { h } from 'hyperapp';
import { ComponentWithText, px, style } from '../../lib/types';

interface Props {
    key?: string;
    datatest?: string;
    height: number;
    minWidth: number;
    fontSize: number;
    marginRight?: number;
    title?: string;
}

export const ToolText: ComponentWithText<Props> = (
    { key, datatest, height, fontSize, minWidth, marginRight = 0, title }, children,
) => {
    const properties = style({
        lineHeight: px(height),
        fontSize: px(fontSize),
        minWidth: px(minWidth),
        textAlign: 'center',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        marginRight: px(marginRight),
    });

    return (
        <span key={ key } datatest={ datatest } title={ title } aria-label={ title } style={ properties }>
            { children }
        </span>
    );
};
