/** @jest-environment jsdom */

import { parseClipboard, parseClipboardText } from '../index';

const mockClipboardRead = (items: { types: string[]; text?: string }[]) => {
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
            read: jest.fn().mockResolvedValue(items.map(item => ({
                types: item.types,
                getType: async () => ({ text: async () => item.text ?? '' }),
            }))),
        },
    });
};

const mockClipboardReadText = (text: string | null) => {
    Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: {
            readText: text === null
                ? jest.fn().mockRejectedValue(new Error('denied'))
                : jest.fn().mockResolvedValue(text),
        },
    });
};

const validFieldText = Array(20).fill('..........').join('\n');

describe('parseClipboard', () => {
    test('returns a fumen when a text item contains a v115@ string', async () => {
        mockClipboardRead([{ types: ['text/plain'], text: 'see v115@abc123 for detail' }]);
        const result = await parseClipboard();
        expect(result).toEqual({ type: 'fumen', fumen: 'v115@abc123' });
    });

    test('returns a parsed field when text looks like a 20x10 field', async () => {
        mockClipboardRead([{ types: ['text/plain'], text: validFieldText }]);
        const result = await parseClipboard();
        expect(result.type).toBe('fieldText');
        expect(result.warning).toBeUndefined();
    });

    test('returns none when no clipboard item matches', async () => {
        mockClipboardRead([{ types: ['text/plain'], text: 'random unrelated text' }]);
        const result = await parseClipboard();
        expect(result).toEqual({ type: 'none' });
    });

    test('returns none and logs when clipboard.read rejects', async () => {
        Object.defineProperty(navigator, 'clipboard', {
            configurable: true,
            value: { read: jest.fn().mockRejectedValue(new Error('denied')) },
        });
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        const result = await parseClipboard();

        expect(result).toEqual({ type: 'none' });
        errorSpy.mockRestore();
    });
});

describe('parseClipboardText', () => {
    test('returns a fumen when text contains a v115@ string', async () => {
        mockClipboardReadText('v115@xyz789');
        const result = await parseClipboardText();
        expect(result).toEqual({ type: 'fumen', fumen: 'v115@xyz789' });
    });

    test('returns a parsed field when text looks like a 20x10 field', async () => {
        mockClipboardReadText(validFieldText);
        const result = await parseClipboardText();
        expect(result.type).toBe('fieldText');
    });

    test('returns none for unrelated text', async () => {
        mockClipboardReadText('nothing here');
        const result = await parseClipboardText();
        expect(result).toEqual({ type: 'none' });
    });

    test('returns none when readText rejects', async () => {
        mockClipboardReadText(null);
        const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);

        const result = await parseClipboardText();

        expect(result).toEqual({ type: 'none' });
        errorSpy.mockRestore();
    });
});
