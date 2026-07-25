import * as fs from 'fs';
import * as path from 'path';

// resources/ はCopyPluginでそのままdest/へ配られる静的ファイルであり、ビルド時の検証が入らない。
// canonical/OGP/JSON-LDの重複やJSON・XMLの破損を検知するため、ファイル内容を直接検査する。

const productionUrl = 'https://61bi-234469.github.io/fumen-mobile-fork/';
const resources = path.join(__dirname, '..', '..', 'resources');

const read = (...names: string[]): string => fs.readFileSync(path.join(resources, ...names), 'utf-8');

const count = (text: string, pattern: RegExp): number => (text.match(pattern) || []).length;

const relativeReferences = (html: string): string[] => {
    const pattern = /(?:href|src)="((?:\.\.\/|\.\/)[^"]*)"/g;
    const references: string[] = [];
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(html)) !== null) {
        references.push(match[1]);
    }
    return references;
};

const sectionIds = (html: string): string[] =>
    (html.match(/<section id="([^"]+)">/g) || [])
        .map(section => (section.match(/id="([^"]+)"/) as RegExpMatchArray)[1]);

const navigationAnchors = (html: string): string[] =>
    (html.match(/href="#([^"]+)"/g) || [])
        .map(anchor => (anchor.match(/href="#([^"]+)"/) as RegExpMatchArray)[1]);

const expectLocalReference = (
    html: string,
    manualFile: string,
    reference: string,
    expectedFile: string,
) => {
    expect(html).toContain(`href="${reference}"`);
    expect(path.resolve(path.dirname(manualFile), reference)).toBe(expectedFile);
};

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
        expect(locations).toEqual([productionUrl, `${productionUrl}manual/`, `${productionUrl}manual/en/`]);
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

    test('manual/index.html declares its own canonical and Japanese metadata', () => {
        const manual = read('manual', 'index.html');

        expect(count(manual, /<link rel="canonical"/g)).toBe(1);
        expect(manual).toContain(`<link rel="canonical" href="${productionUrl}manual/">`);
        expect(count(manual, /property="og:locale"/g)).toBe(1);
        expect(manual).toContain('<meta property="og:locale" content="ja_JP">');
        expect(count(manual, /property="og:locale:alternate"/g)).toBe(1);
        expect(manual).toContain('<meta property="og:locale:alternate" content="en_US">');
        expect(manual).toContain(`<meta property="og:url" content="${productionUrl}manual/">`);
        expect(manual).toContain('<a href="./en/">English</a>');
        expect(manual).toContain(`<link rel="alternate" hreflang="ja" href="${productionUrl}manual/">`);
        expect(manual).toContain(`<link rel="alternate" hreflang="en" href="${productionUrl}manual/en/">`);
        expect(manual).toContain(`<link rel="alternate" hreflang="x-default" href="${productionUrl}manual/">`);
    });

    test('manual/en/index.html declares its own canonical and English metadata', () => {
        const manual = read('manual', 'en', 'index.html');
        const description = 'Learn how to create fumen data, organize pages, manage branches, and analyze fields with Cold Clear in Fumen Mobile Fork.';

        expect(count(manual, /<html lang="en">/g)).toBe(1);
        expect(count(manual, /<title>/g)).toBe(1);
        expect(manual).toContain('<title>Fumen Mobile Fork User Manual</title>');
        expect(count(manual, /<meta name="description"/g)).toBe(1);
        expect(manual).toContain(`<meta name="description" content="${description}">`);
        expect(count(manual, /<link rel="canonical"/g)).toBe(1);
        expect(manual).toContain(`<link rel="canonical" href="${productionUrl}manual/en/">`);
        expect(count(manual, /property="og:title"/g)).toBe(1);
        expect(manual).toContain('<meta property="og:title" content="Fumen Mobile Fork User Manual">');
        expect(count(manual, /property="og:description"/g)).toBe(1);
        expect(manual).toContain(`<meta property="og:description" content="${description}">`);
        expect(manual).toContain(`<meta property="og:url" content="${productionUrl}manual/en/">`);
        expect(manual).toContain(`<meta property="og:image" content="${productionUrl}manual/images/en/editor.png">`);
        expect(manual).toContain('<meta property="og:image:alt" content="Fumen Mobile Fork editor">');
        expect(manual).toContain('<meta property="og:locale" content="en_US">');
        expect(manual).toContain('<meta property="og:locale:alternate" content="ja_JP">');
        expect(manual).toContain('<meta name="twitter:title" content="Fumen Mobile Fork User Manual">');
        expect(manual).toContain(`<meta name="twitter:description" content="${description}">`);
        expect(manual).toContain(`<meta name="twitter:image" content="${productionUrl}manual/images/en/editor.png">`);
        expect(manual).toContain(`<link rel="alternate" hreflang="ja" href="${productionUrl}manual/">`);
        expect(manual).toContain(`<link rel="alternate" hreflang="en" href="${productionUrl}manual/en/">`);
        expect(manual).toContain(`<link rel="alternate" hreflang="x-default" href="${productionUrl}manual/">`);
        expect(manual).toContain('<a href="../">日本語</a>');
        expect(description).toMatch(/^[\x00-\x7F]*$/);
    });

    test('both manuals link to the correct sibling documents and assets', () => {
        const japanesePath = path.join(resources, 'manual', 'index.html');
        const englishPath = path.join(resources, 'manual', 'en', 'index.html');
        const japanese = read('manual', 'index.html');
        const english = read('manual', 'en', 'index.html');

        for (const [html, manualFile] of [[japanese, japanesePath], [english, englishPath]] as const) {
            for (const reference of relativeReferences(html)) {
                expect(fs.existsSync(path.resolve(path.dirname(manualFile), reference))).toBe(true);
            }
        }

        expectLocalReference(english, englishPath, '../../index.html', path.join(resources, 'index.html'));
        expectLocalReference(english, englishPath, '../../help.html', path.join(resources, 'help.html'));
        expectLocalReference(english, englishPath, '../', path.join(resources, 'manual'));
        expectLocalReference(japanese, japanesePath, './en/', path.join(resources, 'manual', 'en'));

        const japaneseImages = relativeReferences(japanese).filter(reference => reference.endsWith('.png'));
        const englishImages = relativeReferences(english).filter(reference => reference.endsWith('.png'));
        const japaneseImagesDirectory = path.join(resources, 'manual', 'images');
        const englishImagesDirectory = path.join(resources, 'manual', 'images', 'en');
        expect(japaneseImages.length).toBe(8);
        expect(englishImages.length).toBe(8);
        expect(japaneseImages.every(reference =>
            path.dirname(path.resolve(path.dirname(japanesePath), reference)) === japaneseImagesDirectory,
        )).toBe(true);
        expect(englishImages.every(reference =>
            path.dirname(path.resolve(path.dirname(englishPath), reference)) === englishImagesDirectory,
        )).toBe(true);
    });

    test('both manuals expose the same section anchors', () => {
        const japanese = read('manual', 'index.html');
        const english = read('manual', 'en', 'index.html');

        expect(sectionIds(english)).toEqual(sectionIds(japanese));
        expect(navigationAnchors(english)).toEqual(sectionIds(english));
        expect(navigationAnchors(japanese)).toEqual(sectionIds(japanese));
    });

    test('help.html links to both manuals', () => {
        const help = read('help.html');

        expect(help).toContain('<a href="./manual/index.html">');
        expect(help).toContain('<a href="./manual/en/index.html">');
    });
});
