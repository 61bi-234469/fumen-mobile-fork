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
    const originalExecCommand = win.document.execCommand.bind(win.document);
    win.document.execCommand = (commandId, ...args) => {
        if (typeof commandId === 'string' && /^(copy|cut)$/i.test(commandId)) {
            return true;
        }
        return originalExecCommand(commandId, ...args);
    };
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
};

export const visit = (
    { fumen, sleepInMill = 800, lng = 'en', mode = 'readonly', mobile = true, reload = false, stubClipboard = true },
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

    // Register before visiting so the stub is applied on the initial load and on any cy.reload()
    // below (window:before:load fires for both). Scoped to the current test, so opting out is just
    // a matter of passing stubClipboard: false.
    if (stubClipboard) {
        cy.on('window:before:load', stubClipboardCopy);
    }

    if (params) {
        const query = Object.entries(params).map(value => value[0] + '=' + value[1]).join('&');
        cy.visit(baseUrl + '?' + query);
    } else {
        cy.visit(baseUrl);
    }

    if (reload) {
        cy.reload();
    }

    cy.window().then(disableModalAnimations);

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
    rightTap();
};
