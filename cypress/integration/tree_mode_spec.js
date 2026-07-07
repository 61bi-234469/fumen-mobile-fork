import { datatest, visit } from '../support/common';

describe('Tree mode in list view', () => {
    it('disables list reordering and confirms before deleting the tree structure', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH', lng: 'en' });

        cy.get(datatest('btn-list-view')).click();
        cy.get('[title="Enable tree mode"]').click();

        cy.get(datatest('list-view-item-0')).should('have.prop', 'draggable', false);

        cy.get('[title="Disable tree mode"]').click();
        cy.get(datatest('mdl-tree-disable-confirm')).should('be.visible');
        cy.get(datatest('btn-tree-disable-cancel')).click();
        cy.get(datatest('mdl-tree-disable-confirm')).should('not.exist');
        cy.get('[title="Disable tree mode"]').should('be.visible');

        cy.get('[title="Disable tree mode"]').click();
        cy.get(datatest('btn-tree-disable-confirm')).click();
        cy.get('[title="Enable tree mode"]').should('be.visible');
    });

    it('deletes a subtree on the first mobile touch drop', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH', lng: 'en' });

        cy.get(datatest('btn-list-view')).click();
        cy.get('[title="Enable tree mode"]').click();
        cy.get('[title="Show pages in tree graph view"]').click();

        cy.get('svg circle[fill="#10B981"]').last().click({ force: true });
        cy.get('[datatest^="tree-node-"]').should('have.length', 2);
        cy.get('svg circle[fill="#10B981"]').last().click({ force: true });
        cy.get('[datatest^="tree-node-"]').should('have.length', 3);

        cy.get(datatest('btn-view-settings')).click();
        cy.contains('Move with children').click();
        cy.get(datatest('btn-view-settings')).click();

        cy.get('svg circle[fill="#F59E0B"]').first().click({ force: true });
        cy.get('[datatest^="tree-node-"]').should('have.length', 4);
        cy.get('svg circle[fill="#10B981"]').last().click({ force: true });
        cy.get('[datatest^="tree-node-"]').should('have.length', 5);

        cy.window().then(async (win) => {
            const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
            const nodes = win.document.querySelectorAll('[datatest^="tree-node-"]');
            const source = nodes[3];
            const rect = source.getBoundingClientRect();
            const start = { x: rect.left + 55, y: rect.top + 150 };
            const mid = { x: start.x - 15, y: start.y - 45 };
            const end = { x: rect.left - 6, y: rect.top + 8 };
            const target = win.document.elementFromPoint(start.x, start.y) || source;

            const fireTouch = (type, point) => {
                const touch = new win.Touch({
                    identifier: 123,
                    target,
                    clientX: point.x,
                    clientY: point.y,
                    screenX: point.x,
                    screenY: point.y,
                    pageX: point.x + win.scrollX,
                    pageY: point.y + win.scrollY,
                    radiusX: 2,
                    radiusY: 2,
                    force: 1,
                });
                const event = new win.TouchEvent(type, {
                    bubbles: true,
                    cancelable: true,
                    touches: type === 'touchend' ? [] : [touch],
                    targetTouches: type === 'touchend' ? [] : [touch],
                    changedTouches: [touch],
                });
                target.dispatchEvent(event);
            };

            fireTouch('touchstart', start);
            await wait(80);
            fireTouch('touchmove', mid);
            await wait(80);
            fireTouch('touchmove', end);
            await wait(120);
            fireTouch('touchend', end);
        });

        cy.get('[datatest^="tree-node-"]').should('have.length', 3);
        cy.get('svg circle[fill="#EF4444"], svg circle[fill="#F87171"]').should('not.exist');
    });
});
