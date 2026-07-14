import { block, Color, datatest, expectFumen, mino, minoPosition, Piece, Rotation, visit } from '../support/common';
import { operations } from '../support/operations';

// テト譜を開く
describe('Put pieces', () => {
    it('Move piece', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.spawn.O();

        cy.get(datatest('tray-piece-drag')).should('not.be.disabled');
        operations.mode.piece.harddrop();
        operations.mode.piece.moveToLeft();
        cy.get(datatest('img-rotation-spawn')).should('be.visible');

        operations.mode.tools.undo();
        operations.mode.tools.redo();
        operations.mode.piece.resetPiece();
        cy.get(datatest('tray-piece-drag')).should('be.disabled');
    });

    it('Put pieces', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.block.click(5, 5);

        cy.get(datatest('tray-piece-drag')).should('not.be.disabled');
        mino(Piece.T, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.T.Highlight2);
        });

        operations.mode.piece.resetPiece();
        cy.get(datatest('tray-piece-drop')).should('be.disabled');

        operations.mode.piece.draw();
        operations.mode.block.click(5, 5);
        operations.mode.piece.harddrop();
        cy.get(datatest('img-rotation-spawn')).should('be.visible');
    });

    it('Show current rotation', () => {
        visit({ mode: 'edit' });

        operations.mode.piece.open();

        cy.get(datatest('img-rotation-empty')).should('be.visible');

        // T
        operations.mode.piece.spawn.T();
        operations.mode.piece.rotateToRight();

        cy.get(datatest('img-rotation-right')).should('be.visible');

        operations.mode.piece.rotateToLeft();

        cy.get(datatest('img-rotation-spawn')).should('be.visible');

        operations.mode.piece.rotateToLeft();

        cy.get(datatest('img-rotation-left')).should('be.visible');

        operations.mode.piece.rotateToLeft();

        cy.get(datatest('img-rotation-reverse')).should('be.visible');

        operations.mode.piece.rotateToLeft();

        cy.get(datatest('img-rotation-right')).should('be.visible');

        // 次のページ
        operations.mode.tools.nextPage();

        cy.get(datatest('img-rotation-empty')).should('be.visible');

        // O
        operations.mode.piece.spawn.O();

        cy.get(datatest('img-rotation-spawn')).should('be.visible');

        operations.mode.piece.rotateToRight();

        cy.get(datatest('img-rotation-spawn')).should('be.visible');

        operations.mode.piece.rotateToRight();

        cy.get(datatest('img-rotation-spawn')).should('be.visible');

        operations.mode.piece.rotateToRight();

        cy.get(datatest('img-rotation-spawn')).should('be.visible');

        operations.mode.piece.rotateToRight();

        cy.get(datatest('img-rotation-spawn')).should('be.visible');

        // 前のページ
        operations.mode.tools.backPage();

        cy.get(datatest('img-rotation-right')).should('be.visible');
    });

    it('180 rotation is only available with SRS+ rotation system', () => {
        visit({ mode: 'edit' });

        operations.mode.piece.open();
        operations.mode.piece.draw();

        minoPosition(Piece.T, Rotation.Spawn)(3, 3).forEach(position => {
            operations.mode.block.click(position[0], position[1]);
        });

        cy.get(datatest('img-rotation-spawn')).should('be.visible');

        // 180 rotation remains a keyboard action rather than a context-tray button.
        cy.get(datatest('tray-piece-rotate-left')).should('be.visible');
        cy.get(datatest('tray-piece-rotate-right')).should('be.visible');

        // Switch to SRS+ (TETR.IO)
        operations.menu.setRotationSystem('srsPlus');

        operations.mode.piece.rotateTo180();

        cy.get(datatest('img-rotation-reverse')).should('be.visible');

        operations.mode.piece.rotateTo180();

        cy.get(datatest('img-rotation-spawn')).should('be.visible');

        // Switching back to guideline SRS keeps the tray limited to left/right rotation.
        operations.menu.setRotationSystem('srs');

        cy.get(datatest('tray-piece-rotate-left')).should('be.visible');
        cy.get(datatest('tray-piece-rotate-right')).should('be.visible');
    });

    it('Spawn guideline piece', () => {
        visit({ mode: 'edit' });

        operations.mode.piece.open();

        operations.mode.piece.spawn.T();
        operations.mode.piece.harddrop();

        operations.mode.piece.spawn.S();
        operations.mode.piece.harddrop();

        operations.mode.piece.spawn.Z();
        operations.mode.piece.harddrop();

        operations.mode.piece.spawn.I();
        operations.mode.piece.harddrop();

        operations.mode.piece.spawn.L();
        operations.mode.piece.harddrop();

        operations.mode.piece.spawn.J();
        operations.mode.piece.harddrop();

        operations.mode.piece.spawn.O();
        operations.mode.piece.harddrop();

        expectFumen('v115@vhGVQJXBJU3IRyIStIWjITZI');
    });

    it('Spawn classic piece', () => {
        visit({ fumen: 'v115@vhAAAA', mode: 'edit' });

        // Rotation system is a global user setting, so classic behavior must be selected explicitly.
        operations.menu.setRotationSystem('classic');

        operations.mode.piece.open();

        operations.mode.piece.spawn.T();
        operations.mode.piece.harddrop();

        operations.mode.piece.spawn.S();
        operations.mode.piece.harddrop();

        operations.mode.piece.spawn.Z();
        operations.mode.piece.harddrop();

        operations.mode.piece.spawn.I();
        operations.mode.piece.harddrop();

        operations.mode.piece.spawn.L();
        operations.mode.piece.harddrop();

        operations.mode.piece.spawn.J();
        operations.mode.piece.harddrop();

        operations.mode.piece.spawn.O();
        operations.mode.piece.harddrop();

        expectFumen('v115@vhGFrBHhBEXBRSBCIBG+AD0A');
    });

    it('Spawn: usecase 1', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();

        {
            operations.mode.piece.spawn.I();
            operations.mode.piece.harddrop();
        }

        {
            operations.mode.piece.spawn.Z();
            operations.mode.piece.harddrop();
        }

        {
            operations.mode.piece.spawn.L();
            operations.mode.piece.rotateToRight();
            operations.mode.piece.moveToLeftEnd();
            operations.mode.piece.harddrop();
        }

        {
            operations.mode.piece.spawn.O();
            operations.mode.piece.moveToRightEnd();
            operations.mode.piece.harddrop();
        }

        {
            operations.mode.piece.spawn.S();
            operations.mode.piece.moveToRightEnd();
            operations.mode.piece.rotateToLeft();
            operations.mode.piece.moveToLeft();
            operations.mode.piece.harddrop();
        }

        {
            operations.mode.piece.spawn.T();
            operations.mode.piece.moveToLeftEnd();
            operations.mode.piece.rotateToRight();
            operations.mode.piece.harddrop();
            operations.mode.piece.rotateToRight();
        }

        {
            operations.mode.piece.spawn.J();
            operations.mode.piece.moveToRightEnd();
            operations.mode.piece.harddrop();
        }

        expectFumen('v115@vhGRQJUGJKJJTNJ/MJFKJWSJ');
    });


    it('Reset', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.draw();

        // Piece actions that need a placed piece start disabled.
        cy.get(datatest('tray-piece-drag')).should('be.disabled');
        cy.get(datatest('tray-piece-rotate-right')).should('be.disabled');
        cy.get(datatest('tray-piece-rotate-left')).should('be.disabled');
        cy.get(datatest('tray-piece-drop')).should('be.disabled');

        operations.mode.block.click(5, 5);

        // SPAWN creates lastMino immediately and switches to DRAG.
        cy.get(datatest('tray-piece-drag')).should('not.be.disabled');
        cy.get(datatest('tray-piece-rotate-right')).should('not.be.disabled');
        cy.get(datatest('tray-piece-rotate-left')).should('not.be.disabled');
        cy.get(datatest('tray-piece-drop')).should('not.be.disabled');

        operations.mode.piece.resetPiece();

        operations.mode.piece.spawn.Z();

        // A spawned piece enables drag, rotation, and drop.
        cy.get(datatest('tray-piece-drag')).should('not.be.disabled');
        cy.get(datatest('tray-piece-rotate-right')).should('not.be.disabled');
        cy.get(datatest('tray-piece-rotate-left')).should('not.be.disabled');
        cy.get(datatest('tray-piece-drop')).should('not.be.disabled');

        operations.mode.piece.resetPiece();

        // Reset disables the placed-piece operations again.
        cy.get(datatest('tray-piece-drag')).should('be.disabled');
        cy.get(datatest('tray-piece-rotate-right')).should('be.disabled');
        cy.get(datatest('tray-piece-rotate-left')).should('be.disabled');
        cy.get(datatest('tray-piece-drop')).should('be.disabled');
    });

    it('Inference', () => {
        visit({ mode: 'edit' });
        operations.mode.tools.home();
        cy.get(datatest('btn-piece-inference')).click();

        operations.mode.block.click(5, 5);

        cy.get(block(5, 5)).should('have.attr', 'color', Color.Completion.Highlight2);

        // 消えない
        cy.get(datatest('btn-select-mode')).click();

        cy.get(block(5, 5)).should('have.attr', 'color', Color.Completion.Highlight2);

        // 消えない
        cy.get(datatest('btn-piece-mode')).click();

        cy.get(block(5, 5)).should('have.attr', 'color', Color.Completion.Highlight2);

        // 消える
        operations.mode.piece.spawn.T();

        cy.get(block(5, 5)).should('not.have.attr', 'color', Color.Completion.Highlight2);
    });

    it('Split inference', () => {
        visit({ mode: 'edit' });
        operations.mode.tools.home();
        cy.get(datatest('btn-piece-inference')).click();

        const positions = minoPosition(Piece.L, Rotation.Spawn)(4, 5);
        positions.forEach(position => operations.mode.block.click(position[0], position[1]));
        positions.forEach(position => {
            cy.get(block(position[0], position[1])).should('have.attr', 'color', Color.L.Highlight2);
        });

        operations.mode.block.click(positions[0][0], positions[0][1]);
        cy.get(block(positions[0][0], positions[0][1])).should('not.have.attr', 'color', Color.L.Highlight2);
    });

    it('Swap current piece', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.spawn.Z();
        operations.mode.piece.harddrop();
        operations.mode.piece.spawn.J();
        operations.mode.piece.harddrop();
        operations.mode.piece.spawn.J();

        cy.get(datatest('text-pages')).should('contain', '3 / 3');
        cy.get(datatest('img-rotation-spawn')).should('be.visible');
    });
});
