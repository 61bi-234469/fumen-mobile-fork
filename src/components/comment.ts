import { Component, px, style } from '../lib/types';
import { div, input } from '@hyperapp/html';

interface Props {
    dataTest: string;
    key: string;
    id: string;
    textColor: string;
    backgroundColorClass: string;
    height: number;
    text: string;
    readonly: boolean;
    placeholder?: string;
    currentIndex: number;
    actions: {
        updateCommentText: (data: { text?: string, pageIndex: number }) => void;
        commitCommentText: () => void;
    };
}

// The row shares its parent with the toolbar. Without a key Hyperapp matches the two by position, and
// swapping this row for another element rebuilds the whole toolbar.
const COMMENT_ROW_KEY = 'comment-row';

export const comment: Component<Props> = (
    {
        height, textColor, backgroundColorClass, dataTest, key, id, text,
        readonly, placeholder, currentIndex, actions,
    },
) => {
    const commentStyle = style({
        width: '100%',
        height: px(height),
        lineHeight: px(height),
        fontSize: px(height * 0.6),
        boxSizing: 'border-box',
        textAlign: 'center',
        border: 'none',
        color: textColor,
    });

    if (readonly) {
        return div({
            key: COMMENT_ROW_KEY,
            style: style({
                width: '100%',
                height: px(height),
                whiteSpace: 'nowrap',
            }),
        }, [
            input({
                id,
                key,
                dataTest,
                placeholder,
                value: text,
                type: 'text',
                className: backgroundColorClass,
                style: commentStyle,
                readonly: 'readonly',
            }),
        ]);
    }

    const oncreate = (element: HTMLInputElement) => {
        element.value = text;
    };

    const update = (event: KeyboardEvent | FocusEvent) => {
        if (event.target !== null) {
            const target = event.target as HTMLInputElement;
            actions.updateCommentText({ text: target.value, pageIndex: currentIndex });
        }
    };

    const blur = (event: KeyboardEvent) => {
        if (event.target !== null) {
            const target = event.target as HTMLInputElement;
            target.blur();
        }
    };

    const onblur = () => {
        actions.commitCommentText();
    };

    let lastComposingOnEnterDown = true;

    const onkeydown = (event: KeyboardEvent) => {
        // 最後にEnterを押されたときのisComposingを記録する
        // IMEで変換しているときはtrueになる
        if (event.key === 'Enter') {
            lastComposingOnEnterDown = event.isComposing;
        }
    };

    const onkeyup = (event: KeyboardEvent) => {
        // 最後にエンターが押されたか (IMEには反応しない)
        if (!event.isComposing && !lastComposingOnEnterDown && event.key === 'Enter') {
            blur(event);
        }
    };

    return div({
        key: COMMENT_ROW_KEY,
        style: style({
            width: '100%',
            height: px(height),
            whiteSpace: 'nowrap',
        }),
    }, [
        input({
            // `value` を設定すると、（undefinedでも）更新のたびにそれまで入力していた文字も消えてしまうため、使用しない
            id,
            key,
            dataTest,
            placeholder,
            oncreate,
            onblur,
            onkeydown,
            onkeyup,
            oninput: update,
            onfocus: update,
            type: 'text',
            className: backgroundColorClass,
            style: commentStyle,
        }),
    ]);
};
