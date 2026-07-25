import { datatest, visit } from '../support/common.js';
import { operations } from '../support/operations';

const productionUrl = 'https://61bi-234469.github.io/fumen-mobile-fork/';

const expectMetaContent = (selector, expected) => {
    cy.get(`head ${selector}`, { timeout: 10000 }).should('have.attr', 'content', expected);
};

// Hold & Nextのテスト
describe('Langauge', () => {
    it('ja', () => {
        visit({ lng: 'ja' });

        operations.menu.openPage();

        cy.get(datatest('open-fumen-label')).should('have.text', 'テト譜を開く');
    });

    it('en', () => {
        visit({ lng: 'en' });

        operations.menu.openPage();

        cy.get(datatest('open-fumen-label')).should('have.text', 'Open fumen');
    });
});

// i18nextの言語判定後にdocumentのSEOメタデータが同期されることを確認する
describe('SEO metadata', () => {
    const jaTitle = 'テト譜エディタ | Fumen Mobile Fork';
    const jaDescription = 'fumen-for-mobile派生のテト譜エディタ。'
        + 'スマートフォンとPCでテト譜の作成・閲覧、リスト・ツリー編集、GIF出力、Cold Clearによる盤面分析に対応しています。';
    const enTitle = 'Tetris Fumen Editor | Fumen Mobile Fork';
    const enDescription = 'A Tetris fumen editor forked from fumen-for-mobile.'
        + ' Create and view fumen data on mobile and desktop, organize pages in lists or trees,'
        + ' export GIFs, and analyze fields with Cold Clear.';

    it('ja', () => {
        visit({ lng: 'ja' });

        cy.get('html').should('have.attr', 'lang', 'ja');
        cy.title().should('eq', jaTitle);
        expectMetaContent('meta[name="description"]', jaDescription);
        expectMetaContent('meta[property="og:title"]', jaTitle);
        expectMetaContent('meta[property="og:description"]', jaDescription);
        expectMetaContent('meta[property="og:locale"]', 'ja_JP');
        expectMetaContent('meta[property="og:locale:alternate"]', 'en_US');
        expectMetaContent('meta[name="twitter:title"]', jaTitle);
        expectMetaContent('meta[name="twitter:description"]', jaDescription);
    });

    it('en', () => {
        visit({ lng: 'en' });

        cy.get('html').should('have.attr', 'lang', 'en');
        cy.title().should('eq', enTitle);
        expectMetaContent('meta[name="description"]', enDescription);
        expectMetaContent('meta[property="og:title"]', enTitle);
        expectMetaContent('meta[property="og:description"]', enDescription);
        expectMetaContent('meta[property="og:locale"]', 'en_US');
        expectMetaContent('meta[property="og:locale:alternate"]', 'ja_JP');
        expectMetaContent('meta[name="twitter:title"]', enTitle);
        expectMetaContent('meta[name="twitter:description"]', enDescription);
    });

    // 盤面データ付きの共有URLでも、canonicalとog:urlは本番URLのまま固定する
    it('keeps canonical fixed regardless of language and fumen', () => {
        visit({ lng: 'en', fumen: 'v115@vhAAgH' });

        cy.get('html').should('have.attr', 'lang', 'en');
        cy.get('head link[rel="canonical"]').should('have.attr', 'href', productionUrl);
        expectMetaContent('meta[property="og:url"]', productionUrl);
    });
});
