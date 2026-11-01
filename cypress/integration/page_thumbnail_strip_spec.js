import { datatest, emptyPagesFumen, expectFumen, visit } from '../support/common';
import { operations } from '../support/operations';

// 主系列 1-2-3-4-5 と、2 ページ目から分かれる 6-7 の枝を持つ Tree（#TREE= 埋め込み）
const branchedTreeFumen = 'v115@bhzhPeAgWWBFLLwCSIMSAT2J8DJzF7BTPvtCXPvtCX?1bxEBNv3B32bxEFNvtCXIF7BZz93D3GF7BRz9tEXIF7BVDw?3BXJaxEVN/3D3NaxEZdRxDlcJSAT2AAARhTpFeTaPeAgHHh?zwFezSZeAgH9gjlFeTLjeAgHzgj0FejWteAgHpgT4FejH3e?AgHfgDtFezDBfAgH';

const strip = () => cy.get(datatest('page-thumbnail-strip'));

describe('Page thumbnail strip', () => {
    it('jumps to a tapped page from the Reader and closes the strip', () => {
        visit({ fumen: emptyPagesFumen(6) });

        operations.pageStrip.open();
        cy.get(datatest('text-pages')).should('have.attr', 'aria-expanded', 'true');
        cy.get(datatest('page-thumbnail-item')).should('have.length', 6);
        cy.get(datatest('page-thumbnail-tree')).should('not.exist');
        operations.pageStrip.expectCurrent(1);

        operations.pageStrip.select(4);
        cy.get(datatest('text-pages')).should('have.text', '4 / 6');
        strip().should('not.exist');

        // ツールバーのページ送りでは開いたまま強調が追従する
        operations.pageStrip.open();
        operations.pageStrip.expectCurrent(4);
        cy.get(datatest('btn-next-page')).click();
        cy.get(datatest('text-pages')).should('have.text', '5 / 6');
        operations.pageStrip.expectCurrent(5);

        cy.get('body').type('{esc}');
        strip().should('not.exist');

        operations.pageStrip.open();
        cy.get(datatest('btn-page-thumbnail-strip-close')).click();
        strip().should('not.exist');

        operations.pageStrip.open();
        cy.get(datatest('text-pages')).click();
        strip().should('not.exist');
    });

    it('closes on a board tap in the Editor without drawing', () => {
        const fumen = emptyPagesFumen(3);
        visit({ fumen, mode: 'edit' });

        operations.pageStrip.open();
        cy.get(datatest('page-thumbnail-strip-scrim')).click(150, 300);
        strip().should('not.exist');
        cy.get(datatest('text-pages')).should('have.text', '1 / 3');

        expectFumen(fumen);
    });

    it('keeps keyboard operation inside the strip', () => {
        const fumen = emptyPagesFumen(3);
        visit({ fumen, mode: 'edit' });

        // Enter on the page counter opens it; Tab must not reach the global ListView shortcut
        cy.get(datatest('text-pages')).focus().type('{enter}');
        strip().should('be.visible');
        cy.get(datatest('text-pages')).trigger('keydown', { key: 'Tab', code: 'Tab' });
        cy.get(datatest('btn-back-to-editor')).should('not.exist');

        // Space on the close button closes the strip without inserting a page (InsertPage = Space)
        cy.get(datatest('btn-page-thumbnail-strip-close')).focus().type(' ');
        strip().should('not.exist');
        cy.get(datatest('text-pages')).should('have.text', '1 / 3');

        expectFumen(fumen);
    });

    it('does nothing on a single-page fumen', () => {
        visit({ fumen: emptyPagesFumen(1), mode: 'edit' });

        cy.get(datatest('text-pages')).should('not.have.attr', 'role');
        cy.get(datatest('text-pages')).click();
        strip().should('not.exist');
    });

    it('closes when the screen changes', () => {
        visit({ fumen: emptyPagesFumen(3), mode: 'edit' });

        operations.pageStrip.open();
        cy.get(datatest('btn-list-view')).click();
        strip().should('not.exist');
        cy.get(datatest('btn-back-to-editor')).click();
        cy.get(datatest('text-pages')).should('have.attr', 'aria-expanded', 'false');
        strip().should('not.exist');
    });

    it('lays tree pages out by depth and lane while Tree management is on', () => {
        visit({ fumen: branchedTreeFumen, mode: 'edit', userSettings: { openTreeScreenOnTreeData: false } });

        operations.pageStrip.open();
        cy.get(datatest('page-thumbnail-tree')).should('exist');
        cy.get(datatest('page-thumbnail-item')).should('have.length', 7);
        cy.get(datatest('page-thumbnail-strip')).find('svg').should('not.exist');

        // 3 ページ目（主系列、深さ 2）と 6 ページ目（枝、深さ 2）は同じ列で、枝が下のレーン
        cy.get(datatest('page-thumbnail-item')).should(($items) => {
            const rectOf = page => $items.filter(`[data-page="${page}"]`)[0].getBoundingClientRect();
            expect(rectOf(6).top).to.be.greaterThan(rectOf(3).top);
            expect(rectOf(6).left).to.be.closeTo(rectOf(3).left, 1);
        });

        operations.pageStrip.select(6);
        cy.get(datatest('text-pages')).should('have.text', '6 / 7');
        strip().should('not.exist');
        operations.pageStrip.open();
        operations.pageStrip.expectCurrent(6);
    });
});
