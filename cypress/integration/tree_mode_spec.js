import { datatest, visit } from '../support/common';
import { operations } from '../support/operations';

const enterTreeGraphView = () => {
    cy.get(datatest('btn-list-view')).click();
    cy.get('[title="Enable tree mode"]').click();
    cy.get('[title="Show pages in tree view"]').click();
};

const buildThreeNodeChain = () => {
    cy.get('svg circle[fill="#10B981"]').last().click({ force: true });
    cy.get('[datatest^="tree-node-"]').should('have.length', 2);
    cy.get('svg circle[fill="#10B981"]').last().click({ force: true });
    cy.get('[datatest^="tree-node-"]').should('have.length', 3);
};

const createTouchDispatcher = (win, target) => (type, point) => {
    const touch = new win.Touch({
        identifier: 987,
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

describe('Tree mode in list view', () => {
    it('selects list cards first, then jumps on a second click with tree off and on', () => {
        const openList = () => {
            cy.viewport(1280, 800);
            cy.clearLocalStorage();
            visit({ mode: 'edit', mobile: false, fumen: 'v115@vhF0MJ9NJXDJ2OJzEJi/I', lng: 'en' });
            cy.get(datatest('btn-list-view')).click();
        };
        const selectThenJump = () => {
            cy.get('[datatest^="list-view-item-"]').then(($items) => {
                const item = Array.from($items).find((element) => {
                    return getComputedStyle(element).borderTopColor !== 'rgb(37, 99, 235)';
                });
                expect(item).to.exist;

                const pageIndex = Number(item.getAttribute('datatest').replace('list-view-item-', ''));
                const selector = datatest(`list-view-item-${pageIndex}`);
                cy.get(selector).children('div').first().click({ force: true });
                cy.get(selector).should('have.css', 'border-top-color', 'rgb(37, 99, 235)');
                cy.get(datatest('list-view-tools')).should('exist');

                cy.get(selector).children('div').first().click({ force: true });
                cy.get(datatest('list-view-tools')).should('not.exist');
                cy.get(datatest('tools')).find(datatest('text-pages'))
                    .should('have.text', `${pageIndex + 1} / 6`);
            });
        };

        openList();
        selectThenJump();

        openList();
        cy.get('[title="Enable tree mode"]').click();
        selectThenJump();
    });

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

    it('deletes nodes with the permanent delete button and restores via the undo toast', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH', lng: 'en' });

        enterTreeGraphView();
        buildThreeNodeChain();

        // Every rendered node has a delete button (the virtual root has none)
        cy.get('[datatest^="btn-tree-node-delete-"]').should('have.length', 3);

        // Leaf delete removes only that node and shows the Undo toast
        cy.get('[datatest^="btn-tree-node-delete-"]').last().click({ force: true });
        cy.get('[datatest^="tree-node-"]').should('have.length', 2);
        cy.get('[datatest="btn-tree-delete-undo"]').click();
        cy.get('[datatest^="tree-node-"]').should('have.length', 3);

        // No legacy drag-delete UI (red badge / red parent button) is rendered
        cy.get('svg circle[fill="#F87171"]').should('not.exist');

        // Subtree scope: deleting the middle node removes its subtree
        operations.tree.setScope('subtree');
        cy.get('[datatest^="btn-tree-node-delete-"]').eq(1).click({ force: true });
        cy.get('[datatest^="tree-node-"]').should('have.length', 1);

        // Deleting the last remaining page is rejected (button disabled)
        cy.get('[datatest^="btn-tree-node-delete-"]').first().click({ force: true });
        cy.get('[datatest^="tree-node-"]').should('have.length', 1);
    });

    it('applies descendants scope to deletion and disables it for leaves', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH', lng: 'en' });

        enterTreeGraphView();
        buildThreeNodeChain();
        operations.tree.setScope('descendants');
        cy.get(datatest('btn-tree-scope-chip')).should('contain', 'Descendants only');

        // The middle node remains while its child is removed.
        cy.get('[datatest^="btn-tree-node-delete-"]').eq(1).click({ force: true });
        cy.get('[datatest^="tree-node-"]').should('have.length', 2);
        cy.get('[datatest="btn-tree-delete-undo"]').click();
        cy.get('[datatest^="tree-node-"]').should('have.length', 3);

        // A leaf has no descendants to target, so both delete and drag are disabled.
        cy.get('[datatest^="btn-tree-node-delete-"]').last()
            .find('circle').eq(1).should('have.attr', 'fill', '#94A3B8');
        cy.get('[datatest^="tree-handle-"]').last()
            .find('rect[width="32"][height="10"]')
            .should('have.attr', 'fill', '#94A3B8');
    });

    it('activates a card first and navigates from a second card click', () => {
        cy.viewport('iphone-6');
        visit({ mode: 'edit', fumen: 'v115@vhAAgH', lng: 'en' });

        enterTreeGraphView();
        buildThreeNodeChain();

        // A click at the visible card body reaches the card (not the controls overlay),
        // changes only the active node, and keeps the tree visible.
        cy.window().then((win) => {
            const node = win.document.querySelectorAll('[datatest^="tree-node-"]')[1];
            const rect = node.getBoundingClientRect();
            const point = { x: rect.left + 40, y: rect.top + 60 };
            const target = win.document.elementFromPoint(point.x, point.y);

            expect(target.closest('[datatest^="tree-node-"]')).to.equal(node);
            target.dispatchEvent(new win.MouseEvent('click', {
                bubbles: true,
                clientX: point.x,
                clientY: point.y,
            }));
        });
        cy.get('[datatest="fumen-graph-container"]').should('exist');
        cy.get('[datatest^="tree-page-link-"]').eq(1)
            .find('rect[fill="#2563EB"]')
            .should('exist');

        // Swipe across a card body: no drag state, no ghost
        cy.window().then(async (win) => {
            const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
            const nodes = win.document.querySelectorAll('[datatest^="tree-node-"]');
            const source = nodes[1];
            const rect = source.getBoundingClientRect();
            const start = { x: rect.left + 40, y: rect.top + 60 };
            const target = win.document.elementFromPoint(start.x, start.y) || source;
            const fireTouch = createTouchDispatcher(win, target);

            fireTouch('touchstart', start);
            await wait(60);
            fireTouch('touchmove', { x: start.x + 40, y: start.y + 10 });
            await wait(60);
            fireTouch('touchmove', { x: start.x + 80, y: start.y + 20 });
            await wait(60);
            fireTouch('touchend', { x: start.x + 80, y: start.y + 20 });
        });

        cy.get('[datatest="tree-drag-ghost"]').should('not.exist');
        cy.get('[datatest^="tree-node-"]').should('have.length', 3);

        // A second click on the active card follows the same page jump behavior as #number.
        cy.window().then((win) => {
            const node = win.document.querySelectorAll('[datatest^="tree-node-"]')[1];
            node.dispatchEvent(new win.MouseEvent('click', {
                bubbles: true,
            }));
        });
        cy.get('[datatest="fumen-graph-container"]').should('not.exist');
    });

    it('moves a node by dragging its handle onto an insert button', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH', lng: 'en' });

        enterTreeGraphView();
        buildThreeNodeChain();

        cy.get('[datatest^="tree-handle-"]').first().within(() => {
            cy.get(':scope > circle').should('not.exist');
            cy.get('rect[width="32"][height="10"]').should('exist');
        });
        cy.get('[datatest^="btn-tree-insert-"]').first()
            .find('circle').eq(1)
            .should('have.attr', 'r', '16');

        cy.window().then(async (win) => {
            const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
            const handles = win.document.querySelectorAll('[datatest^="tree-handle-"]');
            const parentNodeId = win.document.querySelectorAll('[datatest^="tree-node-"]')[1]
                .getAttribute('datatest')
                .replace('tree-node-', '');
            const handle = handles[2]; // last node in the chain
            const handleRect = handle.getBoundingClientRect();
            const start = {
                x: handleRect.left + handleRect.width / 2,
                y: handleRect.top + handleRect.height / 2,
            };

            // First node's insert button (green) is the drop target
            const insertCircle = win.document.querySelectorAll('svg circle[fill="#10B981"]')[0];
            const targetRect = insertCircle.getBoundingClientRect();
            const end = {
                x: targetRect.left + targetRect.width / 2,
                y: targetRect.top + targetRect.height / 2,
            };
            const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
            const fireTouch = createTouchDispatcher(win, handle);

            fireTouch('touchstart', start);
            await wait(60);
            fireTouch('touchmove', mid);
            await wait(60);

            // The source's parent cannot receive the move, so neither of its
            // Insert/Branch controls should remain visible during the drag.
            expect(win.document.querySelector(
                `[datatest="btn-tree-insert-${parentNodeId}"]`,
            )).to.equal(null);
            expect(win.document.querySelector(
                `[datatest="btn-tree-branch-${parentNodeId}"]`,
            )).to.equal(null);

            // Valid Insert/Branch targets visibly grow from 32px to 36px.
            const expandedInsert = win.document.querySelector(
                '[datatest^="btn-tree-insert-"] circle:nth-of-type(2)',
            );
            expect(expandedInsert.getAttribute('r')).to.equal('18');

            fireTouch('touchmove', end);
            await wait(120);
            fireTouch('touchend', end);
        });

        // The dragged page is inserted between the first and second page:
        // node order in the DOM stays creation order, so the second node now
        // shows #3 and the third one #2.
        cy.get('[datatest^="tree-node-"]').should('have.length', 3);
        cy.get('[datatest^="tree-page-link-"]').eq(1).contains('#3');
        cy.get('[datatest^="tree-page-link-"]').eq(2).contains('#2');
        cy.get('[datatest="tree-drag-ghost"]').should('not.exist');
    });

    it('hides the source parent insert button even when the parent is branched', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH', lng: 'en' });

        enterTreeGraphView();
        cy.get('svg circle[fill="#10B981"]').last().click({ force: true });
        cy.get('[datatest^="tree-node-"]').should('have.length', 2);

        cy.get('[datatest^="tree-node-"]').first().then(($parent) => {
            const parentNodeId = $parent.attr('datatest').replace('tree-node-', '');
            cy.get(`[datatest="btn-tree-branch-${parentNodeId}"]`).click({ force: true });
            cy.get('[datatest^="tree-node-"]').should('have.length', 3);

            cy.window().then(async (win) => {
                const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
                const handle = win.document.querySelectorAll('[datatest^="tree-handle-"]')[2];
                const rect = handle.getBoundingClientRect();
                const start = {
                    x: rect.left + rect.width / 2,
                    y: rect.top + rect.height / 2,
                };
                const moved = { x: start.x + 30, y: start.y };
                const fireTouch = createTouchDispatcher(win, handle);

                fireTouch('touchstart', start);
                await wait(60);
                fireTouch('touchmove', moved);
                await wait(60);

                expect(win.document.querySelector(
                    `[datatest="btn-tree-insert-${parentNodeId}"]`,
                )).to.equal(null);
                expect(win.document.querySelector(
                    `[datatest="btn-tree-branch-${parentNodeId}"]`,
                )).to.not.equal(null);

                fireTouch('touchend', moved);
            });
        });
    });

    it('auto-scrolls the tree while dragging near the container edge', () => {
        cy.viewport('iphone-6');
        visit({ mode: 'edit', fumen: 'v115@vhAAgH', lng: 'en' });

        enterTreeGraphView();
        buildThreeNodeChain();

        cy.get('[datatest="fumen-graph-container"]').then(($container) => {
            expect($container[0].scrollLeft).to.equal(0);
        });

        cy.window().then(async (win) => {
            const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
            const handle = win.document.querySelectorAll('[datatest^="tree-handle-"]')[0];
            const handleRect = handle.getBoundingClientRect();
            const start = {
                x: handleRect.left + handleRect.width / 2,
                y: handleRect.top + handleRect.height / 2,
            };
            const edge = { x: win.innerWidth - 8, y: start.y };
            const fireTouch = createTouchDispatcher(win, handle);

            fireTouch('touchstart', start);
            await wait(60);
            fireTouch('touchmove', { x: start.x + 30, y: start.y });
            await wait(60);
            fireTouch('touchmove', edge);
            await wait(600); // let the auto-scroll rAF loop run
            fireTouch('touchend', edge);
        });

        cy.get('[datatest="fumen-graph-container"]').then(($container) => {
            expect($container[0].scrollLeft).to.be.greaterThan(0);
        });
        cy.get('[datatest="tree-drag-ghost"]').should('not.exist');
    });
});
