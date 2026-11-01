import { ToolText } from '../tool_text';

const base = { datatest: 'text-pages', height: 40, minWidth: 48, fontSize: 14, title: '3 / 12' };

describe('ToolText', () => {
    test('stays a plain label without onclick', () => {
        const node: any = ToolText(base, '3 / 12');

        expect(node.attributes.role).toBeUndefined();
        expect(node.attributes.tabindex).toBeUndefined();
        expect(node.attributes.onclick).toBeUndefined();
        expect(node.attributes.style.cursor).toBeUndefined();
        expect(node.children).toEqual(['3 / 12']);
    });

    test('stays a plain label while disabled', () => {
        const node: any = ToolText({ ...base, onclick: jest.fn(), enable: false }, '1 / 1');

        expect(node.attributes.role).toBeUndefined();
        expect(node.attributes.onclick).toBeUndefined();
    });

    test('becomes a button that toggles on click, Enter, and Space', () => {
        const onclick = jest.fn();
        const node: any = ToolText({ ...base, onclick, expanded: true, buttonTitle: 'Show page thumbnails' }, '3 / 12');

        expect(node.attributes).toMatchObject({
            role: 'button',
            tabindex: 0,
            title: 'Show page thumbnails',
            'aria-label': '3 / 12',
            'aria-expanded': 'true',
        });
        expect(node.children).toEqual(['3 / 12']);

        const key = (value: string) => ({ key: value, preventDefault: jest.fn(), stopPropagation: jest.fn() });
        node.attributes.onclick();
        node.attributes.onkeydown(key('Enter'));
        node.attributes.onkeydown(key(' '));
        node.attributes.onkeydown(key('a'));
        expect(onclick).toHaveBeenCalledTimes(3);

        // Tab moves focus instead of reaching the global ListView shortcut
        const tab = key('Tab');
        node.attributes.onkeydown(tab);
        expect(tab.stopPropagation).toHaveBeenCalled();
        expect(tab.preventDefault).not.toHaveBeenCalled();
        expect(onclick).toHaveBeenCalledTimes(3);
    });
});
