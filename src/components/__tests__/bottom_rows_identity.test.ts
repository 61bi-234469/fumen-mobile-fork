/**
 * @jest-environment jsdom
 */

import { app } from 'hyperapp';
import { div } from '@hyperapp/html';
import { comment } from '../comment';
import { page_slider } from '../page_slider';
import { ToolbarLayout } from '../tools/toolbar_layout';

type Row = 'comment' | 'readonly-comment' | 'reserved' | 'slider';

interface TestState {
    row: Row;
}

interface TestActions {
    show: (row: Row) => (state: TestState) => TestState;
}

const commentRow = (readonly: boolean) => comment({
    readonly,
    key: readonly ? 'text-comment-readonly' : 'text-comment',
    dataTest: 'text-comment',
    id: 'text-comment',
    textColor: '#fff',
    backgroundColorClass: 'comment-band',
    height: 30,
    text: '',
    currentIndex: 0,
    actions: { updateCommentText: () => undefined, commitCommentText: () => undefined },
});

const topRow = (row: Row) => {
    switch (row) {
    case 'comment':
        return commentRow(false);
    case 'readonly-comment':
        return commentRow(true);
    case 'slider':
        return page_slider({
            datatest: 'range-page-slider',
            size: { width: 100, height: 30 },
            maxPage: 3,
            currentIndex: 0,
            actions: { openPageWhenChange: () => undefined },
        });
    case 'reserved':
        return div({ key: 'reserved-comment-space' });
    }
};

// Hyperapp renders on a timer
const flush = () => new Promise(resolve => setTimeout(resolve, 5));

// The same sibling layout as `menu-top` in the editor and reader views.
describe('rows above the bottom toolbar', () => {
    let container: HTMLElement;
    let actions: TestActions;

    beforeEach(async () => {
        container = document.createElement('div');
        document.body.appendChild(container);
        actions = app<TestState, TestActions>(
            { row: 'comment' },
            { show: row => () => ({ row }) },
            state => div({ key: 'menu-top' }, [
                topRow(state.row),
                ToolbarLayout({
                    datatest: 'tools',
                    className: 'tools',
                    height: 40,
                    left: [],
                    center: [],
                    right: [],
                    leftGap: 0,
                    centerGap: 0,
                }),
            ]),
            container,
        );
        await flush();
    });

    afterEach(() => {
        container.remove();
    });

    const toolbar = () => container.querySelector('[datatest="tools"]');

    test.each<Row>(['reserved', 'slider', 'readonly-comment'])(
        'keeps the toolbar element when the comment row is swapped for the %s row',
        async (row) => {
            const before = toolbar();
            expect(before).not.toBeNull();

            actions.show(row);
            await flush();
            expect(toolbar()).toBe(before);

            actions.show('comment');
            await flush();
            expect(toolbar()).toBe(before);
            expect(container.querySelectorAll('[datatest="tools"]')).toHaveLength(1);
        },
    );

    test('keeps the toolbar below the row', async () => {
        actions.show('reserved');
        await flush();
        actions.show('comment');
        await flush();

        const rows = Array.from(container.firstElementChild!.children);
        expect(rows).toHaveLength(2);
        expect(rows[0].querySelector('[datatest="text-comment"]')).not.toBeNull();
        expect(rows[1]).toBe(toolbar());
    });
});
