import { block, ClassicColor, Color, rightTap, visit } from '../support/common';
import { operations } from '../support/operations';

describe('Color', () => {
    it('Guide line color', () => {
        cy.clearLocalStorage();

        visit({
            fumen: 'v115@9gQ4g0wwAtQpglB8AewhQ4g0wwAtQpglB8AewhQ4g0?wwAtQpglB8AewhQ4g0wwAtQpglB8AewhJeJDnvhAJjB',
        });

        // Lockなし
        {
            // 1段目
            cy.get(block(7, 0)).should('have.attr', 'color', Color.Gray.Normal);
            cy.get(block(9, 0)).should('have.attr', 'color', Color.I.Normal);

            // 2段目
            cy.get(block(7, 1)).should('have.attr', 'color', Color.Gray.Normal);
            cy.get(block(8, 1)).should('have.attr', 'color', Color.I.Highlight2);
            cy.get(block(9, 1)).should('have.attr', 'color', Color.I.Normal);
        }

        cy.wait(500);
        rightTap();

        // Lockあり
        {
            // 1段目
            cy.get(block(7, 0)).should('have.attr', 'color', Color.Gray.Normal);
            cy.get(block(9, 0)).should('have.attr', 'color', Color.I.Normal);

            // 2段目
            cy.get(block(7, 1)).should('have.attr', 'color', Color.Gray.Highlight1);
            cy.get(block(8, 1)).should('have.attr', 'color', Color.I.Highlight2);
            cy.get(block(9, 1)).should('have.attr', 'color', Color.I.Highlight1);
        }
    });

    it('Classic color', () => {
        cy.clearLocalStorage();

        visit({
            fumen: 'v115@9gQ4g0wwAtQpglB8AewhQ4g0wwAtQpglB8AewhQ4g0?wwAtQpglB8AewhQ4g0wwAtQpglB8AewhJeJjfvhAJjB',
        });

        operations.menu.setRotationSystem('classic');

        // Lockなし
        {
            // 1段目
            cy.get(block(7, 0)).should('have.attr', 'color', ClassicColor.Gray.Normal);
            cy.get(block(9, 0)).should('have.attr', 'color', ClassicColor.I.Normal);

            // 2段目
            cy.get(block(7, 1)).should('have.attr', 'color', ClassicColor.Gray.Normal);
            cy.get(block(8, 1)).should('have.attr', 'color', ClassicColor.I.Highlight2);
            cy.get(block(9, 1)).should('have.attr', 'color', ClassicColor.I.Normal);
        }

        cy.wait(500);
        rightTap();

        // Lockあり
        {
            // 1段目
            cy.get(block(7, 0)).should('have.attr', 'color', ClassicColor.Gray.Normal);
            cy.get(block(9, 0)).should('have.attr', 'color', ClassicColor.I.Normal);

            // 2段目
            cy.get(block(7, 1)).should('have.attr', 'color', ClassicColor.Gray.Highlight1);
            cy.get(block(8, 1)).should('have.attr', 'color', ClassicColor.I.Highlight2);
            cy.get(block(9, 1)).should('have.attr', 'color', ClassicColor.I.Highlight1);
        }
    });

    it('Rotation system keeps the palette in sync', () => {
        cy.clearLocalStorage();

        visit({
            mode: 'edit',
            fumen: 'v115@9gQ4g0wwAtQpglB8AewhQ4g0wwAtQpglB8AewhQ4g0?wwAtQpglB8AewhQ4g0wwAtQpglB8AewhJeJDnvhAJjB',
        });

        operations.menu.setRotationSystem('classic');
        cy.get(block(9, 0)).should('have.attr', 'color', ClassicColor.I.Normal);

        operations.menu.setRotationSystem('srs');
        cy.get(block(9, 0)).should('have.attr', 'color', Color.I.Normal);

        operations.menu.setRotationSystem('srsPlus');
        cy.get(block(9, 0)).should('have.attr', 'color', Color.I.Normal);
    });
});
