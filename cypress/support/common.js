import { operations } from './operations';

export const HighlightType = {
    Normal: 'Normal',
    Highlight1: 'Highlight1',
    Highlight2: 'Highlight2',
    Lighter: 'Lighter',
};

export const Color = {
    Completion: {
        [HighlightType.Normal]: '#ffffff',
        [HighlightType.Highlight1]: '#ffffff',
        [HighlightType.Highlight2]: '#ffffff',
        [HighlightType.Lighter]: '#ffffff',
    },
    Gray: {
        [HighlightType.Normal]: '#999999',
        [HighlightType.Highlight1]: '#cccccc',
        [HighlightType.Highlight2]: '#ffffff',
        [HighlightType.Lighter]: '#333333',
    },
    I: {
        [HighlightType.Normal]: '#009999',
        [HighlightType.Highlight1]: '#33cccc',
        [HighlightType.Highlight2]: '#00ffff',
        [HighlightType.Lighter]: '#003333',
    },
    T: {
        [HighlightType.Normal]: '#990099',
        [HighlightType.Highlight1]: '#cc33cc',
        [HighlightType.Highlight2]: '#ff00ff',
        [HighlightType.Lighter]: '#4d004d',
    },
    S: {
        [HighlightType.Normal]: '#009900',
        [HighlightType.Highlight1]: '#33cc33',
        [HighlightType.Highlight2]: '#00ff00',
        [HighlightType.Lighter]: '#003300',
    },
    Z: {
        [HighlightType.Normal]: '#990000',
        [HighlightType.Highlight1]: '#cc3333',
        [HighlightType.Highlight2]: '#ff0000',
        [HighlightType.Lighter]: '#4d0000',
    },
    L: {
        [HighlightType.Normal]: '#996600',
        [HighlightType.Highlight1]: '#cc9933',
        [HighlightType.Highlight2]: '#ff9900',
        [HighlightType.Lighter]: '#3b1d00',
    },
    J: {
        [HighlightType.Normal]: '#0000BB',
        [HighlightType.Highlight1]: '#3333cc',
        [HighlightType.Highlight2]: '#0000ff',
        [HighlightType.Lighter]: '#000061',
    },
    O: {
        [HighlightType.Normal]: '#999900',
        [HighlightType.Highlight1]: '#cccc33',
        [HighlightType.Highlight2]: '#ffff00',
        [HighlightType.Lighter]: '#333300',
    },
    Empty: {
        [HighlightType.Normal]: '#000000',
        [HighlightType.Highlight1]: '#000000',
        [HighlightType.Highlight2]: '#000000',
        [HighlightType.Lighter]: '#000000',
    },
};

export const ClassicColor = {
    Completion: Color.Completion,
    Gray: Color.Gray,
    I: Color.Z,
    T: Color.I,
    S: Color.T,
    Z: Color.S,
    L: Color.L,
    J: Color.J,
    O: Color.O,
    Empty: Color.Empty,
};

export const Piece = {
    Empty: '0',
    I: '1',
    L: '2',
    O: '3',
    Z: '4',
    T: '5',
    J: '6',
    S: '7',
    Gray: '8',
};

export const Rotation = {
    Spawn: 'Spawn',
    Reverse: 'Reverse',
    Left: 'Left',
    Right: 'Right',
};

export const datatest = value => `[datatest="${value}"]`;

export const block = (x, y) => datatest(`block-${x}-${y}`);
export const sentBlock = (x) => datatest(`sent-block-${x}-0`);

export const mino = (piece, rotation) => {
    let blocks = getPieces(piece);
    switch (rotation) {
    case Rotation.Spawn:
        break;
    case Rotation.Reverse:
        blocks = blocks.map(current => [-current[0], -current[1]]);
        break;
    case Rotation.Left:
        blocks = blocks.map(current => [-current[1], current[0]]);
        break;
    case Rotation.Right:
        blocks = blocks.map(current => [current[1], -current[0]]);
        break;
    }

    return (x, y) => {
        return blocks.map(current => [current[0] + x, current[1] + y]).map(current => block(...current));
    };
};

export const minoPosition = (piece, rotation) => {
    let blocks = getPieces(piece);
    switch (rotation) {
    case Rotation.Spawn:
        break;
    case Rotation.Reverse:
        blocks = blocks.map(current => [-current[0], -current[1]]);
        break;
    case Rotation.Left:
        blocks = blocks.map(current => [-current[1], current[0]]);
        break;
    case Rotation.Right:
        blocks = blocks.map(current => [current[1], -current[0]]);
        break;
    }

    return (x, y) => {
        return blocks.map(current => [current[0] + x, current[1] + y]);
    };
};

const getPieces = (piece) => {
    switch (piece) {
    case Piece.I:
        return [[0, 0], [-1, 0], [1, 0], [2, 0]];
    case Piece.T:
        return [[0, 0], [-1, 0], [1, 0], [0, 1]];
    case Piece.O:
        return [[0, 0], [1, 0], [0, 1], [1, 1]];
    case Piece.L:
        return [[0, 0], [-1, 0], [1, 0], [1, 1]];
    case Piece.J:
        return [[0, 0], [-1, 0], [1, 0], [-1, 1]];
    case Piece.S:
        return [[0, 0], [-1, 0], [0, 1], [1, 1]];
    case Piece.Z:
        return [[0, 0], [1, 0], [0, 1], [-1, 1]];
    }
};

// In headless Electron, `document.execCommand('copy')` fails and the clipboard
// flow raises a "Failed to copy: command error" toast (see src/components/modals/clipboard.tsx).
// That toast lingers and can cover click targets, causing cross-spec flakes. Stub copy/cut to
// succeed so the app takes its normal "Copied to clipboard" path. Tests that need the real failure
// can pass `stubClipboard: false` to visit().
export const stubClipboardCopy = (win) => {
    const document = win.document;
    if (document.execCommand && document.execCommand.__fumenClipboardStub) {
        return;
    }

    const originalExecCommand = document.execCommand.bind(document);
    const execCommand = (commandId, ...args) => {
        if (typeof commandId === 'string' && /^(copy|cut)$/i.test(commandId)) {
            return true;
        }
        return originalExecCommand(commandId, ...args);
    };

    // Use an own property so the stub also replaces the browser's prototype method in
    // Electron, where a plain assignment can be ignored for some document implementations.
    Object.defineProperty(execCommand, '__fumenClipboardStub', { value: true });
    try {
        Object.defineProperty(document, 'execCommand', {
            configurable: true,
            value: execCommand,
        });
    } catch (error) {
        // Keep compatibility with browsers that expose execCommand as an assignable
        // property only, while the normal Electron path uses defineProperty above.
        document.execCommand = execCommand;
    }
};

// The side menu and every dialog (clipboard, append, open, ...) are Materialize M.Modal instances,
// whose open/close are anime.js-driven (default in/out 250ms each). expectFumen() opens the menu and
// the clipboard modal on every call, so Cypress spends most of the suite waiting for those animations
// to settle. Zeroing the shared M.Modal duration defaults makes every modal settle in a single frame,
// which keeps Cypress's animation wait (left enabled, so clicks still land on settled elements) but
// removes the wait time. No coverage is lost: nothing asserts on animation. Re-applied on every visit
// because cy.reload()/fresh load reloads materialize and resets the defaults to 250ms.
export const disableModalAnimations = (win) => {
    const modal = win.M && win.M.Modal;
    if (modal && modal.defaults) {
        modal.defaults.inDuration = 0;
        modal.defaults.outDuration = 0;
    }
    const toast = win.M && win.M.Toast;
    if (toast && toast.defaults) {
        toast.defaults.inDuration = 0;
        toast.defaults.outDuration = 0;
    }
};

export const visit = (
    {
        fumen, sleepInMill = 200, lng = 'en', mode = 'readonly', mobile = true, reload = false,
        stubClipboard = true, flagsHidden = undefined,
    },
) => {
    let baseUrl = 'fumen-mobile-fork/#';

    if (mode !== 'readonly') {
        baseUrl += `/${mode}`;
    }

    const params = {};

    if (fumen) {
        params.d = fumen;
    }

    if (lng) {
        params.lng = lng;
    }

    if (mobile) {
        params.mobile = 1;
    }

    const applyFlagsHidden = (win) => {
        if (flagsHidden === undefined) {
            return;
        }
        let settings = {};
        try {
            settings = JSON.parse(win.localStorage.getItem('user-settings@1') || '{}');
        } catch (error) {
            settings = {};
        }
        win.localStorage.setItem('user-settings@1', JSON.stringify({ ...settings, flagsHidden }));
    };

    const beforeLoad = (win) => {
        if (stubClipboard) {
            stubClipboardCopy(win);
        }
        applyFlagsHidden(win);
    };

    // Keep direct cy.reload() calls covered as well; onBeforeLoad below handles the initial
    // visit explicitly, and the idempotent setup makes the two hooks safe together.
    if (stubClipboard) {
        cy.on('window:before:load', stubClipboardCopy);
    }

    if (params) {
        const query = Object.entries(params).map(value => value[0] + '=' + value[1]).join('&');
        if (stubClipboard || flagsHidden !== undefined) {
            cy.visit(baseUrl + '?' + query, { onBeforeLoad: beforeLoad });
        } else {
            cy.visit(baseUrl + '?' + query);
        }
    } else {
        if (stubClipboard || flagsHidden !== undefined) {
            cy.visit(baseUrl, { onBeforeLoad: beforeLoad });
        } else {
            cy.visit(baseUrl);
        }
    }

    if (reload) {
        cy.reload();
    }

    // The app restores user settings during its bootstrap. Re-apply the explicit test
    // fixture after the first render and reload once so the setting is also covered on
    // browsers that do not deliver the initial beforeLoad callback consistently.
    if (flagsHidden !== undefined && !reload) {
        cy.window().then(applyFlagsHidden);
        cy.reload();
    }

    cy.window().then((win) => {
        if (stubClipboard) {
            // Apply again after cy.reload(), and keep the setup deterministic even if the
            // browser does not deliver window:before:load to the spec event listener.
            stubClipboardCopy(win);
        }
        disableModalAnimations(win);
    });

    // Field renders a fixed 10x23 grid of <param datatest="block-x-y"> elements (see
    // src/components/field.tsx) on both readonly and edit screens regardless of fumen
    // content, so waiting for block-0-0 to exist covers app boot + fumen decode + initial
    // render with a real assertion instead of a blind sleep. It's a non-visible Konva-backed
    // element, so `exist` (not `be.visible`) is the right check. The remaining sleepInMill
    // covers startup work that doesn't show up in the DOM (i18n init, localStorage restore,
    // initial resize), so it is shortened rather than removed.
    cy.get(datatest('block-0-0'), { timeout: 10000 }).should('exist');
    cy.wait(sleepInMill);
};

export const rightTap = (first, second) => {
    let count, callback;
    if (typeof first === 'number') {
        count = first;
        callback = second;
    } else {
        count = 1;
        callback = first;
    }

    for (let i = 0; i < count; i += 1) {
        if (0 < i) cy.wait(40);
        cy.get('body').click(300, 300);
    }

    cy.wait(80);

    if (callback) callback();
};

export const leftTap = (first, second = undefined) => {
    let count, callback;
    if (typeof first === 'number') {
        count = first;
        callback = second;
    } else {
        count = 1;
        callback = first;
    }

    for (let i = 0; i < count; i += 1) {
        if (0 < i) cy.wait(40);
        cy.get('body').click(100, 300);
    }

    cy.wait(80);

    if (callback) callback();
};

export const pages = (max) => {
    return (page) => {
        return `${page} / ${max}`;
    };
};

export const holdBox = () => {
    return datatest('box-hold');
};

export const nextBox = (index) => {
    return datatest(`box-next-${index}`);
};

export const expectFumen = (fumen) => {
    operations.menu.copyToClipboard();
    // The assertion below retries up to the default command timeout, so no fixed wait is needed
    // for the copied-fumen-data attribute to settle.
    cy.get(datatest('copied-fumen-data')).should('have.attr', 'data', fumen);
    // No dismissing tap here: copyToClipboard() already closes the clipboard modal via
    // btn-clipboard-cancel, so the editor is fully interactive again. A trailing rightTap()
    // (body click at 300,300) used to land on the "L" piece button of the drawing-tool palette
    // after the fork's UI rework, silently selecting L as mode.piece. That corrupted later
    // operations whose default piece must stay unset (e.g. Fill row defaults to Gray, drawing-tool
    // Flags 2), producing deterministic fumen/color mismatches. See docs/e2e-ci-failure-investigation.md.
};
