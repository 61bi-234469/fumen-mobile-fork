import { block, Color, datatest, visit } from '../support/common';
import { operations } from '../support/operations';

describe('Rectangle selection and parts', () => {
    beforeEach(() => {
        cy.clearLocalStorage();
        visit({ mode: 'edit', lng: 'en' });
    });

    it('only toggles the floating menu from the toolbar', () => {
        operations.rectSelect.open();
        cy.get(datatest('btn-piece-mode')).should('exist');
        cy.get(datatest('btn-rect-select-action')).should('be.visible');
        cy.get(datatest('btn-rect-select')).click();
        cy.get(datatest('rect-floating-menu')).should('not.exist');
        cy.get(datatest('btn-piece-mode')).should('exist');
    });

    it('keeps the menu inside the editor when dragged to the viewport edge', () => {
        operations.rectSelect.open();
        cy.get(datatest('rect-floating-menu')).then($menu => {
            const menu = $menu[0];
            const menuRect = menu.getBoundingClientRect();
            const header = menu.firstElementChild;
            const startX = menuRect.left + 8;
            const startY = menuRect.top + 8;
            header.dispatchEvent(new PointerEvent('pointerdown', {
                bubbles: true, clientX: startX, clientY: startY, pointerId: 1,
            }));
            cy.window().then(win => {
                win.dispatchEvent(new PointerEvent('pointermove', {
                    bubbles: true, clientX: 2000, clientY: 2000, pointerId: 1,
                }));
                win.dispatchEvent(new PointerEvent('pointerup', {
                    bubbles: true, clientX: 2000, clientY: 2000, pointerId: 1,
                }));
            });
        });
        cy.get(datatest('rect-floating-menu')).then($menu => {
            cy.get('#field-top').then($host => {
                const menuRect = $menu[0].getBoundingClientRect();
                const hostRect = $host[0].getBoundingClientRect();
                expect(menuRect.left).to.be.at.least(hostRect.left);
                expect(menuRect.top).to.be.at.least(hostRect.top);
                expect(menuRect.right).to.be.at.most(hostRect.right + 1);
                expect(menuRect.bottom).to.be.at.most(hostRect.bottom + 1);
            });
        });
    });

    it('selects and cancels a field rectangle without committing it', () => {
        operations.rectSelect.start();
        operations.rectSelect.drag({ x: 1, y: 1 }, { x: 3, y: 3 });
        cy.get(datatest('btn-rect-commit')).should('be.visible');
        cy.get(datatest('btn-rect-cancel')).should('be.visible').click();
        cy.get(datatest('btn-rect-commit')).should('not.exist');
    });

    it('copies a selection into the persistent parts row', () => {
        operations.rectSelect.start();
        operations.rectSelect.drag({ x: 1, y: 1 }, { x: 2, y: 2 });
        cy.get(datatest('btn-part-copy')).click();
        cy.window().then(win => {
            const saved = JSON.parse(win.localStorage.getItem('parts@1'));
            expect(saved.items).to.have.length(1);
        });
    });

    it('moves a selection as one undoable edit', () => {
        operations.mode.block.I();
        operations.mode.block.click(1, 1);
        cy.get(block(1, 1)).should('have.attr', 'color', Color.I.Normal);

        operations.rectSelect.start();
        operations.rectSelect.drag({ x: 1, y: 1 }, { x: 1, y: 1 });
        operations.rectSelect.drag({ x: 1, y: 1 }, { x: 3, y: 3 });
        operations.rectSelect.commit();
        cy.get(block(1, 1)).should('have.attr', 'color', Color.Empty.Normal);
        cy.get(block(3, 3)).should('have.attr', 'color', Color.I.Normal);

        operations.mode.tools.undo();
        cy.get(block(1, 1)).should('have.attr', 'color', Color.I.Normal);
        cy.get(block(3, 3)).should('have.attr', 'color', Color.Empty.Normal);
    });
});
