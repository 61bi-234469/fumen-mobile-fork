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
    // 指定すると押せるテキストになる。enable が false の間は従来どおりのただのテキスト
    onclick?: () => void;
    enable?: boolean;
    expanded?: boolean;
    buttonTitle?: string;
}

export const ToolText: ComponentWithText<Props> = (
    {
        key, datatest, height, fontSize, minWidth, marginRight = 0, title, onclick, enable = true, expanded,
        buttonTitle,
    },
    children,
) => {
    const clickable = onclick !== undefined && enable;
    const properties = style({
        lineHeight: px(height),
        fontSize: px(fontSize),
        minWidth: px(minWidth),
        textAlign: 'center',
        whiteSpace: 'nowrap',
        flexShrink: 0,
        marginRight: px(marginRight),
        ...(clickable ? { cursor: 'pointer', userSelect: 'none' } : {}),
    });

    if (!clickable) {
        return (
            <span key={ key } datatest={ datatest } title={ title } aria-label={ title } style={ properties }>
                { children }
            </span>
        );
    }

    // Enter/Space は押下、Tab はフォーカス移動として扱い、グローバルの編集ショートカットへ渡さない
    const onkeydown = (event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.stopPropagation();
            onclick!();
        } else if (event.key === 'Tab') {
            event.stopPropagation();
        }
    };

    return (
        <span key={ key } datatest={ datatest } title={ buttonTitle ?? title } aria-label={ title }
              style={ properties } role="button" tabindex={ 0 } aria-expanded={ expanded ? 'true' : 'false' }
              onclick={ () => onclick!() } onkeydown={ onkeydown }>
            { children }
        </span>
    );
};
