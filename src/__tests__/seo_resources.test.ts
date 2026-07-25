import * as fs from 'fs';
import * as path from 'path';

// resources/ はCopyPluginでそのままdest/へ配られる静的ファイルであり、ビルド時の検証が入らない。
// canonical/OGP/JSON-LDの重複やJSON・XMLの破損を検知するため、ファイル内容を直接検査する。

const productionUrl = 'https://61bi-234469.github.io/fumen-mobile-fork/';
const resources = path.join(__dirname, '..', '..', 'resources');

const read = (...names: string[]): string => fs.readFileSync(path.join(resources, ...names), 'utf-8');

const count = (text: string, pattern: RegExp): number => (text.match(pattern) || []).length;

describe('static SEO resources', () => {
    describe('index.html', () => {
        const html = read('index.html');

        test('declares each canonical and social metadata entry exactly once', () => {
            expect(count(html, /<link rel="canonical"/g)).toBe(1);
            expect(count(html, /property="og:title"/g)).toBe(1);
            expect(count(html, /property="og:description"/g)).toBe(1);
            expect(count(html, /property="og:url"/g)).toBe(1);
            expect(count(html, /property="og:image"/g)).toBe(1);
            expect(count(html, /property="og:locale"/g)).toBe(1);
            expect(count(html, /name="twitter:card"/g)).toBe(1);
            expect(count(html, /name="description"/g)).toBe(1);
            expect(count(html, /<link rel="manifest"/g)).toBe(1);
            expect(count(html, /application\/ld\+json/g)).toBe(1);
        });

        test('points canonical and OGP url at the production URL', () => {
            expect(html).toContain(`<link rel="canonical" href="${productionUrl}">`);
            expect(html).toContain(`<meta property="og:url" content="${productionUrl}">`);
        });

        test('has valid JSON-LD without price claims', () => {
            const matched = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
            expect(matched).not.toBeNull();

            const jsonLd = JSON.parse((matched as RegExpMatchArray)[1]);
            expect(jsonLd['@type']).toBe('WebApplication');
            expect(jsonLd.url).toBe(productionUrl);
            expect(jsonLd.inLanguage).toEqual(['ja', 'en']);

            // 派生元の明示は表示文面ではなく構造化データで機械可読にする
            expect(jsonLd.isBasedOn.url).toBe('https://knewjade.github.io/fumen-for-mobile/');

            // 「無料」表現を使わない方針のため、価格・無料に関する主張は構造化データにも含めない
            expect(jsonLd.offers).toBeUndefined();
            expect(jsonLd.isAccessibleForFree).toBeUndefined();
        });

        test('references icons that exist', () => {
            const icons = html.match(/(?:href|content)="(icons\/[^"]+)"/g) || [];
            expect(icons.length).toBeGreaterThan(0);
            for (const icon of icons) {
                const file = (icon.match(/"(icons\/[^"]+)"/) as RegExpMatchArray)[1];
                expect(fs.existsSync(path.join(resources, file))).toBe(true);
            }
        });
    });

    test('manifest.json is valid JSON with the approved metadata', () => {
        const manifest = JSON.parse(read('manifest.json'));

        expect(manifest.description).toBeTruthy();
        expect(manifest.id).toBe('./');
        expect(manifest.start_url).toBe('./');
        expect(manifest.scope).toBe('./');
        expect(manifest.categories).toEqual(['utilities', 'productivity']);
    });

    test('sitemap.xml lists only the approved production URLs', () => {
        const sitemap = read('sitemap.xml');

        expect(sitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
        expect(count(sitemap, /<urlset/g)).toBe(1);
        expect(count(sitemap, /<url>/g)).toBe(count(sitemap, /<\/url>/g));

        const locations = (sitemap.match(/<loc>([^<]+)<\/loc>/g) || [])
            .map(loc => (loc.match(/<loc>([^<]+)<\/loc>/) as RegExpMatchArray)[1]);
        expect(locations).toEqual([productionUrl, `${productionUrl}manual/`]);
    });

    test('robots.txt sitemap URL matches the shipped sitemap', () => {
        const robots = read('robots.txt');

        expect(robots).toContain(`Sitemap: ${productionUrl}sitemap.xml`);
        expect(robots).toContain('Disallow: /fumen-mobile-fork/preview/');
        expect(fs.existsSync(path.join(resources, 'sitemap.xml'))).toBe(true);
    });

    test('help.html is excluded from search results and points at the manual', () => {
        const help = read('help.html');

        expect(help).toContain('<meta name="robots" content="noindex, follow">');
        expect(help).toContain(`<link rel="canonical" href="${productionUrl}manual/">`);
    });

    test('manual/index.html declares its own canonical', () => {
        const manual = read('manual', 'index.html');

        expect(count(manual, /<link rel="canonical"/g)).toBe(1);
        expect(manual).toContain(`<link rel="canonical" href="${productionUrl}manual/">`);
    });
});
