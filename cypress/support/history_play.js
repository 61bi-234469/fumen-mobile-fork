import { datatest, expectFumen, visit } from './common';
import { operations } from './operations';

// expectFumen() drives the menu + clipboard modals, so it is by far the most expensive step.
// play() runs three phases (forward / undo / redo); verifying every step in all three means ~3x
// the expectFumen calls. By default we keep FULL per-step verification on the forward phase (the
// primary "operation -> fumen" correctness check) but reduce undo/redo to a round-trip: undo every
// step back to the initial state and assert it once, then redo every step forward to the final
// state and assert it once. Every undo/redo press is still exercised; what we lose is the per-step
// assertion that each individual undo/redo lands on the exact intermediate fumen.
//
// Pass { fullUndoRedo: true } to keep per-step undo/redo assertions. Used by the representative
// specs that uniquely cover this: the canonical multi-operation walk and the specs whose cases
// have count > 1 (multiple history entries collapsed into one logical undo), where per-step
// grouping correctness is the point.
export const play = (fumen, history, { fullUndoRedo = false } = {}) => {
    const testCases = [
        {
            fumen,
            callback: () => {
                visit({ fumen, reload: true, flagsHidden: false });
                operations.screen.writable();
            },
            count: 0,
        },
    ].concat(history);

    visit({ flagsHidden: false });
    operations.screen.writable();

    // 通常の操作
    for (const testCase of testCases) {
        operations.mode.tools.home();
        testCase.callback();
        expectFumen(testCase.fumen);
    }

    cy.log('undo');

    if (fullUndoRedo) {
        // Undo back to the initial state, asserting every intermediate fumen.
        for (const testCase of testCases.concat().reverse()) {
            expectFumen(testCase.fumen);
            const count = testCase.count !== undefined ? testCase.count : 1;
            for (let i = 0; i < count; i++) {
                operations.mode.tools.undo();
            }
        }

        cy.log('redo');

        for (const testCase of testCases) {
            const count = testCase.count !== undefined ? testCase.count : 1;
            for (let i = 0; i < count; i++) {
                operations.mode.tools.redo();
            }
            expectFumen(testCase.fumen);
        }
        return;
    }

    // 新UIでは1つの論理操作（ピース配置など）が複数の履歴エントリになるため、
    // 回数を数える代わりに、ToolButton が有効なときだけ描画するアイコンを見て
    // 履歴が空になるまで押す。ToolButton は <a> で enable は見た目だけなので、
    // disabled プロパティや固定 wait には依存しない。
    const clickWhileEnabled = (selector) => {
        const button = () => cy.get(datatest(selector)).filter('a').first();
        button().find('i').invoke('text').then((text) => {
            if (text.trim() !== '') {
                button().click();
                clickWhileEnabled(selector);
            }
        });
    };

    clickWhileEnabled('btn-undo');
    expectFumen(testCases[0].fumen);

    cy.log('redo');

    clickWhileEnabled('btn-redo');
    expectFumen(testCases[testCases.length - 1].fumen);
};
