import { block, Color, datatest, expectFumen, mino, minoPosition, Piece, Rotation, visit } from '../support/common';
import { operations } from '../support/operations';

// テト譜を開く
describe('Put pieces', () => {
    it('combines keyboard movement and rotation while both keys are held', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();

        cy.get('body').trigger('keydown', { code: 'ArrowLeft' });
        cy.get('body').trigger('keydown', { code: 'KeyX' });
        cy.get('body').trigger('keyup', { code: 'KeyX' });
        cy.get('body').trigger('keyup', { code: 'ArrowLeft' });

        cy.get(datatest('img-rotation-right')).should('be.visible');
        mino(Piece.T, Rotation.Right)(3, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.T.Highlight2);
        });
    });

    it('combines touch movement and rotation with independent pointers', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();

        cy.get(datatest('tray-piece-move-left'))
            .trigger('pointerdown', { pointerId: 1, button: 0 });
        cy.get(datatest('tray-piece-rotate-right'))
            .trigger('pointerdown', { pointerId: 2, button: 0 });
        cy.get(datatest('tray-piece-rotate-right'))
            .trigger('pointerup', { pointerId: 2, button: 0 });
        cy.get(datatest('tray-piece-move-left'))
            .trigger('pointerup', { pointerId: 1, button: 0 });

        cy.get(datatest('img-rotation-right')).should('be.visible');
        mino(Piece.T, Rotation.Right)(3, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.T.Highlight2);
        });
    });

    it('uses DAS Cut to skip DAS when a held direction meets a new spawn', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();

        cy.clock();
        cy.get('body').trigger('keydown', { code: 'ArrowLeft' });
        cy.tick(200);
        operations.mode.tools.nextPage();
        operations.mode.piece.spawn.T();
        cy.get('body').trigger('keyup', { code: 'ArrowLeft' });

        mino(Piece.T, Rotation.Spawn)(2, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.T.Highlight2);
        });
    });

    it('applies ARR=0 DAS Cut to a queued spawn when DCD is zero', () => {
        visit({ mode: 'edit' });
        operations.menu.openUserSettings();
        operations.menu.selectUserSettingsTab('piece');
        cy.get(datatest('input-piece-arr')).clear().type('0').blur();
        cy.get(datatest('input-piece-das')).clear().type('5').blur();
        cy.get(datatest('input-piece-dcd')).clear().type('0').blur();
        cy.get(datatest('btn-save')).click();

        operations.mode.comment.open();
        cy.get(datatest('text-comment')).clear().type('T:J');
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();

        cy.clock();
        cy.get('body').trigger('keydown', { code: 'ArrowLeft' });
        cy.tick(5 * (1000 / 60));
        operations.mode.piece.harddrop();

        cy.get(datatest('text-pages')).should('contain', '2 / 2');
        mino(Piece.J, Rotation.Spawn)(1, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.J.Highlight2);
        });
        cy.get('body').trigger('keyup', { code: 'ArrowLeft' });
    });

    it('keeps a touch direction held while hard-dropping with another pointer', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();

        cy.clock();
        cy.get(datatest('tray-piece-move-left'))
            .trigger('pointerdown', { pointerId: 1, pointerType: 'touch', button: 0 });
        cy.tick(200);
        cy.get(datatest('tray-piece-harddrop'))
            .trigger('pointerdown', { pointerId: 2, pointerType: 'touch', button: 0 })
            .trigger('pointerup', { pointerId: 2, pointerType: 'touch', button: 0 });
        // Page transition can cancel the captured pointer without lifting the finger.
        cy.get(datatest('tray-piece-move-left'))
            .trigger('pointercancel', { pointerId: 1, pointerType: 'touch' });
        operations.mode.piece.spawn.T();
        cy.tick(2 * (1000 / 60));

        mino(Piece.T, Rotation.Spawn)(0, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.T.Highlight2);
        });
        cy.get(datatest('tray-piece-move-left'))
            .trigger('pointerup', { pointerId: 1, pointerType: 'touch', button: 0 });
    });

    it('exposes the DAS Cut setting in piece settings', () => {
        visit({ mode: 'edit' });
        operations.menu.openUserSettings();
        operations.menu.selectUserSettingsTab('piece');

        cy.get(datatest('input-piece-dcd'))
            .should('have.value', '0');
    });

    it('Hard drop advances to the next page and reset re-spawns the piece', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.piece.spawn.O();

        cy.get(datatest('tray-piece-harddrop')).should('not.be.disabled');
        operations.mode.piece.harddrop();
        cy.get(datatest('text-pages')).should('contain', '2 / 2');
        cy.get(datatest('img-rotation-empty')).should('be.visible');
        operations.mode.piece.resetPiece();
        cy.get(datatest('tray-piece-harddrop')).should('not.be.disabled');
        cy.get(datatest('img-rotation-spawn')).should('be.visible');
    });

    it('RESET clears the painted field and current piece', () => {
        visit({ mode: 'edit' });
        operations.mode.tools.home();
        operations.mode.block.T();
        operations.mode.block.click(0, 0);
        operations.mode.piece.open();
        operations.mode.piece.spawn.O();

        operations.mode.piece.resetBoard();

        cy.get(datatest('img-rotation-empty')).should('be.visible');
        cy.get(block(0, 0)).should('not.have.attr', 'color', Color.T.Normal);
    });

    it('RESET replaces an enabled infinite 7bag with current plus six next pieces', () => {
        visit({ mode: 'edit' });
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).clear().type('#Q=[T](S)IOLJSZ').blur();
        operations.mode.piece.open();
        operations.mode.piece.toggleInfiniteQueue();
        operations.mode.piece.resetBoard();

        operations.mode.comment.open();
        cy.get(datatest('text-comment')).invoke('val').should('match', /^#Q=\[\]\([IOTLJSZ]\)([IOTLJSZ]{6})$/)
            .then(comment => {
                const matched = /^#Q=\[\]\(([IOTLJSZ])\)([IOTLJSZ]{6})$/.exec(comment);
                expect(matched).to.not.equal(null);
                expect(`${matched[1]}${matched[2]}`).to.have.length(7);
                expect(`${matched[1]}${matched[2]}`.split('').sort().join('')).to.equal('IJLOSTZ');
            });
    });

    it('spawns the first configured next piece after hard drop', () => {
        visit({ mode: 'edit' });
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).clear().type('T:JIOTSL');
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();

        operations.mode.piece.harddrop();

        cy.get(datatest('text-pages')).should('contain', '2 / 2');
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).should('have.value', '#Q=[T](J)IOTSL');
        mino(Piece.J, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.J.Highlight2);
        });
    });

    it('adds one 7bag when enabling infinite queue with a short existing queue', () => {
        visit({ mode: 'edit' });
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).clear().type('T:I');
        operations.mode.piece.open();

        operations.mode.piece.toggleInfiniteQueue();
        cy.get(datatest('piece-queue-infinite-checkbox'))
            .should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('tray-piece-harddrop')).should('not.be.disabled');
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).invoke('val').should('match', /^#Q=\[T\]\(I\)[IOTLJSZ]{7}$/);
        operations.mode.piece.open();
        operations.mode.piece.harddrop();

        operations.mode.comment.open();
        cy.get(datatest('text-comment')).invoke('val').should('match', /^#Q=\[T\]\([IOTLJSZ]\)[IOTLJSZ]{6}$/);
    });

    it('seeds one 7bag and spawns the first one when the queue is empty', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();

        operations.mode.piece.toggleInfiniteQueue();
        cy.get(datatest('piece-queue-infinite-checkbox'))
            .should('have.attr', 'aria-pressed', 'true');
        cy.get(datatest('tray-piece-harddrop')).should('not.be.disabled');
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).invoke('val')
            .should('match', /^#Q=\[\]\([IOTLJSZ]\)[IOTLJSZ]{6}$/);

        operations.mode.piece.open();
        operations.mode.piece.harddrop();
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).invoke('val').then(comment => {
            const matched = /^#Q=\[\]\([IOTLJSZ]\)([IOTLJSZ]+)$/.exec(comment);
            expect(matched).to.not.equal(null);
            expect(matched[1]).to.have.length(12);
            expect(matched[1].slice(-7).split('').sort().join('')).to.equal('IJLOSTZ');
        });
    });

    it('does not replenish an infinite queue while at least seven pieces are known', () => {
        visit({ mode: 'edit' });
        operations.mode.comment.open();
        cy.get(datatest('text-comment')).clear().type('T:IOTLJSZIOTLJSZIOTLJSZ');
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.piece.toggleInfiniteQueue();
        cy.get(datatest('piece-queue-infinite-checkbox'))
            .should('have.attr', 'aria-pressed', 'true');
        operations.mode.piece.harddrop();

        operations.mode.comment.open();
        cy.get(datatest('text-comment')).invoke('val').then(comment => {
            const matched = /^#Q=\[T\]\([IOTLJSZ]\)([IOTLJSZ]+)$/.exec(comment);
            expect(matched).to.not.equal(null);
            // The input has 21 NEXT pieces. Hard drop consumes one, leaving 20;
            // the infinite queue must not append another bag while seven are known.
            expect(matched[1]).to.have.length(20);
        });
    });

    it('Put pieces', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();
        operations.mode.block.click(5, 5);

        cy.get(datatest('tray-piece-harddrop')).should('not.be.disabled');
        mino(Piece.T, Rotation.Spawn)(4, 20).forEach(selector => {
            cy.get(selector).should('have.attr', 'color', Color.T.Highlight2);
        });

        operations.mode.piece.resetPiece();
        cy.get(datatest('tray-piece-harddrop')).should('not.be.disabled');
        operations.mode.piece.harddrop();
        cy.get(datatest('text-pages')).should('contain', '2 / 2');
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

        expectFumen('v115@vhHVQJXBJU3IRyIStIWjITZIAgH');
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

        expectFumen('v115@vhHFrBHhBEXBRSBCIBG+AD0AAAA');
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
        }

        {
            operations.mode.piece.spawn.J();
            operations.mode.piece.moveToRightEnd();
            operations.mode.piece.harddrop();
        }

        expectFumen('v115@vhHRQJUGJKJJTNJ/MJtEJWIJAgH');
    });


    it('Reset and delete spawn mino', () => {
        visit({ mode: 'edit' });
        operations.mode.piece.open();

        // Piece actions that need a placed piece start disabled.
        cy.get(datatest('tray-piece-harddrop')).should('be.disabled');
        cy.get(datatest('tray-piece-rotate-right')).should('be.disabled');
        cy.get(datatest('tray-piece-rotate-left')).should('be.disabled');

        operations.mode.piece.spawn.T();

        // Clicking a palette mino creates it immediately and keeps PIECE active.
        cy.get(datatest('tray-piece-harddrop')).should('not.be.disabled');
        cy.get(datatest('tray-piece-rotate-right')).should('not.be.disabled');
        cy.get(datatest('tray-piece-rotate-left')).should('not.be.disabled');

        // GRAY re-spawns the current mino instead of deleting it.
        operations.mode.piece.resetPiece();
        cy.get(datatest('tray-piece-harddrop')).should('not.be.disabled');

        // EMPTY deletes the spawn mino.
        cy.get(datatest('btn-piece-empty')).click();
        cy.get(datatest('tray-piece-harddrop')).should('be.disabled');
        cy.get(datatest('tray-piece-rotate-right')).should('be.disabled');
        cy.get(datatest('tray-piece-rotate-left')).should('be.disabled');
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
