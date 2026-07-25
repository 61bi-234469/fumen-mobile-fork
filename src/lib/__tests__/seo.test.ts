/** @jest-environment jsdom */

import { syncSeoMetadata } from '../seo';

const content = (selector: string): string | null | undefined =>
    document.querySelector(selector)?.getAttribute('content');

describe('syncSeoMetadata', () => {
    beforeEach(() => {
        document.head.innerHTML = `
            <title>Initial title</title>
            <meta name="description" content="Initial description">
            <link rel="canonical" href="https://61bi-234469.github.io/fumen-mobile-fork/">
            <meta property="og:title" content="Initial title">
            <meta property="og:description" content="Initial description">
            <meta property="og:url" content="https://61bi-234469.github.io/fumen-mobile-fork/">
            <meta property="og:image" content="https://61bi-234469.github.io/fumen-mobile-fork/icons/ms-icon-310x310.png">
            <meta property="og:locale" content="ja_JP">
            <meta property="og:locale:alternate" content="en_US">
            <meta name="twitter:title" content="Initial title">
            <meta name="twitter:description" content="Initial description">
            <meta name="twitter:image" content="https://61bi-234469.github.io/fumen-mobile-fork/icons/ms-icon-310x310.png">
        `;
        document.documentElement.lang = 'ja';
    });

    test('updates document metadata for the detected language', () => {
        syncSeoMetadata({
            language: 'en',
            title: 'English title',
            description: 'English description',
        });

        expect(document.documentElement.lang).toBe('en');
        expect(document.title).toBe('English title');
        expect(content('meta[name="description"]')).toBe('English description');
        expect(content('meta[property="og:title"]')).toBe('English title');
        expect(content('meta[property="og:description"]')).toBe('English description');
        expect(content('meta[property="og:locale"]')).toBe('en_US');
        expect(content('meta[property="og:locale:alternate"]')).toBe('ja_JP');
        expect(content('meta[name="twitter:title"]')).toBe('English title');
        expect(content('meta[name="twitter:description"]')).toBe('English description');
    });

    test('updates document metadata for Japanese', () => {
        document.documentElement.lang = 'en';

        syncSeoMetadata({
            language: 'ja',
            title: '日本語タイトル',
            description: '日本語の説明',
        });

        expect(document.documentElement.lang).toBe('ja');
        expect(document.title).toBe('日本語タイトル');
        expect(content('meta[name="description"]')).toBe('日本語の説明');
        expect(content('meta[property="og:title"]')).toBe('日本語タイトル');
        expect(content('meta[property="og:description"]')).toBe('日本語の説明');
        expect(content('meta[property="og:locale"]')).toBe('ja_JP');
        expect(content('meta[property="og:locale:alternate"]')).toBe('en_US');
        expect(content('meta[name="twitter:title"]')).toBe('日本語タイトル');
        expect(content('meta[name="twitter:description"]')).toBe('日本語の説明');
    });

    // canonicalとOGP URL・画像は常に本番URLを指す固定値であり、共有URLごとに別ページとして
    // 評価されないよう実行時同期の対象から外している。
    test('keeps canonical and fixed URLs untouched', () => {
        syncSeoMetadata({
            language: 'en',
            title: 'English title',
            description: 'English description',
        });

        expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href'))
            .toBe('https://61bi-234469.github.io/fumen-mobile-fork/');
        expect(content('meta[property="og:url"]'))
            .toBe('https://61bi-234469.github.io/fumen-mobile-fork/');
        expect(content('meta[property="og:image"]'))
            .toBe('https://61bi-234469.github.io/fumen-mobile-fork/icons/ms-icon-310x310.png');
        expect(content('meta[name="twitter:image"]'))
            .toBe('https://61bi-234469.github.io/fumen-mobile-fork/icons/ms-icon-310x310.png');
    });

    test('does not throw when the target meta elements are missing', () => {
        document.head.innerHTML = '<title>Initial title</title>';

        expect(() => syncSeoMetadata({
            language: 'ja',
            title: '日本語タイトル',
            description: '日本語の説明',
        })).not.toThrow();

        expect(document.documentElement.lang).toBe('ja');
        expect(document.title).toBe('日本語タイトル');
    });
});
