import { parseQuery } from '../params';

describe('parseQuery', () => {
    test('reads plain and encoded values', () => {
        const query = parseQuery('d=v115%40vhAAgH&screen=edit');
        expect(query.get('d')).toBe('v115@vhAAgH');
        expect(query.get('screen')).toBe('edit');
        expect(query.get('tree')).toBeUndefined();
    });

    test('does not split on an encoded ampersand inside a value', () => {
        const query = parseQuery('d=a%26b&lng=ja');
        expect(query.get('d')).toBe('a&b');
        expect(query.get('lng')).toBe('ja');
    });

    test('keeps malformed escapes as raw text instead of throwing', () => {
        const query = parseQuery('d=v115@abc%2&lng=en');
        expect(query.get('d')).toBe('v115@abc%2');
        expect(query.get('lng')).toBe('en');
    });

    test('ignores keys without a value separator', () => {
        expect(parseQuery('d').get('d')).toBeUndefined();
        expect(parseQuery('').get('d')).toBeUndefined();
    });
});
